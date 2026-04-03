import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
    type LocalStorageScope,
    type LocalStorageScopeOptions,
    getConnectionsIndexPath,
    getLegacyConnectionConfigPath,
    resolveLocalStorageScope,
    ensureParentDir,
    normalizeStoragePath
} from './paths.js';

export interface LocalConnectionItem {
    connectionType?: string;
    type?: string;
    command?: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    url?: string;
    oauth?: unknown;
    clientName?: string;
    clientVersion?: string;
    serverInfo?: {
        name?: string;
        version?: string;
    };
    filePath?: string;
    name?: string;
    version?: string;
    rename?: boolean;
    enableDatasetReflux?: boolean;
    datasetName?: string;
    connectionId?: string;
    storageScope?: LocalStorageScope;
    workspacePath?: string;
    [key: string]: any;
}

export type LocalConnectionEntry = LocalConnectionItem | LocalConnectionItem[];

export interface LocalConnectionRecord {
    id: string;
    name: string;
    item: LocalConnectionEntry;
    createdAt: number;
    updatedAt: number;
}

interface LocalConnectionStore {
    version: 1;
    records: LocalConnectionRecord[];
}

const EMPTY_STORE: LocalConnectionStore = {
    version: 1,
    records: []
};

function cloneEntry<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeConnectionType(type?: string): string | undefined {
    if (!type) return undefined;
    const normalized = type.trim().toUpperCase().replace(/[-\s]/g, '_');
    if (normalized === 'STDIO') return 'STDIO';
    if (normalized === 'SSE') return 'SSE';
    if (normalized === 'STREAMABLE_HTTP' || normalized === 'STREAMABLEHTTP' || normalized === 'HTTP') {
        return 'STREAMABLE_HTTP';
    }
    return normalized;
}

function detachAsArray(entry: LocalConnectionEntry): LocalConnectionItem[] {
    return Array.isArray(entry) ? entry : [entry];
}

function detachAsItem(entry: LocalConnectionEntry): LocalConnectionItem {
    return Array.isArray(entry) ? entry[0] : entry;
}

function normalizeItemForStorage(item: LocalConnectionItem): LocalConnectionItem {
    const next = cloneEntry(item);
    const connectionType = normalizeConnectionType(String(next.connectionType || next.type || ''));
    if (connectionType) {
        next.connectionType = connectionType;
        next.type = undefined;
    }
    delete next.connectionId;
    delete next.storageScope;
    delete next.workspacePath;
    return next;
}

function toStoredEntry(entry: LocalConnectionEntry, options: LocalStorageScopeOptions): LocalConnectionEntry {
    const resolved = resolveLocalStorageScope(options);
    const workspacePath = resolved.workspacePath ? normalizeStoragePath(resolved.workspacePath) : undefined;
    const items = detachAsArray(cloneEntry(entry)).map((item) => {
        const next = normalizeItemForStorage(item);
        if (resolved.scope === 'workspace' && workspacePath) {
            if (next.filePath && normalizeStoragePath(next.filePath).startsWith(workspacePath)) {
                next.filePath = normalizeStoragePath(next.filePath).replace(workspacePath, '{workspace}');
            }
            if (next.connectionType === 'STDIO' && next.cwd && normalizeStoragePath(next.cwd).startsWith(workspacePath)) {
                next.cwd = normalizeStoragePath(next.cwd).replace(workspacePath, '{workspace}');
            }
        }
        return next;
    });
    return Array.isArray(entry) ? items : items[0];
}

function toPublicEntry(record: LocalConnectionRecord, options: LocalStorageScopeOptions): LocalConnectionEntry {
    const resolved = resolveLocalStorageScope(options);
    const workspacePath = resolved.workspacePath ? normalizeStoragePath(resolved.workspacePath) : undefined;
    const items = detachAsArray(cloneEntry(record.item)).map((item) => {
        const next = normalizeItemForStorage(item);
        if (resolved.scope === 'workspace' && workspacePath) {
            if (next.filePath && next.filePath.startsWith('{workspace}')) {
                next.filePath = normalizeStoragePath(next.filePath.replace('{workspace}', workspacePath));
            }
            if (next.connectionType === 'STDIO' && next.cwd && next.cwd.startsWith('{workspace}')) {
                next.cwd = normalizeStoragePath(next.cwd.replace('{workspace}', workspacePath));
            }
        }
        next.connectionId = record.id;
        next.storageScope = resolved.scope;
        if (workspacePath) {
            next.workspacePath = workspacePath;
        }
        return next;
    });
    return Array.isArray(record.item) ? items : items[0];
}

function resolveRecordName(entry: LocalConnectionEntry): string {
    const master = detachAsItem(entry);
    return (
        master.name?.trim() ||
        master.serverInfo?.name?.trim() ||
        master.command?.trim() ||
        master.url?.trim() ||
        'Unnamed Connection'
    );
}

function normaliseConnectionFilePath(entry: LocalConnectionEntry, options: LocalStorageScopeOptions): string | undefined {
    const master = detachAsItem(toPublicEntry({
        id: 'preview',
        name: 'preview',
        item: entry,
        createdAt: 0,
        updatedAt: 0
    }, options));
    if (!master.filePath) {
        return undefined;
    }
    return normalizeStoragePath(master.filePath);
}

function readJsonFile<T>(filePath: string): T | undefined {
    try {
        if (!fs.existsSync(filePath)) {
            return undefined;
        }
        return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
    } catch {
        return undefined;
    }
}

function writeStore(filePath: string, store: LocalConnectionStore): void {
    ensureParentDir(filePath);
    fs.writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf-8');
}

