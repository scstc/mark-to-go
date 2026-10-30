import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { createServer, request } from 'node:http';
import type { RequestOptions, IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { prepareS3Configuration } from '../src/s3-config.ts';
import { signS3Put } from '../src/s3-signature.ts';
import { createS3Uploader } from '../src/s3-uploader.ts';
import { createOssUploader } from '../src/oss-uploader.ts';
import { prepareOssConfiguration } from '../src/oss-config.ts';
import { putObject } from '../src/object-storage-request.ts';
import { UploadCache, resourceFingerprint } from '../src/upload-cache.ts';
import { checkLocalConfiguration } from '../src/local-configuration.ts';
import { MarkToGoError } from '../src/i18n.ts';

const options = { s3Region: 'us-east-1', s3Bucket: 'examplebucket', s3AccessKeyId: 'AKIDEXAMPLE',
	s3SecretName: 's3-secret', s3Prefix: 'mark-to-go/', s3PublicBaseUrl: '', timeoutSeconds: 120 };

void test('S3 SigV4 matches AWS Smithy SDK fixtures without double encoding special object paths', () => {
	// Independently generated with @smithy/signature-v4 and @aws-crypto/sha256-js, uriEscapePath: false.
	for (const [path, signature] of [
		['/test%24file.text', '2a268f5c19863c1d943f5b83830ab0ff4d647ebb715ce1e48f353939d55fc8ae'],
		['/%E4%B8%AD%E6%96%87%20%E5%9B%BE%E7%89%87/a%20%21%27%28%29%2A%25.png', '9226b523406ab04359a9740cd03af5bf009b682742c3f1308fa77b728bc31ec1'],
	]) {
		const authorization = signS3Put({ region: 'us-east-1', path: path!, accessKeyId: 'AKIDEXAMPLE',
			secret: 'fixture-secret', headers: { host: 'examplebucket.s3.us-east-1.amazonaws.com',
				'content-type': 'image/png', 'x-amz-content-sha256': '9febe01bd41bfb69683e29d711d8adffc9ae38de17a6873464b416f3b67398b6',
				'x-amz-date': '20261030T010203Z', 'content-length': '10' } });
		assert.equal(authorization, 'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20261030/us-east-1/s3/aws4_request, ' +
			'SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=' + signature);
	}
});

void test('S3 endpoints cover standard, China and dotted buckets while public image domains never receive credentials', () => {
	assert.equal(prepareS3Configuration(options).endpoint, 'https://examplebucket.s3.us-east-1.amazonaws.com');
	assert.equal(prepareS3Configuration({ ...options, s3Region: 'cn-north-1' }).endpoint,
		'https://examplebucket.s3.cn-north-1.amazonaws.com.cn');
	assert.equal(prepareS3Configuration({ ...options, s3Bucket: 'images.example' }).endpoint,
		'https://s3.us-east-1.amazonaws.com/images.example');
	const cdn = prepareS3Configuration({ ...options, s3PublicBaseUrl: 'https://cdn.example.com/images/' });
	assert.equal(cdn.publicBaseUrl, 'https://cdn.example.com/images');
	assert.equal(cdn.endpoint, prepareS3Configuration(options).endpoint);
	for (const invalid of [{ s3Region: 'https://evil.example' }, { s3Region: 'us-east-1.evil.example' },
		{ s3Bucket: 'invalid..bucket' }, { s3Bucket: '192.168.1.1' }, { s3Bucket: 'directory--x-s3' },
		{ s3Bucket: 'Bad_Bucket' }, { s3Prefix: '../escape' }, { s3Prefix: 'a\\b' },
		{ s3PublicBaseUrl: 'http://example.com' }, { s3PublicBaseUrl: 'https://secret@example.com' },
		{ s3PublicBaseUrl: 'https://example.com/?query=1' }, { s3PublicBaseUrl: 'https://localhost' },
	]) assert.throws(() => prepareS3Configuration({ ...options, ...invalid }));
});

void test('S3 signs exact snapshot bytes, reuses cache across sessions and isolates buckets and public URLs', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'mark-to-go-s3-'));
	const stages: string[] = [];
	try {
		const image = join(directory, 'original.PNG');
		await writeFile(image, 'test-image');
		const cacheFile = join(directory, 'cache.json');
		const cache = new UploadCache(cacheFile);
		await cache.initialize();
		let calls = 0;
		const send: typeof putObject = async input => {
			calls++;
			stages.push(dirname(input.file));
			assert.equal(await readFile(input.file, 'utf8'), 'test-image');
			assert.equal(input.headers['x-amz-content-sha256'], createHash('sha256').update('test-image').digest('hex'));
			assert.equal(input.headers['x-amz-acl'], undefined);
			assert.equal(input.headers['x-oss-date'], undefined);
			assert.match(input.headers.authorization!, /^AWS4-HMAC-SHA256 /);
			assert.ok(input.hostname.endsWith('.s3.us-east-1.amazonaws.com'));
			assert.ok(!input.hostname.includes('cdn.example'));
			await writeFile(image, 'changed source');
		};
		const upload = async (configuration = options, secret = 'never-persist-this-secret'): Promise<string> => {
			const session = createS3Uploader(configuration, secret, new UploadCache(cacheFile), () => assert.fail(), undefined, send);
			try { return await session.upload(image); } finally { await session.close(); }
		};
		const url = await upload();
		assert.match(url, /^https:\/\/examplebucket\.s3\.us-east-1\.amazonaws\.com\/mark-to-go\/[a-f0-9]{64}\.png$/);
		await writeFile(image, 'test-image');
		assert.equal(await upload(options, 'rotated-secret'), url);
		assert.equal(calls, 1);
		await upload({ ...options, s3Bucket: 'anotherbucket' });
		await writeFile(image, 'test-image');
		assert.match(await upload({ ...options, s3PublicBaseUrl: 'https://cdn.example.com' }), /^https:\/\/cdn\.example\.com\//);
		assert.equal(calls, 3);
		const saved = await readFile(cacheFile, 'utf8');
		assert.ok(!saved.includes('never-persist-this-secret') && !saved.includes('AKIDEXAMPLE'));
		for (const stage of stages) await assert.rejects(readdir(stage), { code: 'ENOENT' });
	} finally { await rm(directory, { recursive: true, force: true }); }
});

