import { App, Modal, Notice, PluginSettingTab, requireApiVersion, SecretComponent, Setting } from 'obsidian';
import type { SettingDefinitionItem } from 'obsidian';
import { remote, shell } from 'electron';
import type MarkToGoPlugin from './main';
import type { PicListOptions } from './piclist';
import { UPLOAD_CACHE_FILE } from './upload-cache';
import type { LanguageSetting } from './i18n';
import { checkLocalConfiguration } from './local-configuration';
import type { MessageKey } from './i18n';
import type { OssOptions } from './oss-config';
import type { S3Options } from './s3-config';

interface SettingRow {
	name: string;
	desc: string;
	render?: (setting: Setting) => void;
}

export interface MarkToGoSettings extends PicListOptions, OssOptions, S3Options {
	uploadProvider: 'piclist' | 'oss' | 's3';
	outputDirectory: string;
	language: LanguageSetting;
}

export const DEFAULT_SETTINGS: MarkToGoSettings = {
	uploadProvider: 'piclist',
	ossRegion: '',
	ossBucket: '',
	ossAccessKeyId: '',
	ossSecretName: '',
	ossPrefix: 'mark-to-go/',
	ossPublicBaseUrl: '',
	s3Region: '',
	s3Bucket: '',
	s3AccessKeyId: '',
	s3SecretName: '',
	s3Prefix: 'mark-to-go/',
	s3PublicBaseUrl: '',
	cliPath: '',
	nodePath: '',
	configPath: '',
	outputDirectory: '',
	timeoutSeconds: 120,
	language: 'auto',
};

