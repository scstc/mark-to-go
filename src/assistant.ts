import { Component } from 'obsidian';
import type { MessageKey, Translator } from './i18n';
import { createEmotionBallRuntime } from './vendor/emotion-ball/runtime.mjs';
import type { EmotionBallInstance, EmotionBallRuntime } from './vendor/emotion-ball/runtime.mjs';

export type AssistantState = 'idle' | 'checking' | 'uploading' | 'copying' | 'copied' | 'error' | 'sleeping';

export interface AssistantView {
	element: HTMLDivElement;
	controlsEl: HTMLDivElement;
	setState(state: AssistantState, message?: string): void;
	setPaused(paused: boolean): void;
	destroy(): void;
}

const labels: Record<AssistantState, MessageKey> = {
	idle: 'assistantIdle', checking: 'assistantChecking', uploading: 'assistantUploading',
	copying: 'assistantCopying', copied: 'assistantCopied', error: 'assistantError', sleeping: 'assistantSleeping',
};

const emotionIds: Record<AssistantState, string> = {
	idle: '02', checking: '30', uploading: '32', copying: '32', copied: '33', error: '34', sleeping: '00',
};
const runtimes = new WeakMap<Window, EmotionBallRuntime>();

export function createAssistant(
	container: HTMLElement,
	t: Translator,
	initialState: AssistantState = 'idle',
	compact = false,
): AssistantView {
	const element = container.createDiv({
		cls: 'mark-to-go-assistant ' + (compact ? 'mark-to-go-assistant-compact' : 'mark-to-go-assistant-preview'),
		attr: { 'data-state': initialState, 'data-paused': 'false' },
	});
	const stage = element.createDiv({ cls: 'mark-to-go-assistant-stage', attr: { 'aria-hidden': 'true' } });
	const controlsEl = element.createDiv({ cls: 'mark-to-go-assistant-controls' });
	const status = controlsEl.createEl('p', { cls: 'mark-to-go-assistant-status', text: t(labels[initialState]),
		attr: { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' } });
	let destroyed = false;
	let paused = false;
	let started = false;
	let state = initialState;
	let visible = false;
	let ball: EmotionBallInstance | undefined;
	let lifecycle: Component | undefined;
	const ownerDocument = element.ownerDocument;
	const view = ownerDocument?.defaultView;
	const preference = view?.matchMedia('(prefers-reduced-motion: reduce)');
	const updateActivity = () => {
		if (!ball || destroyed) return;
		const active = !paused && !preference?.matches && !ownerDocument.hidden && visible;
		ball.stopTour();
		ball.setActive(active);
		if (active && !started) {
			started = true;
			ball.setEmotion(emotionIds[state]);
		}
		if (!active) { ball.clearGaze(); ball.renderStatic(); }
	};
	const resetGaze = () => ball?.clearGaze();
	const destroy = () => {
		if (destroyed) return;
		destroyed = true;
		lifecycle?.unload();
		ball?.destroy();
		element.remove();
	};
	if (view) {
		try {
			let runtime = runtimes.get(view);
			if (!runtime) { runtime = createEmotionBallRuntime(view); runtimes.set(view, runtime); }
			ball = runtime.create(stage, { emotion: emotionIds[state], color: '#a3efcb', eyeColor: '#17382a',
				autostart: false, lite: false });
			lifecycle = new Component();
			lifecycle.load();
			const observer = new view.IntersectionObserver(entries => {
				visible = entries.some(entry => entry.isIntersecting);
				updateActivity();
			});
			observer.observe(element);
			lifecycle.register(() => observer.disconnect());
			lifecycle.registerDomEvent(ownerDocument, 'pointermove', event => {
				if (event.pointerType === 'touch' || destroyed || paused || preference?.matches ||
					ownerDocument.hidden || !visible || state === 'sleeping') return;
				const bounds = stage.getBoundingClientRect();
				ball?.setGaze((event.clientX - bounds.left - bounds.width / 2) / Math.max(150, bounds.width * 1.5),
					(event.clientY - bounds.top - bounds.height / 2) / Math.max(150, bounds.height * 1.5));
			}, { passive: true });
			lifecycle.registerDomEvent(ownerDocument, 'pointerleave', resetGaze);
			lifecycle.registerDomEvent(view, 'blur', resetGaze);
			lifecycle.registerDomEvent(ownerDocument, 'visibilitychange', updateActivity);
			lifecycle.registerDomEvent(view, 'unload', destroy);
			preference?.addEventListener('change', updateActivity);
			lifecycle.register(() => preference?.removeEventListener('change', updateActivity));
		} catch (error) {
			lifecycle?.unload();
			ball?.destroy();
			ball = undefined;
			stage.remove();
			console.warn('MarkToGo: assistant animation could not start.', error);
		}
	}
	return {
		element,
		controlsEl,
		setState(nextState, message) {
			if (destroyed) return;
			if (nextState !== state) ball?.setEmotion(emotionIds[nextState]);
			state = nextState;
			element.setAttribute('data-state', state);
			if (state === 'sleeping') resetGaze();
			status.setText(message ?? t(labels[state]));
			updateActivity();
		},
		setPaused(value) {
			if (destroyed) return;
			paused = value;
			element.setAttribute('data-paused', String(paused));
			updateActivity();
		},
		destroy,
	};
}
