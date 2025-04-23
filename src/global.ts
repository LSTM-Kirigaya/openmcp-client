import * as vscode from 'vscode';
import * as os from 'os';
import * as fspath from 'path';
import * as fs from 'fs';

export type FsPath = string;
export const panels = new Map<FsPath, vscode.WebviewPanel>();


export interface IStdioConnectionItem {
    type: 'stdio';
    name: string;
    command: string;
    args: string[];
    cwd?: string;
    env?: { [key: string]: string };
    filePath?: string;
}

export interface ISSEConnectionItem {
    type: 'sse';
    name: string;
    url: string;
    oauth?: string;
    env?: { [key: string]: string };
    filePath?: string;
}

export interface IConnectionConfig {
    items: (IStdioConnectionItem | ISSEConnectionItem)[];
}

export const CONNECTION_CONFIG_NAME = 'openmcp_connection.json';

let _connectionConfig: IConnectionConfig | undefined;
let _workspaceConnectionConfig: IConnectionConfig | undefined;

/**
 * @description 获取全局的连接信息，全局文件信息都是绝对路径
 * @returns 
 */
export function getConnectionConfig() {
    if (_connectionConfig) {
        return _connectionConfig;
    }
    const homeDir = os.homedir();
    const configDir = fspath.join(homeDir, '.openmcp');
    const connectionConfig = fspath.join(configDir, CONNECTION_CONFIG_NAME);
    if (!fs.existsSync(connectionConfig)) {
        fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(connectionConfig, JSON.stringify({ items: [] }), 'utf-8');
    }

    const rawConnectionString = fs.readFileSync(connectionConfig, 'utf-8');
    const connection = JSON.parse(rawConnectionString) as IConnectionConfig;
    _connectionConfig = connection;
    return connection;
}


/**
 * @description 获取工作区的连接信息，工作区的连接文件的路径都是相对路径，以 {workspace} 开头
 * @param workspace 
 */
export function getWorkspaceConnectionConfig() {
    const workspace = getWorkspacePath();

    if (_workspaceConnectionConfig) {
        return _workspaceConnectionConfig;
    }
    const configDir = fspath.join(workspace, '.vscode');
    const connectionConfig = fspath.join(configDir, CONNECTION_CONFIG_NAME);

    if (!fs.existsSync(connectionConfig)) {
        fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(connectionConfig, JSON.stringify({ items: [] }), 'utf-8');
    }

    const rawConnectionString = fs.readFileSync(connectionConfig, 'utf-8');
    const connection = JSON.parse(rawConnectionString) as IConnectionConfig;

    const workspacePath = getWorkspacePath();
    for (const item of connection.items) {
        if (item.filePath && item.filePath.startsWith('{workspace}')) {
            item.filePath = item.filePath.replace('{workspace}', workspacePath).replace(/\\/g, '/');
        }
        if (item.type === 'stdio' && item.cwd && item.cwd.startsWith('{workspace}')) {
            item.cwd = item.cwd.replace('{workspace}', workspacePath).replace(/\\/g, '/');
        }
    }

    _workspaceConnectionConfig = connection;
    return connection;
}

export function saveWorkspaceConnectionConfig(workspace: string) {

    if (!_workspaceConnectionConfig) {
        return;
    }

    const connectionConfig = JSON.parse(JSON.stringify(_workspaceConnectionConfig)) as IConnectionConfig;

    const configDir = fspath.join(workspace, '.vscode');
    const connectionConfigPath = fspath.join(configDir, CONNECTION_CONFIG_NAME);

    const workspacePath = getWorkspacePath();
    for (const item of connectionConfig.items) {
        if (item.filePath && item.filePath.replace(/\\/g, '/').startsWith(workspacePath)) {
            item.filePath = item.filePath.replace(workspacePath, '{workspace}').replace(/\\/g, '/');
        }
        if (item.type ==='stdio' && item.cwd && item.cwd.replace(/\\/g, '/').startsWith(workspacePath)) {
            item.cwd = item.cwd.replace(workspacePath, '{workspace}').replace(/\\/g, '/');
        }
    }
    fs.writeFileSync(connectionConfigPath, JSON.stringify(connectionConfig, null, 2), 'utf-8');
}

interface ClientStdioConnectionItem {
    command: string;
    args: string[];
    clientName: string;
    clientVersion: string;
    connectionType: 'STDIO';
    cwd: string;
    env: { [key: string]: string };
}

interface ClientSseConnectionItem {
    url: string;
    clientName: string;
    clientVersion: string;
    connectionType: 'SSE';
    env: { [key: string]: string };
}

export function updateWorkspaceConnectionConfig(absPath: string, data: ClientStdioConnectionItem | ClientSseConnectionItem) {
    const connectionItem = getWorkspaceConnectionConfigItemByPath(absPath);
    const workspaceConnectionConfig = getWorkspaceConnectionConfig();

    // 如果存在，删除老的 connectionItem
    if (connectionItem) {
        const index = workspaceConnectionConfig.items.indexOf(connectionItem);
        if (index !== -1) {
            workspaceConnectionConfig.items.splice(index, 1);
        }
    }

    if (data.connectionType === 'STDIO') {
        const connectionItem: IStdioConnectionItem = {
            type:'stdio',
            name: data.clientName,
            command: data.command,
            args: data.args,
            cwd: data.cwd.replace(/\\/g, '/'),
            env: data.env,
            filePath: absPath.replace(/\\/g, '/')
        };

        // 插入到第一个
        workspaceConnectionConfig.items.unshift(connectionItem);
        const workspacePath = getWorkspacePath();
        saveWorkspaceConnectionConfig(workspacePath);
        vscode.commands.executeCommand('openmcp.sidebar.workspace-connection.refresh');

    } else {

    }
}

function normaliseConnectionFilePath(item: IStdioConnectionItem | ISSEConnectionItem, workspace: string) {
    if (item.filePath) {
        if (item.filePath.startsWith('{workspace}')) {
            return item.filePath.replace('{workspace}', workspace).replace(/\\/g, '/');
        } else {
            return item.filePath.replace(/\\/g, '/');
        }
    }

    return undefined;
}

export function getWorkspacePath() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    return (workspaceFolder?.uri.fsPath || '').replace(/\\/g, '/');
}

/**
 * @description 根据输入的文件路径，获取该文件的 mcp 连接签名
 * @param absPath 
 */
export function getWorkspaceConnectionConfigItemByPath(absPath: string) {
    const workspacePath = getWorkspacePath();
    const workspaceConnectionConfig = getWorkspaceConnectionConfig();

    const normaliseAbsPath = absPath.replace(/\\/g, '/');
    for (const item of workspaceConnectionConfig.items) {
        const filePath = normaliseConnectionFilePath(item, workspacePath);
        if (filePath === normaliseAbsPath) {
            return item;
        }
    }

    return undefined;
}