import { mkdir, readdir, stat, unlink } from 'fs/promises';
import { join } from 'path';
import pino from 'pino';
import pretty from 'pino-pretty';
import { createStream, type RotatingFileStream } from 'rotating-file-stream';
import { gatewayUserLogDir } from './paths.js';

/** 日志保留天数：超过此时间的文件在启动与每日清理时删除 */
export const LOG_RETENTION_DAYS = 3;

const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;

export async function pruneLogsOlderThan(logDir: string, days: number): Promise<void> {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    let entries;
    try {
        entries = await readdir(logDir, { withFileTypes: true });
    } catch (e: unknown) {
        const err = e as NodeJS.ErrnoException;
        if (err.code === 'ENOENT') {
            return;
        }
        throw e;
    }
    await Promise.all(
        entries.map(async (ent) => {
            if (!ent.isFile()) {
                return;
            }
            const full = join(logDir, ent.name);
            try {
                const st = await stat(full);
                if (st.mtimeMs < cutoff) {
                    await unlink(full);
                }
            } catch {
                // 并发删除等场景忽略
            }
        })
    );
}

/**
 * 日志目录：用户主目录 .openmcp/logs/gateway，按天轮转，保留约 3 天。
 */
export async function createGatewayLogger(): Promise<pino.Logger> {
    const logDir = gatewayUserLogDir();
    await mkdir(logDir, { recursive: true });
    await pruneLogsOlderThan(logDir, LOG_RETENTION_DAYS);

    const fileStream: RotatingFileStream = createStream('gateway.log', {
        interval: '1d',
        path: logDir,
        maxFiles: LOG_RETENTION_DAYS,
        encoding: 'utf8'
    });

    fileStream.on('error', (err) => {
        console.error('[gateway log file]', err);
    });

    const isProd = process.env.NODE_ENV === 'production';
    const outStream = isProd
        ? process.stdout
        : pretty({ colorize: true, sync: true, translateTime: 'SYS:standard' });

    const level = process.env.LOG_LEVEL ?? 'info';

    const logger = pino({ level }, pino.multistream([
        { level, stream: outStream },
        { level, stream: fileStream }
    ]));

    setInterval(() => {
        void pruneLogsOlderThan(logDir, LOG_RETENTION_DAYS);
    }, PRUNE_INTERVAL_MS);

    return logger;
}
