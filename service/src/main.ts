import WebSocket from 'ws';
import pino from 'pino';

import { messageController } from './controller';
import { VSCodeWebViewLike } from './adapter';

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
const wss = new WebSocket.Server({ port: 8080 });

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

    // 注册消息接受的管线
    webview.onDidReceiveMessage(message => {
        logger.info(`command: [${message.command || 'No Command'}]`);

        const { command, data } = message;
        messageController(command, data, webview);
    });
});