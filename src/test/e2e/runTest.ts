import * as path from 'path';

import { downloadAndUnzipVSCode, resolveCliPathFromVSCodeExecutablePath, runTests } from '@vscode/test-electron';

async function main() {
	try {
		// The folder containing the Extension Manifest package.json
		// Passed to `--extensionDevelopmentPath`
		const extensionDevelopmentPath = path.resolve(__dirname, '../../../');
		console.log('Extension Path:', extensionDevelopmentPath); // 添加日志验证路径
		// The path to the extension test script
		// Passed to --extensionTestsPath
		const extensionTestsPath = path.resolve(__dirname, './suite/index.js');

		const downloadedVSCodePath = await downloadAndUnzipVSCode({ version: '1.95.0' });
		const vscodeExecutablePath = resolveCliPathFromVSCodeExecutablePath(downloadedVSCodePath);

		// Download VS Code, unzip it and run the integration test
		await runTests({ 
            extensionDevelopmentPath:  extensionDevelopmentPath,
            extensionTestsPath: extensionTestsPath,
            vscodeExecutablePath,
        });
	} catch (err) {
		console.error('Failed to run tests');
        console.error(err);
		process.exit(1);
	}
}

main();
