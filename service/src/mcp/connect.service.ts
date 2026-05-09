import { exec, execSync, spawnSync } from 'node:child_process';
import { RequestClientType, RequestData } from '../common/index.dto.js';
import { connect } from './client.service.js';
import { RestfulResponse } from '../common/index.dto.js';
import { ConnectionType, McpOptions } from './client.dto.js';
import { McpServerConnectMonitor } from './connect-monitor.service.js';
import * as crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import * as os from 'os';
import { PostMessageble } from '../hook/adapter.js';
import chalk from 'chalk';
import { FORBIDDEN_MONITOR } from '../hook/setting.js';
import { releaseClientStorageBinding, rememberClientStorageBinding } from '../storage/client-binding.js';

export const clientMap: Map<string, RequestClientType> = new Map();
export interface ConnectedSessionInfo {
    clientId: string;
    name: string;
    version: string;
}
function normalizeConnectionType(type?: string): ConnectionType | undefined {
    if (!type) return undefined;
    const normalized = type.trim().toUpperCase().replace(/[-\s]/g, '_');
    if (normalized === 'STDIO') return 'STDIO';
    if (normalized === 'SSE') return 'SSE';
    if (normalized === 'STREAMABLE_HTTP' || normalized === 'STREAMABLEHTTP') return 'STREAMABLE_HTTP';
    return undefined;
}

