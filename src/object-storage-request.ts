import { request } from 'node:https';
import type { ClientRequest, IncomingMessage } from 'node:http';
import { createReadStream } from 'node:fs';
import type { ReadStream } from 'node:fs';
import { MarkToGoError } from './i18n';
import type { MessageKey } from './i18n';
import { setTimeout as scheduleTimeout, clearTimeout as cancelTimeout } from 'node:timers';

export interface ObjectPutRequest {
	provider?: 'oss' | 's3';
	hostname: string;
	path: string;
	headers: Record<string, string>;
	file: string;
	timeoutMs: number;
}

function responseError(status: number, body: string, provider: 'oss' | 's3'): MarkToGoError {
	const code = /<Code>([A-Za-z0-9]+)<\/Code>/.exec(body)?.[1];
	let key: MessageKey = 'ossUploadFailed';
	if (code === 'NoSuchBucket' || status === 404) key = 'ossBucketMissing';
	else if (code === 'RequestTimeTooSkewed') key = 'ossClockSkew';
	else if (code === 'SignatureDoesNotMatch' || code === 'InvalidAccessKeyId') key = 'ossAuthenticationFailed';
	else if (status === 301 || status === 302 || code === 'AuthorizationHeaderMalformed' || code === 'PermanentRedirect') key = 'ossWrongRegion';
	else if (status === 403) key = 'ossAccessDenied';
	return storageError(key, provider);
}

function storageError(key: MessageKey, provider: 'oss' | 's3'): MarkToGoError {
	const s3Errors: Partial<Record<MessageKey, MessageKey>> = {
		ossUploadFailed: 's3UploadFailed', ossBucketMissing: 's3BucketMissing', ossClockSkew: 's3ClockSkew',
		ossAuthenticationFailed: 's3AuthenticationFailed', ossWrongRegion: 's3WrongRegion', ossAccessDenied: 's3AccessDenied',
		ossTimeout: 's3Timeout', ossNetworkFailed: 's3NetworkFailed', ossFileFailed: 's3FileFailed',
	};
	return new MarkToGoError(provider === 's3' ? s3Errors[key] ?? key : key);
}

/** No redirects or retries: credentials are sent only to the configured storage endpoint. */
export async function putObject(
	input: ObjectPutRequest, signal: AbortSignal, makeRequest: typeof request = request,
): Promise<void> {
	const failure = (key: MessageKey): MarkToGoError => storageError(key, input.provider ?? 'oss');
	if (signal.aborted) throw new MarkToGoError('cancelled');
	await new Promise<void>((accept, reject) => {
		let settled = false;
		let outgoing: ClientRequest | undefined;
		let response: IncomingMessage | undefined;
		let stream: ReadStream | undefined;
		const finish = (error?: MarkToGoError): void => {
			if (settled) return;
			settled = true;
			cancelTimeout(timer);
			signal.removeEventListener('abort', abort);
			stream?.destroy();
			response?.destroy();
			outgoing?.destroy();
			const complete = (): void => { if (error) reject(error); else accept(); };
			if (stream && !stream.closed) stream.once('close', complete);
			else complete();
		};
		const abort = (): void => finish(new MarkToGoError('cancelled'));
		const timer = scheduleTimeout(() => finish(failure('ossTimeout')), input.timeoutMs);
		signal.addEventListener('abort', abort, { once: true });
		try {
			outgoing = makeRequest({ hostname: input.hostname, method: 'PUT', path: input.path,
				headers: input.headers }, incoming => {
				response = incoming;
				if (settled) { incoming.destroy(); return; }
				const chunks: Buffer[] = [];
				let length = 0;
				incoming.on('data', (chunk: Buffer) => {
					length += chunk.length;
					if (length > 65536) finish(failure('ossUploadFailed'));
					else chunks.push(chunk);
				});
				incoming.on('error', () => finish(failure('ossNetworkFailed')));
				incoming.on('end', () => {
					const status = incoming.statusCode ?? 0;
					finish(status === 200 ? undefined : responseError(status, Buffer.concat(chunks).toString('utf8'), input.provider ?? 'oss'));
				});
			});
			outgoing.on('error', () => finish(failure('ossNetworkFailed')));
			stream = createReadStream(input.file);
			stream.on('error', () => finish(failure('ossFileFailed')));
			stream.pipe(outgoing);
			if (signal.aborted) abort();
		} catch { finish(failure('ossNetworkFailed')); }
	});
}
