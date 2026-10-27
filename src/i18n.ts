import { en } from './locales/en';
import { zh } from './locales/zh';

export type LanguageSetting = 'auto' | 'en' | 'zh';
export type MessageKey = keyof typeof en;
export type MessageParams = Record<string, string | number>;
export type Translator = (key: MessageKey, params?: MessageParams) => string;

export function resolveLanguage(setting: string, appLanguage: string): 'en' | 'zh' {
	if (setting === 'en' || setting === 'zh') return setting;
	return /^zh(?:[-_]|$)/i.test(appLanguage) ? 'zh' : 'en';
}

export function createTranslator(language: 'en' | 'zh'): Translator {
	const messages = language === 'zh' ? zh : en;
	return (key, params = {}) => messages[key].replace(/\{(\w+)\}/g,
		(match: string, name: string) => params[name] === undefined ? match : String(params[name]));
}

export class MarkToGoError extends Error {
	constructor(readonly key: MessageKey, readonly params: MessageParams = {}, readonly cause?: unknown) {
		super(createTranslator('zh')(key, params));
		this.name = 'MarkToGoError';
	}
}

export function localizeError(error: unknown, t: Translator): string {
	if (!(error instanceof MarkToGoError)) return t('shareFailed');
	const message = t(error.key, error.params);
	return error.cause instanceof MarkToGoError ? message + ' ' + localizeError(error.cause, t) : message;
}
