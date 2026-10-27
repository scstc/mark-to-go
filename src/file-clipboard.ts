import { execFile } from 'node:child_process';
import { lstat, mkdtemp, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { MarkToGoError } from './i18n';
import { processError } from './process-errors';

const prefix = 'mark-to-go-clipboard-';

export class ClipboardPublishError extends MarkToGoError {
	constructor(error: MarkToGoError, readonly mayHavePublished: boolean) {
		super(error.key, error.params);
	}
}

async function removeClipboardFile(path: string): Promise<void> {
	const directory = dirname(path);
	// Only remove our own temporary file, never recurse into a supplied path.
	if (resolve(dirname(directory)) !== resolve(tmpdir()) ||
		!new RegExp('^' + prefix + '[a-zA-Z0-9]{6}$').test(basename(directory))) return;
	if ((await lstat(directory)).isSymbolicLink()) return;
	await unlink(path);
	await rmdir(directory);
}

export function powershellPath(): string {
	return join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
}

export function fileClipboardCommand(path: string): string[] {
	// The file name is data, never executable PowerShell syntax.
	const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$previous = @([System.Windows.Forms.Clipboard]::GetFileDropList())
$files = New-Object System.Collections.Specialized.StringCollection
[void]$files.Add([Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${Buffer.from(path, 'utf16le').toString('base64')}')))
[System.Windows.Forms.Clipboard]::SetFileDropList($files)
foreach ($item in $previous) {
	[Console]::WriteLine([Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($item)))
}
`;
	return ['-NoProfile', '-NonInteractive', '-STA', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')];
}

async function publishFile(path: string, signal?: AbortSignal): Promise<string[]> {
	if (process.platform !== 'win32') throw new MarkToGoError('fileClipboardUnsupported');
	const output = await new Promise<string>((accept, reject) => {
		execFile(powershellPath(), fileClipboardCommand(path),
			{ windowsHide: true, shell: false, timeout: 15000, maxBuffer: 1024 * 1024, signal },
			(error, stdout) => {
				if (!error) { accept(stdout); return; }
				const classified = processError(error, signal);
				// Cancellation can race with publication; preserve uncertain attachments.
				reject(new ClipboardPublishError(classified,
					classified.key !== 'processMissing' && classified.key !== 'processDenied'));
			});
	});
	return output.trim().split(/\r?\n/).filter(Boolean).map(line => Buffer.from(line, 'base64').toString('utf16le'));
}

export async function copyMarkdownFile(
	name: string, content: string, signal?: AbortSignal,
	publish: (path: string, signal?: AbortSignal) => Promise<string[]> = publishFile,
): Promise<void> {
	if (signal?.aborted) throw new MarkToGoError('cancelled');
	const directory = await mkdtemp(join(tmpdir(), prefix)).catch(() => { throw new MarkToGoError('temporaryFileFailed'); });
	const path = join(directory, basename(name));
	let published = false;
	try {
		await writeFile(path, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
		if (signal?.aborted) throw new MarkToGoError('cancelled');
		const previous = await publish(path, signal);
		published = true;
		for (const old of previous) await removeClipboardFile(old).catch(() => undefined);
	} catch (error) {
		if (!published && !(error instanceof ClipboardPublishError && error.mayHavePublished)) {
			await unlink(path).catch(() => undefined);
			await rmdir(directory).catch(() => undefined);
		}
		throw error instanceof MarkToGoError ? error : new MarkToGoError('temporaryFileFailed');
	}
}
