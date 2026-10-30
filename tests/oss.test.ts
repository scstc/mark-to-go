import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer, request } from 'node:http';
import type { RequestOptions, IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import { signOssPut } from '../src/oss-signature.ts';
import { prepareOssConfiguration, encodeOssPath } from '../src/oss-config.ts';
import { putOssObject } from '../src/oss-request.ts';
import type { OssPutRequest } from '../src/oss-request.ts';
import { createOssUploader } from '../src/oss-uploader.ts';
import { UploadCache } from '../src/upload-cache.ts';
import { checkLocalConfiguration } from '../src/local-configuration.ts';
import { shareMarkdown } from '../src/share.ts';

const options = { ossRegion: 'cn-hangzhou', ossBucket: 'examplebucket', ossAccessKeyId: 'exampleAccessKey',
	ossSecretName: 'oss-test-secret', ossPrefix: 'mark-to-go/', ossPublicBaseUrl: '', timeoutSeconds: 120 };

void test('OSS V4 matches the official ali-oss SDK for the documentation example and special object paths', () => {
	// Fixtures independently verified using ali-oss 6.x signUtils.authorizationV4.
	// The documentation replaces the original secret with a placeholder but retains its old signature.
	const authorization = signOssPut({ bucket: 'examplebucket', region: 'cn-hangzhou', objectKey: 'exampleobject',
		accessKeyId: 'exampleAccessKey', secret: 'yourAccessKeySecret', headers: {
			'content-disposition': 'attachment', 'content-length': '3', 'content-md5': 'ICy5YqxZB1uWSwcVLSNLcA==',
			'content-type': 'text/plain', 'x-oss-content-sha256': 'UNSIGNED-PAYLOAD', 'x-oss-date': '20250411T064124Z',
		}, additionalHeaders: ['content-disposition', 'content-length'] });
	assert.equal(authorization, 'OSS4-HMAC-SHA256 Credential=exampleAccessKey/20250411/cn-hangzhou/oss/aliyun_v4_request, ' +
		'AdditionalHeaders=content-disposition;content-length, Signature=d3694c2dfc5371ee6acd35e88c4871ac95a7ba01d3a2f476768fe61218590097');
	assert.equal(signOssPut({ bucket: 'bucket', region: 'cn-hangzhou', objectKey: "中文 图片/a !'()*%.png",
		accessKeyId: 'ak', secret: 'sk', headers: { 'content-type': 'image/png',
			'x-oss-content-sha256': 'UNSIGNED-PAYLOAD', 'x-oss-date': '20261030T010203Z' } }),
	'OSS4-HMAC-SHA256 Credential=ak/20261030/cn-hangzhou/oss/aliyun_v4_request, Signature=dc30ed5894c8b158cd52ff10104c897aff930bb6e4d736c4d2cb448f2591e4be');
});

void test('OSS validates destinations and encodes object paths without allowing CDN settings to redirect credentials', () => {
	const config = prepareOssConfiguration({ ...options, ossPrefix: '/中文 图片/', ossPublicBaseUrl: 'https://cdn.example.com/base/' });
	assert.equal(config.endpoint, 'https://examplebucket.oss-cn-hangzhou.aliyuncs.com');
	assert.equal(config.publicBaseUrl, 'https://cdn.example.com/base');
	assert.equal(config.prefix, '中文 图片/');
	assert.equal(encodeOssPath("中文 图片/a !'()*%.png"), '%E4%B8%AD%E6%96%87%20%E5%9B%BE%E7%89%87/a%20%21%27%28%29%2A%25.png');
	for (const invalid of [
		{ ossRegion: 'oss-cn-hangzhou' }, { ossRegion: 'https://evil.example' }, { ossBucket: 'Bad_Bucket' },
		{ ossPrefix: '../escape' }, { ossPrefix: 'a\\b' }, { ossPrefix: 'a\nb' },
		{ ossPublicBaseUrl: 'https://user:password@example.com' }, { ossPublicBaseUrl: 'https://example.com/?a=b' },
		{ ossPublicBaseUrl: 'http://example.com' }, { ossPublicBaseUrl: 'https://localhost' },
	]) assert.throws(() => prepareOssConfiguration({ ...options, ...invalid }));
});

void test('OSS shares immutable image bytes, reuses uploads across clients, and isolates destinations without persisting secrets', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'mark-to-go-oss-test-'));
	const stages: string[] = [];
	try {
		const image = join(directory, '原图.PNG');
		await writeFile(image, 'original image');
		const cachePath = join(directory, 'cache.json');
		const cache = new UploadCache(cachePath);
		await cache.initialize();
		let requests = 0;
		const send = async (input: OssPutRequest): Promise<void> => {
			requests++;
			stages.push(dirname(input.file));
			await writeFile(image, 'changed while uploading');
			assert.equal(await readFile(input.file, 'utf8'), 'original image');
			assert.equal(input.hostname, 'examplebucket.oss-cn-hangzhou.aliyuncs.com');
			assert.equal(input.headers['content-type'], 'image/png');
			assert.equal(input.headers['content-length'], '14');
			assert.ok(input.headers.authorization?.startsWith('OSS4-HMAC-SHA256 '));
			assert.equal(input.headers['x-oss-object-acl'], undefined);
		};
		const warn = (): void => assert.fail('Unexpected cache warning');
		const uploader = createOssUploader(options, 'secret-never-persist', cache, warn, undefined, send);
		const url = await uploader.upload(image);
		assert.match(url, /^https:\/\/examplebucket\.oss-cn-hangzhou\.aliyuncs\.com\/mark-to-go\/[a-f0-9]{64}\.png$/);
		assert.deepEqual(uploader.stats, { uploaded: 1, reused: 0 });
		await uploader.close();
		await writeFile(image, 'original image');
		const restarted = createOssUploader(options, 'rotated-secret', new UploadCache(cachePath), warn, undefined, send);
		assert.equal(await restarted.upload(image), url);
		assert.deepEqual(restarted.stats, { uploaded: 0, reused: 1 });
		await restarted.close();
		assert.equal(requests, 1);
		const alternate = createOssUploader({ ...options, ossPublicBaseUrl: 'https://cdn.example.com/base' },
			'other-secret', cache, warn, undefined, send);
		assert.match(await alternate.upload(image), /^https:\/\/cdn\.example\.com\/base\/mark-to-go\//);
		await alternate.close();
		assert.equal(requests, 2);
		const persisted = await readFile(cachePath, 'utf8');
		assert.ok(!persisted.includes('secret-never-persist') && !persisted.includes('exampleAccessKey'));
		for (const stage of stages) await assert.rejects(readdir(stage), { code: 'ENOENT' });
	} finally { await rm(directory, { recursive: true, force: true }); }
});

