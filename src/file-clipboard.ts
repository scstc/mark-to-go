import { execFile } from 'node:child_process';
import { lstat, mkdtemp, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { MarkToGoError } from './i18n';

const prefix = 'mark-to-go-clipboard-';

async function removeClipboardFile(path: string): Promise<void> {
	const directory = dirname(path);
	// Only remove our own temporary file, never recurse into a supplied path.
	if (resolve(dirname(directory)) !== resolve(tmpdir()) ||
		!new RegExp('^' + prefix + '[a-zA-Z0-9]{6}$').test(basename(directory))) return;
	if ((await lstat(directory)).isSymbolicLink()) return;
	await unlink(path);
	await rmdir(directory);
}

export async function copyMarkdownFile(name: string, content: string): Promise<void> {
	if (process.platform !== 'win32') throw new MarkToGoError('fileClipboardUnsupported');
	const directory = await mkdtemp(join(tmpdir(), prefix));
	const path = join(directory, basename(name));
	try {
		await writeFile(path, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
		// FileDropList publishes real file attachments and persists after PowerShell exits.
		// Encoding the path keeps note names out of executable PowerShell syntax.
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
		const output = await new Promise<string>((accept, reject) => {
			execFile(join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
				['-NoProfile', '-NonInteractive', '-STA', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
				{ windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024 },
				(error, stdout) => error ? reject(new Error(error.message)) : accept(stdout));
		});
		// Closing the dialog must not invalidate a pending paste. Retire the previous
		// MarkToGo file only after another file has successfully replaced it.
		for (const line of output.trim().split(/\r?\n/).filter(Boolean)) {
			const previous = Buffer.from(line, 'base64').toString('utf16le');
			await removeClipboardFile(previous).catch(() => undefined);
		}
	} catch (error) {
		await unlink(path).catch(() => undefined);
		await rmdir(directory).catch(() => undefined);
		throw error;
	}
}
