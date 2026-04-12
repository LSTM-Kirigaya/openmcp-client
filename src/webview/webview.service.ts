import * as vscode from 'vscode';
import * as fs from 'fs';
import * as fspath from 'path';
import { ConnectionType, detachMcpOptionAsItem, exportFile, McpOptions, panels, updateInstalledConnectionConfig, updateWorkspaceConnectionConfig } from '../global.js';
import { routeMessage, disconnectService } from '../../openmcp-sdk/service/index.js';

export function getWebviewContent(context: vscode.ExtensionContext, panel: vscode.WebviewPanel): string | undefined {
    const viewRoot = fspath.join(context.extensionPath, 'openmcp-sdk', 'renderer');
    const htmlIndexPath = fspath.join(viewRoot, 'index.html');    

    const html = fs.readFileSync(htmlIndexPath, { encoding: 'utf-8' })?.replace(/(<link.+?href="|<script.+?src="|<img.+?src="|url\()(.+?)(\)|")/g, (m, $1, $2) => {
        const importFile = $2 as string;
        const rel = importFile.startsWith('/') ? importFile.substring(1) : importFile;
        const absLocalPath = fspath.resolve(viewRoot, rel);
        
        const webviewUri = panel.webview.asWebviewUri(vscode.Uri.file(absLocalPath));
        const replaceHref = $1 + webviewUri?.toString() + '"';        
        return replaceHref;
    });

    return html;
}

export function getWorkspacePath(context: vscode.ExtensionContext, uri: vscode.Uri) {
    // TODO: 启动上下文？
    // 获取当前打开的项目的路径
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    return workspaceFolder?.uri.fsPath || '';
}

export function revealOpenMcpWebviewPanel(
    context: vscode.ExtensionContext,
    type: 'workspace' | 'installed',
    panelKey: string,
    option: McpOptions[] | McpOptions
) {
    if (panels.has(panelKey)) {
        const panel = panels.get(panelKey);
        panel?.reveal();
        return panel;
    }

    // 对老版本的 option 进行调整
    option = Array.isArray(option)? option : [option];
    option.forEach((item: McpOptions) => {
        const itemType = (item.type || item.connectionType).toUpperCase() as ConnectionType;
        item.type = undefined;
        item.connectionType = itemType;
        if (itemType === 'STDIO') {
            item.commandString = [item.command, ...(item.args || [])]?.join(' ');
        }
    });

    const item = detachMcpOptionAsItem(option);
    const panelTitle = 'OpenMCP ' + item.name;

    const panel = vscode.window.createWebviewPanel(
        'openmcp-webview',
        panelTitle,
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            enableFindWidget: true
        }
    );

    panels.set(panelKey, panel);

    // 设置HTML内容
    const html = getWebviewContent(context, panel);
    panel.webview.html = html || '';
    panel.iconPath = vscode.Uri.file(fspath.join(context.extensionPath, 'openmcp-sdk', 'renderer', 'images', 'openmcp.png'));

    let clientId = '';

    // 处理来自webview的消息
    panel.webview.onDidReceiveMessage(async message => {
        const { command, data } = message;
        console.log('receive message', message);

        // 拦截消息，注入额外信息
        switch (command) {
            case 'vscode/launch-signature':
                const launchResult = {
                    _id: data._id,
                    code: 200,
                    msg: option
                };

                panel.webview.postMessage({
                    command: 'vscode/launch-signature',
                    data: launchResult
                });

                break;

            case 'vscode/update-connection-signature':
                if (type === 'installed') {
                    updateInstalledConnectionConfig(panelKey, data);
                } else {
                    updateWorkspaceConnectionConfig(panelKey, data);
                }
                break;

            case 'vscode/export-file':
                exportFile(data.filename, data.content);
                break;

            case 'vscode/openExternal':
                if (data.url) {
                    vscode.env.openExternal(vscode.Uri.parse(data.url));
                }
                break;

            case 'vscode/clipboard/writeText':
                vscode.env.clipboard.writeText(data.text);
                break;

            default:
                const res = await routeMessage(command, data, panel.webview);

                if (command === 'connect') {

                    if (res?.code !== 200) {
                        vscode.window.showErrorMessage('Failed to connect to the MCP Server.');
                        return;
                    }

                    if (res?.msg?.clientId) {
                        clientId = res.msg.clientId;
                    }
                }

                break;
        }

    });

    panel.onDidDispose(async () => {
        // 删除
        panels.delete(panelKey);

        vscode.window.showInformationMessage('Disconnected from the MCP Server.');
        
        // 关闭后端的连接
        if (clientId) {
            const res = await disconnectService({ clientId });

            if (res.code !== 200) {
                vscode.window.showErrorMessage('Fail to disconnect, please disconnect manually');
            }
        }

        // 退出
        panel.dispose();
    });

    return panel;
}

export function getDefaultLanunchSignature(path: string, cwd: string) {
    const relativePath = fspath.relative(cwd, path);

    if (relativePath.endsWith('.py')) {
        return {
            command: 'mcp',
            args: ['run', relativePath]
        };
    } else if (relativePath.endsWith('.js')) {
        return {
            command:'node',
            args: [relativePath]
        };
    }
}


export function getNewsWebviewContent(context: vscode.ExtensionContext, panel: vscode.WebviewPanel): string | undefined {
    const viewRoot = fspath.join(context.extensionPath, 'resources', 'changelog');
    const htmlIndexPath = fspath.join(viewRoot, 'index.html');

    try {
        if (!fs.existsSync(htmlIndexPath)) {
            return undefined;
        }
        return fs.readFileSync(htmlIndexPath, { encoding: 'utf-8' });
    } catch {
        return undefined;
    }
}

export function revealOpenMcpNewsWebviewPanel(
    context: vscode.ExtensionContext,
) {

    const panel = vscode.window.createWebviewPanel(
        'openmcp-whatnews',
        'What\'s new in OpenMCP',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            enableFindWidget: true
        }
    );

    // 设置HTML内容
    const html = getNewsWebviewContent(context, panel);
    panel.webview.html = html || '';
    panel.iconPath = vscode.Uri.file(fspath.join(context.extensionPath, 'openmcp-sdk', 'renderer', 'images', 'openmcp.png'));

    panel.onDidDispose(async () => {
        // 退出
        panel.dispose();
    });

    return panel;
}

export async function checkNews(context: vscode.ExtensionContext) {
    const versionKey = 'openmcp-news-version';
    const lastVersion = context.globalState.get<string>(versionKey) || '';

    const currentVersion = context.extension.packageJSON.version;
    if (lastVersion !== currentVersion) {
        // 记录新版本
        await context.globalState.update(versionKey, currentVersion);
        // 展示新闻面板
        revealOpenMcpNewsWebviewPanel(context);
    }
}