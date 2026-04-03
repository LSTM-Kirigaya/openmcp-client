import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Logger } from 'pino';
import { routeMessage, VSCodeWebViewLike, setRunningCWD, listServers, replaceAllServers } from '@openmcp/service';
import { createGatewayLogger } from './logger.js';

export interface VSCodeMessage {
    command: string;
    data?: unknown;
    callbackId?: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const devHome = join(__dirname, '..', '..');

export type MessageHandler = (message: VSCodeMessage) => void;

function loadLaunchServers(): any[] {
    const records = listServers();
    return records.map((r: any) => {
        const item: any = { ...r };
        if (item.connectionType === 'STDIO' && item.command) {
            item.commandString = [item.command, ...(item.args || [])].join(' ');
        }
        return item;
    });
}

function parseGatewayPort(): number {
    const raw = process.env.PORT;
    if (raw === undefined || raw === '') {
        return 8282;
    }
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0 || n > 65535) {
        return 8282;
    }
    return n;
}

async function bootstrap() {
    const logger = await createGatewayLogger();
    setRunningCWD(devHome);

    const port = parseGatewayPort();
    const wss = new WebSocketServer({ port });
    logger.info({ port }, 'WebSocket 服务器已启动');

    wss.on('connection', (ws) => {
        const webview = new VSCodeWebViewLike(ws);

        webview.postMessage({
            command: 'hello',
            data: {
                version: '0.0.1',
                name: '消息桥连接完成'
            }
        });

        webview.onDidReceiveMessage(async (message: VSCodeMessage) => {
            logger.info({ command: message.command ?? '未定义' }, 'receive command');

            const { command, data } = message as { command: string; data: any };

            switch (command) {
                case 'web/launch-signature': {
                    const items = loadLaunchServers();
                    webview.postMessage({
                        command: 'web/launch-signature',
                        data: {
                            _id: data._id,
                            code: 200,
                            msg: items
                        }
                    });
                    break;
                }

                case 'web/update-connection-signature':
                    try {
                        if (Array.isArray(data)) {
                            replaceAllServers(data);
                        }
                    } catch (error) {
                        logger.error({ err: error }, '更新 Server 配置失败');
                    }
                    break;

                default:
                    routeMessage(command, data, webview);
                    break;
            }
        });
    });
}

bootstrap().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