export function getClient(clientId?: string): RequestClientType | undefined {
    return clientMap.get(clientId || '');
}
export const clientMonitorMap: Map<string, McpServerConnectMonitor> = new Map();
export async function updateClientMap(uuid: string, options: McpOptions): Promise<{ res: boolean; error?: any }> {
    try {
        const client = await connect(options);
        clientMap.set(uuid, client);
        const tools = await client.listTools();
        console.log(
            chalk.white('update client tools'),
            chalk.blue(tools.tools.map(tool => tool.name).join(','))
        );
        const resourceTemplates = await client.listResourceTemplates();
        console.log(
            chalk.white('update client resourceTemplates'),
            chalk.blue(resourceTemplates.resourceTemplates.map(r => r.name).join(','))
        );
        const resources = await client.listResources();
        console.log(
            chalk.white('update client resources'),
            chalk.blue(resources.resources.map(r => r.name).join(','))
        );
        const prompts = await client.listPrompts();
        console.log(
            chalk.white('update client prompts'),
            chalk.blue(prompts.prompts.map(p => p.name).join(','))
        );
        return { res: true };
    } catch (error) {
        console.error('[updateClientMap] error:', error);
        return { res: false, error };
    }
}
export function tryGetRunCommandError(command: string, args: string[] = [], cwd?: string): string | null {
    try {
        const commandString = command + ' ' + args.join(' ');
        const result = spawnSync(commandString, {
            cwd: cwd || process.cwd(),
            stdio: 'pipe',
            encoding: 'utf-8'
        });

        if (result.error) {
            return result.error.message;
        }
        if (result.status !== 0) {
            return result.stderr || `Command failed with code ${result.status}`;
        }
        return null;
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
}

function getCWD(option: McpOptions) {
    // if (option.cwd) {
    // 	return option.cwd;
    // }
    const file = option.args?.at(-1);
    if (file) {
        // 如果是绝对路径，直接返回目录
        if (path.isAbsolute(file)) {
            // 如果是是文件，则返回文件所在的目录
            if (!fs.existsSync(file)) {
                return '';
            }

            if (fs.statSync(file).isDirectory()) {
                return file;
            } else {
                return path.dirname(file);
            }
        } else {
            // 如果是相对路径，根据 cwd 获取真实路径
            const absPath = path.resolve(option.cwd || process.cwd(), file);

            if (!fs.existsSync(absPath)) {
                return '';
            }

            // 如果是是文件，则返回文件所在的目录
            if (fs.statSync(absPath).isDirectory()) {
                return absPath;
            } else {
                return path.dirname(absPath);
            }
        }
    }
    return undefined;
}

function getCommandFileExt(option: McpOptions) {
    const file = option.args?.at(-1);
    if (file) {
        return path.extname(file);
    }
    return undefined;
}

function collectAllOutputExec(command: string, cwd: string) {
    return new Promise<string>((resolve, reject) => {
        const handler = setTimeout(() => {
            resolve('');
        }, 5000);

        exec(command, { cwd }, (error, stdout, stderr) => {
            const errorString = error || '';
            const stdoutString = stdout || '';
            const stderrString = stderr || '';

            console.log('[collectAllOutputExec]', errorString);
            console.log('[collectAllOutputExec]', stdoutString);
            console.log('[collectAllOutputExec]', stderrString);

            clearTimeout(handler);
            resolve(errorString + stdoutString + stderrString);
        });
    });
}

async function preprocessCommand(option: McpOptions, webview?: PostMessageble) {
    // 对于特殊表示的路径，进行特殊的支持
    if (option.args) {
        option.args = option.args.map(arg => {
            if (arg.startsWith('~/')) {
                return arg.replace('~', process.env.HOME || '');
            }
            return arg;
        });
    }

    if (option.cwd && option.cwd.startsWith('~/')) {
        option.cwd = option.cwd.replace('~', process.env.HOME || '');
    }

    const connectionType = normalizeConnectionType(option.connectionType);
    if (connectionType === 'SSE' || connectionType === 'STREAMABLE_HTTP') {
        return;
    }

    const cwd = getCWD(option);
    if (!cwd) {
        return;
    }

    const ext = getCommandFileExt(option);
    if (!ext) {
        return;
    }

    // STDIO 模式下，对不同类型的项目进行额外支持
    // uv：如果没有初始化，则进行 uv sync，将 mcp 设置为虚拟环境的
    // npm：如果没有初始化，则进行 npm init，将 mcp 设置为虚拟环境
    // go：如果没有初始化，则进行 go mod init

    switch (ext) {
        case '.py':
            await initUv(option, cwd, webview);
            break;
        case '.js':
        case '.ts':
            await initNpm(option, cwd, webview);
            break;

        default:
            break;
    }
}

async function initUv(option: McpOptions, cwd: string, webview?: PostMessageble) {
    let projectDir = cwd;

    while (projectDir !== path.dirname(projectDir)) {
        if (fs.readdirSync(projectDir).includes('pyproject.toml')) {
            break;
        }
        projectDir = path.dirname(projectDir);
    }

    const venv = path.join(projectDir, '.venv');

    // judge by OS
    const mcpCli = os.platform() === 'win32' ?
        path.join(venv, 'Scripts', 'mcp.exe') :
        path.join(venv, 'bin', 'mcp');

    if (option.command === 'mcp') {
        option.command = mcpCli;
        // option.cwd = projectDir;
    }

    if (fs.existsSync(mcpCli)) {
        return '';
    }

    const syncOutput = await collectAllOutputExec('uv sync', projectDir);

    webview?.postMessage({
        command: 'connect/log',
        data: {
            code: syncOutput.toLowerCase().startsWith('error') ? 501 : 200,
            msg: {
                title: 'uv sync',
                message: syncOutput
            }
        }
    });

    const addOutput = await collectAllOutputExec('uv add mcp "mcp[cli]"', projectDir);
    webview?.postMessage({
        command: 'connect/log',
        data: {
            code: addOutput.toLowerCase().startsWith('error') ? 501 : 200,
            msg: {
                title: 'uv add mcp "mcp[cli]"',
                message: addOutput
            }
        }
    });
}


async function initNpm(option: McpOptions, cwd: string, webview?: PostMessageble) {
    let projectDir = cwd;

    while (projectDir !== path.dirname(projectDir)) {
        if (fs.readdirSync(projectDir).includes('package.json')) {
            break;
        }
        projectDir = path.dirname(projectDir);
    }

    const nodeModulesPath = path.join(projectDir, 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
        return '';
    }

    const installOutput = execSync('npm i', { cwd: projectDir }).toString('utf-8') + '\n';
    webview?.postMessage({
        command: 'connect/log',
        data: {
            code: installOutput.toLowerCase().startsWith('error') ? 200 : 501,
            msg: {
                title: 'npm i',
                message: installOutput
            }
        }
    })
}


function normalizeForStableStringify(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(normalizeForStableStringify);
    }
    if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const key of Object.keys(value as Record<string, unknown>).sort()) {
            const item = (value as Record<string, unknown>)[key];
            if (item !== undefined) {
                out[key] = normalizeForStableStringify(item);
            }
        }
        return out;
    }
    return value;
}

function stableStringify(value: unknown): string {
    return JSON.stringify(normalizeForStableStringify(value)) ?? '';
}

function connectionIdentity(option: McpOptions): Record<string, unknown> {
    return {
        connectionType: normalizeConnectionType(option.connectionType) || option.connectionType,
        command: option.command,
        args: option.args,
        url: option.url,
        cwd: option.cwd,
        env: option.env,
        clientName: option.clientName,
        clientVersion: option.clientVersion
    };
}

