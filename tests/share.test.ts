import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shareMarkdown } from '../src/share.ts';
import type { ShareDependencies, ShareStage } from '../src/share.ts';

function fixture() {
	const uploads: string[] = [];
	const copied: string[] = [];
	const stages: ShareStage[] = [];
	let opened = 0;
	let closed = 0;
	const deps: ShareDependencies = {
		resolve: (target) => Promise.resolve({ key: target, path: '/vault/' + target }),
		openUploader: () => {
			opened++;
			return Promise.resolve({
				upload: (path) => {
					uploads.push(path);
					return Promise.resolve('https://cdn.example.test/' + uploads.length + '.png');
				},
				close: () => { closed++; return Promise.resolve(); },
			});
		},
		copy: (content) => { copied.push(content); return Promise.resolve('copied'); },
		progress: () => undefined,
		stage: stage => { stages.push(stage); },
	};
	return { deps, uploads, copied, stages, get opened() { return opened; }, get closed() { return closed; } };
}

void test('default export only copies shareable text without requiring PicList or creating a saved path', async () => {
	const f = fixture();
	const content = '# Note\n\n![remote](https://example.test/a.png)';
	const result = await shareMarkdown(content, f.deps);
	assert.equal(f.opened, 0);
	assert.deepEqual(f.copied, [content]);
	assert.deepEqual(result, { content, uploaded: 0, reused: 0, clipboardStatus: 'copied' });
	assert.equal('path' in result, false);
	assert.deepEqual(f.stages, ['checking', 'copying'], 'Existing online images must not imply an upload');
});

void test('typed stages announce real work before resource checks, uploads and copying begin', async () => {
	const f = fixture();
	const resolve = f.deps.resolve.bind(f.deps);
	const openUploader = f.deps.openUploader.bind(f.deps);
	const copy = f.deps.copy.bind(f.deps);
	f.deps.resolve = target => {
		assert.equal(f.stages[f.stages.length - 1], 'checking');
		return resolve(target);
	};
	f.deps.openUploader = () => {
		assert.equal(f.stages[f.stages.length - 1], 'uploading');
		return openUploader();
	};
	f.deps.copy = content => {
		assert.equal(f.stages[f.stages.length - 1], 'copying');
		return copy(content);
	};
	await shareMarkdown('![[image.png]]', f.deps);
	assert.deepEqual(f.stages, ['checking', 'uploading', 'copying']);
});

void test('resolve every resource before uploading anything so missing images cannot cause partial uploads', async () => {
	const f = fixture();
	f.deps.resolve = (target) => Promise.resolve(target === 'missing.png' ? null : { key: target, path: target });
	await assert.rejects(shareMarkdown('![[exists.png]]\n![[missing.png]]', f.deps), /missing.png/);
	assert.equal(f.opened, 0);
	assert.deepEqual(f.copied, []);
	assert.deepEqual(f.stages, ['checking']);
});

void test('aliases deduplicate by resolved file while same-named files in different folders stay distinct', async () => {
	const f = fixture();
	f.deps.resolve = (target) => Promise.resolve({
		key: target === 'a.png' ? 'one/a.png' : target,
		path: '/vault/' + (target === 'a.png' ? 'one/a.png' : target),
	});
	const source = '![[a.png]]\n![alias](one/a.png)\n![[two/a.png]]';
	const result = await shareMarkdown(source, f.deps);
	assert.deepEqual(f.uploads, ['/vault/one/a.png', '/vault/two/a.png']);
	assert.equal(result.uploaded, 2);
	assert.equal(result.content, '![a](https://cdn.example.test/1.png)\n![alias](https://cdn.example.test/1.png)\n![a](https://cdn.example.test/2.png)');
	assert.equal(source, '![[a.png]]\n![alias](one/a.png)\n![[two/a.png]]');
	assert.deepEqual(f.copied, [result.content]);
	assert.equal(f.closed, 1);
});

void test('partial upload failure closes the session, reports completed uploads, and never exports or copies', async () => {
	const f = fixture();
	let n = 0;
	let closed = false;
	f.deps.openUploader = () => Promise.resolve({
		upload: () => ++n === 1 ? Promise.resolve('https://cdn.example.test/a.png') : Promise.reject(new Error('secret detail')),
		close: () => { closed = true; return Promise.resolve(); },
	});
	await assert.rejects(shareMarkdown('![[a.png]]\n![[b.svg]]', f.deps), /b.svg。已完成 1\/2/);
	assert.equal(closed, true);
	assert.deepEqual(f.copied, []);
	assert.deepEqual(f.stages, ['checking', 'uploading'], 'Failed uploads must never show the copying stage');
});

void test('an unshareable result URL is a failed upload and cannot enter an export', async () => {
	const f = fixture();
	f.deps.openUploader = () => Promise.resolve({
		upload: () => Promise.resolve('http://localhost/private.png'),
		close: () => Promise.resolve(),
	});
	await assert.rejects(shareMarkdown('![[a.png]]', f.deps), /上传失败/);
	assert.deepEqual(f.copied, []);
});

void test('clipboard failure retains prepared Markdown for a later retry or explicit save', async () => {
	const f = fixture();
	f.deps.copy = () => Promise.reject(new Error('unavailable'));
	const result = await shareMarkdown('# Note', f.deps);
	assert.equal(result.clipboardStatus, 'failed');
	assert.equal('path' in result, false);
	assert.equal(result.content, '# Note');
	assert.deepEqual(f.stages, ['checking', 'copying']);
});

void test('a superseded clipboard action remains skipped rather than being reported as a failure or success', async () => {
	const f = fixture();
	f.deps.copy = () => Promise.resolve('skipped');
	const result = await shareMarkdown('# Note', f.deps);
	assert.equal(result.clipboardStatus, 'skipped');
	assert.deepEqual(f.stages, ['checking', 'copying']);
});

void test('cancellation before export or after upload must not replace the clipboard', async () => {
	const f = fixture();
	const controller = new AbortController();
	f.deps.signal = controller.signal;
	controller.abort();
	await assert.rejects(shareMarkdown('# Note', f.deps), /取消/);
	assert.deepEqual(f.copied, []);
	assert.deepEqual(f.stages, []);
	const g = fixture();
	const duringUpload = new AbortController();
	g.deps.signal = duringUpload.signal;
	g.deps.openUploader = () => Promise.resolve({
		upload: () => { duringUpload.abort(); return Promise.resolve('https://cdn.example.test/image.svg'); },
		close: () => Promise.resolve(),
	});
	await assert.rejects(shareMarkdown('![[image.svg]]', g.deps), /取消/);
	assert.deepEqual(g.copied, []);
	assert.deepEqual(g.stages, ['checking', 'uploading'], 'Cancelled uploads must never show the copying stage');
	const h = fixture();
	const duringResolution = new AbortController();
	h.deps.signal = duringResolution.signal;
	h.deps.resolve = target => {
		duringResolution.abort();
		return Promise.resolve({ key: target, path: target });
	};
	await assert.rejects(shareMarkdown('![[image.svg]]', h.deps), /取消/);
	assert.equal(h.opened, 0);
	assert.deepEqual(h.stages, ['checking'], 'Cancellation during resource resolution must not announce or open an upload');
});
