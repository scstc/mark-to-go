import { collectImages, replaceImages, validateImageUrl } from './resources';
import { createTranslator, MarkToGoError } from './i18n';
import type { Translator } from './i18n';
import type { ClipboardOutcome } from './clipboard-coordinator';

export interface Resource {
	key: string;
	path: string;
}

export interface UploadSession {
	stats?: { uploaded: number; reused: number };
	upload(path: string): Promise<string>;
	close(): Promise<void>;
}

export interface ShareDependencies {
	translate?: Translator;
	resolve(target: string): Promise<Resource | null>;
	openUploader(): Promise<UploadSession>;
	copy(content: string): Promise<ClipboardOutcome>;
	progress(message: string): void;
	signal?: AbortSignal;
}

export interface ShareResult {
	content: string;
	uploaded: number;
	reused: number;
	clipboardStatus: ClipboardOutcome | 'failed';
}

export async function shareMarkdown(content: string, deps: ShareDependencies): Promise<ShareResult> {
	const t = deps.translate ?? createTranslator('zh');
	const checkCancelled = (): void => {
		if (deps.signal?.aborted) throw new MarkToGoError('cancelled');
	};
	checkCancelled();
	deps.progress(t('checking'));
	const references = collectImages(content);
	const resources = new Map<string, Resource>();
	const keys = new Map<string, string>();
	const missing: string[] = [];
	for (const reference of references) {
		checkCancelled();
		const resource = await deps.resolve(reference.target);
		if (!resource) missing.push(reference.target);
		else {
			keys.set(reference.target, resource.key);
			resources.set(resource.key, resource);
		}
	}
	if (missing.length) throw new MarkToGoError('missingImages', { paths: [...new Set(missing)].join(', ') });
	const urls = new Map<string, string>();
	let uploaded = 0;
	let reused = 0;
	if (resources.size) {
		const uploader = await deps.openUploader();
		try {
			for (const [key, resource] of resources) {
				checkCancelled();
				deps.progress(t('processing', { current: urls.size + 1, total: resources.size }));
				try {
					urls.set(key, validateImageUrl(await uploader.upload(resource.path)));
				} catch (error) {
					if (deps.signal?.aborted) throw new MarkToGoError('cancelled');
					throw new MarkToGoError('uploadFailed', { path: key, completed: urls.size, total: resources.size }, error);
				}
			}
			uploaded = uploader.stats?.uploaded ?? urls.size;
			reused = uploader.stats?.reused ?? 0;
		} finally {
			await uploader.close();
		}
	}
	checkCancelled();
	const exported = replaceImages(content, references, (reference) => {
		const key = keys.get(reference.target);
		const url = key === undefined ? undefined : urls.get(key);
		if (!url) throw new MarkToGoError('incompleteResults');
		return url;
	});
	let clipboardStatus: ShareResult['clipboardStatus'];
	try {
		checkCancelled();
		clipboardStatus = await deps.copy(exported);
	} catch {
		clipboardStatus = 'failed';
	}
	return { content: exported, uploaded, reused, clipboardStatus };
}
