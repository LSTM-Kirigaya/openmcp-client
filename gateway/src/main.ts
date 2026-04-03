import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Logger } from 'pino';
import { routeMessage, VSCodeWebViewLike, setRunningCWD } from '@openmcp/service';
import fs from 'fs/promises';
import { createGatewayLogger } from './logger.js';

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

export type MessageHandler = (message: VSCodeMessage) => void;

async function refreshConnectionOption(logger: Logger) {
    const defaultOption = {
        connectionType: 'STDIO',
        commandString: 'mcp run main.py',
        cwd: serverPath
    };

    try {
        await fs.writeFile(envPath, JSON.stringify(defaultOption, null, 4), 'utf-8');
        return { items: [defaultOption] };
    } catch (error) {
        logger.error({ err: error }, '刷新连接配置失败');
        throw error;
    }
}

async function acquireConnectionOption(logger: Logger) {
    try {
        const data = await fs.readFile(envPath, 'utf-8');
        const option = JSON.parse(data);

        if (!option.items || option.items.length === 0) {
            return await refreshConnectionOption(logger);
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
        logger.warn({ err: error }, '读取 .env 配置文件失败，将写入默认配置');
        return await refreshConnectionOption(logger);
    }
}

async function updateConnectionOption(logger: Logger, data: any) {
    try {
        await fs.writeFile(envPath, JSON.stringify({ items: data }, null, 4), 'utf-8');
    } catch (error) {
        logger.error({ err: error }, '更新连接配置失败');
        throw error;
    }
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
        const optionPromise = acquireConnectionOption(logger).catch(async (error) => {
            logger.error({ err: error }, '初始化连接配置失败');
            return await refreshConnectionOption(logger);
        });

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
                    const option = await optionPromise;
                    webview.postMessage({
                        command: 'web/launch-signature',
                        data: {
                            _id: data._id,
                            code: 200,
                            msg: option.items
                        }
                    });
                    break;
                }

                case 'web/update-connection-signature':
                    await updateConnectionOption(logger, data);
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
