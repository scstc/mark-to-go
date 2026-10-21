import { fromMarkdown } from 'mdast-util-from-markdown';
import type { Nodes } from 'mdast';
import { MarkToGoError } from './i18n';

export interface ImageReference {
	start: number;
	end: number;
	target: string;
	alt: string;
	title?: string | null;
	fragment: string;
}

const IMAGE_EXTENSION = /\.(png|jpe?g|gif|webp|svg)$/i;
const REMOTE_IMAGE = /^(?:https?:\/\/|\/\/|data:)/i;

export function collectImages(markdown: string): ImageReference[] {
	const tree = fromMarkdown(markdown);
	const excluded: Array<[number, number]> = [];
	const references: ImageReference[] = [];
	const definitions = new Map<string, { url: string; title?: string | null }>();
	const frontmatter = /^(?:\uFEFF)?---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)(?:\r?\n|$)/.exec(markdown);
	if (frontmatter) excluded.push([0, frontmatter[0].length]);

	function walk(node: Nodes, visit: (node: Nodes) => void): void {
		visit(node);
		if ('children' in node) {
			for (const child of node.children) walk(child, visit);
		}
	}
	walk(tree, (node) => {
		const start = node.position?.start.offset;
		const end = node.position?.end.offset;
		if (start === undefined || end === undefined) return;
		if (['code', 'inlineCode', 'html', 'definition'].includes(node.type)) {
			excluded.push([start, end]);
		}
		if (node.type === 'definition') definitions.set(node.identifier, node);
	});
	const isExcluded = (start: number, end: number): boolean =>
		excluded.some(([a, b]) => start < b && end > a);

	function add(start: number, end: number, target: string, alt: string, title?: string | null): void {
		if (REMOTE_IMAGE.test(target)) return;
		const hash = target.indexOf('#');
		const fragment = hash < 0 ? '' : target.slice(hash);
		const path = hash < 0 ? target : target.slice(0, hash);
		let decoded: string;
		try {
			decoded = decodeURIComponent(path);
		} catch {
			throw new MarkToGoError('invalidEncoding', { path });
		}
		if (!IMAGE_EXTENSION.test(decoded)) {
			throw new MarkToGoError('unsupportedEmbed', { path: decoded });
		}
		if (/^[a-z][a-z\d+.-]*:/i.test(decoded)) {
			throw new MarkToGoError('localImagesOnly', { path: decoded });
		}
		references.push({ start, end, target: decoded, alt, title, fragment });
	}

	walk(tree, (node) => {
		const start = node.position?.start.offset;
		const end = node.position?.end.offset;
		if (start === undefined || end === undefined || isExcluded(start, end)) return;
		if (node.type === 'image') {
			add(start, end, node.url, node.alt ?? '', node.title);
		} else if (node.type === 'imageReference') {
			const definition = definitions.get(node.identifier);
			if (definition) add(start, end, definition.url, node.alt ?? '', definition.title);
		}
	});

	const wikiPattern = /!\[\[([^\]\r\n]+)\]\]/g;
	for (const match of markdown.matchAll(wikiPattern)) {
		const start = match.index;
		const end = start + match[0].length;
		if (isExcluded(start, end) || references.some((r) => start < r.end && end > r.start)) continue;
		let escapes = 0;
		for (let i = start - 1; i >= 0 && markdown[i] === '\\'; i--) escapes++;
		if (escapes % 2) continue;
		const parts = (match[1] ?? '').split('|');
		const target = parts.shift() ?? '';
		const label = parts.find((part) => !/^\d+(?:x\d+)?$/.test(part));
		const fallback = target.split('/').pop()?.split('#')[0]?.replace(/\.[^.]+$/, '') ?? '';
		add(start, end, target, label ?? fallback);
	}
	return references.sort((a, b) => a.start - b.start);
}

export function validateImageUrl(value: string): string {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new MarkToGoError('invalidImageUrl');
	}
	if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
		throw new MarkToGoError('invalidImageUrl');
	}
	if (/^(?:localhost|127(?:\.\d+){3}|0\.0\.0\.0|\[::1\])$/i.test(url.hostname)) {
		throw new MarkToGoError('localImageUrl');
	}
	return url.href;
}

export function replaceImages(
	markdown: string,
	references: ImageReference[],
	urlFor: (reference: ImageReference) => string,
): string {
	let result = markdown;
	for (const reference of [...references].sort((a, b) => b.start - a.start)) {
		const url = new URL(validateImageUrl(urlFor(reference)));
		if (reference.fragment) url.hash = reference.fragment.slice(1);
		const destination = url.href.replace(/[()]/g, (char) => char === '(' ? '%28' : '%29');
		const alt = reference.alt.replace(/[\r\n]+/g, ' ').replace(/[\\[\]]/g, '\\$&');
		const title = reference.title
			? ' "' + reference.title.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ') + '"'
			: '';
		const image = '![' + alt + '](' + destination + title + ')';
		result = result.slice(0, reference.start) + image + result.slice(reference.end);
	}
	return result;
}
