import { MarkToGoError } from './i18n';
import { validateImageUrl } from './resources';
export { encodeObjectPath as encodeOssPath } from './object-storage-path';

export interface OssOptions {
	ossRegion: string;
	ossBucket: string;
	ossAccessKeyId: string;
	ossSecretName: string;
	ossPrefix: string;
	ossPublicBaseUrl: string;
}

export interface OssConfiguration {
	region: string;
	bucket: string;
	accessKeyId: string;
	prefix: string;
	endpoint: string;
	publicBaseUrl: string;
}

export function prepareOssConfiguration(options: OssOptions): OssConfiguration {
	const region = options.ossRegion.trim();
	const bucket = options.ossBucket.trim();
	if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(region) || region.startsWith('oss-')) {
		throw new MarkToGoError('ossRegionInvalid');
	}
	if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) throw new MarkToGoError('ossBucketInvalid');
	const accessKeyId = options.ossAccessKeyId.trim();
	if (!/^[a-zA-Z0-9]+$/.test(accessKeyId)) throw new MarkToGoError('ossCredentialsMissing');
	const prefix = options.ossPrefix.trim().replace(/^\/+|\/+$/g, '');
	if (Buffer.byteLength(prefix) > 512 || [...prefix].some(character => character.charCodeAt(0) < 32 ||
		character.charCodeAt(0) === 127 || character === '\\') ||
		prefix.split('/').some(part => part === '.' || part === '..')) throw new MarkToGoError('ossPrefixInvalid');
	const endpoint = `https://${bucket}.oss-${region}.aliyuncs.com`;
	let publicBaseUrl = endpoint;
	if (options.ossPublicBaseUrl.trim()) {
		try {
			const url = new URL(validateImageUrl(options.ossPublicBaseUrl.trim()));
			if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error();
			publicBaseUrl = url.href.replace(/\/+$/, '');
		} catch { throw new MarkToGoError('ossDomainInvalid'); }
	}
	return { region, bucket, accessKeyId, prefix: prefix ? prefix + '/' : '', endpoint, publicBaseUrl };
}

