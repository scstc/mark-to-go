export function encodeObjectPath(path: string): string {
	return path.split('/').map(part => encodeURIComponent(part).replace(/[!'()*]/g,
		character => '%' + character.charCodeAt(0).toString(16).toUpperCase())).join('/');
}
