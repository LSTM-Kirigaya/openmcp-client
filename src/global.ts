import * as vscode from 'vscode';
import * as fspath from 'path';
import * as fs from 'fs';
import {
    getLocalConnectionRecordByName,
    getLocalConnectionRecordByPath,
    getLocalConnectionsStoragePath,
    listLocalConnectionItems,
    replaceLocalConnectionItems
} from '@openmcp/service';
import { t } from './i18n';

export type FsPath = string;
export const panels = new Map<FsPath, vscode.WebviewPanel>();

export interface IConnectionConfig {
    items: (McpOptions[] | McpOptions)[];
}

export type ConnectionType = 'STDIO' | 'SSE' | 'STREAMABLE_HTTP';

export interface McpOptions {
    connectionType: ConnectionType;
    command?: string;

    // STDIO 特定选项
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;

    // SSE 特定选项
    url?: string;
    oauth?: any;

    // 通用客户端选项
    clientName?: string;
    clientVersion?: string;
    serverInfo?: {
        name: string
        version: string
    }

    // vscode 专用
    filePath?: string;
    name?: string;
    version?: string;
    type?: ConnectionType;
    rename?: boolean;

    // 额外功能
    enableDatasetReflux?: boolean;
    datasetName?: string;

    [key: string]: any;
}


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
    _connectionConfig = {
        items: listLocalConnectionItems({ scope: 'user' }) as (McpOptions[] | McpOptions)[]
    };
    const connection = _connectionConfig;
    return connection;
}

/**
 * @description 获取工作区的连接信息，默认是 {workspace}/.openmcp/connection.json
 * @returns 
 */
export function getWorkspaceConnectionConfigPath() {
    const workspace = getWorkspacePath();
    if (!workspace) {
       return null; // 如果没有工作区，则返回 null
    }
    return getLocalConnectionsStoragePath({ scope: 'workspace', workspacePath: workspace });
}

/**
 * @description 获取工作区的连接信息，工作区的连接文件的路径都是相对路径，以 {workspace} 开头
 * @param workspace 
 */
export function getWorkspaceConnectionConfig():IConnectionConfig| null {
    if (_workspaceConnectionConfig) {
        return _workspaceConnectionConfig;
    }

    const workspace = getWorkspacePath();
    if (!workspace) {
       return null; // 如果没有工作区，则返回 null
    }
    _workspaceConnectionConfig = {
        items: listLocalConnectionItems({
            scope: 'workspace',
            workspacePath: workspace
        }) as (McpOptions[] | McpOptions)[]
    };
    const connection = _workspaceConnectionConfig;
    return connection;
}

export function getInstalledConnectionConfigPath() {
    return getLocalConnectionsStoragePath({ scope: 'user' });
}

/**
 * @description 保存连接信息到全局配置文件，这个部分和「安装的连接」对应
 * @returns 
 */
export function saveConnectionConfig() {
    if (!_connectionConfig) {
        return;
    }
    replaceLocalConnectionItems(_connectionConfig.items as any[], { scope: 'user' });
}

export function saveWorkspaceConnectionConfig(workspace: string) {

    if (!_workspaceConnectionConfig) {
        return;
    }
    replaceLocalConnectionItems(_workspaceConnectionConfig.items as any[], {
        scope: 'workspace',
        workspacePath: workspace
    });
}


export function updateWorkspaceConnectionConfig(
    name: string,
    data: McpOptions[]
) {
    const workspaceConnectionConfig = getWorkspaceConnectionConfig();
    if (!workspaceConnectionConfig) {
        console.error('没有工作区连接配置文件，请先创建一个工作区连接');
        return;
    }
    const connectionIndex = workspaceConnectionConfig.items.findIndex(item => detachMcpOptionAsItem(item).name === name);
    const connectionItem = connectionIndex >= 0 ? workspaceConnectionConfig.items[connectionIndex] : undefined;

    data.forEach(item => {
        item.cwd = item.cwd?.replace(/\\/g, '/');
        item.name = item.serverInfo?.name;
        item.version = item.serverInfo?.version;
        item.type = undefined;
    });

    console.log('get connectionItem: ', data);

    // 如果存在，替换老的 connectionItem
    if (connectionItem) {
        if (connectionIndex !== -1) {
            // check rename value
            const oldNItem = detachMcpOptionAsItem(workspaceConnectionConfig.items[connectionIndex]);
            if (oldNItem.rename) {
                // if renamed, reserve user defined name
                const newNItem = detachMcpOptionAsItem(data);
                newNItem.name = oldNItem.name;
            }

            workspaceConnectionConfig.items[connectionIndex] = data;
        } else {
            // insert new one
            workspaceConnectionConfig.items.unshift(data);
        }
    } else {
        workspaceConnectionConfig.items.unshift(data);
    }
    
    const workspacePath = getWorkspacePath();
    saveWorkspaceConnectionConfig(workspacePath);
    vscode.commands.executeCommand('openmcp.sidebar.workspace-connection.refresh');

}

