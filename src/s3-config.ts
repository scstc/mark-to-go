import { MarkToGoError } from './i18n';
import { validateImageUrl } from './resources';

export interface S3Options {
	s3Region: string;
	s3Bucket: string;
	s3AccessKeyId: string;
	s3SecretName: string;
	s3Prefix: string;
	s3PublicBaseUrl: string;
}

export function prepareS3Configuration(options: S3Options) {
	const region = options.s3Region.trim();
	const bucket = options.s3Bucket.trim();
	if (!/^[a-z]{2}(?:-[a-z]+)+-\d+$/.test(region)) throw new MarkToGoError('s3RegionInvalid');
	if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) || /\.\.|\.-|-\./.test(bucket) ||
		/^\d+\.\d+\.\d+\.\d+$/.test(bucket) || /^(?:xn--|sthree-|amzn-s3-demo-)/.test(bucket) ||
		/(?:-s3alias|--ol-s3|\.mrap|--x-s3|--table-s3)$/.test(bucket)) throw new MarkToGoError('s3BucketInvalid');
	const accessKeyId = options.s3AccessKeyId.trim();
	if (!/^[a-zA-Z0-9]+$/.test(accessKeyId)) throw new MarkToGoError('s3CredentialsMissing');
	const prefix = options.s3Prefix.trim().replace(/^\/+|\/+$/g, '');
	if (Buffer.byteLength(prefix) > 512 || [...prefix].some(character => character.charCodeAt(0) < 32 ||
		character.charCodeAt(0) === 127 || character === '\\') ||
		prefix.split('/').some(part => part === '.' || part === '..')) throw new MarkToGoError('s3PrefixInvalid');
	const suffix = region.startsWith('cn-') ? 'amazonaws.com.cn' : 'amazonaws.com';
	// Dotted buckets require path-style HTTPS to avoid wildcard certificate mismatches.
	const endpoint = bucket.includes('.') ? `https://s3.${region}.${suffix}/${bucket}`
		: `https://${bucket}.s3.${region}.${suffix}`;
	let publicBaseUrl = endpoint;
	if (options.s3PublicBaseUrl.trim()) {
		try {
			const url = new URL(validateImageUrl(options.s3PublicBaseUrl.trim()));
			if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error();
			publicBaseUrl = url.href.replace(/\/+$/, '');
		} catch { throw new MarkToGoError('s3DomainInvalid'); }
	}
	return { region, bucket, accessKeyId, prefix: prefix ? prefix + '/' : '', endpoint, publicBaseUrl };
}
