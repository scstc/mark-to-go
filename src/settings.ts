import { App, Modal, Notice, PluginSettingTab, requireApiVersion, Setting } from 'obsidian';
import type { SettingDefinitionItem } from 'obsidian';
import { remote } from 'electron';
import type MarkToGoPlugin from './main';
import type { PicListOptions } from './piclist';
import { UPLOAD_CACHE_FILE } from './upload-cache';
import type { LanguageSetting } from './i18n';
import { checkLocalConfiguration } from './local-configuration';
import type { MessageKey } from './i18n';

interface SettingRow {
	name: string;
	desc: string;
	render?: (setting: Setting) => void;
}

export interface MarkToGoSettings extends PicListOptions {
	outputDirectory: string;
	language: LanguageSetting;
}

export const DEFAULT_SETTINGS: MarkToGoSettings = {
	cliPath: '',
	nodePath: '',
	configPath: '',
	outputDirectory: '',
	timeoutSeconds: 120,
	language: 'auto',
};

export class MarkToGoSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: MarkToGoPlugin) {
		super(app, plugin);
	}

	display(): void {
		this.renderLegacy();
	}

	private renderLegacy(): void {
		this.containerEl.empty();
		for (const row of this.rows()) {
			const setting = new Setting(this.containerEl).setName(row.name).setDesc(row.desc);
			row.render?.(setting);
		}
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return this.rows().map((row): SettingDefinitionItem => row.render
			? { name: row.name, desc: row.desc, render: row.render }
			: { name: row.name, desc: row.desc });
	}

	private refresh(): void {
		if (requireApiVersion('1.13.0')) this.update();
		else this.renderLegacy();
	}

	private rows(): SettingRow[] {
		const t = this.plugin.t;
		return [{ name: t('languageName'), desc: t('languageDescription'),
			render: setting => { setting.addDropdown(dropdown => dropdown
				.addOption('auto', t('autoLanguage'))
				.addOption('zh', '简体中文')
				.addOption('en', 'English')
				.setValue(this.plugin.settings.language)
				.onChange(async value => {
					if (value !== 'auto' && value !== 'en' && value !== 'zh') return;
					await this.plugin.setLanguage(value);
					this.refresh();
				})); } },
		{ name: 'MarkToGo', desc: t('instructions', { action: t('menuAction') }) + ' ' + t('disclosure') },
		this.pathRow(t('cliName'), t('cliDescription'), 'cliPath', t('cliPlaceholder')),
		this.pathRow(t('nodeName'), t('nodeDescription'), 'nodePath', t('nodePlaceholder')),
		this.pathRow(t('configName'), t('configDescription'), 'configPath', t('configPlaceholder')),
		this.pathRow(t('outputName'), t('outputDescription'), 'outputDirectory', t('outputPlaceholder')),
		{ name: t('timeoutName'), desc: t('timeoutDescription'), render: setting => {
			setting.addText((text) => {
				text.setValue(String(this.plugin.settings.timeoutSeconds)).onChange(async (value) => {
					const number = Number(value);
					const valid = Number.isFinite(number) && number >= 5 && number <= 600;
					text.inputEl.setAttribute('aria-invalid', String(!valid));
					setting.setDesc(t(valid ? 'timeoutDescription' : 'timeoutInvalid'));
					if (valid) {
						this.plugin.settings.timeoutSeconds = Math.round(number);
						await this.plugin.saveSettings();
					}
				});
				text.inputEl.onblur = () => {
					text.setValue(String(this.plugin.settings.timeoutSeconds));
					text.inputEl.removeAttribute('aria-invalid');
					setting.setDesc(t('timeoutDescription'));
				};
			});
		} },
		{ name: t('checkConfiguration'), desc: t('checkDescription'), render: setting => {
			setting.addButton(button => button.setButtonText(t('checkConfiguration')).onClick(async () => {
				button.buttonEl.disabled = true;
				try {
					const items = await checkLocalConfiguration(this.plugin.settings, remote?.app.getPath('downloads'));
					const modal = new Modal(this.app);
					modal.titleEl.setText(t('checkConfiguration'));
					modal.contentEl.createEl('p', { text: t('checkDescription') });
					const labels: Record<typeof items[number]['id'], MessageKey> = {
						node: 'nodeName', cli: 'cliName', config: 'configName', provider: 'checkProvider',
						output: 'outputName', fileClipboard: 'copyFile',
					};
					for (const item of items) {
						const row = new Setting(modal.contentEl).setName(t(labels[item.id])).setDesc(t(item.message));
						row.controlEl.createSpan({ text: t(item.status === 'ok' ? 'checkOk' :
							item.status === 'warning' ? 'checkWarning' : 'checkError') });
					}
					modal.open();
				} catch { new Notice(t('checkUnavailable')); }
				finally { button.buttonEl.disabled = false; }
			}));
		} },
		{ name: t('cacheName'), desc: t('cacheDescription', { path: UPLOAD_CACHE_FILE }), render: setting => {
			setting.addButton((button) => {
				button.setButtonText(t('cacheClear'));
				button.buttonEl.disabled = this.plugin.isSharing;
				button.onClick(async () => {
					button.buttonEl.disabled = true;
					try {
						await this.plugin.clearUploadCache();
						new Notice(t('cacheCleared'));
					} catch {
						new Notice(t('cacheClearFailed'));
					} finally {
						button.buttonEl.disabled = this.plugin.isSharing;
					}
				});
			});
		} }];
	}

	private pathRow(
		name: string,
		description: string,
		key: 'cliPath' | 'nodePath' | 'configPath' | 'outputDirectory',
		placeholder: string,
	): SettingRow {
		return { name, desc: description, render: setting => {
			setting.addText((text) => text
				.setPlaceholder(placeholder)
				.setValue(this.plugin.settings[key])
				.onChange(async (value) => {
					this.plugin.settings[key] = value.trim();
					await this.plugin.saveSettings();
				}));
		} };
	}
}