export function updateInstalledConnectionConfig(
    name: string,
    data: McpOptions[]
) {
    const installedConnectionConfig = getConnectionConfig();
    const connectionIndex = installedConnectionConfig.items.findIndex(item => detachMcpOptionAsItem(item).name === name);
    const connectionItem = connectionIndex >= 0 ? installedConnectionConfig.items[connectionIndex] : undefined;

    // 对于第一个 item 添加 filePath
    // 对路径进行标准化
    data.forEach(item => {
        item.cwd = item.cwd?.replace(/\\/g, '/');
        item.name = item.serverInfo?.name;
        item.version = item.serverInfo?.version;
        item.type = undefined;
    });

    console.log('get connectionItem: ', data);

    if (connectionItem) {
        if (connectionIndex !== -1) {
            installedConnectionConfig.items[connectionIndex] = data;
        } else {
            installedConnectionConfig.items.unshift(data);
        }
    } else {
        installedConnectionConfig.items.unshift(data);
    }
    
    saveConnectionConfig();
    vscode.commands.executeCommand('openmcp.sidebar.installed-connection.refresh');
}


export function getWorkspacePath() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    console.log('getWorkspacePath: ', vscode.workspace.workspaceFolders);
    return (workspaceFolder?.uri.fsPath || '').replace(/\\/g, '/');
}

/**
 * @description 根据输入的文件路径，获取该文件的 mcp 连接签名
 * @param absPath 
 */
export function getWorkspaceConnectionConfigItemByPath(absPath: string) {
    const workspacePath = getWorkspacePath();
    if (!workspacePath) {
        return null; // 如果没有工作区连接配置文件，则返回 null
    }
    return getLocalConnectionRecordByPath(absPath, {
        scope: 'workspace',
        workspacePath
    })?.item as McpOptions[] | McpOptions | undefined;
}

/**
 * @description 根据输入的名称，获取该文件的 mcp 连接签名
 * @param absPath 
 */
export function getWorkspaceConnectionConfigItemByName(name: string) {
    const workspacePath = getWorkspacePath();
    if (!workspacePath) {
        return null; // 如果没有工作区连接配置文件，则返回 null
    }
    return getLocalConnectionRecordByName(name, {
        scope: 'workspace',
        workspacePath
    })?.item as McpOptions[] | McpOptions | undefined;
}

/**
 * @description 根据输入的名称，获取该文件的 mcp 连接签名
 * @param absPath 
 */
export function getInstalledConnectionConfigItemByName(name: string) {
    return getLocalConnectionRecordByName(name, { scope: 'user' })?.item as McpOptions[] | McpOptions | undefined;
}


/**
 * @description 根据输入的文件路径，获取该文件的 mcp 连接签名
 * @param absPath 
 */
export function getInstalledConnectionConfigItemByPath(absPath: string) {
    return getLocalConnectionRecordByPath(absPath, { scope: 'user' })?.item as McpOptions[] | McpOptions | undefined;
}


export async function getFirstValidPathFromCommand(command: string, cwd: string): Promise<string | undefined> {
    // 分割命令字符串
    const parts = command.split(' ');

    // 遍历命令部分，寻找第一个可能是路径的部分
    for (let i = 1; i < parts.length; i++) {
        const part = parts[i];

        // 跳过以 '-' 开头的参数
        if (part.startsWith('-')) continue;

        // 处理相对路径
        let fullPath = part;
        if (!fspath.isAbsolute(part)) {
            fullPath = fspath.join(cwd, part);
        }

        console.log(fullPath);

        if (fs.existsSync(fullPath)) {
            return fullPath;
        }
    }

    return undefined;
}


export async function exportFile(filename: string, content: any) {
    // 使用 vscode 的 api，创建文件导出窗口，询问用户
    const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(filename),
        filters: {
            'JSON': ['json']
        }
    });

    if (uri) {
        fs.writeFileSync(uri.fsPath, content, 'utf-8');
    }
}

export function detachMcpOptionAsItem(data: McpOptions | McpOptions[]): McpOptions {
    return Array.isArray(data) ? data[0] : data;
}

export function detachMcpOptionAsArray(data: McpOptions | McpOptions[]): McpOptions[] {
    return Array.isArray(data) ? data : [data];
}