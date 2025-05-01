import * as vscode from 'vscode';
import { RegisterCommand, RegisterTreeDataProvider } from '../common';
import { getWorkspaceConnectionConfig, getWorkspaceConnectionConfigPath, getWorkspacePath, panels, saveWorkspaceConnectionConfig } from '../global';
import { ConnectionViewItem } from './common';
import { revealOpenMcpWebviewPanel } from '../webview/webview.service';
import { acquireUserCustomConnection, deleteUserConnection } from './workspace.service';

@RegisterTreeDataProvider('openmcp.sidebar.workspace-connection')
export class McpWorkspaceConnectProvider implements vscode.TreeDataProvider<ConnectionViewItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ConnectionViewItem | undefined | null | void> = new vscode.EventEmitter<ConnectionViewItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ConnectionViewItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private context: vscode.ExtensionContext) { }

    // 实现 TreeDataProvider 接口
    getTreeItem(element: ConnectionViewItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ConnectionViewItem): Thenable<ConnectionViewItem[]> {
        // TODO: 读取 configDir 下的所有文件，作为子节点
        const connection = getWorkspaceConnectionConfig();
        const sidebarItems = connection.items.map((item, index) => {
            // 连接的名字
            const itemName = `${item.name} (${item.type})`
            return new ConnectionViewItem(itemName, vscode.TreeItemCollapsibleState.None, item, 'server');
        })

        // 返回子节点
        return Promise.resolve(sidebarItems);
    }

    @RegisterCommand('revealWebviewPanel')
    public revealWebviewPanel(context: vscode.ExtensionContext, view: ConnectionViewItem) {
        const item = view.item;
        revealOpenMcpWebviewPanel(context, item.filePath || item.name, item);
    }

    @RegisterCommand('refresh')
    public refresh(context: vscode.ExtensionContext): void {
        console.log(this);

        this._onDidChangeTreeData.fire();
    }

    @RegisterCommand('addConnection')
    public async addConnection(context: vscode.ExtensionContext) {

        const item = await acquireUserCustomConnection();

        if (!item) {
            return;
        }

        const workspaceConnectionConfig = getWorkspaceConnectionConfig();
        workspaceConnectionConfig.items.push(item);
        saveWorkspaceConnectionConfig(getWorkspacePath());

        // 刷新侧边栏视图
        vscode.commands.executeCommand('openmcp.sidebar.workspace-connection.refresh');
    }

    @RegisterCommand('openConfiguration')
    public async openConfiguration(context: vscode.ExtensionContext, view: ConnectionViewItem) {
        const configPath = getWorkspaceConnectionConfigPath();
        const uri = vscode.Uri.file(configPath);
        vscode.commands.executeCommand('vscode.open', uri);
    }

    @RegisterCommand('deleteConnection')
    public async deleteConnection(context: vscode.ExtensionContext, view: ConnectionViewItem) {
        const connectionItem = view.item;
        await deleteUserConnection(connectionItem);
    }
}
