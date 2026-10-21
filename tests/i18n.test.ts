import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTranslator, localizeError, resolveLanguage, MarkToGoError } from '../src/i18n.ts';
import { en } from '../src/locales/en.ts';
import { zh } from '../src/locales/zh.ts';
import { shareMarkdown } from '../src/share.ts';

void test('auto follows Obsidian while explicit choices override the application language', () => {
	assert.equal(resolveLanguage('auto', 'en'), 'en');
	assert.equal(resolveLanguage('auto', 'zh-CN'), 'zh');
	assert.equal(resolveLanguage('auto', 'zh_TW'), 'zh');
	assert.equal(resolveLanguage('en', 'zh-CN'), 'en');
	assert.equal(resolveLanguage('zh', 'en'), 'zh');
	assert.equal(resolveLanguage('auto', 'fr'), 'en');
	assert.equal(resolveLanguage('invalid', ''), 'en');
});

void test('both languages cover the same UI and interpolate the same variables', () => {
	assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort());
	for (const key of Object.keys(en) as Array<keyof typeof en>) {
		assert.deepEqual(en[key].match(/\{\w+\}/g)?.sort(), zh[key].match(/\{\w+\}/g)?.sort(), key);
	}
	assert.equal(createTranslator('en')('resultCounts', { uploaded: 0, reused: 2 }), 'New uploads: 0. Reused: 2.');
	assert.equal(createTranslator('zh')('saveToDownloads'), '保存到 Downloads');
	assert.equal(createTranslator('en')('menuAction'), 'MarkToGo');
});

void test('errors use the selected language while preserving the actual resource path', () => {
	const error = new MarkToGoError('missingImages', { paths: '附件/图.svg' });
	assert.equal(localizeError(error, createTranslator('en')), 'Local images not found: 附件/图.svg');
	assert.equal(localizeError(error, createTranslator('zh')), '找不到本地图片：附件/图.svg');
	assert.equal(localizeError(new Error('technical detail'), createTranslator('en')), 'Export failed. Check your configuration.');
});

void test('English export progress does not fall back to hardcoded Chinese', async () => {
	const progress: string[] = [];
	await shareMarkdown('# Note', {
		translate: createTranslator('en'),
		resolve: () => Promise.resolve(null),
		openUploader: () => assert.fail('No images should require an uploader'),
		copy: () => Promise.resolve(),
		progress: message => { progress.push(message); },
	});
	assert.deepEqual(progress, ['Checking images…', 'Copying Markdown…']);
});
