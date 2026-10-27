import { MarkToGoError } from './i18n';

/** Classify trusted process fields, never forward stdout, stderr or raw messages. */
export function processError(error: unknown, signal?: AbortSignal): MarkToGoError {
	const value = error && typeof error === 'object' ? error as Record<string, unknown> : {};
	if (signal?.aborted || value.name === 'AbortError') return new MarkToGoError('cancelled');
	if (value.code === 'ENOENT') return new MarkToGoError('processMissing');
	if (value.code === 'EACCES' || value.code === 'EPERM') return new MarkToGoError('processDenied');
	if (value.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') return new MarkToGoError('processOutputLimit');
	if (value.killed === true) return new MarkToGoError('processTimeout');
	return new MarkToGoError('processFailed');
}
