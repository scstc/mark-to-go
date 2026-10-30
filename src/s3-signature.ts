import { createHash, createHmac } from 'node:crypto';

interface S3SignatureInput {
	region: string;
	path: string;
	accessKeyId: string;
	secret: string;
	headers: Record<string, string>;
}

/** S3 SigV4 signs the encoded wire path once, without path normalization. */
export function signS3Put(input: S3SignatureInput): string {
	const headers = Object.fromEntries(Object.entries(input.headers)
		.map(([name, value]) => [name.toLowerCase(), value.trim().replace(/\s+/g, ' ')]));
	const names = Object.keys(headers).filter(name => name !== 'authorization' && name !== 'content-length').sort();
	const signedHeaders = names.join(';');
	const canonical = ['PUT', input.path, '', names.map(name => name + ':' + headers[name] + '\n').join(''),
		signedHeaders, headers['x-amz-content-sha256']!].join('\n');
	const timestamp = headers['x-amz-date']!;
	const date = timestamp.slice(0, 8);
	const scope = `${date}/${input.region}/s3/aws4_request`;
	const toSign = ['AWS4-HMAC-SHA256', timestamp, scope, createHash('sha256').update(canonical).digest('hex')].join('\n');
	let key = Buffer.from('AWS4' + input.secret);
	for (const part of [date, input.region, 's3', 'aws4_request']) key = createHmac('sha256', key).update(part).digest();
	const signature = createHmac('sha256', key).update(toSign).digest('hex');
	return `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}
