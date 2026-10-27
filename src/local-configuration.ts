import { execFile } from 'node:child_process';
import { access, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import type { PicListOptions } from './piclist';
import { expandHome, readPicListConfig, resolveCommand } from './piclist';
import { powershellPath } from './file-clipboard';
import { MarkToGoError } from './i18n';
import type { MessageKey } from './i18n';
import { processError } from './process-errors';

export interface ConfigurationCheckItem {
	id: 'node' | 'cli' | 'config' | 'provider' | 'output' | 'fileClipboard';
	status: 'ok' | 'warning' | 'error';
	message: MessageKey;
}

async function nodeVersion(node: string): Promise<void> {
	await new Promise<void>((accept, reject) => {
		execFile(node, ['--version'], { windowsHide: true, shell: false, timeout: 5000, maxBuffer: 1024 },
			(error, stdout) => {
				if (error) reject(processError(error));
				else if (!/^v\d+\.\d+\.\d+\s*$/.test(stdout)) reject(new MarkToGoError('nodeVersionInvalid'));
				else accept();
			});
	});
}

function errorKey(error: unknown): MessageKey {
	return error instanceof MarkToGoError ? error.key : 'checkUnavailable';
}

/** A read-only local check: no uploader, plugins, upload session or clipboard access. */
export async function checkLocalConfiguration(
	settings: PicListOptions & { outputDirectory: string }, downloadsDirectory?: string,
): Promise<ConfigurationCheckItem[]> {
	const items: ConfigurationCheckItem[] = [];
	try {
		const command = await resolveCommand(settings);
		items.push({ id: 'cli', status: 'ok', message: 'checkReady' });
		try {
			await nodeVersion(command.node);
			items.push({ id: 'node', status: 'ok', message: 'checkReady' });
		} catch (error) { items.push({ id: 'node', status: 'error', message: errorKey(error) }); }
	} catch (error) {
		const key = errorKey(error);
		items.push({ id: 'cli', status: key === 'nodeMissing' ? 'ok' : 'error',
			message: key === 'nodeMissing' ? 'checkReady' : key });
		items.push({ id: 'node', status: key === 'nodeMissing' ? 'error' : 'warning',
			message: key === 'nodeMissing' ? key : 'checkUnavailable' });
	}
	try {
		await readPicListConfig(settings);
		items.push({ id: 'config', status: 'ok', message: 'checkReady' },
			{ id: 'provider', status: 'ok', message: 'checkReady' });
	} catch (error) {
		const key = errorKey(error);
		const validFile = key === 'noUploader' || key === 'providerInvalid';
		items.push({ id: 'config', status: validFile ? 'ok' : 'error', message: validFile ? 'checkReady' : key },
			{ id: 'provider', status: validFile ? 'error' : 'warning', message: validFile ? key : 'checkUnavailable' });
	}
	const output = settings.outputDirectory.trim() || downloadsDirectory;
	try {
		if (!output) items.push({ id: 'output', status: 'warning', message: 'checkDefaultOutput' });
		else {
			const path = expandHome(output);
			if (!(await stat(path)).isDirectory()) throw new Error('Not a directory');
			await access(path, constants.W_OK);
			items.push({ id: 'output', status: 'ok', message: 'checkReady' });
		}
	} catch {
		items.push({ id: 'output', status: 'warning', message: 'checkOutputUnavailable' });
	}
	try {
		if (process.platform !== 'win32') throw new MarkToGoError('fileClipboardUnsupported');
		await access(powershellPath(), constants.R_OK);
		items.push({ id: 'fileClipboard', status: 'ok', message: 'checkClipboardAvailable' });
	} catch (error) {
		items.push({ id: 'fileClipboard', status: 'warning',
			message: error instanceof MarkToGoError ? error.key : 'processMissing' });
	}
	return items;
}
