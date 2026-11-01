import { Notice } from 'obsidian';
import { createAssistant } from './assistant';
import type { AssistantState, AssistantView } from './assistant';
import type { Translator } from './i18n';

export class AssistantNotice extends Notice {
	private assistant?: AssistantView;
	private assistantState: AssistantState;
	private assistantHidden = false;
	private onAssistantHide?: () => void;

	constructor(t: Translator, message: string, state: AssistantState, duration: number, closed: () => void) {
		const fragment = createFragment();
		const host = fragment.createDiv({ cls: 'mark-to-go-assistant-notice' });
		super(fragment, duration);
		this.assistantState = state;
		this.onAssistantHide = closed;
		this.assistant = createAssistant(host, t, state, true);
		this.assistant.setState(state, message);
	}

	setStage(state: AssistantState): void {
		this.assistantState = state;
		this.assistant?.setState(state);
	}

	updateMessage(message: string): void {
		this.assistant?.setState(this.assistantState, message);
	}

	hide(): void {
		if (this.assistantHidden) return;
		this.assistantHidden = true;
		this.assistant?.destroy();
		super.hide();
		this.onAssistantHide?.();
	}
}
