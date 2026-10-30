import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { prepareS3Configuration } from './s3-config';
import type { S3Options } from './s3-config';
import { encodeObjectPath } from './object-storage-path';
import { signS3Put } from './s3-signature';
import { putObject } from './object-storage-request';
import { createObjectStorageUploader } from './object-storage-uploader';
import type { UploadCache } from './upload-cache';
import type { UploadSession } from './share';
import { MarkToGoError } from './i18n';

export function createS3Uploader(
	options: S3Options & { timeoutSeconds: number }, secret: string, cache: UploadCache,
	warn: () => void, signal?: AbortSignal, send: typeof putObject = putObject,
): UploadSession {
	const config = prepareS3Configuration(options);
	if (!secret.trim()) throw new MarkToGoError('s3CredentialsMissing');
	const namespace = createHash('sha256').update(JSON.stringify({ provider: 's3-v4', ...config })).digest('hex');
	return createObjectStorageUploader({ provider: 's3', namespace, timeoutSeconds: options.timeoutSeconds,
		fileError: 's3FileFailed', async prepare(file, name, headers) {
			const objectKey = config.prefix + name;
			const url = new URL(config.endpoint + '/' + encodeObjectPath(objectKey));
			const hash = createHash('sha256');
			for await (const chunk of createReadStream(file)) {
				if (signal?.aborted) throw new MarkToGoError('cancelled');
				hash.update(chunk as Buffer);
			}
			headers.host = url.host;
			headers['x-amz-date'] = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '');
			headers['x-amz-content-sha256'] = hash.digest('hex');
			headers.authorization = signS3Put({ ...config, path: url.pathname, secret, headers });
			return { request: { provider: 's3', hostname: url.hostname, path: url.pathname,
				headers, file }, url: config.publicBaseUrl + '/' + encodeObjectPath(objectKey) };
		},
	}, cache, warn, signal, send);
}
