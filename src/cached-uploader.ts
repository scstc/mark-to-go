import { createPicListSession, readPicListConfig } from './piclist';
import type { PicListOptions } from './piclist';
import type { UploadSession } from './share';
import { configurationFingerprint, resourceFingerprint, UploadCache } from './upload-cache';
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { MarkToGoError } from './i18n';

export async function createCachedUploader(
	options: PicListOptions,
	cache: UploadCache,
	warn: () => void,
	signal?: AbortSignal,
): Promise<UploadSession> {
	const prepared = await readPicListConfig(options);
	const namespace = configurationFingerprint(prepared.config);
	const stats = { uploaded: 0, reused: 0 };
	let session: UploadSession | undefined;
	let directory: string | undefined;
	let index = 0;
	return {
		stats,
		async upload(path: string): Promise<string> {
			directory ??= await mkdtemp(join(tmpdir(), 'mark-to-go-cache-'));
			const staging = join(directory, String(index++));
			await mkdir(staging);
			const copy = join(staging, basename(path));
			// Hash the same immutable input that will be handed to the CLI.
			await copyFile(path, copy);
			const key = await resourceFingerprint(namespace, copy);
			const result = await cache.getOrUpload(key, async () => {
				if (signal?.aborted) throw new MarkToGoError('cancelled');
				session ??= await createPicListSession(options, signal, prepared);
				return session.upload(copy);
			}, warn);
			if (result.reused) stats.reused++;
			else stats.uploaded++;
			return result.url;
		},
		async close(): Promise<void> {
			try {
				await session?.close();
			} finally {
				if (directory) await rm(directory, { recursive: true, force: true });
			}
		},
	};
}
