import { App, Modal, Notice, Setting } from 'obsidian';
import { clipboard, shell } from 'electron';
import type { ShareResult } from './share';
import type { Translator } from './i18n';
import { localizeError } from './i18n';

export class ShareResultModal extends Modal {
	constructor(
		app: App,
		private readonly result: ShareResult,
		private readonly t: Translator,
		private readonly saveFile: () => Promise<string>,
		private readonly customFolder = false,
	) {
		super(app);
	}

	onOpen(): void {
		this.titleEl.setText(this.t('resultTitle'));
		this.contentEl.createEl('p', {
			text: this.t('resultCounts', { uploaded: this.result.uploaded, reused: this.result.reused }),
		});
		const status = this.contentEl.createEl('p', {
			text: this.t(this.result.copied ? 'clipboardCopied' : 'clipboardFailed'),
		});
		const fileStatus = this.contentEl.createEl('p', { text: this.t('notSaved') });
		let saving = false;
		let saved = false;
		const saveLabel = this.t(this.customFolder ? 'saveFile' : 'saveToDownloads');
		const actions = new Setting(this.contentEl);
		actions.addButton((button) => button.setButtonText(saveLabel).setCta().onClick(async () => {
			if (saving || saved) return;
			saving = true;
			button.buttonEl.disabled = true;
			button.setButtonText(this.t('savingFile'));
			try {
				const path = await this.saveFile();
				saved = true;
				fileStatus.empty();
				fileStatus.createEl('code', { text: path });
				actions.addButton((folder) => folder.setButtonText(this.t('openFolder')).onClick(() => {
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
		actions.addButton((button) => button.setButtonText(this.t('copyMarkdown')).onClick(() => {
				try {
					clipboard.writeText(this.result.content);
					this.close();
				} catch {
					status.setText(this.t('clipboardRetryFailed'));
				}
			}));
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