void test('adding S3 retains pre-existing OSS cache identities and requires no PicList programs for S3 checks', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'mark-to-go-s3-compat-'));
	try {
		const image = join(directory, 'image.png');
		await writeFile(image, 'existing OSS image');
		const oss = { ossRegion: 'cn-beijing', ossBucket: 'examplebucket', ossAccessKeyId: 'exampleAccount',
			ossSecretName: 'oss-secret', ossPrefix: 'mark-to-go/', ossPublicBaseUrl: '', timeoutSeconds: 120 };
		const config = prepareOssConfiguration(oss);
		const namespace = createHash('sha256').update(JSON.stringify({ provider: 'oss-v4', ...config })).digest('hex');
		const digest = await resourceFingerprint('oss-object-v1', image);
		const key = createHash('sha256').update(namespace + '\n' + digest).digest('hex');
		const cache = new UploadCache(join(directory, 'cache.json'));
		await cache.initialize();
		const url = 'https://examplebucket.oss-cn-beijing.aliyuncs.com/mark-to-go/existing.png';
		await cache.getOrUpload(key, () => Promise.resolve(url), () => assert.fail());
		const session = createOssUploader(oss, 'secret', cache, () => assert.fail(), undefined, () => assert.fail('Reuploaded an existing OSS image'));
		assert.equal(await session.upload(image), url);
		assert.deepEqual(session.stats, { uploaded: 0, reused: 1 });
		await session.close();
		const settings = { ...options, uploadProvider: 's3' as const, cliPath: 'missing', nodePath: 'missing', configPath: 'missing', outputDirectory: '' };
		const checks = await checkLocalConfiguration(settings, undefined, () => true);
		assert.ok(checks.some(item => item.message === 's3LocalCheckReady'));
		assert.ok(checks.every(item => !['node', 'cli', 'config'].includes(item.id)));
		assert.ok((await checkLocalConfiguration(settings)).some(item => item.message === 's3CredentialsMissing'));
	} finally { await rm(directory, { recursive: true, force: true }); }
});

void test('S3 HTTP failures stay actionable, hide server details and never follow redirects', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'mark-to-go-s3-http-'));
	let status = 403;
	let body = '<Code>AccessDenied</Code><Secret>private-detail</Secret>';
	let requests = 0;
	const server = createServer((_incoming, response) => {
		requests++;
		if (status === 0) return;
		response.writeHead(status, { Location: 'https://must-not-receive-credentials.example.com' });
		response.end(body);
	});
	await new Promise<void>(accept => server.listen(0, '127.0.0.1', accept));
	try {
		const file = join(directory, 'image.png');
		await writeFile(file, 'image');
		const send = ((settings: RequestOptions, callback?: (response: IncomingMessage) => void) => request({ ...settings,
			hostname: '127.0.0.1', port: (server.address() as AddressInfo).port }, callback)) as typeof request;
		const input = { provider: 's3' as const, hostname: 'examplebucket.s3.us-east-1.amazonaws.com', path: '/image.png',
			headers: { 'content-length': '5', authorization: 'fixture-authorization' }, file, timeoutMs: 1000 };
		await assert.rejects(putObject(input, new AbortController().signal, send), error => {
			assert.equal((error as { key: string }).key, 's3AccessDenied');
			assert.ok(!String(error).includes('private-detail')); return true;
		});
		status = 301; body = '<Code>PermanentRedirect</Code>';
		await assert.rejects(putObject(input, new AbortController().signal, send), { key: 's3WrongRegion' });
		assert.equal(requests, 2);
		status = 0;
		await assert.rejects(putObject({ ...input, timeoutMs: 30 }, new AbortController().signal, send), { key: 's3Timeout' });
	} finally {
		server.closeAllConnections();
		await new Promise<void>((accept, reject) => server.close(error => error ? reject(error) : accept()));
		await rm(directory, { recursive: true, force: true });
	}
});

void test('closing an S3 session cancels its request and removes snapshots without caching a success', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'mark-to-go-s3-cancel-'));
	try {
		const image = join(directory, 'image.png');
		const cacheFile = join(directory, 'cache.json');
		await writeFile(image, 'image');
		const cache = new UploadCache(cacheFile);
		await cache.initialize();
		let started!: () => void;
		const ready = new Promise<void>(accept => { started = accept; });
		let stage = '';
		const session = createS3Uploader(options, 'secret', cache, () => assert.fail(), undefined, (input, signal) =>
			new Promise<void>((_accept, reject) => {
				stage = dirname(input.file);
				signal.addEventListener('abort', () => reject(new MarkToGoError('cancelled')), { once: true });
				started();
			}));
		const operation = session.upload(image);
		const rejected = assert.rejects(operation, { key: 'cancelled' });
		await ready;
		await session.close();
		await rejected;
		await assert.rejects(readdir(stage), { code: 'ENOENT' });
		assert.deepEqual((JSON.parse(await readFile(cacheFile, 'utf8')) as { entries: object }).entries, {});
	} finally { await rm(directory, { recursive: true, force: true }); }
});
