import { createReadStream } from 'node:fs';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, extname, resolve } from 'node:path';
import { validateImageUrl } from './resources';
import { MarkToGoError } from './i18n';

export const UPLOAD_CACHE_FILE = 'MarkToGo/upload-cache.json';
const FORMAT = 'mark-to-go-upload-cache';
const LEGACY_FORMAT = 'share-ready-upload-cache';
const writes = new Map<string, Promise<void>>();

interface CacheResult {
	url: string;
	reused: boolean;
}

function stableJson(value: unknown): string {
	if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
	if (value !== null && typeof value === 'object') {
		const object = value as Record<string, unknown>;
		return '{' + Object.keys(object).sort().map(key => JSON.stringify(key) + ':' + stableJson(object[key])).join(',') + '}';
	}
	return JSON.stringify(value) ?? 'null';
}

function omit(value: unknown, keys: string[]): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
	return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
}

export function configurationFingerprint(config: Record<string, unknown>): string {
	const bed = omit(config.picBed, []);
	const provider = bed.uploader || bed.current;
	if (typeof provider !== 'string') throw new MarkToGoError('providerInvalid');
	const identity = {
		...omit(config, ['picBed', 'settings', 'uploader', 'debug', 'PICGO_ENV', 'needReload']),
		picBed: { uploader: provider, transformer: bed.transformer ?? 'path',
			config: omit(bed[provider], ['_id', '_configName', '_createdAt', '_updatedAt']) },
		settings: omit(config.settings, ['shortKey', 'server', 'isListeningClipboard', 'showUpdateTip', 'autoStart',
			'manualPageOpen', 'language', 'miniWindowPosition', 'galleryPicBedFilter', 'pasteStyle', 'systemTheme', 'logLevel', 'logPath']),
	};
	// Device paths, GUI state and named-config IDs do not identify the cloud destination.
	// Credentials influence only this fingerprint; their raw values are never saved.
	return createHash('sha256').update(stableJson(identity)).digest('hex');
}

export async function resourceFingerprint(namespace: string, file: string): Promise<string> {
	const hash = createHash('sha256').update(namespace).update('\n').update(extname(file).toLowerCase()).update('\n');
	for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
	return hash.digest('hex');
}

export class UploadCache {
	private readonly inFlight = new Map<string, Promise<CacheResult>>();
	private readonly file: string;

	constructor(file: string) {
		this.file = resolve(file);
	}

	private async read(): Promise<{ exists: boolean; legacy: boolean; entries: Record<string, string> }> {
		let content: string;
		try {
			content = await readFile(this.file, 'utf8');
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { exists: false, legacy: false, entries: {} };
			throw error;
		}
		const record: unknown = JSON.parse(content);
		if (!record || typeof record !== 'object' || !('format' in record) ||
			(record.format !== FORMAT && record.format !== LEGACY_FORMAT) ||
			!('version' in record) || record.version !== 1 ||
			!('entries' in record) || !record.entries || typeof record.entries !== 'object' || Array.isArray(record.entries)) {
			throw new MarkToGoError('cacheFormatInvalid');
		}
		const entries: Record<string, string> = {};
		for (const [key, url] of Object.entries(record.entries)) {
			if (!/^[a-f0-9]{64}$/.test(key) || typeof url !== 'string') throw new MarkToGoError('cacheRecordInvalid');
			entries[key] = validateImageUrl(url);
		}
		return { exists: true, legacy: record.format === LEGACY_FORMAT, entries };
	}

	private enqueue(task: () => Promise<void>): Promise<void> {
		const operation = (writes.get(this.file) ?? Promise.resolve()).catch(() => undefined).then(task);
		writes.set(this.file, operation);
		const cleanup = (): void => { if (writes.get(this.file) === operation) writes.delete(this.file); };
		void operation.then(cleanup, cleanup);
		return operation;
	}

	private async write(entries: Record<string, string>): Promise<void> {
		await mkdir(dirname(this.file), { recursive: true });
		const temporary = this.file + '.' + randomUUID() + '.tmp';
		try {
			const sorted = Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)));
			await writeFile(temporary, JSON.stringify({ format: FORMAT, version: 1, entries: sorted }, null, 2) + '\n',
				{ flag: 'wx', mode: 0o600 });
			await rename(temporary, this.file);
		} finally {
			await unlink(temporary).catch(() => undefined);
		}
	}

	initialize(): Promise<void> {
		return this.enqueue(async () => {
			const cache = await this.read();
			if (!cache.exists || cache.legacy) await this.write(cache.entries);
		});
	}

	clear(): Promise<void> {
		if (this.inFlight.size) throw new MarkToGoError('clearWhileSharing');
		return this.enqueue(() => this.write({}));
	}

	private async get(key: string): Promise<string | undefined> {
		await writes.get(this.file)?.catch(() => undefined);
		// Reload the shared file instead of retaining a stale in-memory snapshot.
		return (await this.read()).entries[key];
	}

	private set(key: string, url: string): Promise<void> {
		return this.enqueue(async () => {
			const { entries } = await this.read();
			await this.write({ ...entries, [key]: url });
		});
	}

	async getOrUpload(key: string, upload: () => Promise<string>, warn: () => void): Promise<CacheResult> {
		if (!/^[a-f0-9]{64}$/.test(key)) throw new MarkToGoError('cacheKeyInvalid');
		const pending = this.inFlight.get(key);
		if (pending) return { url: (await pending).url, reused: true };
		const operation = (async (): Promise<CacheResult> => {
			let readable = true;
			try {
				const url = await this.get(key);
				if (url) return { url, reused: true };
			} catch {
				readable = false;
				warn();
			}
			const url = validateImageUrl(await upload());
			if (readable) {
				try {
					await this.set(key, url);
				} catch {
					warn();
				}
			}
			return { url, reused: false };
		})();
		this.inFlight.set(key, operation);
		try {
			return await operation;
		} finally {
			this.inFlight.delete(key);
		}
	}
}
