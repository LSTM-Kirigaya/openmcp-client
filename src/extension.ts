import * as vscode from 'vscode';
import * as fs from 'fs';
import * as fspath from 'path';

import * as OpenMCPService from '../resources/service';

function getWebviewContent(context: vscode.ExtensionContext, panel: vscode.WebviewPanel): string | undefined {
    const viewRoot = fspath.join(context.extensionPath, 'resources', 'renderer');
    const htmlIndexPath = fspath.join(viewRoot, 'index.html');
    const html = fs.readFileSync(htmlIndexPath, { encoding: 'utf-8' })?.replace(/(<link.+?href="|<script.+?src="|<img.+?src=")(.+?)"/g, (m, $1, $2) => {
        const absLocalPath = fspath.resolve(viewRoot, $2);        
        const webviewUri = panel.webview.asWebviewUri(vscode.Uri.file(absLocalPath));

        const replaceHref = $1 + webviewUri?.toString() + '"';
        return replaceHref;
    });
    return html;
}

function getLaunchCWD(context: vscode.ExtensionContext, uri: vscode.Uri) {
    // TODO: 启动上下文？
    // 获取当前打开的项目的路径
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    return workspaceFolder?.uri.fsPath || '';
}

export function activate(context: vscode.ExtensionContext) {
    console.log('activate openmcp');

    // 初始化 OpenMCPService
    // 获取当前打开的项目的路径
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const workspace = workspaceFolder?.uri.fsPath || '';
    OpenMCPService.setVscodeWorkspace(workspace);

    // 注册 showOpenMCP 命令
    context.subscriptions.push(
        vscode.commands.registerCommand('openmcp.showOpenMCP', async (uri: vscode.Uri) => {

            const panel = vscode.window.createWebviewPanel(
                'OpenMCP',
                'OpenMCP',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    enableFindWidget: true
                }
            );

            const cwd = getLaunchCWD(context, uri);
            // 获取 uri 相对于 cwd 的路径
            const relativePath = fspath.relative(cwd, uri.fsPath);
            
            console.log('current file' + uri.fsPath);
            console.log(`relativePath: ${relativePath}`);

            // 设置HTML内容
            const html = getWebviewContent(context, panel); 
            panel.webview.html = html || '';
            panel.iconPath = vscode.Uri.file(fspath.join(context.extensionPath, 'resources', 'renderer', 'images', 'openmcp.png'));     

            // 处理来自webview的消息
            panel.webview.onDidReceiveMessage(message => {
                const { command, data } = message;
                console.log('receive message', message);

                // 拦截消息，注入额外信息
                switch (command) {
                    case 'vscode/launch-command':
                        const commandString = 'uv run mcp run ' + relativePath;
                        const launchResult = {
                            code: 200,
                            msg: {
                                commandString: commandString,
                                cwd: cwd
                            }
                        }

                        panel.webview.postMessage({
                            command: 'vscode/launch-command',
                            data: launchResult
                        });

                        break;
                
                    default:
                        OpenMCPService.messageController(command, data, panel.webview);                
                        break;
                }

            });

            panel.onDidDispose(() => {
                panel.dispose();
            });
        })
    );
}


export function deactivate() {

}