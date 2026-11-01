import type { Setting } from 'obsidian';
import type { Translator } from './i18n';
import { createAssistant } from './assistant';

const states = [
	{ id: 'idle', key: 'assistantIdle' },
	{ id: 'checking', key: 'assistantChecking' },
	{ id: 'uploading', key: 'assistantUploading' },
	{ id: 'copied', key: 'assistantCopied' },
	{ id: 'error', key: 'assistantError' },
	{ id: 'sleeping', key: 'assistantSleeping' },
] as const;

export function renderAssistantPreview(setting: Setting, t: Translator): () => void {
	setting.settingEl.addClass('mark-to-go-assistant-setting');
	const assistant = createAssistant(setting.controlEl, t);
	const controls = assistant.controlsEl;
	const choices = controls.createDiv({ cls: 'mark-to-go-assistant-choices',
		attr: { role: 'group', 'aria-label': t('assistantStateLabel') } });
	const buttons: HTMLButtonElement[] = [];
	for (const state of states) {
		const button = choices.createEl('button', { text: t(state.key), cls: 'mark-to-go-assistant-choice',
			attr: { type: 'button', 'aria-pressed': String(state.id === 'idle') } });
		button.onclick = () => {
			assistant.setState(state.id);
			for (const choice of buttons) choice.setAttribute('aria-pressed', String(choice === button));
		};
		buttons.push(button);
	}
	let paused = false;
	const pause = controls.createEl('button', { text: t('assistantPause'), cls: 'mark-to-go-assistant-pause',
		attr: { type: 'button', 'aria-pressed': 'false' } });
	pause.onclick = () => {
		paused = !paused;
		assistant.setPaused(paused);
		pause.setAttribute('aria-pressed', String(paused));
		pause.setText(t(paused ? 'assistantResume' : 'assistantPause'));
	};
	controls.createEl('a', { cls: 'mark-to-go-assistant-license', text: t('assistantLicense'),
		attr: { href: 'https://github.com/sam70361/aora-bot/blob/e3b6148c818da4a8e1966f2bc89cdb3cee473b73/LICENSE',
			target: '_blank', rel: 'noopener noreferrer' } });
	return () => assistant.destroy();
}
