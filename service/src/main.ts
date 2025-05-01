import WebSocket from 'ws';
import pino from 'pino';

import { routeMessage } from './common/router';
import { VSCodeWebViewLike } from './hook/adapter';
import path from 'node:path';
import * as fs from 'node:fs';

export interface VSCodeMessage {
    command: string;
    data?: unknown;
    callbackId?: string;
}

const logger = pino({
    transport: {
        target: 'pino-pretty', // 启用 pino-pretty
        options: {
            colorize: true,      // 开启颜色
            levelFirst: true,    // 先打印日志级别
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss', // 格式化时间
            ignore: 'pid,hostname',     // 忽略部分字段
        }
    }
});

export type MessageHandler = (message: VSCodeMessage) => void;
const wss = new (WebSocket as any).Server({ port: 8080 });

interface IStdioLaunchSignature {
    type: 'stdio';
    commandString: string;
    cwd: string;
}

interface ISSELaunchSignature {
    type:'sse';
    url: string;
    oauth: string;
}

export type ILaunchSigature = IStdioLaunchSignature | ISSELaunchSignature;

function refreshConnectionOption(envPath: string) {
    const defaultOption = {
        type:'stdio',
        command: 'mcp',
        args: ['run', 'main.py'],
        cwd: '../server'
    };

    fs.writeFileSync(envPath, JSON.stringify(defaultOption, null, 4));   

    return defaultOption;
}

function getInitConnectionOption() {
    const envPath = path.join(__dirname, '..', '.env');

    if (!fs.existsSync(envPath)) {
        return refreshConnectionOption(envPath);
    }

    try {
        const option = JSON.parse(fs.readFileSync(envPath, 'utf-8'));
        return option;

    } catch (error) {
        logger.error('读取 .env 配置文件');
        return refreshConnectionOption(envPath);
    }
}

function updateConnectionOption(data: any) {
    const envPath = path.join(__dirname, '..', '.env');
    
    if (data.connectionType === 'STDIO') {
        const connectionItem = {
            type: 'stdio',
            command: data.command,
            args: data.args,
            cwd: data.cwd.replace(/\\/g, '/')
        };

        fs.writeFileSync(envPath, JSON.stringify(connectionItem, null, 4));
    } else {
        const connectionItem = {
            type: 'sse',
            url: data.url,
            oauth: data.oauth
        };

        fs.writeFileSync(envPath, JSON.stringify(connectionItem, null, 4));
    }
}

wss.on('connection', ws => {

    // 仿造 webview 进行统一接口访问
    const webview = new VSCodeWebViewLike(ws);

    // 先发送成功建立的消息
    webview.postMessage({
        command: 'hello',
        data: {
            version: '0.0.1',
            name: '消息桥连接完成'
        }
    });

    const option = getInitConnectionOption();

    // 注册消息接受的管线
    webview.onDidReceiveMessage(message => {
        logger.info(`command: [${message.command || 'No Command'}]`);
        const { command, data } = message;

        switch (command) {
            case 'web/launch-signature':
                const launchResultMessage: ILaunchSigature = option.type === 'stdio' ?
                    {
                        type: 'stdio',
                        commandString: option.command + ' ' + option.args.join(' '),
                        cwd: option.cwd || ''
                    } :
                    {
                        type: 'sse',
                        url: option.url,
                        oauth: option.oauth || ''
                    };
            
                const launchResult = {
                    code: 200,
                    msg: launchResultMessage
                };

                webview.postMessage({
                    command: 'web/launch-signature',
                    data: launchResult
                });

                break;
            
            case 'web/update-connection-sigature':
                updateConnectionOption(data);
                break;
        
            default:
                routeMessage(command, data, webview);
                break;
        }
    });
});