void test('failed and cancelled OSS uploads leave no cache entry or image snapshot', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'mark-to-go-oss-failure-'));
	try {
		const image = join(directory, 'image.png');
		await writeFile(image, 'image');
		const cachePath = join(directory, 'cache.json');
		const cache = new UploadCache(cachePath);
		await cache.initialize();
		let stage = '';
		const controller = new AbortController();
		const uploader = createOssUploader(options, 'secret', cache, () => assert.fail(), controller.signal, async input => {
			stage = dirname(input.file); controller.abort();
		});
		await assert.rejects(uploader.upload(image), { key: 'cancelled' });
		await uploader.close();
		await assert.rejects(readdir(stage), { code: 'ENOENT' });
		assert.deepEqual((JSON.parse(await readFile(cachePath, 'utf8')) as { entries: object }).entries, {});
		const failed = createOssUploader(options, 'secret', cache, () => assert.fail(), undefined, () => Promise.reject(new Error('private detail')));
		await assert.rejects(failed.upload(image), { key: 'ossFileFailed' });
		await failed.close();
		assert.deepEqual((JSON.parse(await readFile(cachePath, 'utf8')) as { entries: object }).entries, {});
	} finally { await rm(directory, { recursive: true, force: true }); }
});

void test('content naming avoids filename collisions and configuration changes cannot reuse another destination', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'mark-to-go-oss-names-'));
	try {
		const image = join(directory, 'same-name.png');
		const renamed = join(directory, 'renamed.png');
		const cache = new UploadCache(join(directory, 'cache.json'));
		await cache.initialize();
		let uploads = 0;
		const send = (): Promise<void> => { uploads++; return Promise.resolve(); };
		const upload = async (configuration = options, path = image): Promise<string> => {
			const session = createOssUploader(configuration, 'secret', cache, () => assert.fail(), undefined, send);
			try { return await session.upload(path); } finally { await session.close(); }
		};
		await writeFile(image, 'first image');
		const first = await upload();
		await writeFile(renamed, 'first image');
		assert.equal(await upload(options, renamed), first);
		assert.equal(uploads, 1);
		await writeFile(image, 'different image with same name');
		assert.notEqual(await upload(), first);
		assert.equal(uploads, 2);
		for (const changed of [{ ossBucket: 'otherbucket' }, { ossRegion: 'cn-shanghai' },
			{ ossPrefix: 'other/' }, { ossAccessKeyId: 'anotherAccount' }]) {
			await upload({ ...options, ...changed });
		}
		assert.equal(uploads, 6);
	} finally { await rm(directory, { recursive: true, force: true }); }
});

