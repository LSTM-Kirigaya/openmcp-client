import * as vscode from 'vscode';
import { SidebarItem } from './common';
import { RegisterTreeDataProvider } from '../common';

@RegisterTreeDataProvider('openmcp.sidebar.help')
export class HelpProvider implements vscode.TreeDataProvider<SidebarItem> {

    constructor(private context: vscode.ExtensionContext) {
    }

    // 实现 TreeDataProvider 接口
    getTreeItem(element: SidebarItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: SidebarItem): Thenable<SidebarItem[]> {
        // 返回子节点
        return Promise.resolve([
            new SidebarItem('入门', vscode.TreeItemCollapsibleState.None, {
                command: 'vscode.open',
                title: 'Open Guide',
                arguments: [vscode.Uri.parse('https://zhuanlan.zhihu.com/p/1896301240826184013')]
            }, 'book'),
            new SidebarItem('阅读文档', vscode.TreeItemCollapsibleState.None, {
                command: 'vscode.open',
                title: 'Open Documentation',
                arguments: [vscode.Uri.parse('https://document.kirigaya.cn/blogs/openmcp/main.html')]
            }, 'file-text'),
            new SidebarItem('报告问题', vscode.TreeItemCollapsibleState.None, {
                command: 'vscode.open',
                title: 'Report Issue',
                arguments: [vscode.Uri.parse('https://github.com/LSTM-Kirigaya/openmcp-client/issues')]
            }, 'bug'),
            new SidebarItem('参与项目', vscode.TreeItemCollapsibleState.None, {
                command: 'vscode.open',
                title: 'Join Project',
                arguments: [vscode.Uri.parse('https://qm.qq.com/cgi-bin/qm/qr?k=C6ZUTZvfqWoI12lWe7L93cWa1hUsuVT0&jump_from=webapi&authKey=McW6B1ogTPjPDrCyGttS890tMZGQ1KB3QLuG4aqVNRaYp4vlTSgf2c6dMcNjMuBD')]
            }, 'organization'),
            new SidebarItem('评论插件', vscode.TreeItemCollapsibleState.None, {
                command: 'vscode.open',
                title: 'Review Extension',
                arguments: [vscode.Uri.parse('https://marketplace.visualstudio.com/items?itemName=kirigaya.openmcp&ssr=false#review-details')]
            }, 'feedback')
        ]);
    }
}

