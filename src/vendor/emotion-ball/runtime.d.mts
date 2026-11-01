export interface EmotionBallDefinition {
	id: string;
	name: string;
	group: string;
	desc: string;
	en: { name: string; desc?: string } | null;
	gaze: boolean;
	raw: unknown;
}

export interface EmotionBallInstance {
	readonly emotionId: string | null;
	readonly touring: boolean;
	setEmotion(id: string, options?: { auto?: boolean }): boolean;
	setGaze(x: number, y: number): EmotionBallInstance;
	clearGaze(): EmotionBallInstance;
	setActive(active: boolean): void;
	renderStatic(): void;
	stopTour(): void;
	destroy(): void;
	spin(turns?: number, direction?: number): EmotionBallInstance;
	bounce(): EmotionBallInstance;
}

export interface EmotionBallOptions {
	emotion?: string;
	color?: string;
	eyeColor?: string;
	eyeScale?: number;
	shape?: 'blob' | 'wedge' | 'gem';
	autostart?: boolean;
	lite?: boolean;
	fallbackId?: string;
	idle?: boolean | {
		standbyAfter?: number;
		sleepAfter?: number;
		standbyId?: string;
		sleepId?: string;
	};
}

export interface EmotionBallRuntime {
	readonly version: string;
	create(target: HTMLElement | string, options?: EmotionBallOptions): EmotionBallInstance;
	config: {
		list(group?: string): EmotionBallDefinition[];
		get(id: string): EmotionBallDefinition | null;
		groups(): Array<{ key: string; name: string; en: string }>;
	};
}

export function createEmotionBallRuntime(ownerWindow: Window): EmotionBallRuntime;
