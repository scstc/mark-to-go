import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { configurationFingerprint, resourceFingerprint, UPLOAD_CACHE_FILE, UploadCache } from '../src/upload-cache.ts';

const key = 'a'.repeat(64);
const url = 'https://images.example.test/image.svg';
const failWarning = (): void => assert.fail('Unexpected cache failure');

void test('a second share and a new plugin instance reuse the persisted URL without uploading', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'mark-to-go-cache-test-'));
	try {
		const file = join(dir, UPLOAD_CACHE_FILE);
		const cache = new UploadCache(file);
		let uploads = 0;
		const upload = () => { uploads++; return Promise.resolve(url); };
		assert.deepEqual(await cache.getOrUpload(key, upload, failWarning), { url, reused: false });
		assert.deepEqual(await cache.getOrUpload(key, upload, failWarning), { url, reused: true });
		assert.deepEqual(await new UploadCache(file).getOrUpload(key, upload, failWarning), { url, reused: true });
		assert.equal(uploads, 1);
		assert.equal((await readdir(dir)).filter(name => name.endsWith('.tmp')).length, 0);
		await cache.clear();
		assert.equal((await cache.getOrUpload(key, upload, failWarning)).reused, false);
		assert.equal(uploads, 2);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

void test('simultaneous notes sharing the same resource start one upload', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'mark-to-go-cache-test-'));
	try {
		const cache = new UploadCache(join(dir, UPLOAD_CACHE_FILE));
		let uploads = 0;
		const upload = () => { uploads++; return Promise.resolve(url); };
		const results = await Promise.all(Array.from({ length: 5 }, () => cache.getOrUpload(key, upload, failWarning)));
		assert.equal(uploads, 1);
		assert.equal(results.filter(result => !result.reused).length, 1);
		assert.ok(results.every(result => result.url === url));
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

void test('failed and invalid upload results are never remembered as successful mappings', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'mark-to-go-cache-test-'));
	try {
		const cache = new UploadCache(join(dir, UPLOAD_CACHE_FILE));
		await assert.rejects(cache.getOrUpload(key, () => Promise.reject(new Error('offline')), failWarning), /offline/);
		await assert.rejects(cache.getOrUpload(key, () => Promise.resolve('http://localhost/x.svg'), failWarning));
		assert.equal((await cache.getOrUpload(key, () => Promise.resolve(url), failWarning)).reused, false);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

void test('bad cache data warns without losing the successful share or silently replacing the broken file', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'mark-to-go-cache-test-'));
	try {
		const file = join(dir, UPLOAD_CACHE_FILE);
		await mkdir(dirname(file), { recursive: true });
		await writeFile(file, '{broken');
		const cache = new UploadCache(file);
		let warnings = 0;
		assert.deepEqual(await cache.getOrUpload(key, () => Promise.resolve(url), () => { warnings++; }), { url, reused: false });
		assert.equal(warnings, 1);
		assert.equal(await readFile(file, 'utf8'), '{broken');
		await cache.clear();
		assert.equal((await cache.getOrUpload(key, () => Promise.resolve(url), failWarning)).reused, false);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

void test('resource content and configuration determine identity instead of image path or JSON key order', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'mark-to-go-cache-test-'));
	try {
		const a = join(dir, 'original.svg');
		const b = join(dir, 'renamed.svg');
		await writeFile(a, '<svg>A</svg>');
		await writeFile(b, '<svg>A</svg>');
		const namespace = configurationFingerprint({ picBed: { uploader: 'oss', oss: { token: 'private-token', bucket: 'one' } } });
		assert.equal(namespace, configurationFingerprint({ picBed: { oss: { bucket: 'one', token: 'private-token' }, uploader: 'oss' } }));
		assert.notEqual(namespace, configurationFingerprint({ picBed: { uploader: 'oss', oss: { token: 'private-token', bucket: 'two' } } }));
		const original = await resourceFingerprint(namespace, a);
		assert.equal(original, await resourceFingerprint(namespace, b));
		await writeFile(b, '<svg>B</svg>');
		assert.notEqual(original, await resourceFingerprint(namespace, b));
		assert.notEqual(original, await resourceFingerprint('another-config', a));
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

void test('independent running clients observe new, changed and deleted records without restarting', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'mark-to-go-cache-sync-'));
	try {
		const file = join(dir, UPLOAD_CACHE_FILE);
		const a = new UploadCache(file);
		const b = new UploadCache(file);
		const secondKey = 'b'.repeat(64);
		// Concurrent writers in one runtime merge the latest file instead of stale snapshots.
		await Promise.all([
			a.getOrUpload(key, () => Promise.resolve(url), failWarning),
			b.getOrUpload(secondKey, () => Promise.resolve('https://images.example.test/b.svg'), failWarning),
		]);
		assert.equal((await b.getOrUpload(key, () => assert.fail('Synced record was not reused'), failWarning)).reused, true);
		assert.equal((await a.getOrUpload(secondKey, () => assert.fail('Other client record lost'), failWarning)).reused, true);
		const updated = 'https://images.example.test/new.svg';
		const synced = JSON.parse(await readFile(file, 'utf8')) as { entries: Record<string, string> };
		assert.equal(Object.keys(synced.entries).length, 2);
		synced.entries[key] = updated;
		await writeFile(file, JSON.stringify(synced));
		assert.equal((await b.getOrUpload(key, () => assert.fail('Updated record ignored'), failWarning)).url, updated);
		await writeFile(join(dir, 'unrelated.json'), 'keep');
		await a.clear();
		assert.equal(await readFile(join(dir, 'unrelated.json'), 'utf8'), 'keep');
		assert.equal((await b.getOrUpload(key, () => Promise.resolve(url), failWarning)).reused, false);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

void test('initialization creates the independent cache directory and preserves an existing valid file unchanged', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'mark-to-go-root-cache-'));
	try {
		const file = join(dir, UPLOAD_CACHE_FILE);
		const cache = new UploadCache(file);
		await cache.initialize();
		assert.deepEqual(await readdir(dir), ['MarkToGo']);
		assert.deepEqual(await readdir(dirname(file)), ['upload-cache.json']);
		const empty = JSON.parse(await readFile(file, 'utf8')) as { format: string; entries: Record<string, string> };
		assert.equal(empty.format, 'mark-to-go-upload-cache');
		assert.deepEqual(empty.entries, {});
		await cache.getOrUpload(key, () => Promise.resolve(url), failWarning);
		const existing = await readFile(file, 'utf8');
		await new UploadCache(file).initialize();
		assert.equal(await readFile(file, 'utf8'), existing);
		assert.equal((await new UploadCache(file).getOrUpload(key, () => assert.fail('Existing mapping lost'), failWarning)).reused, true);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

void test('device UI settings and named-config IDs do not split a shared cloud identity', () => {
	const a = {
		picBed: { uploader: 'oss', oss: { bucket: 'shared', token: 'secret', _id: 'computer-a', _configName: 'A' }, unused: { value: 1 } },
		settings: { logPath: 'C:/one/log', language: 'zh-CN', miniWindowPosition: [1, 2] }, PICGO_ENV: 'GUI',
		buildIn: { watermark: { enabled: true } }, picgoPlugins: { 'picgo-plugin-example': true },
	};
	const b = {
		...a,
		picBed: { current: 'oss', oss: { bucket: 'shared', token: 'secret', _id: 'computer-b', _configName: 'B' } },
		settings: { logPath: '/other/log', language: 'en', miniWindowPosition: [3, 4] }, PICGO_ENV: 'CLI',
	};
	assert.equal(configurationFingerprint(a), configurationFingerprint(b));
	assert.notEqual(configurationFingerprint(a), configurationFingerprint({ ...a, buildIn: { watermark: { enabled: false } } }));
	assert.notEqual(configurationFingerprint(a), configurationFingerprint({ ...a, picgoPlugins: {} }));
});

void test('renaming the plugin upgrades the legacy cache format without reuploading existing resources', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'mark-to-go-legacy-cache-'));
	try {
		const file = join(dir, UPLOAD_CACHE_FILE);
		await mkdir(dirname(file), { recursive: true });
		await writeFile(file, JSON.stringify({ format: 'share-ready-upload-cache', version: 1, entries: { [key]: url } }));
		const cache = new UploadCache(file);
		await cache.initialize();
		assert.deepEqual(await cache.getOrUpload(key, () => assert.fail('Rename caused a duplicate upload'), failWarning), { url, reused: true });
		const upgraded = JSON.parse(await readFile(file, 'utf8')) as { format: string; entries: Record<string, string> };
		assert.equal(upgraded.format, 'mark-to-go-upload-cache');
		assert.deepEqual(upgraded.entries, { [key]: url });
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
