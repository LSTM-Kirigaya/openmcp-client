import { getWorkspaceConnectionConfig, getWorkspacePath, IConnectionItem, panels, saveWorkspaceConnectionConfig } from "../global";

import * as vscode from 'vscode';

export async function acquireUserCustomConnection(): Promise<IConnectionItem | undefined> {
    // 让用户选择连接类型
    const connectionType = await vscode.window.showQuickPick(['stdio', 'sse'], {
        placeHolder: '请选择连接类型'
    });

    if (!connectionType) {
        return; // 用户取消选择
    }

    if (connectionType === 'stdio') {
        // 获取 command
        const commandString = await vscode.window.showInputBox({
            prompt: '请输入连接的 command',
            placeHolder: '例如: mcp run main.py'
        });

        if (!commandString) {
            return; // 用户取消输入
        }

        // 获取 cwd
        const cwd = await vscode.window.showInputBox({
            prompt: '请输入工作目录 (cwd)，可选',
            placeHolder: '例如: /path/to/project'
        });

        // 校验 command + cwd 是否有效
        try {
            const commandPath = await validateAndGetCommandPath(commandString, cwd);
            console.log('Command Path:', commandPath);
        } catch (error) {
            vscode.window.showErrorMessage(`无效的 command: ${error}`);
            return;
        }

        const commands = commandString.split(' ');
        const command = commands[0];
        const args = commands.slice(1);

        // 保存连接配置
        return {
            type: 'stdio',
            name: `stdio-${Date.now()}`,
            command: command,
            args,
            cwd: cwd || ''
        };

    } else if (connectionType === 'sse') {
        // 获取 url
        const url = await vscode.window.showInputBox({
            prompt: '请输入连接的 URL',
            placeHolder: '例如: https://127.0.0.1:8080'
        });

        if (!url) {
            return; // 用户取消输入
        }

        // 获取 oauth
        const oauth = await vscode.window.showInputBox({
            prompt: '请输入 OAuth 令牌，可选',
            placeHolder: '例如: your-oauth-token'
        });

        // 保存连接配置
        return {
            type: 'sse',
            name: `sse-${Date.now()}`,
            version: '1.0', // 假设默认版本为 1.0，可根据实际情况修改
            url: url,
            oauth: oauth || ''
        }
    }
}

export async function deleteUserConnection(item: IConnectionItem) {
    // 弹出确认对话框
    const confirm = await vscode.window.showWarningMessage(
        `确定要删除连接 "${item.name}" 吗？`,
        { modal: true },
        '确定'
    );

    if (confirm !== '确定') {
        return; // 用户取消删除
    }

    const workspaceConnectionConfig = getWorkspaceConnectionConfig();

    // 从配置中移除该连接项
    const index = workspaceConnectionConfig.items.indexOf(item);
    if (index !== -1) {
        workspaceConnectionConfig.items.splice(index, 1);

        // 保存更新后的配置
        const workspacePath = getWorkspacePath();
        saveWorkspaceConnectionConfig(workspacePath);

        // 刷新侧边栏视图
        vscode.commands.executeCommand('openmcp.sidebar.workspace-connection.refresh');
        panels.delete(item.name);
        // 如果该连接有对应的webview面板，则关闭它
        if (panels.has(item.filePath || item.name)) {
            const panel = panels.get(item.filePath || item.name);
            panel?.dispose();
        }
    }
}

export async function validateAndGetCommandPath(command: string, cwd?: string): Promise<string> {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    try {
        const { stdout } = await execAsync(`which ${command.split(' ')[0]}`, { cwd });
        return stdout.trim();
    } catch (error) {
        throw new Error(`无法找到命令: ${command.split(' ')[0]}`);
    }
}