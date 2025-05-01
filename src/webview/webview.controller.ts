import * as vscode from 'vscode';
import { RegisterCommand } from "../common";
import { getDefaultLanunchSignature, getLaunchCWD, revealOpenMcpWebviewPanel } from './webview.service';
import { getWorkspaceConnectionConfigItemByPath } from '../global';

export class WebviewController {
    @RegisterCommand('openmcp.showOpenMCP')
    async showOpenMCP(context: vscode.ExtensionContext, uri: vscode.Uri) {
        const connectionItem = getWorkspaceConnectionConfigItemByPath(uri.fsPath);
        if (!connectionItem) {
            // 项目不存在连接信息
            const cwd = getLaunchCWD(context, uri);

            const sigature = getDefaultLanunchSignature(uri.fsPath, cwd);

            if (!sigature) {
                vscode.window.showErrorMessage('OpenMCP: 无法获取启动参数');
                return;
            }

            revealOpenMcpWebviewPanel(context, uri.fsPath, {
                type: 'stdio',
                name: 'OpenMCP',
                command: sigature.command,
                args: sigature.args,
                cwd
            });
        } else {
            revealOpenMcpWebviewPanel(context, uri.fsPath, connectionItem);
        }

    }
}