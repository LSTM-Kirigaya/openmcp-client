import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { routeMessage } from './common/router.js';
import { VSCodeWebViewLike } from './hook/adapter.js';
import fs from 'fs';
import path from 'path';
import { setRunningCWD } from './hook/setting.js';
import { exit } from 'process';


export interface VSCodeMessage {
    command: string;
    data?: unknown;
    callbackId?: string;
}

export type MessageHandler = (message: VSCodeMessage) => void;

function refreshConnectionOption(envPath: string) {
    const serverPath = join(__dirname, '..', '..', 'servers');
    const defaultOption = {
        connectionType: 'STDIO',
        commandString: 'mcp run main.py',
        cwd: serverPath
    };

    fs.writeFileSync(envPath, JSON.stringify(defaultOption, null, 4));
    return { items: [defaultOption] };
}

function acquireConnectionOption() {
    const envPath = join(__dirname, '..', '.env');

    if (!fs.existsSync(envPath)) {
        return refreshConnectionOption(envPath);
    }

    try {
        const option = JSON.parse(fs.readFileSync(envPath, 'utf-8'));

        if (!option.items || option.items.length === 0) {
            return refreshConnectionOption(envPath);
        }

        // 按照前端的规范，整理成 commandString 样式
        option.items = option.items.map((item: any) => {
            if (item.connectionType === 'STDIO') {
                item.commandString = [item.command, ...item.args]?.join(' ');
            } else {
                item.url = item.url;
            }
            return item;
        });

        return option;

    } catch (error) {
        // logger.error('读取 .env 配置文件');
        return refreshConnectionOption(envPath);
    }
}

// 验证 .env.website.local 存在性
const localEnvPath = join(__dirname, '..', '.env.website.local');
if (!fs.existsSync(localEnvPath)) {
    console.log('.env.website.local 不存在！');
    exit(0);
}

// 读取认证密码
const authPassword = JSON.parse(fs.readFileSync(localEnvPath, 'utf-8')).password;

function updateConnectionOption(data: any) {
    const envPath = join(__dirname, '..', '.env');
    fs.writeFileSync(envPath, JSON.stringify({ items: data }, null, 4));
}

const devHome = join(__dirname, '..', '..');
setRunningCWD(devHome);

function verifyToken(url: string) {
    try {
        const token = url.split('=')[1];
        return token === authPassword.toString();
    } catch (error) {
        return false;
    }
}

const wss = new WebSocketServer({
    port: 8282,
    verifyClient: (info, callback) => {
        const url = info.req.url || '';
        const ok = verifyToken(url);
        
        if (!ok) {
            callback(false, 401, 'Unauthorized: Invalid token');
        } else {
            callback(true);
        }
    }
});

console.log('listen on ws://localhost:8282');

wss.on('connection', (ws) => {
    const webview = new VSCodeWebViewLike(ws);

    webview.postMessage({
        command: 'hello',
        data: {
            version: '0.0.1',
            name: '消息桥连接完成'
        }
    });

    const option = acquireConnectionOption();

    webview.onDidReceiveMessage(message => {
        console.log(`command: [${message.command || 'No Command'}]`);
        const { command, data } = message;

        switch (command) {
            case 'web/launch-signature':
                webview.postMessage({
                    command: 'web/launch-signature',
                    data: {
                        code: 200,
                        msg: option.items
                    }
                });
                break;

            case 'web/update-connection-signature':
                updateConnectionOption(data);
                break;

            default:
                routeMessage(command, data, webview);
                break;
        }
    });
});
