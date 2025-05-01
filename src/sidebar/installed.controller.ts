import * as vscode from 'vscode';
import { RegisterCommand, RegisterTreeDataProvider } from '../common';
import { getWorkspaceConnectionConfig, getWorkspacePath, panels, saveWorkspaceConnectionConfig } from '../global';
import { ConnectionViewItem } from './common';

@RegisterTreeDataProvider('openmcp.sidebar.installed-connection')
export class McpInstalledConnectProvider implements vscode.TreeDataProvider<ConnectionViewItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ConnectionViewItem | undefined | null | void> = new vscode.EventEmitter<ConnectionViewItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ConnectionViewItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private context: vscode.ExtensionContext) {}

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


    @RegisterCommand('refresh')
    public refresh(context: vscode.ExtensionContext): void {
        this._onDidChangeTreeData.fire();
    }

    @RegisterCommand('addConnection')
    public async addConnection(context: vscode.ExtensionContext) {
        
    }

    @RegisterCommand('openConfiguration')
    public async openConfiguration(context: vscode.ExtensionContext, view: ConnectionViewItem) {
        const item = view.item;
        const uri = vscode.Uri.file(item.filePath || item.name);
        vscode.commands.executeCommand('vscode.open', uri);
    }

    @RegisterCommand('deleteConnection')
    public async deleteConnection(context: vscode.ExtensionContext, view: ConnectionViewItem) {
        const workspaceConnectionConfig = getWorkspaceConnectionConfig();
        const connectionItem = view.item;
    
        // 弹出确认对话框
        const confirm = await vscode.window.showWarningMessage(
            `确定要删除连接 "${connectionItem.name}" 吗？`,
            { modal: true },
            '确定'
        );
    
        if (confirm !== '确定') {
            return; // 用户取消删除
        }
    
        // 从配置中移除该连接项
        const index = workspaceConnectionConfig.items.indexOf(connectionItem);
        if (index !== -1) {
            workspaceConnectionConfig.items.splice(index, 1);
            
            // 保存更新后的配置
            const workspacePath = getWorkspacePath();
            saveWorkspaceConnectionConfig(workspacePath);
            
            // 刷新侧边栏视图
            vscode.commands.executeCommand('openmcp.sidebar.workspace-connection.refresh');
            
            // 如果该连接有对应的webview面板，则关闭它
            if (panels.has(connectionItem.filePath || connectionItem.name)) {
                const panel = panels.get(connectionItem.filePath || connectionItem.name);
                panel?.dispose();
            }
        }
    }
}
