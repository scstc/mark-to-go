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

class PreviewElement {
	children: PreviewElement[] = [];
	parent?: PreviewElement;
	attributes = new Map<string, string>();
	text = '';
	onclick?: () => void;
	constructor(readonly tag: string) {}
	addClass(...names: string[]) { this.setAttribute('class', names.join(' ')); }
	setAttribute(name: string, value: string) { this.attributes.set(name, value); }
	setText(text: string) { this.text = text; }
	remove() {
		if (!this.parent) return;
		this.parent.children = this.parent.children.filter(child => child !== this);
		this.parent = undefined;
	}
	private createChild(tag: string, options: { cls?: string; text?: string; attr?: Record<string, string> } = {}) {
		const element = new PreviewElement(tag);
		if (options.cls) element.addClass(options.cls);
		if (options.text) element.setText(options.text);
		for (const [name, value] of Object.entries(options.attr ?? {})) element.setAttribute(name, value);
		element.parent = this;
		this.children.push(element);
		return element;
	}
	createEl(tag: string, options?: { cls?: string; text?: string; attr?: Record<string, string> }) { return this.createChild(tag, options); }
	createDiv(options?: { cls?: string; text?: string; attr?: Record<string, string> }) { return this.createChild('div', options); }
	createSvg(tag: string, options?: { cls?: string; text?: string; attr?: Record<string, string> }) { return this.createChild(tag, options); }
	descendants(): PreviewElement[] { return this.children.flatMap(child => [child, ...child.descendants()]); }
}

class Row {
	settingEl = new PreviewElement('div');
	controlEl = this.settingEl.createDiv();
	static rows: Row[] = [];
	name = '';
	desc = '';
	text?: TextControl;
	constructor() { Row.rows.push(this); }
	setName(name: string) { this.name = name; return this; }
	setDesc(desc: string) { this.desc = desc; return this; }
	addText(render: (control: TextControl) => void) { this.text = new TextControl(); render(this.text); return this; }
	addDropdown(render: (control: TextControl) => void) { return this.addText(render); }
	addComponent(render: (element: object) => TextControl) { this.text = render({}); return this; }
	addExtraButton(render: (button: { setIcon(icon: string): unknown; setTooltip(text: string): unknown; onClick(cb: () => unknown): unknown }) => void) {
		const button = { extraSettingsEl: { setAttribute: (_name: string, _value: string) => undefined },
			setIcon: (_icon: string) => button, setTooltip: (_text: string) => button,
			onClick: (_callback: () => unknown) => button };
		render(button); return this;
	}
	addButton(render: (button: { buttonEl: { disabled: boolean }; setButtonText(text: string): unknown; onClick(cb: () => unknown): unknown }) => void) {
		const button = { buttonEl: { disabled: false }, setButtonText: (_text: string) => button,
			onClick: (_callback: () => unknown) => button };
		render(button); return this;
	}
}

class Tab {
	updates = 0;
	hides = 0;
	containerEl = { empty: () => { Row.rows = []; } };
	update() { this.updates++; }
	hide() { this.hides++; }
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
			display(): void; getSettingDefinitions(): Array<{ name: string; render?: (row: Row) => void | (() => void) }>;
		}; DEFAULT_SETTINGS: { timeoutSeconds: number; language: string } };
		let saves = 0;
		let languageChanges = 0;
		const unloadCallbacks: Array<() => void> = [];
		const plugin = { settings: { ...loaded.DEFAULT_SETTINGS }, t: createTranslator('en'), isSharing: false,
			register: (cleanup: () => void) => { unloadCallbacks.push(cleanup); },
			saveSettings: () => { saves++; return Promise.resolve(); },
			setLanguage: () => { languageChanges++; return Promise.resolve(); },
		};
		const tab = new loaded.MarkToGoSettingTab({}, plugin);
		const definitions = tab.getSettingDefinitions();
		assert.ok(definitions.some(d => d.name === 'Check local configuration' && d.render));
		assert.ok(definitions.some(d => d.name === 'Upload timeout per image' && d.render));
		tab.display();
		assert.deepEqual(Row.rows.map(r => r.name), Array.from(definitions, d => d.name));
		const settingsBeforePreview = JSON.stringify(plugin.settings);
		const preview = Row.rows.find(row => row.name === 'Assistant preview')!.controlEl.children[0]!;
		const previewElements = preview.descendants();
		const copied = previewElements.find(element => element.tag === 'button' && element.text === 'Copied')!;
		const pause = previewElements.find(element => element.tag === 'button' && element.text === 'Pause animation')!;
		assert.equal(typeof copied.onclick, 'function');
		assert.equal(typeof pause.onclick, 'function');
		copied.onclick!();
		pause.onclick!();
		assert.equal(preview.attributes.get('data-state'), 'copied');
		assert.equal(preview.attributes.get('data-paused'), 'true');
		assert.equal(saves, 0, 'Trying the assistant must not save or change upload settings');
		assert.equal(JSON.stringify(plugin.settings), settingsBeforePreview);
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
		const settingsBeforeCleanup = JSON.stringify(plugin.settings);
		tab.display();
		assert.equal(preview.parent, undefined, 'Re-rendering must retire the previous preview');
		const renderedPreview = Row.rows.find(row => row.name === 'Assistant preview')!.controlEl.children[0]!;
		const searchRow = new Row();
		const disposeSearch = tab.getSettingDefinitions().find(definition => definition.name === 'Assistant preview')!.render!(searchRow);
		assert.equal(typeof disposeSearch, 'function');
		if (disposeSearch) { disposeSearch(); disposeSearch(); }
		assert.equal(searchRow.controlEl.children.length, 0, 'Search render cleanup must remove its preview');
		tab.hide();
		tab.hide();
		assert.equal(renderedPreview.parent, undefined, 'Hiding settings must retire the visible preview');
		assert.equal(tab.hides, 2);
		tab.display();
		const unloadingPreview = Row.rows.find(row => row.name === 'Assistant preview')!.controlEl.children[0]!;
		assert.equal(unloadCallbacks.length, 1, 'Re-renders must not accumulate plugin unload callbacks');
		unloadCallbacks[0]!();
		unloadCallbacks[0]!();
		assert.equal(unloadingPreview.parent, undefined, 'Plugin unload cleanup must be safe to repeat');
		assert.equal(JSON.stringify(plugin.settings), settingsBeforeCleanup);
		assert.equal(saves, 1);
	}
});

