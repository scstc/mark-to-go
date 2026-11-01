import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEmotionBallRuntime } from '../src/vendor/emotion-ball/runtime.mjs';

class SvgNode {
	readonly children: SvgNode[] = [];
	readonly attributes = new Map<string, string>();
	parentNode?: SvgNode;
	textContent = '';
	writes = 0;
	readonly style = { stroke: '', removeProperty: (name: string) => {
		Reflect.deleteProperty(this.style, name);
	} };
	private readonly classes = new Set<string>();
	readonly classList = {
		add: (name: string) => { this.classes.add(name); },
		remove: (name: string) => { this.classes.delete(name); },
		toggle: (name: string, enabled: boolean) => {
			if (enabled) this.classes.add(name);
			else this.classes.delete(name);
			return enabled;
		},
	};
	constructor(readonly tagName: string) {}
	setAttribute(name: string, value: string) { this.attributes.set(name, String(value)); this.writes++; }
	getAttribute(name: string) { return this.attributes.get(name) ?? null; }
	appendChild(child: SvgNode) { child.parentNode = this; this.children.push(child); return child; }
	removeChild(child: SvgNode) {
		const index = this.children.indexOf(child);
		if (index >= 0) this.children.splice(index, 1);
		child.parentNode = undefined;
		return child;
	}
	remove() { this.parentNode?.removeChild(this); }
	get totalWrites(): number { return this.writes + this.children.reduce((total, child) => total + child.totalWrites, 0); }
}

function createWindow() {
	let now = 0;
	let nextId = 1;
	const frames = new Map<number, FrameRequestCallback>();
	const intervals = new Map<number, () => void>();
	const ownerWindow = {
		document: { createElementNS: (_namespace: string, tag: string) => new SvgNode(tag) },
		performance: { now: () => now },
		requestAnimationFrame: (callback: FrameRequestCallback) => {
			const id = nextId++;
			frames.set(id, callback);
			return id;
		},
		cancelAnimationFrame: (id: number) => { frames.delete(id); },
		setInterval: (callback: () => void) => {
			const id = nextId++;
			intervals.set(id, callback);
			return id;
		},
		clearInterval: (id: number) => { intervals.delete(id); },
	};
	return {
		ownerWindow, frames, intervals,
		runtime: createEmotionBallRuntime(ownerWindow as unknown as Window),
		frame() {
			now += 16;
			const callbacks = [...frames.values()];
			frames.clear();
			for (const callback of callbacks) callback(now);
		},
	};
}

void test('pausing or disposing the final ball leaves no background animation scheduled', () => {
	const host = createWindow();
	const target = new SvgNode('div');
	const ball = host.runtime.create(target as unknown as HTMLElement, { autostart: false, lite: false });
	assert.equal(host.frames.size, 0, 'A preview must stay idle until its owner makes it visible');
	assert.equal(host.intervals.size, 0);
	ball.setActive(true);
	assert.equal(host.frames.size, 1);
	host.frame();
	ball.setActive(false);
	assert.equal(host.frames.size, 0, 'A hidden window must not retain a pending animation frame');
	ball.setActive(true);
	assert.equal(host.frames.size, 1);
	ball.destroy();
	ball.destroy();
	assert.equal(host.frames.size, 0, 'Unloading must cancel the final frame immediately');
	assert.equal(host.intervals.size, 0);
	assert.equal(target.children.length, 0);
});

void test('multiple visible balls share one clock and closing one preserves the other animation', () => {
	const host = createWindow();
	const firstTarget = new SvgNode('div');
	const secondTarget = new SvgNode('div');
	const first = host.runtime.create(firstTarget as unknown as HTMLElement, { emotion: '02', lite: false });
	const second = host.runtime.create(secondTarget as unknown as HTMLElement, { emotion: '30', lite: false });
	assert.equal(host.frames.size, 1, 'Opening a notice alongside a preview must not create another animation loop');
	first.destroy();
	assert.equal(firstTarget.children.length, 0);
	assert.equal(host.frames.size, 1);
	const before = secondTarget.totalWrites;
	host.frame();
	assert.ok(secondTarget.totalWrites > before, 'The remaining visible ball must keep rendering');
	assert.equal(host.frames.size, 1);
	second.destroy();
	assert.equal(host.frames.size, 0);
});

void test('popout windows keep their SDK namespace and animation lifecycle independent', () => {
	const first = createWindow();
	const second = createWindow();
	assert.equal('EmotionBall' in first.ownerWindow, false);
	assert.equal('EmotionBall' in second.ownerWindow, false);
	assert.equal(first.runtime.config.list().length, 32, 'Keep the original expression catalogue');
	for (const id of ['00', '02', '30', '32', '33', '34']) assert.ok(first.runtime.config.get(id));
	const firstBall = first.runtime.create(new SvgNode('div') as unknown as HTMLElement, { lite: false });
	assert.equal(first.frames.size, 1);
	assert.equal(second.frames.size, 0);
	const secondTarget = new SvgNode('div');
	const secondBall = second.runtime.create(secondTarget as unknown as HTMLElement, { lite: false });
	firstBall.destroy();
	assert.equal(first.frames.size, 0);
	assert.equal(second.frames.size, 1, 'Closing the main window must not stop a popout ball');
	const before = secondTarget.totalWrites;
	second.frame();
	assert.ok(secondTarget.totalWrites > before);
	secondBall.destroy();
	assert.equal(second.frames.size, 0);
});
