import { App, Modal, Notice, Setting } from 'obsidian';
import type { ButtonComponent } from 'obsidian';
import { clipboard, shell } from 'electron';
import type { ShareResult } from './share';
import type { Translator } from './i18n';
import { localizeError } from './i18n';
import { copyMarkdownFile } from './file-clipboard';
import type { ClipboardCoordinator } from './clipboard-coordinator';

export class ShareResultModal extends Modal {
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
		this.titleEl.setText(this.t('resultTitle'));
		this.contentEl.createEl('p').createEl('strong', { text: this.filename });
		this.contentEl.createEl('p', {
			text: this.t('resultCounts', { uploaded: this.result.uploaded, reused: this.result.reused }),
		});
		const status = this.contentEl.createEl('p', {
			text: this.t(this.result.clipboardStatus === 'copied' ? 'clipboardCopied' :
				this.result.clipboardStatus === 'skipped' ? 'clipboardSkipped' : 'clipboardFailed'),
			attr: { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' },
		});
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
				button.buttonEl.disabled = saved;
				button.setButtonText(saved ? this.t('fileSaved') : saveLabel);
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
				try {
					const outcome = await this.clipboard.write(ticket, async () => clipboard.writeText(this.result.content));
					status.setText(this.t(outcome === 'copied' ? 'clipboardCopied' : 'clipboardSkipped'));
					fileButton.setButtonText(this.t('copyFile'));
				} catch {
					status.setText(this.t('clipboardRetryFailed'));
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
				try {
					const outcome = await this.clipboard.write(ticket,
						(signal) => copyMarkdownFile(this.filename, this.result.content, signal));
					status.setText(this.t(outcome === 'copied' ? 'fileClipboardCopied' : 'clipboardSkipped'));
					button.setButtonText(this.t(outcome === 'copied' ? 'fileCopied' : 'copyFile'));
				} catch (error) {
					status.setText(this.t('fileClipboardFailed') + ' ' + localizeError(error, this.t));
					button.setButtonText(this.t('copyFile'));
				} finally {
					copying = false;
					textButton.buttonEl.disabled = false;
					button.buttonEl.disabled = false;
				}
			});
		});
	}

	onClose(): void {
		this.contentEl.empty();
		this.closed();
	}
}
