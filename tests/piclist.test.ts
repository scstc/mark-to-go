import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createPicListSession, parseUploadResult } from '../src/piclist.ts';

void test('only a single confirmed CLI success counts, including CLI failures that exit with zero', () => {
	assert.equal(parseUploadResult('info https://wrong.example.test\n[PicList SUCCESS]:\nhttps://cdn.example.test/a.png\n'),
		'https://cdn.example.test/a.png');
	assert.equal(parseUploadResult('\u001b[32m[PicGo SUCCESS]:\u001b[0m\r\nhttps://cdn.example.test/a.svg\r\n'),
		'https://cdn.example.test/a.svg');
	for (const output of ['https://cdn.example.test/no-success.png',
		'[PicList ERROR]:\nupload failed', '[PicList SUCCESS]:\nhttps://a.test\n[PicList SUCCESS]:\nhttps://b.test']) {
		assert.throws(() => parseUploadResult(output));
	}
	assert.throws(() => parseUploadResult('[PicList SUCCESS]:\nhttps://cdn.example.test/a.png', '[PicList ERROR]: broken'));
	assert.throws(() => parseUploadResult('[PicList SUCCESS]:\nhttps://a.test/1.png\nhttps://a.test/2.png\n'), /多个 URL/);
});

void test('CLI image deletion/config migration affect disposable copies; Chinese paths are passed as single arguments', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'mark-to-go-cli-test-'));
	try {
		const cli = join(dir, 'fake cli.cjs');
		const config = join(dir, 'data.json');
		const image = join(dir, '图 & test.svg');
		const originalConfig = JSON.stringify({ picBed: { current: 'local' } });
		await writeFile(config, originalConfig);
		await writeFile(image, '<svg>original</svg>');
		await writeFile(cli, [
			'const fs = require("node:fs");',
			'const [flag, config, verb, image] = process.argv.slice(2);',
			'if (flag !== "-c" || verb !== "upload" || !image.endsWith("图 & test.svg")) process.exit(2);',
			'fs.writeFileSync(config, "{}");',
			'fs.unlinkSync(image);',
			'console.log("[PicList SUCCESS]:\\nhttps://cdn.example.test/result.svg");',
		].join('\n'));
		const session = await createPicListSession({
			cliPath: cli, nodePath: process.execPath, configPath: config, timeoutSeconds: 5,
		});
		try {
			assert.equal(await session.upload(image), 'https://cdn.example.test/result.svg');
		} finally {
			await session.close();
		}
		assert.equal(await readFile(config, 'utf8'), originalConfig);
		assert.equal(await readFile(image, 'utf8'), '<svg>original</svg>');
		assert.deepEqual((await readdir(dir)).sort(), ['data.json', 'fake cli.cjs', '图 & test.svg'].sort());
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

void test('invalid configuration is reported before any upload', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'mark-to-go-cli-test-'));
	try {
		const cli = join(dir, 'noop.cjs');
		const config = join(dir, 'data.json');
		await writeFile(cli, '');
		for (const value of ['null', '[]', '{}', 'not JSON']) {
			await writeFile(config, value);
			await assert.rejects(createPicListSession({
				cliPath: cli, nodePath: process.execPath, configPath: config, timeoutSeconds: 5,
			}), /PicList 配置/);
		}
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
