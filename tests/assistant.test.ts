import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import { build } from 'esbuild';
import { createTranslator } from '../src/i18n.ts';
import type { Translator } from '../src/i18n.ts';
import type { AssistantState } from '../src/assistant.ts';

interface ElementOptions {
	cls?: string;
	text?: string;
	attr?: Record<string, string>;
}

class PreviewElement {
	children: PreviewElement[] = [];
	parent?: PreviewElement;
	attributes = new Map<string, string>();
	text = '';
	removes = 0;
	constructor(readonly ownerDocument: { defaultView: object; hidden: boolean }) {}
	setAttribute(name: string, value: string) { this.attributes.set(name, value); }
	setText(value: string) { this.text = value; }
	createDiv(options?: ElementOptions) { return this.createChild(options); }
	createEl(_tag: string, options?: ElementOptions) { return this.createChild(options); }
	private createChild(options: ElementOptions = {}) {
		const child = new PreviewElement(this.ownerDocument);
		child.parent = this;
		child.text = options.text ?? '';
		if (options.cls) child.attributes.set('class', options.cls);
		for (const [name, value] of Object.entries(options.attr ?? {})) child.attributes.set(name, value);
		this.children.push(child);
		return child;
	}
	remove() {
		this.removes++;
		if (!this.parent) return;
		this.parent.children = this.parent.children.filter(child => child !== this);
		this.parent = undefined;
	}
}

interface TestAssistant {
	element: PreviewElement;
	controlsEl: PreviewElement;
	setState(state: AssistantState, message?: string): void;
	setPaused(paused: boolean): void;
	destroy(): void;
}

const bundle = build({ entryPoints: ['src/assistant.ts'], bundle: true, write: false,
	platform: 'node', format: 'cjs', external: ['obsidian'],
	plugins: [{ name: 'mock-animation-runtime', setup(builder) {
		builder.onResolve({ filter: /\/vendor\/emotion-ball\/runtime\.mjs$/ },
			() => ({ path: 'test-animation-runtime', external: true }));
	} }],
});

async function loadAssistant(create: () => object, component: unknown = class {}) {
	const module = { exports: {} as unknown };
	const warnings: unknown[][] = [];
	runInNewContext((await bundle).outputFiles[0]!.text, { module, exports: module.exports,
		require: (id: string): unknown => {
			if (id === 'obsidian') return { Component: component };
			if (id === 'test-animation-runtime') return { createEmotionBallRuntime: () => ({ create }) };
			throw new Error('Unexpected test import: ' + id);
		},
		console: { warn: (...values: unknown[]) => { warnings.push(values); } },
	});
	const loaded = module.exports as { createAssistant(this: void, container: PreviewElement, t: Translator): TestAssistant };
	return { createAssistant: loaded.createAssistant, warnings };
}

void test('an animation startup failure preserves readable status and safe controls until disposal', async () => {
	const failure = new Error('SVG runtime failed');
	const { createAssistant, warnings } = await loadAssistant(() => { throw failure; });
	const container = new PreviewElement({ hidden: false,
		defaultView: { matchMedia: () => ({ matches: false }) } });
	const assistant = createAssistant(container, createTranslator('en'));
	assert.equal(warnings.length, 1, 'A visual failure must be diagnosable rather than silently swallowed');
	assert.equal(warnings[0]?.[1], failure);
	assert.equal(assistant.element.children.length, 1, 'Only the readable controls remain after removing the failed stage');
	assert.equal(assistant.controlsEl.children[0]?.text, 'Idle');
	assert.doesNotThrow(() => {
		assistant.setState('copying');
		assistant.setPaused(true);
		assistant.setPaused(false);
		assistant.setState('copied', 'Copied with a text-only status');
	});
	assert.equal(assistant.controlsEl.children[0]?.text, 'Copied with a text-only status');
	assert.equal(assistant.element.attributes.get('data-state'), 'copied');
	assert.doesNotThrow(() => { assistant.destroy(); assistant.destroy(); });
	assert.equal(container.children.length, 0);
	assert.equal(assistant.element.removes, 1, 'Repeated disposal must not repeat resource cleanup');
	assistant.setState('error');
	assert.equal(assistant.controlsEl.children[0]?.text, 'Copied with a text-only status');
});

void test('a later animation setup failure destroys the already-created runtime before falling back to text', async () => {
	let ballDisposals = 0;
	let componentDisposals = 0;
	class Lifecycle {
		private loaded = false;
		load() { this.loaded = true; }
		unload() { if (this.loaded) { this.loaded = false; componentDisposals++; } }
	}
	const { createAssistant, warnings } = await loadAssistant(() => ({ destroy: () => { ballDisposals++; } }), Lifecycle);
	const container = new PreviewElement({ hidden: false, defaultView: {
		matchMedia: () => ({ matches: false }),
		IntersectionObserver: class { constructor() { throw new Error('Observer unavailable'); } },
	} });
	const assistant = createAssistant(container, createTranslator('en'));
	assert.equal(warnings.length, 1);
	assert.equal(ballDisposals, 1, 'A successfully created runtime must not survive a later setup failure');
	assert.equal(componentDisposals, 1);
	assert.doesNotThrow(() => {
		assistant.setState('copied');
		assistant.setPaused(true);
		assistant.destroy();
		assistant.destroy();
	});
	assert.equal(ballDisposals, 1);
	assert.equal(componentDisposals, 1);
	assert.equal(container.children.length, 0);
});
