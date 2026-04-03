import {
    type BatchValidationStorageRow,
    loadDefaultValidationSuiteStorage,
    saveDefaultValidationSuiteStorage
} from '../storage/validation-suites.repository.js';

export type { BatchValidationStorageRow } from '../storage/validation-suites.repository.js';

export class BatchValidationRepository {
    constructor(private connectionKey: string, private options: { scope?: 'user' | 'workspace'; workspacePath?: string } = {}) {}

    async load(): Promise<BatchValidationStorageRow> {
        return loadDefaultValidationSuiteStorage(this.connectionKey, this.options);
    }

    async save(storage: BatchValidationStorageRow): Promise<void> {
        saveDefaultValidationSuiteStorage(this.connectionKey, storage, this.options);
    }

    async close(): Promise<void> {
        // no-op
    }
}

const repoMap = new Map<string, BatchValidationRepository>();

function repoCacheKey(connectionKey: string, options?: { scope?: 'user' | 'workspace'; workspacePath?: string }): string {
    return `${options?.scope || 'auto'}::${options?.workspacePath || ''}::${connectionKey}`;
}

export function getBatchValidationRepository(
    connectionKey: string,
    options: { scope?: 'user' | 'workspace'; workspacePath?: string } = {}
): BatchValidationRepository {
    const key = repoCacheKey(connectionKey || 'default', options);
    if (!repoMap.has(key)) {
        repoMap.set(key, new BatchValidationRepository(connectionKey || 'default', options));
    }
    return repoMap.get(key)!;
}