void test('upgrading keeps the selected provider and switching preserves all three configurations and secret references', async () => {
	const bundle = await build({ entryPoints: ['src/settings.ts'], bundle: true, write: false,
		platform: 'node', format: 'cjs', external: ['obsidian', 'electron'] });
	const require = createRequire(import.meta.url);
	for (const supportsSecrets of [false, true]) {
		const module = { exports: {} as unknown };
		runInNewContext(bundle.outputFiles[0]!.text, { module, exports: module.exports,
			require: (id: string): unknown => id === 'obsidian' ? {
				PluginSettingTab: Tab, Setting: Row, ...(supportsSecrets ? { SecretComponent: TextControl } : {}),
				requireApiVersion: (version: string) => version === '1.13.0' ? false : supportsSecrets,
			} : id === 'electron' ? { remote: undefined } : require(id), process, Buffer, AbortController, URL,
		});
		interface Settings {
			uploadProvider: string; cliPath: string; nodePath: string; configPath: string;
			outputDirectory: string; language: string; timeoutSeconds: number; ossRegion: string; ossSecretName: string;
			s3Region: string; s3SecretName: string;
		}
		const loaded = module.exports as { loadSettings(saved: Partial<Settings>): Settings;
			MarkToGoSettingTab: new (app: object, plugin: object) => Tab & { display(): void } };
		const previous = { cliPath: 'C:/custom/picgo', nodePath: 'C:/custom/node.exe', configPath: 'C:/custom/data.json',
			outputDirectory: 'D:/exports', timeoutSeconds: 45, language: 'zh' };
		const settings = loaded.loadSettings(previous);
		assert.equal(settings.uploadProvider, 'piclist');
		assert.equal(loaded.loadSettings({ ...previous, uploadProvider: 'oss' }).uploadProvider, 'oss');
		assert.equal(loaded.loadSettings({ ...previous, uploadProvider: 's3' }).uploadProvider, 's3');
		for (const [key, value] of Object.entries(previous)) assert.equal(settings[key as keyof Settings], value);
		const plugin = { settings, t: createTranslator('en'), isSharing: false, saveSettings: () => Promise.resolve(),
			register: (_cleanup: () => void) => undefined };
		const tab = new loaded.MarkToGoSettingTab({}, plugin);
		tab.display();
		assert.ok(Row.rows.some(row => row.name === 'PicList CLI entry'));
		await Row.rows.find(row => row.name === 'Upload method')!.text!.change!('oss');
		assert.ok(Row.rows.every(row => row.name !== 'PicList CLI entry'));
		if (supportsSecrets) {
			await Row.rows.find(row => row.name === 'OSS region')!.text!.change!('cn-shanghai');
			await Row.rows.find(row => row.name === 'AccessKey Secret')!.text!.change!('my-oss-secret');
			assert.equal(settings.ossSecretName, 'my-oss-secret');
		} else {
			assert.ok(Row.rows.some(row => row.desc.includes('1.11.4')));
			assert.ok(Row.rows.every(row => row.name !== 'AccessKey Secret'));
		}
		await Row.rows.find(row => row.name === 'Upload method')!.text!.change!('s3');
		if (supportsSecrets) {
			await Row.rows.find(row => row.name === 'S3 region')!.text!.change!('us-west-2');
			await Row.rows.find(row => row.name === 'Secret access key')!.text!.change!('my-s3-secret');
		} else {
			assert.ok(Row.rows.some(row => row.desc.includes('1.11.4')));
			assert.ok(Row.rows.every(row => row.name !== 'Secret access key'));
		}
		await Row.rows.find(row => row.name === 'Upload method')!.text!.change!('piclist');
		assert.equal(Row.rows.find(row => row.name === 'PicList CLI entry')!.text!.value, previous.cliPath);
		for (const [key, value] of Object.entries(previous)) assert.equal(settings[key as keyof Settings], value);
		const reloaded = loaded.loadSettings(JSON.parse(JSON.stringify(settings)) as Settings);
		assert.equal(reloaded.ossRegion, supportsSecrets ? 'cn-shanghai' : '');
		assert.equal(reloaded.ossSecretName, supportsSecrets ? 'my-oss-secret' : '');
		assert.equal(reloaded.s3Region, supportsSecrets ? 'us-west-2' : '');
		assert.equal(reloaded.s3SecretName, supportsSecrets ? 'my-s3-secret' : '');
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
			Plugin: class {}, PluginSettingTab: Tab, Modal: class {}, Notice: class {},
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
