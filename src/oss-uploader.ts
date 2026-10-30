import { createHash } from 'node:crypto';
import { prepareOssConfiguration, encodeOssPath } from './oss-config';
import type { OssOptions } from './oss-config';
import { signOssPut } from './oss-signature';
import { putOssObject } from './oss-request';
import { createObjectStorageUploader } from './object-storage-uploader';
import type { UploadCache } from './upload-cache';
import type { UploadSession } from './share';
import { MarkToGoError } from './i18n';

export function createOssUploader(
	options: OssOptions & { timeoutSeconds: number }, secret: string, cache: UploadCache,
	warn: () => void, signal?: AbortSignal, send: typeof putOssObject = putOssObject,
): UploadSession {
	const config = prepareOssConfiguration(options);
	if (!secret.trim()) throw new MarkToGoError('ossCredentialsMissing');
	const namespace = createHash('sha256').update(JSON.stringify({ provider: 'oss-v4', ...config })).digest('hex');
	return createObjectStorageUploader({ provider: 'oss', namespace, timeoutSeconds: options.timeoutSeconds,
		fileError: 'ossFileFailed', prepare(file, name, headers) {
			const objectKey = config.prefix + name;
			headers['x-oss-date'] = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '');
			headers['x-oss-content-sha256'] = 'UNSIGNED-PAYLOAD';
			headers.authorization = signOssPut({ ...config, objectKey, secret, headers });
			return Promise.resolve({ request: { hostname: new URL(config.endpoint).hostname,
				path: '/' + encodeOssPath(objectKey), headers, file },
				url: config.publicBaseUrl + '/' + encodeOssPath(objectKey) });
		},
	}, cache, warn, signal, send);
}
