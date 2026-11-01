import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { ESLint } from 'eslint';

// Run against the actual production build, including all bundled dependencies.
export async function checkPluginBuild(metafile) {
	const inputs = Object.keys(metafile.inputs).map(file => file.replaceAll('\\', '/'));
	assert.ok(inputs.includes('src/main.ts'), 'Plugin entry is missing from the build');
	const websiteInputs = inputs.filter(file => /^(?:docs\/)?site\//.test(file));
	assert.deepEqual(websiteInputs, [], 'Website code must stay outside the plugin bundle');
	const bundle = readFileSync('main.js', 'utf8');
	assert.equal(Buffer.byteLength(bundle), metafile.outputs['main.js'].bytes, 'Build output does not match its metadata');
	const allowedImports = new Set(['obsidian', 'electron', ...builtinModules.map(name => name.replace(/^node:/, ''))]);
	for (const entry of metafile.outputs['main.js'].imports) {
		assert.ok(entry.external && (allowedImports.has(entry.path.replace(/^node:/, '')) ||
			/^@(?:codemirror|lezer)\//.test(entry.path)), 'Unbundled runtime dependency: ' + entry.path);
	}
	const eslint = new ESLint({
		overrideConfigFile: true,
		overrideConfig: [{
			languageOptions: { ecmaVersion: 'latest', sourceType: 'commonjs' },
			rules: { 'no-eval': 'error', 'no-implied-eval': 'error', 'no-new-func': 'error' },
		}],
	});
	const [result] = await eslint.lintText(bundle, { filePath: 'main.cjs' });
	assert.equal(result.errorCount + result.warningCount, 0,
		'Unsafe code execution in the bundle: ' + result.messages.map(message => message.ruleId).join(', '));
	if (inputs.some(file => file.startsWith('src/vendor/emotion-ball/'))) {
		const normalizedBundle = bundle.replaceAll('\r\n', '\n');
		for (const filename of ['LICENSE', 'NOTICE.md']) {
			const declaration = readFileSync('src/vendor/emotion-ball/' + filename, 'utf8').replaceAll('\r\n', '\n').trim();
			assert.ok(normalizedBundle.includes(declaration), 'Missing complete Emotion Ball ' + filename + ' in the bundle');
		}
	}
	const json = filename => JSON.parse(readFileSync(filename, 'utf8'));
	const manifest = json('manifest.json');
	assert.equal(json('package.json').version, manifest.version, 'Package and manifest versions differ');
	const lock = json('package-lock.json');
	assert.equal(lock.version, manifest.version, 'Lockfile and manifest versions differ');
	assert.equal(lock.packages[''].version, manifest.version, 'Lockfile root version differs');
	assert.equal(json('versions.json')[manifest.version], manifest.minAppVersion, 'Minimum app version mapping differs');
	for (const filename of ['main.js', 'manifest.json', 'styles.css']) {
		assert.ok(readFileSync(filename).length, 'Missing or empty release artifact: ' + filename);
	}
	process.stdout.write(`Plugin build checks passed: ${inputs.length} inputs, website isolated, dynamic-code rules clean, Emotion Ball notices and release artifacts verified.\n`);
}
