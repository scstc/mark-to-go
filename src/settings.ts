import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type MarkToGoPlugin from './main';
import type { PicListOptions } from './piclist';
import { UPLOAD_CACHE_FILE } from './upload-cache';
import type { LanguageSetting } from './i18n';

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
		this.containerEl.empty();
		const t = this.plugin.t;
		new Setting(this.containerEl)
			.setName(t('languageName'))
			.setDesc(t('languageDescription'))
			.addDropdown(dropdown => dropdown
				.addOption('auto', t('autoLanguage'))
				.addOption('zh', '简体中文')
				.addOption('en', 'English')
				.setValue(this.plugin.settings.language)
				.onChange(async value => {
					if (value !== 'auto' && value !== 'en' && value !== 'zh') return;
					await this.plugin.setLanguage(value);
					this.display();
				}));
		this.containerEl.createEl('p', { text: t('instructions', { action: t('menuAction') }) });
		this.containerEl.createEl('p', { text: t('disclosure') });
		this.addPath(t('cliName'), t('cliDescription'), 'cliPath', t('cliPlaceholder'));
		this.addPath(t('nodeName'), t('nodeDescription'), 'nodePath', t('nodePlaceholder'));
		this.addPath(t('configName'), t('configDescription'), 'configPath', t('configPlaceholder'));
		this.addPath(t('outputName'), t('outputDescription'), 'outputDirectory', t('outputPlaceholder'));
		new Setting(this.containerEl)
			.setName(t('timeoutName'))
			.setDesc(t('timeoutDescription'))
			.addText((text) => text
				.setValue(String(this.plugin.settings.timeoutSeconds))
				.onChange(async (value) => {
					const number = Number(value);
					if (Number.isFinite(number) && number >= 5 && number <= 600) {
						this.plugin.settings.timeoutSeconds = Math.round(number);
						await this.plugin.saveSettings();
					}
				}));
		new Setting(this.containerEl)
			.setName(t('cacheName'))
			.setDesc(t('cacheDescription', { path: UPLOAD_CACHE_FILE }))
			.addButton((button) => {
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
	}

	private addPath(
		name: string,
		description: string,
		key: 'cliPath' | 'nodePath' | 'configPath' | 'outputDirectory',
		placeholder: string,
	): void {
		new Setting(this.containerEl).setName(name).setDesc(description)
			.addText((text) => text
				.setPlaceholder(placeholder)
				.setValue(this.plugin.settings[key])
				.onChange(async (value) => {
					this.plugin.settings[key] = value.trim();
					await this.plugin.saveSettings();
				}));
	}
}
