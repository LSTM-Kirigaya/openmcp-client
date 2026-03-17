/**
 * 统一分块存储：chunk_{start_index}.om.jsonl
 * 每个文件首行写入起始索引元数据，支持快速定位第 N 条记录所在文件
 */
import * as path from 'path';
import * as fs from 'fs';

export interface ChunkFileMeta {
    start_index: number;
}

export interface ChunkFileIndex {
    filePath: string;
    startIndex: number;
    recordCount: number;
}

export interface UnifiedChunkRecord<T = unknown> {
    id: string;
    data: T;
    timestamp: number;
}

export interface UnifiedChunkOptions {
    /** 单个文件最大字节数，超过则轮转 */
    maxSize?: string | number;
    /** 最多保留的归档文件数 */
    maxFiles?: number;
}

const DEFAULT_MAX_SIZE = '5m';
const DEFAULT_MAX_FILES = 14;

/** 解析 size 字符串为字节数 */
function parseSizeToBytes(size: string | number): number {
    if (typeof size === 'number') return size;
    const match = size.match(/^(\d+)\s*([kKmMgG])?$/i);
    if (!match) return 5 * 1024 * 1024;
    const n = parseInt(match[1], 10);
    const u = (match[2] || '').toUpperCase();
    if (u === 'K') return n * 1024;
    if (u === 'M') return n * 1024 * 1024;
    if (u === 'G') return n * 1024 * 1024 * 1024;
    return n;
}

/** 加载目录下所有 chunk_*.om.jsonl 文件 */
function loadFromDir(dirPath: string): {
    cache: Map<string, { data: unknown; timestamp: number }>;
    fileIndex: ChunkFileIndex[];
} {
    const cache = new Map<string, { data: unknown; timestamp: number }>();
    const fileIndex: ChunkFileIndex[] = [];

    if (!fs.existsSync(dirPath)) return { cache, fileIndex };

    const files = fs.readdirSync(dirPath)
        .filter((f) => /^chunk_\d+\.om\.jsonl$/.test(f))
        .map((f) => ({ name: f, path: path.join(dirPath, f) }))
        .sort((a, b) => {
            const aIdx = parseInt(a.name.replace(/^chunk_(\d+)\.om\.jsonl$/, '$1'), 10);
            const bIdx = parseInt(b.name.replace(/^chunk_(\d+)\.om\.jsonl$/, '$1'), 10);
            return aIdx - bIdx;
        });

    for (const { name, path: fp } of files) {
        try {
            const raw = fs.readFileSync(fp, 'utf-8');
            const lines = raw.split('\n').filter((s) => s.trim());
            if (lines.length === 0) continue;

            const match = name.match(/^chunk_(\d+)\.om\.jsonl$/);
            let startIndex = match ? parseInt(match[1], 10) : 0;
            let dataLineCount = 0;
            let lineOffset = 0;

            const firstLine = lines[0];
            try {
                const first = JSON.parse(firstLine) as { _meta?: ChunkFileMeta };
                if (first._meta?.start_index !== undefined) {
                    startIndex = first._meta.start_index;
                    lineOffset = 1;
                }
            } catch {
                // first line is data, not meta
            }

            dataLineCount = lines.length - lineOffset;
            for (let i = lineOffset; i < lines.length; i++) {
                try {
                    const obj = JSON.parse(lines[i]) as { id: string; data: unknown; timestamp: number };
                    if (obj.id != null && !obj.id.startsWith('_')) {
                        const existing = cache.get(obj.id);
                        if (!existing || obj.timestamp >= existing.timestamp) {
                            cache.set(obj.id, { data: obj.data, timestamp: obj.timestamp });
                        }
                    }
                } catch {
                    // skip
                }
            }

            fileIndex.push({ filePath: fp, startIndex, recordCount: dataLineCount });
        } catch {
            // skip file
        }
    }

    return { cache, fileIndex };
}

export class UnifiedChunkStore {
    private dirPath: string;
    private cache = new Map<string, { data: unknown; timestamp: number }>();
    private fileIndex: ChunkFileIndex[] = [];
    private maxSizeBytes: number;
    private maxFiles: number;
    private currentStream: fs.WriteStream | null = null;
    private currentFilePath: string | null = null;
    private currentFileStartIndex = 0;
    private currentFileSize = 0;
    private totalRecordsWritten = 0;
    private wroteMetaThisFile = false;

    constructor(dirPath: string, options: UnifiedChunkOptions = {}) {
        this.dirPath = path.resolve(dirPath);
        this.maxSizeBytes = parseSizeToBytes(options.maxSize ?? DEFAULT_MAX_SIZE);
        this.maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;

        if (!fs.existsSync(this.dirPath)) {
            fs.mkdirSync(this.dirPath, { recursive: true });
        }

        const loaded = loadFromDir(this.dirPath);
        this.cache = loaded.cache;
        this.fileIndex = loaded.fileIndex;
        this.totalRecordsWritten = this.computeTotalRecords();
        this.ensureStream();
    }

    private computeTotalRecords(): number {
        if (this.fileIndex.length === 0) return 0;
        const last = this.fileIndex[this.fileIndex.length - 1];
        return last.startIndex + last.recordCount;
    }

    private getChunkFilePath(startIndex: number): string {
        return path.join(this.dirPath, `chunk_${startIndex}.om.jsonl`);
    }

