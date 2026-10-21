import { addIcon, FileSystemAdapter, MarkdownView, Notice, Plugin, removeIcon, TFile } from 'obsidian';
import icon from '../assets/icon-monochrome.svg';
import { realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { clipboard, remote } from 'electron';
import { DEFAULT_SETTINGS, MarkToGoSettingTab } from './settings';
import type { MarkToGoSettings } from './settings';
import { expandHome } from './piclist';
import { createCachedUploader } from './cached-uploader';
import { UPLOAD_CACHE_FILE, UploadCache } from './upload-cache';
import { saveMarkdown } from './export';
import { shareMarkdown } from './share';
import type { Resource } from './share';
import { ShareResultModal } from './result-modal';
import { createTranslator, localizeError, resolveLanguage, MarkToGoError } from './i18n';
import type { LanguageSetting, Translator } from './i18n';
import type { Command } from 'obsidian';

export default class MarkToGoPlugin extends Plugin {
	settings: MarkToGoSettings = { ...DEFAULT_SETTINGS };
	private readonly pending = new Map<string, AbortController>();
	private stopped = false;
	private uploadCache!: UploadCache;
	private shareCommand?: Command;

	get t(): Translator {
		const appLanguage = document.documentElement.lang || 'en';
		return createTranslator(resolveLanguage(this.settings.language, appLanguage));
	}

	async onload(): Promise<void> {
		this.stopped = false;
		addIcon(this.manifest.id, icon);
		this.register(() => removeIcon(this.manifest.id));
		this.settings = { ...DEFAULT_SETTINGS, ...await this.loadData() as Partial<MarkToGoSettings> };
		const adapter = this.app.vault.adapter;
		if (!(adapter instanceof FileSystemAdapter)) throw new MarkToGoError('desktopRequired');
		this.uploadCache = new UploadCache(resolve(adapter.getBasePath(), UPLOAD_CACHE_FILE));
		try {
			await this.uploadCache.initialize();
		} catch {
			new Notice(this.t('cacheInitializeFailed'), 12000);
		}
		this.addSettingTab(new MarkToGoSettingTab(this.app, this));
		this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
			if (!(file instanceof TFile) || file.extension.toLowerCase() !== 'md') return;
			menu.addItem((item) => item.setTitle(this.t('menuAction')).setIcon(this.manifest.id)
				.setDisabled(this.pending.has(file.path))
				.onClick(() => this.share(file)));
		}));
		this.shareCommand = this.addCommand({
			id: 'share-note',
			icon: this.manifest.id,
			name: this.t('commandAction'),
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!file || file.extension.toLowerCase() !== 'md') return false;
				if (!checking) void this.share(file);
				return true;
			},
		});
	}

	onunload(): void {
		this.stopped = true;
		for (const controller of this.pending.values()) controller.abort();
		this.pending.clear();
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	async setLanguage(language: LanguageSetting): Promise<void> {
		this.settings.language = language;
		await this.saveSettings();
		if (this.shareCommand) this.shareCommand.name = this.manifest.name + ': ' + this.t('commandAction');
	}

	get isSharing(): boolean {
		return this.pending.size > 0;
	}

	async clearUploadCache(): Promise<void> {
		if (this.isSharing) throw new MarkToGoError('clearWhileSharing');
		await this.uploadCache.clear();
	}

	private async readLatest(file: TFile): Promise<string> {
		const active = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (active?.file?.path === file.path) return active.editor.getValue();
		let content: string | undefined;
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (content === undefined && leaf.view instanceof MarkdownView && leaf.view.file?.path === file.path) {
				content = leaf.view.editor.getValue();
			}
		});
		return content ?? await this.app.vault.cachedRead(file);
	}

	private async resolveImage(target: string, source: TFile): Promise<Resource | null> {
		const file = this.app.metadataCache.getFirstLinkpathDest(target, source.path);
		if (!(file instanceof TFile)) return null;
		const adapter = this.app.vault.adapter;
		if (!(adapter instanceof FileSystemAdapter)) throw new MarkToGoError('desktopRequired');
		let absolute: string;
		let root: string;
		try {
			root = await realpath(adapter.getBasePath());
			absolute = await realpath(resolve(root, file.path));
		} catch {
			return null;
		}
		const within = relative(root, absolute);
		if (within === '..' || within.startsWith('../') || within.startsWith('..\\') || isAbsolute(within)) {
			throw new MarkToGoError('outsideVault');
		}
		return { key: file.path, path: absolute };
	}

	async share(file: TFile): Promise<void> {
		const key = file.path;
		if (this.pending.has(key) || this.stopped) return;
		const controller = new AbortController();
		this.pending.set(key, controller);
		const notice = new Notice(this.t('preparing'), 0);
		try {
			const settings = { ...this.settings };
			const name = file.name;
			let cacheWarningShown = false;
			const result = await shareMarkdown(await this.readLatest(file), {
				translate: this.t,
				resolve: (target) => this.resolveImage(target, file),
				openUploader: () => createCachedUploader(settings, this.uploadCache, () => {
					if (!this.stopped && !cacheWarningShown) {
						cacheWarningShown = true;
						new Notice(this.t('cacheWarning'), 12000);
					}
				}, controller.signal),
				copy: (content) => {
					clipboard.writeText(content);
					return Promise.resolve();
				},
				progress: (message) => { if (!this.stopped) notice.setMessage(message); },
				signal: controller.signal,
			});
			if (!this.stopped) new ShareResultModal(this.app, result, this.t, async () => {
				const directory = settings.outputDirectory.trim()
					? expandHome(settings.outputDirectory.trim()) : remote?.app.getPath('downloads');
				if (!directory) throw new MarkToGoError('downloadsMissing');
				try {
					return await saveMarkdown(directory, name, result.content);
				} catch {
					throw new MarkToGoError('saveFailed', { uploaded: result.uploaded });
				}
			}, Boolean(settings.outputDirectory.trim())).open();
		} catch (error) {
			if (!this.stopped) new Notice(localizeError(error, this.t), 12000);
		} finally {
			notice.hide();
			this.pending.delete(key);
		}
	}
}
