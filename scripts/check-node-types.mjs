import assert from 'node:assert/strict';
import ts from 'typescript';

// Fail before lint if the analysis environment has lost Node's declarations.
const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
assert.equal(config.error, undefined, 'Cannot read tsconfig.json');
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
const program = ts.createProgram(parsed.fileNames, { ...parsed.options, noEmit: true });
const checker = program.getTypeChecker();
let checked = 0;
for (const file of program.getSourceFiles()) {
	if (file.isDeclarationFile || !file.fileName.replaceAll('\\', '/').includes('/src/')) continue;
	for (const statement of file.statements) {
		if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) ||
			!statement.moduleSpecifier.text.startsWith('node:')) continue;
		const symbol = checker.getSymbolAtLocation(statement.moduleSpecifier);
		assert.ok(symbol && checker.getExportsOfModule(symbol).length, 'Missing types for ' + statement.moduleSpecifier.text);
		checked++;
	}
}
assert.ok(checked > 0, 'No Node imports were checked');
process.stdout.write(`Node type resolution verified for ${checked} imports.\n`);
