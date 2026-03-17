import { McpOptions } from './client.dto.js';
import { SingleFileMonitor, FileMonitorConfig } from './file-monitor.service.js';
import { PostMessageble } from '../hook/adapter.js';
import * as fs from 'fs';
import * as path from 'path';
import { pino } from 'pino';
import chalk from 'chalk';


// 保留现有 logger 配置
const logger = pino({
  
});

function getFilePath(options: {
    cwd?: string;
    args?: string[];
}): string {
    const baseDir = options.cwd || process.cwd();
    const targetFile = options.args?.length ? options.args[options.args.length - 1] : '';

    if (!targetFile || path.isAbsolute(targetFile)) {
        return targetFile;
    }

    return path.resolve(baseDir, targetFile);
}

export class McpServerConnectMonitor {
    private Monitor: SingleFileMonitor | undefined;
    private Options: McpOptions;
    private uuid: string;
    private webview: PostMessageble | undefined;
    private filePath: string;

    constructor(uuid: string, options: McpOptions, onchange: Function, webview?: PostMessageble) {
        this.Options = options;
        this.webview = webview;
        this.uuid = uuid;
        this.filePath = getFilePath(options);

        // 记录实例创建
        // logger.info({ uuid, connectionType: options.connectionType }, 'Created new connection monitor instance');

        switch (options.connectionType) {
            case 'STDIO':
                console.log('monitor on ' + this.filePath);
                this.setupStdioMonitor(onchange);
                break;
            case 'SSE':
                // logger.info({ uuid }, 'SSE connection type configured but not implemented');
                break;
            case 'STREAMABLE_HTTP':
                // logger.info({ uuid }, 'STREAMABLE_HTTP connection type configured but not implemented');
                break;
        }
    }

    private setupStdioMonitor(onchange: Function) {
        const fileConfig: FileMonitorConfig = {
            filePath: this.filePath,
            debounceTime: 500,
            duplicateCheckTime: 500,
            onChange: async (curr, prev) => {
                try {
                    await onchange(this.uuid, this.Options);
                    
                    this.sendWebviewMessage('connect/refresh', {
                        code: 200,
                        msg: {
                            message: 'refresh connect success',
                            uuid: this.uuid,
                        }
                    });

                    console.log(
                        chalk.green('Connection refresh successfully')
                    );
                    
                } catch (err) {
                    this.sendWebviewMessage('connect/refresh', {
                        code: 500,
                        msg: {
                            message: 'refresh connect failed',
                            uuid: this.uuid,
                        }
                    });
                    // 使用 error 级别记录错误
                    logger.error({ uuid: this.uuid, error: err }, 'Connection refresh failed');
                }
            },
            onDelete: () => {
                // 使用 warn 级别记录文件删除
                logger.warn({ uuid: this.uuid }, 'Monitored file has been deleted');
            },
            onStart: () => {
                // 使用 info 级别记录监控开始
                // logger.info({ uuid: this.uuid, filePath: path.resolve(fileConfig.filePath) }, 'Started monitoring file');

                try {
                    const stats = fs.statSync(fileConfig.filePath);
                    // 使用 debug 级别记录详细文件信息
                    logger.debug({
                        uuid: this.uuid,
                        size: stats.size,
                        ctime: new Date(stats.ctime).toLocaleString()
                    }, 'File information retrieved');
                } catch (err) {
                    // 使用 error 级别记录获取文件信息失败
                    logger.error({ uuid: this.uuid, error: err }, 'Failed to retrieve file information');
                }
            },
            onError: (error) => {
                // 使用 error 级别记录监控错误
                logger.error({ uuid: this.uuid, error }, 'Error occurred during monitoring');
            }
        };

        this.Monitor = new SingleFileMonitor(fileConfig);
    }

    private sendWebviewMessage(command: string, data: any) {
        // 发送消息到webview
        this.webview?.postMessage({ command, data });
    }

    public close() {
        this.Monitor?.close();
    }

}