/** Add defaults without replacing existing PicList paths or other preferences. */
export function loadSettings(saved: Partial<MarkToGoSettings> | null | undefined): MarkToGoSettings {
	return { ...DEFAULT_SETTINGS, ...saved,
		uploadProvider: saved?.uploadProvider === 'oss' || saved?.uploadProvider === 's3' ? saved.uploadProvider : 'piclist' };
}

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
		{ name: t('helpName'), desc: t('helpDescription'), render: setting => {
			setting.addButton(button => button.setButtonText(t('openHelp')).onClick(() => this.openLink(
				'https://scstc.github.io/mark-to-go/?lang=' + (t('helpLanguage')) + '#guide-install')));
		} },
		{ name: t('uploadProviderName'), desc: t('uploadProviderDescription'), render: setting => {
			setting.settingEl.addClass('mark-to-go-upload-method');
			setting.addDropdown(dropdown => dropdown.addOption('piclist', t('piclistName')).addOption('oss', t('ossName'))
				.addOption('s3', t('s3Name'))
				.setValue(this.plugin.settings.uploadProvider).onChange(async value => {
					if (value !== 'piclist' && value !== 'oss' && value !== 's3') return;
					this.plugin.settings.uploadProvider = value;
					await this.plugin.saveSettings();
					this.refresh();
				}));
		} },
		...this.providerRows(),
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
					const items = await checkLocalConfiguration(this.plugin.settings, remote?.app.getPath('downloads'), () => {
						if (requireApiVersion('1.11.4')) {
							const settings = this.plugin.settings;
							return Boolean(this.app.secretStorage.getSecret(settings.uploadProvider === 's3'
								? settings.s3SecretName : settings.ossSecretName)?.trim());
						}
						return false;
					});
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

	private providerRows(): SettingRow[] {
		const t = this.plugin.t;
		if (this.plugin.settings.uploadProvider === 'piclist') return [
			this.pathRow(t('cliName'), t('cliDescription'), 'cliPath', t('cliPlaceholder')),
			this.pathRow(t('nodeName'), t('nodeDescription'), 'nodePath', t('nodePlaceholder')),
			this.pathRow(t('configName'), t('configDescription'), 'configPath', t('configPlaceholder')),
		];
		const s3 = this.plugin.settings.uploadProvider === 's3';
		if (!requireApiVersion('1.11.4')) return [{ name: t(s3 ? 's3Name' : 'ossName'),
			desc: t(s3 ? 's3UpgradeRequired' : 'ossUpgradeRequired') }];
		if (s3) return [
			this.consoleRow(t('s3Name'), t('s3Description'), () => this.s3Console('s3')),
			this.pathRow(t('s3RegionName'), t('s3RegionDescription'), 's3Region', 'us-east-1'),
			this.pathRow('Bucket', t('s3BucketDescription'), 's3Bucket', 'my-bucket'),
			this.pathRow(t('s3AccessKeyName'), t('s3AccessKeyDescription'), 's3AccessKeyId', '', () => this.s3Console('iam')),
			this.secretRow(t('s3SecretName'), 's3SecretName'),
			this.pathRow(t('s3PrefixName'), t('s3PrefixDescription'), 's3Prefix', 'mark-to-go/'),
			this.pathRow(t('s3DomainName'), t('s3DomainDescription'), 's3PublicBaseUrl', 'https://images.example.com'),
		];
		return [
			this.consoleRow(t('ossName'), t('ossDescription'), 'https://oss.console.aliyun.com/'),
			this.pathRow(t('ossRegionName'), t('ossRegionDescription'), 'ossRegion', 'cn-hangzhou'),
			this.pathRow('Bucket', t('ossBucketDescription'), 'ossBucket', 'my-bucket'),
			this.pathRow('AccessKey ID', t('ossAccessKeyDescription'), 'ossAccessKeyId', '', 'https://ram.console.aliyun.com/users'),
			this.secretRow('AccessKey Secret', 'ossSecretName'),
			this.pathRow(t('ossPrefixName'), t('ossPrefixDescription'), 'ossPrefix', 'mark-to-go/'),
			this.pathRow(t('ossDomainName'), t('ossDomainDescription'), 'ossPublicBaseUrl', 'https://images.example.com'),
		];
	}

	private s3Console(service: 's3' | 'iam'): string {
		const host = this.plugin.settings.s3Region.startsWith('cn-') ? 'console.amazonaws.cn' : 'console.aws.amazon.com';
		return `https://${host}/${service}/home`;
	}

	private consoleRow(name: string, desc: string, url: string | (() => string)): SettingRow {
		return { name, desc, render: setting => {
			setting.addButton(button => button.setButtonText(this.plugin.t('openConsole'))
				.onClick(() => this.openLink(typeof url === 'string' ? url : url())));
		} };
	}

	private async openLink(url: string): Promise<void> {
		try { await shell.openExternal(url); }
		catch { new Notice(this.plugin.t('openLinkFailed')); }
	}

	private secretRow(name: string, key: 'ossSecretName' | 's3SecretName'): SettingRow {
		return { name, desc: this.plugin.t('ossSecretDescription'), render: setting => {
			if (requireApiVersion('1.11.4')) {
				setting.addComponent(el => new SecretComponent(this.app, el)
					.setValue(this.plugin.settings[key]).onChange(async value => {
						this.plugin.settings[key] = value ?? '';
						await this.plugin.saveSettings();
					}));
			}
		} };
	}

	private pathRow(
		name: string,
		description: string,
		key: 'cliPath' | 'nodePath' | 'configPath' | 'outputDirectory' |
			Exclude<keyof OssOptions, 'ossSecretName'> | Exclude<keyof S3Options, 's3SecretName'>,
		placeholder: string,
		helpUrl?: string | (() => string),
	): SettingRow {
		return { name, desc: description, render: setting => {
			setting.addText((text) => text
				.setPlaceholder(placeholder)
				.setValue(this.plugin.settings[key])
				.onChange(async (value) => {
					this.plugin.settings[key] = value.trim();
					await this.plugin.saveSettings();
				}));
			if (helpUrl) setting.addExtraButton(button => {
				button.setIcon('external-link');
				button.extraSettingsEl.setAttribute('aria-label', this.plugin.t('openKeyManagement'));
				if (requireApiVersion('1.1.0')) button.setTooltip(this.plugin.t('openKeyManagement'));
				button.onClick(() => { void this.openLink(typeof helpUrl === 'string' ? helpUrl : helpUrl()); });
			});
		} };
	}
}
