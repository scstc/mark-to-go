declare module 'electron' {
	export const clipboard: { writeText(text: string): void };
	export const remote: { app: { getPath(name: 'downloads'): string } } | undefined;
	export const shell: { showItemInFolder(path: string): void };
}
