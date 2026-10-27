import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import { build } from 'esbuild';
import { createTranslator } from '../src/i18n.ts';

class TextControl {
	value = '';
	change?: (value: string) => unknown;
	inputEl = { onblur: undefined as (() => void) | undefined,
		setAttribute: () => undefined, removeAttribute: () => undefined };
	setValue(value: string) { this.value = value; return this; }
	setPlaceholder() { return this; }
	addOption() { return this; }
	onChange(callback: (value: string) => unknown) { this.change = callback; return this; }
}

class Row {
	static rows: Row[] = [];
	name = '';
	desc = '';
	text?: TextControl;
	constructor() { Row.rows.push(this); }
	setName(name: string) { this.name = name; return this; }
	setDesc(desc: string) { this.desc = desc; return this; }
	addText(render: (control: TextControl) => void) { this.text = new TextControl(); render(this.text); return this; }
	addDropdown(render: (control: TextControl) => void) { return this.addText(render); }
	addButton(render: (button: { buttonEl: { disabled: boolean }; setButtonText(text: string): unknown; onClick(cb: () => unknown): unknown }) => void) {
		const button = { buttonEl: { disabled: false }, setButtonText: (_text: string) => button,
			onClick: (_callback: () => unknown) => button };
		render(button); return this;
	}
}

class Tab {
	updates = 0;
	containerEl = { empty: () => { Row.rows = []; } };
	update() { this.updates++; }
}

void test('search definitions and legacy rendering share real controls; invalid timeout never silently saves', async () => {
	const bundle = await build({ entryPoints: ['src/settings.ts'], bundle: true, write: false,
		platform: 'node', format: 'cjs', external: ['obsidian', 'electron'] });
	const require = createRequire(import.meta.url);
	for (const modern of [false, true]) {
		const module = { exports: {} as unknown };
		runInNewContext(bundle.outputFiles[0]!.text, { module, exports: module.exports,
			require: (id: string): unknown => id === 'obsidian' ? {
				PluginSettingTab: Tab, Setting: Row, requireApiVersion: () => modern,
			} : id === 'electron' ? { remote: undefined } : require(id),
			process, Buffer, AbortController, URL,
		});
		const loaded = module.exports as { MarkToGoSettingTab: new (app: object, plugin: object) => Tab & {
			display(): void; getSettingDefinitions(): Array<{ name: string; render?: (row: Row) => void }>;
		}; DEFAULT_SETTINGS: { timeoutSeconds: number; language: string } };
		let saves = 0;
		let languageChanges = 0;
		const plugin = { settings: { ...loaded.DEFAULT_SETTINGS }, t: createTranslator('en'), isSharing: false,
			saveSettings: () => { saves++; return Promise.resolve(); },
			setLanguage: () => { languageChanges++; return Promise.resolve(); },
		};
		const tab = new loaded.MarkToGoSettingTab({}, plugin);
		const definitions = tab.getSettingDefinitions();
		assert.ok(definitions.some(d => d.name === 'Check local configuration' && d.render));
		assert.ok(definitions.some(d => d.name === 'Upload timeout per image' && d.render));
		tab.display();
		assert.deepEqual(Row.rows.map(r => r.name), Array.from(definitions, d => d.name));
		const timeout = Row.rows.find(r => r.name === 'Upload timeout per image')!;
		await timeout.text!.change!('abc');
		assert.equal(saves, 0);
		assert.equal(plugin.settings.timeoutSeconds, 120);
		assert.ok(timeout.desc.includes('previous value'));
		timeout.text!.inputEl.onblur!();
		assert.equal(timeout.text!.value, '120');
		await timeout.text!.change!('45');
		assert.equal(plugin.settings.timeoutSeconds, 45);
		assert.equal(saves, 1);
		await Row.rows.find(r => r.name === 'Language')!.text!.change!('zh');
		assert.equal(languageChanges, 1);
		assert.equal(tab.updates, modern ? 1 : 0);
	}
});

void test('automatic language selection never calls the newer API on old Obsidian', async () => {
	const bundle = await build({ entryPoints: ['src/main.ts'], bundle: true, write: false,
		platform: 'node', format: 'cjs', loader: { '.svg': 'text' }, external: ['obsidian', 'electron'] });
	const require = createRequire(import.meta.url);
	let modern = false;
	let languageCalls = 0;
	const module = { exports: {} as unknown };
	runInNewContext(bundle.outputFiles[0]!.text, { module, exports: module.exports,
		require: (id: string): unknown => id === 'obsidian' ? {
			Plugin: class {}, PluginSettingTab: Tab, Modal: class {},
			requireApiVersion: () => modern,
			getLanguage: () => { languageCalls++; assert.ok(modern); return 'zh'; },
		} : id === 'electron' ? {} : require(id),
		process, Buffer, AbortController, URL, document: { documentElement: { lang: 'en' } },
	});
	const loaded = module.exports as { default: new () => { t: ReturnType<typeof createTranslator> } };
	const plugin = new loaded.default();
	assert.equal(plugin.t('copyMarkdown'), 'Copy text');
	assert.equal(languageCalls, 0);
	modern = true;
	assert.equal(plugin.t('copyMarkdown'), '复制文本');
	assert.equal(languageCalls, 1);
});
