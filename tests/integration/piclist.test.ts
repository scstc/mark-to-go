import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createPicListSession } from '../../src/piclist.ts';
import { createCachedUploader } from '../../src/cached-uploader.ts';
import { shareMarkdown } from '../../src/share.ts';
import { UPLOAD_CACHE_FILE, UploadCache } from '../../src/upload-cache.ts';

void test('installed PicList CLI uses the explicit config and preserves source bytes with its local provider', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'mark-to-go-real-cli-'));
	try {
		const image = join(dir, '示例 图.svg');
		const config = join(dir, 'data.json');
		const bytes = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>';
		const originalConfig = JSON.stringify({
			picBed: { current: 'local', uploader: 'local', local: { path: join(dir, 'stored'), customUrl: 'https://images.example.test' } },
			settings: { language: 'en' }, picgoPlugins: {},
		});
		await writeFile(image, bytes);
		await writeFile(config, originalConfig);
		const session = await createPicListSession({ cliPath: '', nodePath: process.execPath, configPath: config, timeoutSeconds: 30 });
		try {
			const url = await session.upload(image);
			assert.equal(new URL(url).origin, 'https://images.example.test');
			const stored = await readdir(join(dir, 'stored'));
			assert.equal(stored.length, 1);
			assert.equal(await readFile(join(dir, 'stored', stored[0] ?? ''), 'utf8'), bytes);
		} finally {
			await session.close();
		}
		assert.equal(await readFile(image, 'utf8'), bytes);
		assert.equal(await readFile(config, 'utf8'), originalConfig);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

void test('installed CLI loads an enabled custom uploader from the source config plugin directory', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'mark-to-go-plugin-cli-'));
	try {
		const pluginName = 'picgo-plugin-mark-to-go-test';
		const packageDir = join(dir, 'node_modules', pluginName);
		await mkdir(packageDir, { recursive: true });
		const plugin = [
			'module.exports = () => ({ register(ctx) {',
			'ctx.helper.uploader.register("mark-to-go-test", {',
			'name: "MarkToGo test",',
			'async handle(ctx) { ctx.output = [{imgUrl:"https://images.example.test/plugin.svg"}]; return ctx; }',
			'}); } });',
		].join('\n');
		await writeFile(join(packageDir, 'package.json'), JSON.stringify({ name: pluginName, main: 'index.cjs' }));
		await writeFile(join(packageDir, 'index.cjs'), plugin);
		await writeFile(join(dir, 'package.json'), JSON.stringify({ dependencies: { [pluginName]: '1.0.0' } }));
		const image = join(dir, 'image.svg');
		const config = join(dir, 'data.json');
		await writeFile(image, '<svg xmlns="http://www.w3.org/2000/svg"/>');
		await writeFile(config, JSON.stringify({
			picBed: { current: 'mark-to-go-test', uploader: 'mark-to-go-test', 'mark-to-go-test': { enabled: true } },
			picgoPlugins: { [pluginName]: true }, settings: { language: 'en' },
		}));
		const session = await createPicListSession({ cliPath: '', nodePath: process.execPath, configPath: config, timeoutSeconds: 30 });
		try {
			assert.equal(await session.upload(image), 'https://images.example.test/plugin.svg');
		} finally {
			await session.close();
		}
		assert.equal(await readFile(join(packageDir, 'index.cjs'), 'utf8'), plugin);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

void test('real CLI uploads once, a restarted client exports from shared cache without a CLI, and content/config changes upload again', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'mark-to-go-cached-cli-'));
	try {
		const image = join(dir, 'image.svg');
		const config = join(dir, 'data.json');
		const cacheFile = join(dir, UPLOAD_CACHE_FILE);
		const configValue = {
			picBed: { current: 'local', uploader: 'local', local: { path: join(dir, 'stored'), customUrl: 'https://images.example.test' } },
			settings: { language: 'en' }, picgoPlugins: {},
		};
		await writeFile(image, '<svg xmlns="http://www.w3.org/2000/svg"><title>A</title></svg>');
		await writeFile(config, JSON.stringify(configValue));
		const runShare = (cliPath = '') => shareMarkdown('![[image.svg]]', {
			resolve: () => Promise.resolve({ key: 'image.svg', path: image }),
			openUploader: () => createCachedUploader(
				{ cliPath, nodePath: process.execPath, configPath: config, timeoutSeconds: 30 },
				new UploadCache(cacheFile), () => assert.fail('Unexpected cache warning')),
			copy: () => Promise.resolve(),
			progress: () => undefined,
		});
		const first = await runShare();
		assert.equal(first.uploaded, 1);
		assert.equal(first.reused, 0);
		const second = await runShare(join(dir, 'no-such-cli'));
		assert.equal(second.uploaded, 0);
		assert.equal(second.reused, 1);
		assert.equal(second.content, first.content);
		await writeFile(image, '<svg xmlns="http://www.w3.org/2000/svg"><title>B</title></svg>');
		const changed = await runShare();
		assert.equal(changed.uploaded, 1);
		assert.equal(changed.reused, 0);
		configValue.picBed.local.customUrl = 'https://other.example.test';
		await writeFile(config, JSON.stringify(configValue));
		const differentCloud = await runShare();
		assert.equal(differentCloud.uploaded, 1);
		assert.ok(differentCloud.content.includes('https://other.example.test/'));
		const persisted = JSON.parse(await readFile(cacheFile, 'utf8')) as { entries: Record<string, string> };
		assert.equal(Object.keys(persisted.entries).length, 3);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