async function deterministicUUID(input: string) {
    const msgBuffer = new TextEncoder().encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
    const bytes = new Uint8Array(hashBuffer).slice(0, 16);
    bytes[6] = (bytes[6] & 0x0f) | 0x50;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hashHex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return [
        hashHex.substring(0, 8),
        hashHex.substring(8, 12),
        hashHex.substring(12, 16),
        hashHex.substring(16, 20),
        hashHex.substring(20, 32)
    ].join('-');
}


export async function connectService(
    option: McpOptions,
    webview?: PostMessageble
): Promise<RestfulResponse> {
    try {
        const normalizedType = normalizeConnectionType(option.connectionType);
        if (normalizedType) {
            option.connectionType = normalizedType;
        }

        // 预处理字符串
        await preprocessCommand(option, webview);

        const uuid = await deterministicUUID(stableStringify(connectionIdentity(option)));
        const existingClient = clientMap.get(uuid);
        if (existingClient) {
            const versionInfo = existingClient.getServerVersion();
            rememberClientStorageBinding({
                clientId: uuid,
                connectionId: option.connectionId,
                connectionKey: option.connectionId || versionInfo?.name || 'default',
                scope: option.storageScope,
                workspacePath: option.workspacePath,
                serverName: versionInfo?.name || 'default'
            });
            return {
                code: 200,
                msg: {
                    status: 'success',
                    clientId: uuid,
                    reuseConnection: true,
                    reuseConntion: true,
                    name: versionInfo?.name || 'unknown',
                    version: versionInfo?.version || 'unknown'
                }
            };
        }

        const client = await connect(option);
        clientMap.set(uuid, client);
        
        // 只有 stdio 才需要监听        
        if (normalizeConnectionType(option.connectionType) === 'STDIO' && !FORBIDDEN_MONITOR) {
            clientMonitorMap.set(uuid, new McpServerConnectMonitor(uuid, option, updateClientMap, webview));
        }

        const versionInfo = client.getServerVersion();        
        rememberClientStorageBinding({
            clientId: uuid,
            connectionId: option.connectionId,
            connectionKey: option.connectionId || versionInfo?.name || 'default',
            scope: option.storageScope,
            workspacePath: option.workspacePath,
            serverName: versionInfo?.name || 'default'
        });
        const connectResult = {
            code: 200,
            msg: {
                status: 'success',
                clientId: uuid,
                reuseConnection: false,
                reuseConntion: false,
                name: versionInfo?.name || 'unknown',
                version: versionInfo?.version || 'unknown'
            }
        };

        return connectResult;
    } catch (error) {

        console.log('[connectService catch error]', error);

        // TODO: 这边获取到的 error 不够精致，如何才能获取到更加精准的错误
        // 比如	error: Failed to spawn: `server.py`
        //		  Caused by: No such file or directory (os error 2)

        let errorMsg = '';

        if (option.command) {
            errorMsg += await collectAllOutputExec(
                option.command + ' ' + (option.args || []).join(' '),
                option.cwd || process.cwd()
            )
        }

        errorMsg += (error as any).toString();

        const connectResult = {
            code: 500,
            msg: errorMsg
        };

        return connectResult;
    }
}

export async function disconnectService(data: RequestData) {
    const { clientId } = data;

    if (!clientId) {
        return {
            code: 500,
            msg: 'clientId is required'
        };
    }

    const client = getClient(clientId);

    if (!client) {
        return {
            code: 501,
            msg: 'mcp client 尚未连接'
        };
    }

    try {
        // Disconnect the client
        client.disconnect();

        // Remove from maps
        clientMap.delete(clientId);
        clientMonitorMap.get(clientId)?.close();
        clientMonitorMap.delete(clientId);
        releaseClientStorageBinding(clientId);

        return {
            code: 200,
            msg: 'Successfully disconnected'
        };
    } catch (error) {
        return {
            code: 500,
            msg: `Failed to disconnect: ${error}`
        };
    }
}

export async function listConnectedSessionsService() {
    const sessions: ConnectedSessionInfo[] = [];
    for (const [clientId, client] of clientMap.entries()) {
        if (!client) {
            continue;
        }
        const versionInfo = client.getServerVersion();
        sessions.push({
            clientId,
            name: versionInfo?.name || 'unknown',
            version: versionInfo?.version || 'unknown'
        });
    }

    return {
        code: 200,
        msg: sessions
    };
}
