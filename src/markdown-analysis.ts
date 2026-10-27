import { fromMarkdown } from 'mdast-util-from-markdown';
import type { Nodes } from 'mdast';

function escaped(text: string, at: number): boolean {
	let slashes = 0;
	while (at > 0 && text[--at] === '\\') slashes++;
	return slashes % 2 === 1;
}

function protectedRanges(node: Nodes, ranges: Array<[number, number]>): void {
	if (['code', 'inlineCode', 'html'].includes(node.type)) {
		const start = node.position?.start.offset;
		const end = node.position?.end.offset;
		if (start !== undefined && end !== undefined) ranges.push([start, end]);
	} else if ('children' in node) {
		for (const child of node.children) protectedRanges(child, ranges);
	}
}

/** Hide non-rendered content without changing UTF-16 offsets used for replacements. */
export function markdownForAnalysis(markdown: string): string {
	let text = markdown.replace(/^(?:\uFEFF)?---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)(?:\r?\n|$)/,
		part => part.replace(/[^\r\n]/g, ' '));
	let cursor = 0;
	while (cursor < text.length) {
		const start = text.indexOf('%%', cursor);
		if (start < 0) break;
		const ranges: Array<[number, number]> = [];
		protectedRanges(fromMarkdown(text), ranges);
		if (escaped(text, start) || ranges.some(([a, b]) => start >= a && start < b)) {
			cursor = start + 2;
			continue;
		}
		let close = text.indexOf('%%', start + 2);
		while (close >= 0 && escaped(text, close)) close = text.indexOf('%%', close + 2);
		const end = close < 0 ? text.length : close + 2;
		text = text.slice(0, start) + text.slice(start, end).replace(/[^\r\n]/g, ' ') + text.slice(end);
		cursor = end;
	}
	return text;
}
