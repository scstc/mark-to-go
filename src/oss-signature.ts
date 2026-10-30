import { createHash, createHmac } from 'node:crypto';
import { encodeOssPath } from './oss-config';

interface SignatureInput {
	bucket: string;
	region: string;
	objectKey: string;
	accessKeyId: string;
	secret: string;
	headers: Record<string, string>;
	additionalHeaders?: string[];
}

/** OSS V4 differs from S3 V4: its canonical path includes the bucket. */
export function signOssPut(input: SignatureInput): string {
	const headers = Object.fromEntries(Object.entries(input.headers)
		.map(([name, value]) => [name.toLowerCase(), value.trim().replace(/\s+/g, ' ')]));
	const additional = [...(input.additionalHeaders ?? [])].map(name => name.toLowerCase()).sort();
	const names = Object.keys(headers).filter(name => name.startsWith('x-oss-') ||
		name === 'content-type' || name === 'content-md5' || additional.includes(name)).sort();
	const canonical = ['PUT', encodeOssPath('/' + input.bucket + '/' + input.objectKey), '',
		names.map(name => name + ':' + headers[name] + '\n').join(''), additional.join(';'), 'UNSIGNED-PAYLOAD'].join('\n');
	const timestamp = headers['x-oss-date']!;
	const date = timestamp.slice(0, 8);
	const scope = `${date}/${input.region}/oss/aliyun_v4_request`;
	const toSign = ['OSS4-HMAC-SHA256', timestamp, scope, createHash('sha256').update(canonical).digest('hex')].join('\n');
	let key = Buffer.from('aliyun_v4' + input.secret);
	for (const part of [date, input.region, 'oss', 'aliyun_v4_request']) key = createHmac('sha256', key).update(part).digest();
	const signature = createHmac('sha256', key).update(toSign).digest('hex');
	return `OSS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, ` +
		(additional.length ? `AdditionalHeaders=${additional.join(';')}, ` : '') + `Signature=${signature}`;
}
