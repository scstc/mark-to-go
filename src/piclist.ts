import { execFile } from 'node:child_process';
import { access, copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { delimiter, dirname, join, resolve, basename } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { stripVTControlCharacters } from 'node:util';
import type { UploadSession } from './share';
import { MarkToGoError } from './i18n';

export interface PicListOptions {
	cliPath: string;
	nodePath: string;
	configPath: string;
	timeoutSeconds: number;
}

interface Command {
	node: string;
	script: string;
}

async function exists(path: string): Promise<boolean> {
	try {
		await access(path, constants.R_OK);
		return true;
	} catch {
		return false;
	}
}

export function expandHome(path: string): string {
	return path.replace(/^~(?=$|[/\\])/, homedir()).replace(/%([^%]+)%/g,
		(match: string, name: string) => process.env[name] ?? match);
}

function executableDirectories(): string[] {
	return [...new Set([
		...(process.env.PATH ?? '').split(delimiter).map((p) => p.replace(/^"|"$/g, '')),
		join(homedir(), 'AppData', 'Roaming', 'fnm', 'aliases', 'default'),
		join(homedir(), 'AppData', 'Roaming', 'npm'),
	].filter(Boolean))];
}

export async function resolveCommand(options: PicListOptions): Promise<Command> {
	let script = '';
	const configured = options.cliPath.trim();
	const candidates = configured
		? [expandHome(configured)]
		: executableDirectories().map((dir) => join(dir, 'node_modules', 'piclist', 'bin', 'picgo'));
	for (const candidate of candidates) {
		const file = resolve(candidate);
		if (/\.(?:ps1|cmd|bat)$/i.test(file)) {
			const entry = join(dirname(file), 'node_modules', 'piclist', 'bin', 'picgo');
			if (await exists(entry)) { script = entry; break; }
		} else if (!/\.exe$/i.test(file) && await exists(file)) {
			script = file;
			break;
		}
	}
	if (!script) throw new MarkToGoError('cliMissing');
	const nodeName = process.platform === 'win32' ? 'node.exe' : 'node';
	const nodeCandidates = options.nodePath.trim()
		? [expandHome(options.nodePath.trim())]
		: [join(resolve(dirname(script), '../../..'), nodeName),
			...executableDirectories().map((dir) => join(dir, nodeName))];
	for (const candidate of nodeCandidates) {
		if (await exists(candidate)) return { node: resolve(candidate), script };
	}
	throw new MarkToGoError('nodeMissing');
}

export function defaultConfigPath(): string {
	const directory = process.platform === 'win32'
		? join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'piclist')
		: process.platform === 'darwin'
			? join(homedir(), 'Library', 'Application Support', 'piclist')
			: join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'piclist');
	return join(directory, 'data.json');
}

export function parseUploadResult(stdout: string, stderr = ''): string {
	const output = stripVTControlCharacters(stdout);
	const errors = stripVTControlCharacters(stderr);
	if (/\[(?:PicList|PicGo) ERROR\]/i.test(output + '\n' + errors)) {
		throw new MarkToGoError('cliReportedFailure');
	}
	const urls: string[] = [];
	const pattern = /\[(?:PicList|PicGo) SUCCESS\]:[ \t]*\r?\n([^\r\n]+)/g;
	for (const match of output.matchAll(pattern)) {
		if (match[1]) {
			urls.push(match[1].trim());
			const following = output.slice((match.index ?? 0) + match[0].length);
			if (/^\r?\nhttps?:\/\//i.test(following)) {
				throw new MarkToGoError('multipleUrls');
			}
		}
	}
	if (urls.length !== 1) throw new MarkToGoError('noSuccessResult');
	return urls[0] ?? '';
}

function run(
	command: Command,
	args: string[],
	timeout: number,
	signal?: AbortSignal,
): Promise<{ stdout: string; stderr: string }> {
	return new Promise((resolvePromise, reject) => {
		execFile(command.node, [command.script, ...args], {
			encoding: 'utf8',
			windowsHide: true,
			shell: false,
			timeout,
			maxBuffer: 1024 * 1024,
			signal,
			env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
		}, (error, stdout, stderr) => {
			if (error) reject(new MarkToGoError('cliFailed'));
			else resolvePromise({ stdout, stderr });
		});
	});
}

export interface PicListConfig {
	source: string;
	config: Record<string, unknown>;
}

export async function readPicListConfig(options: PicListOptions): Promise<PicListConfig> {
	const source = resolve(expandHome(options.configPath.trim() || defaultConfigPath()));
	let config: Record<string, unknown>;
	try {
		config = JSON.parse(await readFile(source, 'utf8')) as Record<string, unknown>;
		if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Invalid config');
	} catch {
		throw new MarkToGoError('configReadFailed');
	}
	const picBed = config.picBed as Record<string, unknown> | undefined;
	if (!picBed || !(picBed.uploader || picBed.current)) {
		throw new MarkToGoError('noUploader');
	}
	return { source, config };
}

export async function createPicListSession(
	options: PicListOptions,
	signal?: AbortSignal,
	prepared?: PicListConfig,
): Promise<UploadSession> {
	const command = await resolveCommand(options);
	const original = prepared ?? await readPicListConfig(options);
	const source = original.source;
	const config = { ...original.config };
	const directory = await mkdtemp(join(tmpdir(), 'mark-to-go-'));
	const snapshot = join(directory, 'data.json');
	// PicList may migrate/save its config. Give it a private copy, never the user's original.
	const settings = config.settings && typeof config.settings === 'object'
		? config.settings as Record<string, unknown> : {};
	config.settings = { ...settings, logLevel: ['success', 'error'], logPath: join(directory, 'piclist.log') };
	try {
		// Preserve locally installed uploader plugins without copying or altering their packages.
		const plugins = join(dirname(source), 'node_modules');
		if (await exists(plugins)) {
			await copyFile(join(dirname(source), 'package.json'), join(directory, 'package.json'));
			await symlink(plugins, join(directory, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
		}
		await writeFile(snapshot, JSON.stringify(config), { encoding: 'utf8', mode: 0o600 });
	} catch (error) {
		await rm(directory, { recursive: true, force: true });
		throw error;
	}
	let index = 0;
	return {
		async upload(path: string): Promise<string> {
			const staging = join(directory, 'image-' + index++);
			await mkdir(staging);
			const copy = join(staging, basename(path));
			// Image-processing or deletion hooks are confined to this disposable copy.
			await copyFile(path, copy);
			const seconds = Number.isFinite(options.timeoutSeconds) ? options.timeoutSeconds : 120;
			const { stdout, stderr } = await run(command,
				['-c', snapshot, 'upload', copy], Math.max(5, Math.min(600, seconds)) * 1000, signal);
			return parseUploadResult(stdout, stderr);
		},
		async close(): Promise<void> {
			await rm(directory, { recursive: true, force: true });
		},
	};
}
