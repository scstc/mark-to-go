import { copyFile, mkdtemp, rm, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { resourceFingerprint } from './upload-cache';
import type { UploadCache } from './upload-cache';
import type { UploadSession } from './share';
import { MarkToGoError } from './i18n';
import type { MessageKey } from './i18n';
import { putObject } from './object-storage-request';
import type { ObjectPutRequest } from './object-storage-request';

const contentTypes: Record<string, string> = {
	'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
	'.webp': 'image/webp', '.svg': 'image/svg+xml', '.bmp': 'image/bmp', '.avif': 'image/avif',
};

interface StorageUploadOptions {
	provider: 'oss' | 's3';
	namespace: string;
	timeoutSeconds: number;
	fileError: MessageKey;
	prepare(file: string, name: string, headers: Record<string, string>): Promise<{ request: Omit<ObjectPutRequest, 'timeoutMs'>; url: string }>;
}

/** Hash and upload the same immutable snapshot, preserving existing OSS cache keys. */
export function createObjectStorageUploader(
	options: StorageUploadOptions, cache: UploadCache, warn: () => void,
	signal?: AbortSignal, send: typeof putObject = putObject,
): UploadSession {
	const stats = { uploaded: 0, reused: 0 };
	const controller = new AbortController();
	const abort = (): void => controller.abort();
	signal?.addEventListener('abort', abort, { once: true });
	if (signal?.aborted) abort();
	const check = (): void => { if (controller.signal.aborted) throw new MarkToGoError('cancelled'); };
	return {
		stats,
		async upload(path) {
			check();
			const directory = await mkdtemp(join(tmpdir(), `mark-to-go-${options.provider}-`));
			try {
				const extension = extname(path).toLowerCase();
				const snapshot = join(directory, 'image' + extension);
				await copyFile(path, snapshot);
				check();
				const digest = await resourceFingerprint(options.provider + '-object-v1', snapshot);
				const key = createHash('sha256').update(options.namespace + '\n' + digest).digest('hex');
				const result = await cache.getOrUpload(key, async () => {
					check();
					const seconds = Number.isFinite(options.timeoutSeconds) ? Math.min(600, Math.max(5, options.timeoutSeconds)) : 120;
					const prepared = await options.prepare(snapshot, digest + extension, {
						'content-type': contentTypes[extension] ?? 'application/octet-stream',
						'content-length': String((await stat(snapshot)).size),
					});
					check();
					await send({ ...prepared.request, timeoutMs: seconds * 1000 }, controller.signal);
					check();
					return prepared.url;
				}, warn);
				check();
				if (result.reused) stats.reused++; else stats.uploaded++;
				return result.url;
			} catch (error) {
				if (error instanceof MarkToGoError) throw error;
				throw new MarkToGoError(options.fileError);
			} finally { await rm(directory, { recursive: true, force: true }); }
		},
		close() {
			signal?.removeEventListener('abort', abort);
			abort();
			return Promise.resolve();
		},
	};
}