    private ensureStream(): void {
        if (this.currentStream) return;

        this.currentFileStartIndex = this.totalRecordsWritten;
        this.currentFilePath = this.getChunkFilePath(this.currentFileStartIndex);
        this.currentFileSize = 0;
        this.wroteMetaThisFile = false;

        this.currentStream = fs.createWriteStream(this.currentFilePath, { flags: 'a' });
    }

    private async rotateIfNeeded(): Promise<void> {
        if (this.currentFileSize < this.maxSizeBytes) return;

        await this.closeCurrentStream();

        this.pruneOldFiles();
        this.totalRecordsWritten = this.computeTotalRecords();
        this.ensureStream();
    }

    private pruneOldFiles(): void {
        if (this.fileIndex.length <= this.maxFiles) return;
        const toRemove = this.fileIndex.length - this.maxFiles;
        const sorted = [...this.fileIndex].sort((a, b) => a.startIndex - b.startIndex);
        for (let i = 0; i < toRemove && i < sorted.length; i++) {
            const chunk = sorted[i];
            try {
                const raw = fs.readFileSync(chunk.filePath, 'utf-8');
                const lines = raw.split('\n').filter((s) => s.trim());
                let offset = 0;
                if (lines.length > 0) {
                    try {
                        offset = (JSON.parse(lines[0]) as { _meta?: unknown })?._meta ? 1 : 0;
                    } catch {
                        offset = 0;
                    }
                }
                for (let j = offset; j < lines.length; j++) {
                    try {
                        const obj = JSON.parse(lines[j]) as { id?: string };
                        if (obj.id) this.cache.delete(obj.id);
                    } catch {
                        // skip
                    }
                }
                fs.unlinkSync(chunk.filePath);
                this.fileIndex = this.fileIndex.filter((f) => f.filePath !== chunk.filePath);
            } catch {
                // ignore
            }
        }
    }

    private closeCurrentStream(): Promise<void> {
        return new Promise((resolve) => {
            if (!this.currentStream) {
                resolve();
                return;
            }
            this.currentStream.end(() => {
                this.currentStream = null;
                this.currentFilePath = null;
                resolve();
            });
        });
    }

    private writeLine(line: string): void {
        if (!this.currentStream) return;
        const buf = Buffer.from(line + '\n', 'utf-8');
        this.currentStream.write(buf);
        this.currentFileSize += buf.length;
    }

    private writeMetaIfNeeded(): void {
        if (this.wroteMetaThisFile) return;
        const meta = JSON.stringify({ _meta: { start_index: this.currentFileStartIndex } });
        this.writeLine(meta);
        this.wroteMetaThisFile = true;
    }

    async write(id: string, data: unknown): Promise<void> {
        const timestamp = Date.now();
        let dataObj: unknown;
        if (typeof data === 'string') {
            try {
                dataObj = JSON.parse(data) as unknown;
            } catch {
                dataObj = { _raw: data };
            }
        } else {
            dataObj = data;
        }

        this.writeMetaIfNeeded();
        const line = JSON.stringify({ id, data: dataObj, timestamp });
        this.writeLine(line);
        this.totalRecordsWritten++;
        this.cache.set(id, { data: dataObj, timestamp });

        const lastIdx = this.fileIndex.length - 1;
        if (lastIdx >= 0 && this.fileIndex[lastIdx].filePath === this.currentFilePath) {
            this.fileIndex[lastIdx].recordCount++;
        } else {
            this.fileIndex.push({
                filePath: this.currentFilePath!,
                startIndex: this.currentFileStartIndex,
                recordCount: 1
            });
        }

        await this.rotateIfNeeded();
    }

    async read(id: string): Promise<UnifiedChunkRecord | undefined> {
        const entry = this.cache.get(id);
        if (!entry) return undefined;
        let data = entry.data;
        if (typeof data === 'string' && (data.startsWith('{') || data.startsWith('['))) {
            try {
                data = JSON.parse(data);
            } catch {
                // keep string
            }
        }
        return { id, data, timestamp: entry.timestamp };
    }

    async readAll(limit: number = 100): Promise<UnifiedChunkRecord[]> {
        const entries = Array.from(this.cache.entries())
            .map(([id, e]) => {
                let data = e.data;
                if (typeof data === 'string' && (data.startsWith('{') || data.startsWith('['))) {
                    try {
                        data = JSON.parse(data);
                    } catch {
                        // keep string
                    }
                }
                return { id, data, timestamp: e.timestamp };
            })
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
        return entries;
    }

    /**
     * 获取第 N 条记录所在的文件信息（N 从 0 开始，按写入顺序）
     * 用于快速定位：第 N 条记录在哪个 chunk 文件中
     */
    getFileForRecordIndex(recordIndex: number): ChunkFileIndex | undefined {
        const sorted = [...this.fileIndex].sort((a, b) => a.startIndex - b.startIndex);
        for (const chunk of sorted) {
            if (recordIndex >= chunk.startIndex && recordIndex < chunk.startIndex + chunk.recordCount) {
                return chunk;
            }
        }
        return undefined;
    }

    /**
     * 获取文件索引，用于快速定位
     */
    getFileIndex(): ChunkFileIndex[] {
        return [...this.fileIndex].sort((a, b) => a.startIndex - b.startIndex);
    }

    async count(): Promise<number> {
        return this.cache.size;
    }

    getDirPath(): string {
        return this.dirPath;
    }

    async close(): Promise<void> {
        await this.closeCurrentStream();
        this.cache.clear();
        this.fileIndex = [];
    }
}
