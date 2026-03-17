/**
 * 轻量级存储：基于 JsonArchiveStore 的 key-value 写入与读取
 * 按文件大小自动轮转，类似日志系统
 */
import { JsonArchiveStore, type JsonArchiveRecord } from './json-archive-store.js';

export type OmdbRecord = JsonArchiveRecord;

export class OmdbStore {
    private store: JsonArchiveStore;

    constructor(dirPath: string, tableName: string = 'store') {
        this.store = new JsonArchiveStore(dirPath, tableName.replace(/[^a-zA-Z0-9_-]/g, '_'), {
            maxSize: '5m',
            maxFiles: 14
        });
    }

    async write(id: string, data: unknown): Promise<void> {
        await this.store.write(id, data);
    }

    async read(id: string): Promise<OmdbRecord | undefined> {
        return this.store.read(id);
    }

    async readAll(limit: number = 100): Promise<OmdbRecord[]> {
        return this.store.readAll(limit);
    }

    async count(): Promise<number> {
        return this.store.count();
    }

    getDbPath(): string {
        return this.store.getDirPath();
    }

    close(): void {
        this.store.close();
    }
}