function migrateLegacyStore(options: LocalStorageScopeOptions): LocalConnectionStore | undefined {
    const legacyPath = getLegacyConnectionConfigPath(options);
    const legacy = readJsonFile<{ items?: unknown[] }>(legacyPath);
    if (!legacy || !Array.isArray(legacy.items)) {
        return undefined;
    }
    const records = legacy.items
        .filter((entry) => entry !== null && entry !== undefined)
        .map((entry) => cloneEntry(entry as LocalConnectionEntry))
        .filter((entry) => detachAsArray(entry).length > 0)
        .map((entry, index) => {
            const now = Date.now() + index;
            return {
                id: crypto.randomUUID(),
                name: resolveRecordName(entry),
                item: toStoredEntry(entry, options),
                createdAt: now,
                updatedAt: now
            } satisfies LocalConnectionRecord;
        });
    return {
        version: 1,
        records
    };
}

function loadStore(options: LocalStorageScopeOptions = {}): LocalConnectionStore {
    const storePath = getConnectionsIndexPath(options);
    const existing = readJsonFile<LocalConnectionStore>(storePath);
    if (existing && Array.isArray(existing.records)) {
        return {
            version: 1,
            records: existing.records.filter((record) => record && typeof record.id === 'string' && record.item)
        };
    }
    const migrated = migrateLegacyStore(options);
    if (migrated) {
        writeStore(storePath, migrated);
        return migrated;
    }
    return cloneEntry(EMPTY_STORE);
}

function saveStore(options: LocalStorageScopeOptions, store: LocalConnectionStore): void {
    writeStore(getConnectionsIndexPath(options), store);
}

export function listLocalConnectionRecords(options: LocalStorageScopeOptions = {}): LocalConnectionRecord[] {
    return loadStore(options).records.map((record) => ({
        ...record,
        item: toPublicEntry(record, options)
    }));
}

export function listLocalConnectionItems(options: LocalStorageScopeOptions = {}): LocalConnectionEntry[] {
    return listLocalConnectionRecords(options).map((record) => record.item);
}

export function getLocalConnectionRecordById(id: string, options: LocalStorageScopeOptions = {}): LocalConnectionRecord | undefined {
    const record = loadStore(options).records.find((item) => item.id === id);
    if (!record) return undefined;
    return {
        ...record,
        item: toPublicEntry(record, options)
    };
}

export function getLocalConnectionRecordByName(name: string, options: LocalStorageScopeOptions = {}): LocalConnectionRecord | undefined {
    const record = loadStore(options).records.find((item) => item.name === name);
    if (!record) return undefined;
    return {
        ...record,
        item: toPublicEntry(record, options)
    };
}

export function getLocalConnectionRecordByPath(absPath: string, options: LocalStorageScopeOptions = {}): LocalConnectionRecord | undefined {
    const normalizedPath = normalizeStoragePath(absPath);
    const record = loadStore(options).records.find((item) => {
        const filePath = normaliseConnectionFilePath(item.item, options);
        return filePath === normalizedPath;
    });
    if (!record) return undefined;
    return {
        ...record,
        item: toPublicEntry(record, options)
    };
}

export function replaceLocalConnectionItems(items: LocalConnectionEntry[], options: LocalStorageScopeOptions = {}): void {
    const existing = loadStore(options);
    const previousByName = new Map(existing.records.map((record) => [record.name, record]));
    const records = items
        .filter((entry) => entry !== null && entry !== undefined)
        .map((entry) => cloneEntry(entry))
        .filter((entry) => detachAsArray(entry).length > 0)
        .map((entry, index) => {
            const name = resolveRecordName(entry);
            const prev = previousByName.get(name);
            const now = Date.now() + index;
            return {
                id: prev?.id || crypto.randomUUID(),
                name,
                item: toStoredEntry(entry, options),
                createdAt: prev?.createdAt || now,
                updatedAt: now
            } satisfies LocalConnectionRecord;
        });
    saveStore(options, { version: 1, records });
}

export function upsertLocalConnectionRecord(
    entry: LocalConnectionEntry,
    options: LocalStorageScopeOptions & { id?: string; name?: string } = {}
): LocalConnectionRecord {
    const store = loadStore(options);
    const name = options.name?.trim() || resolveRecordName(entry);
    const recordId = options.id?.trim();
    const existingIndex = store.records.findIndex((record) => record.id === recordId || record.name === name);
    const prev = existingIndex >= 0 ? store.records[existingIndex] : undefined;
    const now = Date.now();
    const nextRecord: LocalConnectionRecord = {
        id: prev?.id || recordId || crypto.randomUUID(),
        name,
        item: toStoredEntry(entry, options),
        createdAt: prev?.createdAt || now,
        updatedAt: now
    };
    if (existingIndex >= 0) {
        store.records[existingIndex] = nextRecord;
    } else {
        store.records.unshift(nextRecord);
    }
    saveStore(options, store);
    return {
        ...nextRecord,
        item: toPublicEntry(nextRecord, options)
    };
}

export function deleteLocalConnectionRecord(id: string, options: LocalStorageScopeOptions = {}): boolean {
    const store = loadStore(options);
    const nextRecords = store.records.filter((record) => record.id !== id);
    if (nextRecords.length === store.records.length) {
        return false;
    }
    saveStore(options, {
        version: 1,
        records: nextRecords
    });
    return true;
}

export function getLocalConnectionsStoragePath(options: LocalStorageScopeOptions = {}): string {
    return getConnectionsIndexPath(options);
}
