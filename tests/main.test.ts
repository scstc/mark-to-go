import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import { build } from 'esbuild';

void test('assistant initialization failures release the note for retry and fall back to a native error notice', async () => {
	const bundle = await build({ entryPoints: ['src/main.ts'], bundle: true, write: false,
		platform: 'node', format: 'cjs', loader: { '.svg': 'text' }, external: ['obsidian', 'electron'],
		plugins: [{ name: 'mock-ui', setup(builder) {
			builder.onResolve({ filter: /^\.\/assistant-notice$/ }, () => ({ path: 'test-assistant-notice', external: true }));
			builder.onResolve({ filter: /^\.\/result-modal$/ }, () => ({ path: 'test-result-modal', external: true }));
		} }],
	});
	let failAssistant = true;
	let assistantAttempts = 0;
	let copied = 0;
	let openedResults = 0;
	const nativeMessages: string[] = [];
	class NativeNotice {
		constructor(message: string) { nativeMessages.push(message); }
	}
	class AssistantNotice {
		constructor() {
			assistantAttempts++;
			if (failAssistant) throw new Error('Animation initialization failed');
		}
		setStage() {}
		updateMessage() {}
		hide() {}
	}
	class ResultModal {
		open() { openedResults++; }
		close() {}
	}
	const module = { exports: {} as unknown };
	const require = createRequire(import.meta.url);
	runInNewContext(bundle.outputFiles[0]!.text, { module, exports: module.exports,
		require: (id: string): unknown => id === 'obsidian' ? {
			Plugin: class {}, PluginSettingTab: class {}, Notice: NativeNotice,
			requireApiVersion: () => true, getLanguage: () => 'en',
		} : id === 'electron' ? { clipboard: { writeText: () => { copied++; } } }
			: id === 'test-assistant-notice' ? { AssistantNotice }
				: id === 'test-result-modal' ? { ShareResultModal: ResultModal } : require(id),
		process, Buffer, AbortController, URL,
	});
	const loaded = module.exports as { default: new () => {
		share(file: { name: string; path: string }): Promise<void>;
		readLatest(): Promise<string>;
		isSharing: boolean;
	} };
	const plugin = new loaded.default();
	plugin.readLatest = () => Promise.resolve('# Retry remains available');
	const file = { name: 'retry.md', path: 'retry.md' };

	await plugin.share(file);
	assert.equal(plugin.isSharing, false, 'A decorative initialization failure must not lock a note until restart');
	assert.equal(assistantAttempts, 2, 'The error assistant also fails in this scenario');
	assert.equal(nativeMessages.length, 1, 'A failed error assistant must still leave a native error message');
	assert.equal(copied, 0);
	assert.equal(openedResults, 0);

	failAssistant = false;
	await plugin.share(file);
	assert.equal(copied, 1, 'Retrying the same note must reach the actual clipboard operation');
	assert.equal(openedResults, 1);
	assert.equal(plugin.isSharing, false);
});
