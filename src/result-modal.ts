import { App, Modal, Notice, Setting } from 'obsidian';
import type { ButtonComponent } from 'obsidian';
import { clipboard, shell } from 'electron';
import type { ShareResult } from './share';
import type { Translator } from './i18n';
import { localizeError } from './i18n';
import { copyMarkdownFile } from './file-clipboard';
import type { ClipboardCoordinator } from './clipboard-coordinator';
import { createAssistant } from './assistant';
import type { AssistantView } from './assistant';

export class ShareResultModal extends Modal {
	private assistant?: AssistantView;
	private opened = false;

	constructor(
		app: App,
		private readonly result: ShareResult,
		private readonly filename: string,
		private readonly t: Translator,
		private readonly saveFile: () => Promise<string>,
		private readonly clipboard: ClipboardCoordinator,
		private readonly customFolder = false,
		private readonly closed: () => void = () => undefined,
	) {
		super(app);
	}

	onOpen(): void {
		this.opened = true;
		this.titleEl.setText(this.t('resultTitle'));
		this.contentEl.createEl('p').createEl('strong', { text: this.filename });
		this.contentEl.createEl('p', {
			text: this.t('resultCounts', { uploaded: this.result.uploaded, reused: this.result.reused }),
		});
		const initialState = this.result.clipboardStatus === 'copied' ? 'copied' :
			this.result.clipboardStatus === 'failed' ? 'error' : 'idle';
		const assistant = createAssistant(this.contentEl, this.t, initialState, true);
		this.assistant = assistant;
		assistant.setState(initialState, this.t(this.result.clipboardStatus === 'copied' ? 'clipboardCopied' :
			this.result.clipboardStatus === 'skipped' ? 'clipboardSkipped' : 'clipboardFailed'));
		this.contentEl.createEl('p', { text: this.t('copyFileHint'), cls: 'setting-item-description' });
		const fileStatus = this.contentEl.createEl('p', { text: this.t('notSaved') });
		let saving = false;
		let saved = false;
		const saveLabel = this.t(this.customFolder ? 'saveFile' : 'saveToDownloads');
		const actions = new Setting(this.contentEl);
		actions.addButton((button) => button.setButtonText(saveLabel).onClick(async () => {
			if (saving || saved) return;
			saving = true;
			button.buttonEl.disabled = true;
			button.setButtonText(this.t('savingFile'));
			try {
				const path = await this.saveFile();
				saved = true;
				if (!this.opened) return;
				fileStatus.empty();
				fileStatus.createEl('code', { text: path });
				new Setting(this.contentEl).addButton((folder) => folder.setButtonText(this.t('openFolder')).onClick(() => {
					try {
						shell.showItemInFolder(path);
						this.close();
					} catch {
						new Notice(this.t('openFolderFailed'));
					}
				}));
			} catch (error) {
				new Notice(localizeError(error, this.t), 12000);
			} finally {
				saving = false;
				if (this.opened) {
					button.buttonEl.disabled = saved;
					button.setButtonText(saved ? this.t('fileSaved') : saveLabel);
				}
			}
		}));
		let copying = false;
		let fileButton: ButtonComponent;
		let textButton: ButtonComponent;
		actions.addButton((button) => {
			textButton = button;
			button.setButtonText(this.t('copyMarkdown')).onClick(async () => {
				if (copying) return;
				const ticket = this.clipboard.claim();
				assistant.setState('copying', this.t('copying'));
				try {
					const outcome = await this.clipboard.write(ticket, async () => clipboard.writeText(this.result.content));
					if (!this.opened) return;
					assistant.setState(outcome === 'copied' ? 'copied' : 'idle',
						this.t(outcome === 'copied' ? 'clipboardCopied' : 'clipboardSkipped'));
					fileButton.setButtonText(this.t('copyFile'));
				} catch {
					assistant.setState('error', this.t('clipboardRetryFailed'));
				}
			});
		});
		actions.addButton((button) => {
			fileButton = button;
			button.buttonEl.disabled = process.platform !== 'win32';
			button.buttonEl.title = this.t(process.platform === 'win32' ? 'copyFileHint' : 'fileClipboardUnsupported');
			button.setButtonText(this.t('copyFile')).setCta().onClick(async () => {
				if (copying) return;
				copying = true;
				const ticket = this.clipboard.claim();
				textButton.buttonEl.disabled = true;
				button.buttonEl.disabled = true;
				button.setButtonText(this.t('copyingFile'));
				assistant.setState('copying', this.t('copyingFile'));
				try {
					const outcome = await this.clipboard.write(ticket,
						(signal) => copyMarkdownFile(this.filename, this.result.content, signal));
					if (!this.opened) return;
					assistant.setState(outcome === 'copied' ? 'copied' : 'idle',
						this.t(outcome === 'copied' ? 'fileClipboardCopied' : 'clipboardSkipped'));
					button.setButtonText(this.t(outcome === 'copied' ? 'fileCopied' : 'copyFile'));
				} catch (error) {
					assistant.setState('error', this.t('fileClipboardFailed') + ' ' + localizeError(error, this.t));
					if (this.opened) button.setButtonText(this.t('copyFile'));
				} finally {
					copying = false;
					if (this.opened) {
						textButton.buttonEl.disabled = false;
						button.buttonEl.disabled = false;
					}
				}
			});
		});
	}

	onClose(): void {
		this.opened = false;
		this.assistant?.destroy();
		this.assistant = undefined;
		this.contentEl.empty();
		this.closed();
	}
}
