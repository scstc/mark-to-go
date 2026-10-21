import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { test } from 'node:test';
import { saveMarkdown } from '../src/export.ts';

void test('concurrent shares preserve existing files, UTF-8 content, and leave no staging files', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'mark-to-go-export-test-'));
	try {
		await writeFile(join(dir, '笔记.shared.md'), 'existing');
		const paths = await Promise.all(Array.from({ length: 6 }, (_, i) => saveMarkdown(dir, '笔记.md', '正文 ' + i)));
		assert.equal(new Set(paths).size, 6);
		assert.equal(await readFile(join(dir, '笔记.shared.md'), 'utf8'), 'existing');
		for (const [i, path] of paths.entries()) assert.equal(await readFile(path, 'utf8'), '正文 ' + i);
		assert.deepEqual((await readdir(dir)).sort(),
			['笔记.shared.md', ...paths.map((path) => basename(path))].sort());
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

void test('a file blocking the output directory fails without altering that file', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'mark-to-go-export-test-'));
	try {
		const blocked = join(dir, 'blocked');
		await writeFile(blocked, 'keep');
		await assert.rejects(saveMarkdown(blocked, 'Note.md', 'new'));
		assert.equal(await readFile(blocked, 'utf8'), 'keep');
		assert.deepEqual(await readdir(dir), ['blocked']);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
