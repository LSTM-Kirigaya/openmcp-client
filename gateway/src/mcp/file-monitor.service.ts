import * as fs from 'fs';
import * as path from 'path';

/**
 * 文件监控配置接口
 */
interface FileMonitorConfig {
    filePath: string;
    onChange?: (curr: fs.Stats, prev: fs.Stats) => void;
    onDelete?: () => void;
    onStart?: () => void;
    onError?: (error: Error) => void;
    debounceTime?: number;         // 防抖时间（毫秒）
    duplicateCheckTime?: number;  // 去重检查时间阈值（毫秒）
}

/**
 * 单文件监控类（去重阈值可配置）
 */
class SingleFileMonitor {
    private filePath: string;
    private onChange: (curr: fs.Stats, prev: fs.Stats) => void;
    private onDelete: () => void;
    private onError: (error: Error) => void;
    private watcher: fs.FSWatcher | null = null;
    private exists: boolean = false;
    private lastModified: number = 0;
    private lastSize: number = 0;
    private debounceTimer: NodeJS.Timeout | null = null;
    private debounceTime: number;
    private duplicateCheckTime: number; // 去重检查时间阈值
    private lastChangeTime: number = 0;
    private lastChangeSize: number = 0;
    private isProcessingChange = false;
    private config: FileMonitorConfig; // 添加config属性

    constructor(config: FileMonitorConfig) {
        this.config = config; // 保存配置
        this.filePath = config.filePath;
        this.onChange = config.onChange || (() => {});
        this.onDelete = config.onDelete || (() => {});
        this.onError = config.onError || ((error) => console.error('文件监控错误:', error));
        this.debounceTime = config.debounceTime || 1000;
        // 使用配置中的去重时间，默认800ms
        this.duplicateCheckTime = config.duplicateCheckTime !== undefined
            ? config.duplicateCheckTime
            : 800;
        this.init();
    }

    private init() {
        // 检查文件是否存在
        this.checkFileExists()
            .then(exists => {
                this.exists = exists;
                if (exists) {
                    const stats = fs.statSync(this.filePath);
                    this.lastModified = stats.mtimeMs;
                    this.lastSize = stats.size;
                }
                this.config.onStart?.(); // 使用保存的config属性
                this.startWatching();
            })
            .catch(this.onError);
    }

    private startWatching() {
        try {
            this.watcher = fs.watch(this.filePath, (eventType) => {
                if (eventType === 'change') {
                    this.handleFileChange(true);
                }
            });
            // console.log(`正在监控文件: ${this.filePath}`);
        } catch (error) {
            this.onError(error as Error);
        }
    }

    private checkFileExists(): Promise<boolean> {
        return new Promise(resolve => {
            fs.access(this.filePath, fs.constants.F_OK, (err) => {
                resolve(!err);
            });
        });
    }

    private handleFileChange(isFromWatch: boolean = false) {
        if (this.isProcessingChange) return;

        if (!this.exists) {
            this.checkFileExists()
                .then(exists => {
                    if (exists) {
                        this.exists = true;
                        const stats = fs.statSync(this.filePath);
                        this.lastModified = stats.mtimeMs;
                        this.lastSize = stats.size;
                    }
                });
            return;
        }

        let currentStats: fs.Stats;
        try {
            currentStats = fs.statSync(this.filePath);
        } catch (error) {
            this.exists = false;
            this.onDelete();
            return;
        }

        const currentMtime = currentStats.mtimeMs;
        const currentSize = currentStats.size;

        if (currentSize === this.lastSize && currentMtime - this.lastModified < 800) {
            return;
        }

        const now = Date.now();
        // 使用可配置的去重时间阈值
        if (now - this.lastChangeTime < this.duplicateCheckTime && currentSize === this.lastChangeSize) {
            return;
        }

        this.lastChangeTime = now;
        this.lastChangeSize = currentSize;
        const prevStats = fs.statSync(this.filePath);
        this.lastModified = currentMtime;
        this.lastSize = currentSize;

        this.isProcessingChange = true;

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            this.checkFileExists()
                .then(exists => {
                    if (exists) {
                        const currStats = fs.statSync(this.filePath);
                        this.onChange(currStats, prevStats);
                    }
                })
                .catch(this.onError)
                .finally(() => {
                    this.isProcessingChange = false;
                    this.debounceTimer = null;
                });
        }, this.debounceTime);
    }

    private checkFileStatus() {
        this.checkFileExists()
            .then(exists => {
                if (this.exists && !exists) {
                    this.exists = false;
                    this.onDelete();
                } else if (!this.exists && exists) {
                    this.exists = true;
                    const stats = fs.statSync(this.filePath);
                    this.lastModified = stats.mtimeMs;
                    this.lastSize = stats.size;
                }
            })
            .catch(this.onError);
    }

    public close() {
        if (this.watcher) {
            // 明确指定close方法的类型，解决TS2554错误
            (this.watcher.close as (callback?: () => void) => void)(() => {
                // console.log(`已停止监控文件: ${this.filePath}`);
            });
            this.watcher = null;
        }

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
    }
}

export { SingleFileMonitor, FileMonitorConfig };