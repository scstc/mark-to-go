import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, rmdir, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { test } from 'node:test';
import { ClipboardPublishError, copyMarkdownFile, fileClipboardCommand } from '../src/file-clipboard.ts';
import { MarkToGoError } from '../src/i18n.ts';

void test('clipboard commands encode special note names as data rather than executable syntax', () => {
	const name = join(tmpdir(), "中文 ' ` $(literal) & note.md");
	const args = fileClipboardCommand(name);
	assert.deepEqual(args.slice(0, 4), ['-NoProfile', '-NonInteractive', '-STA', '-EncodedCommand']);
	const script = Buffer.from(args[4]!, 'base64').toString('utf16le');
	assert.ok(script.includes(Buffer.from(name, 'utf16le').toString('base64')));
	assert.ok(!script.includes(name));
});

void test('only the replaced MarkToGo attachment is retired; user files and the new UTF-8 copy survive', async () => {
	const outside = await mkdtemp(join(tmpdir(), 'mark-to-go-user-file-test-'));
	const original = join(outside, 'keep.md');
	await writeFile(original, 'keep');
	const paths: string[] = [];
	try {
		await copyMarkdownFile('中文.md', '第一版', undefined, path => { paths.push(path); return Promise.resolve([]); });
		await copyMarkdownFile('中文.md', '第二版 😀', undefined, path => { paths.push(path); return Promise.resolve([paths[0]!, original]); });
		await assert.rejects(stat(paths[0]!));
		assert.equal(basename(paths[1]!), '中文.md');
		assert.equal(await readFile(paths[1]!, 'utf8'), '第二版 😀');
		assert.equal(await readFile(original, 'utf8'), 'keep');
	} finally {
		for (const path of paths) await rm(dirname(path), { recursive: true, force: true });
		await rm(outside, { recursive: true, force: true });
	}
});

void test('known pre-publication failures clean staging, but uncertain publication retains a pasteable file', async () => {
	let failed = '';
	await assert.rejects(copyMarkdownFile('failure.md', 'body', undefined, path => {
		failed = path; return Promise.reject(new MarkToGoError('processMissing'));
	}));
	await assert.rejects(stat(dirname(failed)));
	let uncertain = '';
	try {
		await assert.rejects(copyMarkdownFile('cancelled.md', 'still pasteable', undefined, path => {
			uncertain = path;
			return Promise.reject(new ClipboardPublishError(new MarkToGoError('cancelled'), true));
		}));
		assert.equal(await readFile(uncertain, 'utf8'), 'still pasteable');
	} finally { if (uncertain) await rm(dirname(uncertain), { recursive: true, force: true }); }
});

void test('already-cancelled copy never publishes an attachment', async () => {
	const controller = new AbortController();
	controller.abort();
	await assert.rejects(copyMarkdownFile('note.md', 'text', controller.signal, () => assert.fail('Cancelled copy')),
		(error: unknown) => error instanceof MarkToGoError && error.key === 'cancelled');
});

void test('a clipboard path through a symbolic directory cannot delete the target file', async () => {
	const target = await mkdtemp(join(tmpdir(), 'mark-to-go-symlink-target-'));
	const alias = await mkdtemp(join(tmpdir(), 'mark-to-go-clipboard-'));
	let current = '';
	try {
		await writeFile(join(target, 'keep.md'), 'keep');
		await rmdir(alias);
		await symlink(target, alias, process.platform === 'win32' ? 'junction' : 'dir');
		await copyMarkdownFile('current.md', 'copy', undefined, path => {
			current = path; return Promise.resolve([join(alias, 'keep.md')]);
		});
		assert.equal(await readFile(join(target, 'keep.md'), 'utf8'), 'keep');
	} finally {
		await rm(alias, { recursive: true, force: true });
		await rm(target, { recursive: true, force: true });
		if (current) await rm(dirname(current), { recursive: true, force: true });
	}
});
