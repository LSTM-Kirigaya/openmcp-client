import { WebSocketServer } from 'ws';
import { pino } from 'pino';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { routeMessage } from './common/router.js';
import { VSCodeWebViewLike } from './hook/adapter.js';
import fs from 'fs/promises'; // 使用 Promise API 替代回调
import chalk from 'chalk';

export interface VSCodeMessage {
    command: string;
    data?: unknown;
    callbackId?: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

// 统一路径变量
const devHome = join(__dirname, '..', '..');
const serverPath = join(devHome, 'servers');
const envPath = join(__dirname, '..', '.env');

const logger = pino({
  
});

export type MessageHandler = (message: VSCodeMessage) => void;

async function refreshConnectionOption() {
    const defaultOption = {
        connectionType: 'STDIO',
        commandString: 'mcp run main.py',
        cwd: serverPath
    };

    try {
        await fs.writeFile(envPath, JSON.stringify(defaultOption, null, 4), 'utf-8');
        return { items: [defaultOption] };
    } catch (error) {
        console.log('刷新连接配置失败:', error);
        throw error;
    }
}

async function acquireConnectionOption() {
    try {
        const data = await fs.readFile(envPath, 'utf-8');
        const option = JSON.parse(data);

        if (!option.items || option.items.length === 0) {
            return await refreshConnectionOption();
        }

        // 按照前端的规范，整理成 commandString 样式
        option.items = option.items.map((item: { connectionType: string; commandString: string; command: any; args: any; url: any; }) => {
            if (item.connectionType === 'STDIO') {
                item.commandString = [item.command, ...item.args]?.join(' ');
            } else {
                item.url = item.url;
            }
            return item;
        });

        return option;
    } catch (error) {
        console.log('读取 .env 配置文件失败:', error);
        return await refreshConnectionOption();
    }
}

async function updateConnectionOption(data: any) {
    try {
        await fs.writeFile(envPath, JSON.stringify({ items: data }, null, 4), 'utf-8');
    } catch (error) {
        console.log('更新连接配置失败:', error);
        throw error;
    }
}

// 设置运行时路径
import { setRunningCWD } from './hook/setting.js';
import { loadDebuggerMcpConfig } from './debugger-mcp/debugger-mcp-storage.service.js';
import { ensureDebuggerMcpServer } from './debugger-mcp/debugger-mcp.service.js';
setRunningCWD(devHome);

// 若配置开启，则启动 OpenMCP Debugger MCP 服务
const debuggerConfig = loadDebuggerMcpConfig();
if (debuggerConfig.enabled) {
    ensureDebuggerMcpServer(debuggerConfig).then(r => {
        if (r) console.log('[main] OpenMCP Debugger MCP started on port', r.port);
    });
}

// 启动 WebSocket 服务器
const wss = new WebSocketServer({ port: 8282 });
console.log('WebSocket 服务器已启动:', 'ws://localhost:8282');

wss.on('connection', (ws) => {
    const webview = new VSCodeWebViewLike(ws);

    webview.postMessage({
        command: 'hello',
        data: {
            version: '0.0.1',
            name: '消息桥连接完成'
        }
    });

    acquireConnectionOption().then(option => {
        webview.onDidReceiveMessage(async (message) => {
            console.log(
                chalk.white('receive command') + 
                chalk.blue(` [${message.command || '未定义'}]`)
            );

            const { command, data } = message;

            switch (command) {
                case 'web/launch-signature':
                    webview.postMessage({
                        command: 'web/launch-signature',
                        data: {
                            _id: data._id,
                            code: 200,
                            msg: option.items
                        }
                    });
                    break;

                case 'web/update-connection-signature':
                    await updateConnectionOption(data);
                    break;

                default:
                    routeMessage(command, data, webview);
                    break;
            }
        });
    }).catch(error => {
        logger.error('初始化连接配置失败:', error);
    });
});