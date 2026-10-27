import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClipboardCoordinator } from '../src/clipboard-coordinator.ts';
import { shareMarkdown } from '../src/share.ts';

void test('a newer share owns automatic copying even when the older share finishes last', async () => {
	const clipboard = new ClipboardCoordinator();
	const values: string[] = [];
	let finish!: () => void;
	const pending = new Promise<void>(resolve => { finish = resolve; });
	const ticketA = clipboard.claim();
	const a = shareMarkdown('![[a.png]]', {
		resolve: async () => { await pending; return { key: 'a', path: 'a.png' }; },
		openUploader: () => Promise.resolve({ upload: () => Promise.resolve('https://cdn.test/a.png'), close: () => Promise.resolve() }),
		copy: content => clipboard.write(ticketA, async () => { values.push(content); }), progress: () => undefined,
	});
	const ticketB = clipboard.claim();
	const b = await shareMarkdown('B', {
		resolve: () => assert.fail('No images'), openUploader: () => assert.fail('No uploader'),
		copy: content => clipboard.write(ticketB, async () => { values.push(content); }), progress: () => undefined,
	});
	finish();
	assert.equal((await a).clipboardStatus, 'skipped');
	assert.equal(b.clipboardStatus, 'copied');
	assert.deepEqual(values, ['B']);
});

void test('a newer intent that fails never restores an older copy and failed writes do not poison the queue', async () => {
	const clipboard = new ClipboardCoordinator();
	const old = clipboard.claim();
	const failed = clipboard.claim();
	await assert.rejects(clipboard.write(failed, () => Promise.reject(new Error('unavailable'))));
	assert.equal(await clipboard.write(old, () => assert.fail('Stale copy')), 'skipped');
	assert.equal(await clipboard.write(clipboard.claim(), () => Promise.resolve()), 'copied');
});

void test('manual text copy waits for an in-progress file write and remains the final clipboard value', async () => {
	const clipboard = new ClipboardCoordinator();
	const values: string[] = [];
	let finish!: () => void;
	let started!: () => void;
	const begun = new Promise<void>(resolve => { started = resolve; });
	const wait = new Promise<void>(resolve => { finish = resolve; });
	const file = clipboard.write(clipboard.claim(), async () => { started(); await wait; values.push('file'); });
	await begun;
	const text = clipboard.write(clipboard.claim(), async () => { values.push('text'); });
	finish();
	assert.equal(await file, 'skipped');
	assert.equal(await text, 'copied');
	assert.deepEqual(values, ['file', 'text']);
});

void test('unload aborts active work and invalidates queued or future copies', async () => {
	const clipboard = new ClipboardCoordinator();
	let active!: AbortSignal;
	let started!: () => void;
	const begun = new Promise<void>(resolve => { started = resolve; });
	const work = clipboard.write(clipboard.claim(), signal => new Promise<void>(resolve => {
		active = signal; started(); signal.addEventListener('abort', () => resolve(), { once: true });
	}));
	await begun;
	clipboard.dispose();
	assert.equal(active.aborted, true);
	assert.equal(await work, 'skipped');
	assert.equal(await clipboard.write(clipboard.claim(), () => assert.fail('Unloaded')), 'skipped');
});
