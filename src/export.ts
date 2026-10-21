import { mkdir, open, link, unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { MarkToGoError } from './i18n';

export async function saveMarkdown(directory: string, name: string, content: string): Promise<string> {
	await mkdir(directory, { recursive: true });
	const stem = Array.from(basename(name).replace(/\.md$/i, ''))
		.map((char) => char.charCodeAt(0) < 32 ? '_' : char).join('').replace(/[<>:"/\\|?*]/g, '_')
		.replace(/[. ]+$/g, '') || 'Note';
	const temporary = join(directory, '.mark-to-go-' + randomUUID() + '.tmp');
	const handle = await open(temporary, 'wx', 0o600);
	try {
		try {
			await handle.writeFile(content, 'utf8');
			await handle.sync();
		} finally {
			await handle.close();
		}
		for (let suffix = 0; suffix < 10000; suffix++) {
			const filename = stem + '.shared' + (suffix ? '-' + suffix : '') + '.md';
			const destination = join(directory, filename);
			try {
				// An atomic, exclusive link publishes only a fully written file.
				await link(temporary, destination);
				return destination;
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
			}
		}
		throw new MarkToGoError('exportCollisions');
	} finally {
		await unlink(temporary).catch(() => undefined);
	}
}
