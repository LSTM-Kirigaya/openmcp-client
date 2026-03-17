import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { UnifiedChunkStore } from '../common/unified-chunk-store.js';
import { REFLUX_HOME, VSCODE_WORKSPACE } from '../hook/setting.js';
import { ChatStorage, TokenConsumption, type EnableToolItem } from './reflux.dto.js';

interface ChatStorageRow {
    id: string;
    messages: string;
    modelIndex: number | null;
    systemPrompt: string;
    enableTools: EnableToolItem[];
    temperature: number;
    enableWebSearch: number;
    contextLength: number;
    parallelToolCalls: number;
    enableXmlWrapper: number;
    traceHash: string;
    trace: string;
    tokenTotal: number;
    tokenInput: number;
    tokenOutput: number;
    tokenCacheRatio: number;
    timestamp: number;
}

export class RefluxDB {
    private store: UnifiedChunkStore;
    private baseDir: string;

    constructor(tableName: string = 'storage') {
        const dbDir = REFLUX_HOME || path.join(VSCODE_WORKSPACE || process.cwd(), '.openmcp', 'data');
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        this.baseDir = path.join(dbDir, `reflux-${tableName}`);
        this.store = new UnifiedChunkStore(this.baseDir, { maxSize: '5m', maxFiles: 14 });
    }

    async insert(id: string, record: ChatStorage, trace: string, tokenConsumption: TokenConsumption): Promise<void> {
        const settings = record.settings;
        const traceHash = crypto.createHash('md5').update(trace).digest('hex');

        const row: ChatStorageRow = {
            id,
            messages: JSON.stringify(record.messages),
            modelIndex: settings.modelIndex !== undefined ? settings.modelIndex : null,
            systemPrompt: settings.systemPrompt || '',
            enableTools: (settings.enableTools || []) as EnableToolItem[],
            temperature: settings.temperature,
            enableWebSearch: settings.enableWebSearch ? 1 : 0,
            contextLength: settings.contextLength,
            parallelToolCalls: settings.parallelToolCalls ? 1 : 0,
            enableXmlWrapper: settings.enableXmlWrapper ? 1 : 0,
            traceHash,
            trace,
            tokenTotal: tokenConsumption.total,
            tokenInput: tokenConsumption.input,
            tokenOutput: tokenConsumption.output,
            tokenCacheRatio: tokenConsumption.cacheRatio,
            timestamp: Date.now()
        };
        await this.store.write(id, row);
    }

    async findById(id: string): Promise<ChatStorage | undefined> {
        const rowRec = await this.store.read(id);
        if (!rowRec) return undefined;
        const row = rowRec.data as ChatStorageRow;

        return {
            id,
            messages: JSON.parse(row.messages),
            settings: {
                modelIndex: row.modelIndex ?? undefined,
                systemPrompt: row.systemPrompt,
                enableTools: (Array.isArray(row.enableTools) ? row.enableTools : []) as EnableToolItem[],
                temperature: row.temperature,
                enableWebSearch: row.enableWebSearch === 1,
                contextLength: row.contextLength,
                parallelToolCalls: row.parallelToolCalls === 1,
                enableXmlWrapper: row.enableXmlWrapper === 1
            },
            parallelMode: undefined,
            parallelChats: undefined,
            selectedModels: undefined
        };
    }

    async count(): Promise<number> {
        return this.store.count();
    }

    async findAll(page: number = 1, pageSize: number = 15) {
        const all = await this.store.readAll(10000);
        const offset = (page - 1) * pageSize;
        const rows = all.slice(offset, offset + pageSize);

        const data = rows.map((rowRec) => {
            const row = rowRec.data as ChatStorageRow;
            return {
                id: row.id,
                data: {
                    id: row.id,
                    messages: JSON.parse(row.messages),
                    settings: {
                        modelIndex: row.modelIndex ?? undefined,
                        systemPrompt: row.systemPrompt,
                        enableTools: (Array.isArray(row.enableTools) ? row.enableTools : []) as EnableToolItem[],
                        temperature: row.temperature,
                        enableWebSearch: row.enableWebSearch === 1,
                        contextLength: row.contextLength,
                        parallelToolCalls: row.parallelToolCalls === 1,
                        enableXmlWrapper: row.enableXmlWrapper === 1
                    },
                    parallelMode: undefined,
                    parallelChats: undefined,
                    selectedModels: undefined
                },
                timestamp: row.timestamp
            };
        });

        return { data, page, pageSize };
    }

    /** 获取第 N 条记录所在的文件信息（N 从 0 开始，按写入顺序） */
    getFileForRecordIndex(recordIndex: number) {
        return this.store.getFileForRecordIndex(recordIndex);
    }

    async delete(id: string): Promise<void> {
        // JsonArchiveStore 为追加型，不支持物理删除，可标记删除或忽略
        // 为保持 API 兼容，此处为 no-op，或可扩展支持 delete 标记
    }

    async findEnableToolsByHash(hash: string): Promise<any[] | undefined> {
        const all = await this.store.readAll(10000);
        for (const r of all) {
            const row = r.data as ChatStorageRow;
            const tools = Array.isArray(row.enableTools) ? row.enableTools : [];
            const h = crypto.createHash('md5').update(JSON.stringify(tools)).digest('hex');
            if (h === hash) return tools;
        }
        return undefined;
    }

    async findTraceByHash(hash: string): Promise<string | undefined> {
        const all = await this.store.readAll(10000);
        const row = all.find((r) => (r.data as ChatStorageRow).traceHash === hash);
        return row ? (row.data as ChatStorageRow).trace : undefined;
    }

    async update(id: string, record: Partial<ChatStorage>, trace: string, tokenConsumption: TokenConsumption): Promise<void> {
        const existing = await this.findById(id);
        if (!existing) throw new Error(`Record with id ${id} not found`);
        const merged: ChatStorage = {
            id,
            messages: record.messages || existing.messages,
            settings: { ...existing.settings, ...record.settings },
            parallelMode: record.parallelMode !== undefined ? record.parallelMode : existing.parallelMode,
            parallelChats: record.parallelChats || existing.parallelChats,
            selectedModels: record.selectedModels || existing.selectedModels
        };
        return this.insert(id, merged, trace, tokenConsumption);
    }

    async close(): Promise<void> {
        await this.store.close();
    }

    getDbPath(): string {
        return this.baseDir;
    }
}

export class RefluxDBManagement {
    private refluxDbs = new Map<string, RefluxDB>();

    public get(name: string): RefluxDB {
        if (!this.refluxDbs.has(name)) {
            this.refluxDbs.set(name, new RefluxDB(name));
        }
        return this.refluxDbs.get(name)!;
    }

    async close() {
        await Promise.all([...this.refluxDbs.values()].map((db) => db.close()));
        this.refluxDbs.clear();
    }
}

export const refluxDBManagement = new RefluxDBManagement();
