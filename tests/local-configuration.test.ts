import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkLocalConfiguration } from '../src/local-configuration.ts';
import { createTranslator, localizeError, MarkToGoError } from '../src/i18n.ts';
import { processError } from '../src/process-errors.ts';

void test('local checks do not run the uploader, alter configuration or create missing export folders', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'mark-to-go-check-test-'));
	try {
		const cli = join(dir, 'picgo.cjs');
		const config = join(dir, 'data.json');
		const outputDirectory = join(dir, 'not-created');
		await writeFile(cli, 'throw new Error("Uploader must never run during local checks");');
		const contents = JSON.stringify({ picBed: { current: 'test', test: { token: 'SECRET' } } });
		await writeFile(config, contents);
		const before = (await readdir(dir)).sort();
		const items = await checkLocalConfiguration({ cliPath: cli, configPath: config,
			nodePath: process.execPath, timeoutSeconds: 120, outputDirectory });
		assert.equal(items.length, 6);
		for (const id of ['node', 'cli', 'config', 'provider']) assert.equal(items.find(i => i.id === id)?.status, 'ok');
		assert.equal(items.find(i => i.id === 'output')?.status, 'warning');
		assert.equal(await readFile(config, 'utf8'), contents);
		assert.deepEqual((await readdir(dir)).sort(), before);
		assert.ok(!JSON.stringify(items).includes('SECRET'));
		await writeFile(config, JSON.stringify({ picBed: { current: 123 } }));
		const invalid = await checkLocalConfiguration({ cliPath: cli, configPath: config,
			nodePath: process.execPath, timeoutSeconds: 120, outputDirectory: dir });
		assert.equal(invalid.find(i => i.id === 'provider')?.message, 'providerInvalid');
	} finally { await rm(dir, { recursive: true, force: true }); }
});

void test('missing programs produce actionable controlled diagnostics instead of raw system messages', async () => {
	const items = await checkLocalConfiguration({ cliPath: join(tmpdir(), 'mark-to-go-never-exists.cjs'),
		nodePath: '', configPath: join(tmpdir(), 'mark-to-go-never-exists.json'), outputDirectory: '', timeoutSeconds: 5 });
	assert.equal(items.find(i => i.id === 'cli')?.message, 'cliMissing');
	assert.equal(items.find(i => i.id === 'config')?.message, 'configReadFailed');
});

void test('process failures retain safe reasons through upload errors without exposing stderr or credentials', () => {
	const cases: Array<[Record<string, unknown>, string]> = [
		[{ code: 'ENOENT' }, 'processMissing'], [{ code: 'EACCES' }, 'processDenied'],
		[{ killed: true }, 'processTimeout'], [{ code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' }, 'processOutputLimit'],
		[{ code: 1, stderr: 'Authorization: Bearer SECRET', message: 'https://user:password@host' }, 'processFailed'],
	];
	for (const [details, key] of cases) {
		const cause = processError(details);
		assert.equal(cause.key, key);
		const error = new MarkToGoError('uploadFailed', { path: 'a.png', completed: 1, total: 2 }, cause);
		const message = localizeError(error, createTranslator('en'));
		assert.ok(message.includes('a.png'));
		assert.ok(message.includes(createTranslator('en')(cause.key)));
		assert.ok(!/SECRET|password|Authorization/.test(message));
	}
	const controller = new AbortController();
	controller.abort();
	assert.equal(processError({ killed: true }, controller.signal).key, 'cancelled');
});