void test('OSS local checks never resolve PicList and external-only Markdown never opens any uploader', async () => {
	const settings = { ...options, uploadProvider: 'oss' as const, cliPath: 'invalid', nodePath: 'invalid', configPath: 'invalid', outputDirectory: '' };
	const items = await checkLocalConfiguration(settings, undefined, () => true);
	assert.ok(items.some(item => item.id === 'provider' && item.status === 'ok' && item.message === 'ossLocalCheckReady'));
	assert.ok(items.every(item => item.id !== 'cli' && item.id !== 'node' && item.id !== 'config'));
	const missing = await checkLocalConfiguration(settings);
	assert.ok(missing.some(item => item.message === 'ossCredentialsMissing'));
	const markdown = '![online](https://example.com/image.png)';
	const result = await shareMarkdown(markdown, { resolve: () => assert.fail(), openUploader: () => assert.fail(),
		copy: () => Promise.resolve('copied'), progress: () => undefined });
	assert.equal(result.content, markdown);
});

void test('OSS transport sends exact bytes, never follows redirects, and closes timed-out or cancelled requests', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'mark-to-go-oss-http-'));
	let status = 200;
	let body = '';
	let received = '';
	let calls = 0;
	const server = createServer((incoming, response) => {
		calls++;
		incoming.setEncoding('utf8');
		incoming.on('data', (chunk: string) => { received += chunk; });
		incoming.on('end', () => {
			if (status === 0) return;
			response.writeHead(status, { Location: 'https://credentials-must-not-go-here.example.com' });
			response.end(body);
		});
	});
	await new Promise<void>(accept => server.listen(0, '127.0.0.1', accept));
	try {
		const file = join(directory, 'image.png');
		await writeFile(file, 'exact bytes');
		const send = ((settings: RequestOptions, callback?: (response: IncomingMessage) => void) => request({ ...settings,
			hostname: '127.0.0.1', port: (server.address() as AddressInfo).port }, callback)) as typeof request;
		const input: OssPutRequest = { hostname: 'examplebucket.oss-cn-hangzhou.aliyuncs.com', path: '/image.png',
			headers: { 'content-length': '11', authorization: 'test-authorization' }, file, timeoutMs: 2000 };
		await putOssObject(input, new AbortController().signal, send);
		assert.equal(received, 'exact bytes');
		for (const [code, responseBody, error] of [
			[403, '<Error><Code>SignatureDoesNotMatch</Code><Secret>do-not-show</Secret></Error>', 'ossAuthenticationFailed'],
			[403, '<Code>AccessDenied</Code>', 'ossAccessDenied'], [404, '<Code>NoSuchBucket</Code>', 'ossBucketMissing'],
			[403, '<Code>RequestTimeTooSkewed</Code>', 'ossClockSkew'], [301, '', 'ossWrongRegion'],
		] as const) {
			status = code; body = responseBody;
			await assert.rejects(putOssObject(input, new AbortController().signal, send), caught => {
				assert.equal((caught as { key: string }).key, error);
				assert.ok(!String(caught).includes('do-not-show')); return true;
			});
		}
		assert.equal(calls, 6);
		status = 0;
		await assert.rejects(putOssObject({ ...input, timeoutMs: 30 }, new AbortController().signal, send), { key: 'ossTimeout' });
		const controller = new AbortController();
		const operation = putOssObject(input, controller.signal, send);
		controller.abort();
		await assert.rejects(operation, { key: 'cancelled' });
		await assert.rejects(putOssObject(input, controller.signal, send), { key: 'cancelled' });
	} finally {
		server.closeAllConnections();
		await new Promise<void>((accept, reject) => server.close(error => error ? reject(error) : accept()));
		await rm(directory, { recursive: true, force: true });
	}
});
