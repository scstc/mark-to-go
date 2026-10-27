import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collectImages, replaceImages, validateImageUrl } from '../src/resources.ts';

void test('share only actual local image embeds, leaving examples and existing URLs intact', () => {
	const untouched = [
		'---', 'title: Examples', 'image: "![[private.png]]"', '---',
		'Inline: ' + String.fromCharCode(96) + '![[inline.png]]' + String.fromCharCode(96),
		'~~~md', '![[code.png]]', '![example](code.svg)', '~~~',
		'<!-- ![[comment.png]] -->',
		'<img src="html.png">', '',
		'\\![[escaped.png]]',
		'![remote](https://example.test/remote.png)',
		'![data](data:image/png;base64,AAAA)',
		'![relative remote](//example.test/a.png)',
		'[ordinary file](attachment.png)',
	].join('\n');
	const source = untouched + '\n![[架构 图.svg|300]]\n![说明](../images/a%20b.png "图示")\n';
	const refs = collectImages(source);
	assert.deepEqual(refs.map((ref) => ref.target), ['架构 图.svg', '../images/a b.png']);
	const result = replaceImages(source, refs, () => 'https://cdn.example.test/upload.png');
	assert.ok(result.startsWith(untouched + '\n'));
	assert.ok(result.endsWith('![架构 图](https://cdn.example.test/upload.png)\n![说明](https://cdn.example.test/upload.png "图示")\n'));
	assert.ok(source.endsWith('![说明](../images/a%20b.png "图示")\n'));
});

void test('reference images become portable while ordinary links and definitions stay intact', () => {
	const source = '![a][asset]\n![asset][]\n\n[asset]: <a b.svg> "A title"\n[ordinary][asset]';
	const refs = collectImages(source);
	assert.equal(refs.length, 2);
	assert.ok(refs.every((ref) => ref.target === 'a b.svg'));
	const result = replaceImages(source, refs, () => 'https://cdn.example.test/a.svg');
	assert.equal(result, '![a](https://cdn.example.test/a.svg "A title")\n![asset](https://cdn.example.test/a.svg "A title")\n\n[asset]: <a b.svg> "A title"\n[ordinary][asset]');
});

void test('preserve SVG fragments and labels without breaking Markdown destinations', () => {
	const source = '![[map.svg#layer|Map|300x200]]\n![a\\[b\\]](x.png)';
	const refs = collectImages(source);
	assert.equal(replaceImages(source, refs, () => 'https://cdn.example.test/a(b).svg'),
		'![Map](https://cdn.example.test/a%28b%29.svg#layer)\n![a\\[b\\]](https://cdn.example.test/a%28b%29.svg)');
});

void test('unsupported embeds fail before a nonportable export can be produced', () => {
	assert.throws(() => collectImages('![[drawing.excalidraw.md]]'), /先导出为图片/);
	assert.throws(() => collectImages('![bad](x%ZZ.png)'), /无效的 URL 编码/);
	assert.throws(() => collectImages('![outside](file:///tmp/x.png)'), /笔记库内/);
});

void test('accept cloud URLs and reject local, credential-bearing, or non-HTTP results', () => {
	assert.equal(validateImageUrl('https://cdn.example.test/图.svg'), 'https://cdn.example.test/%E5%9B%BE.svg');
	for (const url of ['http://localhost/a.png', 'http://127.1/a.png', 'http://[::1]/a.png',
		'file:///a.png', 'not a URL', 'https://user:password@example.test/a.png']) {
		assert.throws(() => validateImageUrl(url));
	}
});

void test('hidden Obsidian comments never select attachments and preserve original text and UTF-16 offsets', () => {
	const hidden = '---\r\nimage: "![[frontmatter.png]]"\r\n---\r\n😀中文 %% ![[private.png]] %%\r\n' +
		'%%\r\n```\r\n![[missing.png]]\r\n[p]: hidden.png\r\n%%\r\n';
	const source = hidden + '![[visible.png]]\r\n![ref][p]\r\n\r\n[p]: first.png\r\n[p]: second.png\r\n';
	const refs = collectImages(source);
	assert.deepEqual(refs.map(r => r.target), ['visible.png', 'first.png']);
	assert.equal(source.slice(refs[0]!.start, refs[0]!.end), '![[visible.png]]');
	assert.ok(replaceImages(source, refs, () => 'https://cdn.test/image.png').startsWith(hidden));
});

void test('comment markers in real code, HTML and escaped text do not hide later images', () => {
	const source = '`%%`\n\n~~~\n%%\n~~~\n\n<!-- %% -->\n\n\\%% literal\n\n![[visible.png]]';
	assert.deepEqual(collectImages(source).map(r => r.target), ['visible.png']);
	assert.deepEqual(collectImages('visible\n%% ![[never-upload.png]]'), []);
});

void test('table escapes separate display parameters without deleting path backslashes', () => {
	const source = '| A | B |\n| --- | --- |\n| ![[image.png\\|300]] | ![[map.svg\\|说明\\|300x200]] |';
	const refs = collectImages(source);
	assert.deepEqual(refs.map(r => [r.target, r.alt]), [['image.png', 'image'], ['map.svg', '说明']]);
	assert.deepEqual(collectImages('![[folder\\image.png|300]]').map(r => r.target), ['folder\\image.png']);
});

void test('the first visible reference definition wins, including a first external URL', () => {
	assert.deepEqual(collectImages('![photo][p]\n\n[p]: first.png\n[p]: second.png').map(r => r.target), ['first.png']);
	assert.deepEqual(collectImages('![photo][p]\n\n[p]: https://example.test/a.png\n[p]: private.png'), []);
});
