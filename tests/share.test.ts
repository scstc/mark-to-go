import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shareMarkdown } from '../src/share.ts';
import type { ShareDependencies } from '../src/share.ts';

function fixture() {
	const uploads: string[] = [];
	const copied: string[] = [];
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
	};
	return { deps, uploads, copied, get opened() { return opened; }, get closed() { return closed; } };
}

void test('default export only copies shareable text without requiring PicList or creating a saved path', async () => {
	const f = fixture();
	const content = '# Note\n\n![remote](https://example.test/a.png)';
	const result = await shareMarkdown(content, f.deps);
	assert.equal(f.opened, 0);
	assert.deepEqual(f.copied, [content]);
	assert.deepEqual(result, { content, uploaded: 0, reused: 0, clipboardStatus: 'copied' });
	assert.equal('path' in result, false);
});

void test('resolve every resource before uploading anything so missing images cannot cause partial uploads', async () => {
	const f = fixture();
	f.deps.resolve = (target) => Promise.resolve(target === 'missing.png' ? null : { key: target, path: target });
	await assert.rejects(shareMarkdown('![[exists.png]]\n![[missing.png]]', f.deps), /missing.png/);
	assert.equal(f.opened, 0);
	assert.deepEqual(f.copied, []);
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
});

void test('cancellation before export or after upload must not replace the clipboard', async () => {
	const f = fixture();
	const controller = new AbortController();
	f.deps.signal = controller.signal;
	controller.abort();
	await assert.rejects(shareMarkdown('# Note', f.deps), /取消/);
	assert.deepEqual(f.copied, []);
	const g = fixture();
	const duringUpload = new AbortController();
	g.deps.signal = duringUpload.signal;
	g.deps.openUploader = () => Promise.resolve({
		upload: () => { duringUpload.abort(); return Promise.resolve('https://cdn.example.test/image.svg'); },
		close: () => Promise.resolve(),
	});
	await assert.rejects(shareMarkdown('![[image.svg]]', g.deps), /取消/);
	assert.deepEqual(g.copied, []);
});
