import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
    getServersIndexPath,
    getConnectionsIndexPath,
    ensureParentDir
} from './paths.js';
import { RUNNING_CWD } from '../hook/setting.js';

export interface McpServerRecord {
    id: string;
    name: string;
    connectionType?: string;
    command?: string;
    args?: string[];
    url?: string;
    cwd?: string;
    env?: Record<string, string>;
    oauth?: unknown;
    clientName?: string;
    clientVersion?: string;
    serverInfo?: { name?: string; version?: string };
    enableDatasetReflux?: boolean;
    datasetName?: string;
    createdAt: number;
    updatedAt: number;
    [key: string]: unknown;
}

interface ServerStore {
    version: 1;
    records: McpServerRecord[];
}

const EMPTY_STORE: ServerStore = { version: 1, records: [] };

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function readJson<T>(filePath: string): T | undefined {
    try {
        if (!fs.existsSync(filePath)) return undefined;
        return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
    } catch {
        return undefined;
    }
}

function writeStore(filePath: string, store: ServerStore): void {
    ensureParentDir(filePath);
    fs.writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf-8');
}

function resolveRecordName(item: Record<string, any>): string {
    return (
        item.name?.trim?.() ||
        item.serverInfo?.name?.trim?.() ||
        item.command?.trim?.() ||
        item.url?.trim?.() ||
        'Unnamed Server'
    );
}

function resolveGatewayEnvPath(): string | undefined {
    if (!RUNNING_CWD) return undefined;
    const candidate = path.join(RUNNING_CWD, 'gateway', '.env');
    if (fs.existsSync(candidate)) return candidate;
    return undefined;
}

function migrateFromGatewayEnv(): McpServerRecord[] {
    const envPath = resolveGatewayEnvPath();
    if (!envPath) return [];
    try {
        const raw = readJson<{ items?: any[] }>(envPath);
        if (!raw || !Array.isArray(raw.items) || raw.items.length === 0) return [];
        return raw.items
            .filter((item: any) => item && typeof item === 'object')
            .map((item: any, idx: number) => {
                const now = Date.now() + idx;
                const { _id, commandString, ...rest } = item;
                return {
                    id: crypto.randomUUID(),
                    name: resolveRecordName(item),
                    ...rest,
                    createdAt: now,
                    updatedAt: now
                } as McpServerRecord;
            });
    } catch {
        return [];
    }
}

function migrateFromConnectionsIndex(): McpServerRecord[] {
    try {
        const connPath = getConnectionsIndexPath({ scope: 'user' });
        const raw = readJson<{ records?: any[] }>(connPath);
        if (!raw || !Array.isArray(raw.records) || raw.records.length === 0) return [];
        return raw.records
            .filter((r: any) => r && r.item)
            .map((r: any) => {
                const item = Array.isArray(r.item) ? r.item[0] : r.item;
                if (!item) return null;
                const { _id, connectionId, storageScope, workspacePath, ...rest } = item;
                return {
                    id: r.id || crypto.randomUUID(),
                    name: r.name || resolveRecordName(item),
                    ...rest,
                    createdAt: r.createdAt || Date.now(),
                    updatedAt: r.updatedAt || Date.now()
                } as McpServerRecord;
            })
            .filter(Boolean) as McpServerRecord[];
    } catch {
        return [];
    }
}

function deduplicateById(records: McpServerRecord[]): McpServerRecord[] {
    const seen = new Set<string>();
    return records.filter(r => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
    });
}

function loadStore(): ServerStore {
    const storePath = getServersIndexPath();
    const existing = readJson<ServerStore>(storePath);
    if (existing && Array.isArray(existing.records)) {
        return {
            version: 1,
            records: existing.records.filter(r => r && typeof r.id === 'string')
        };
    }

    const migrated: McpServerRecord[] = [];
    migrated.push(...migrateFromGatewayEnv());
    migrated.push(...migrateFromConnectionsIndex());

    const store: ServerStore = {
        version: 1,
        records: deduplicateById(migrated)
    };
    if (store.records.length > 0) {
        writeStore(storePath, store);
        console.log(`[servers] Migrated ${store.records.length} server(s) to ${storePath}`);
    }
    return store;
}

function saveStore(store: ServerStore): void {
    writeStore(getServersIndexPath(), store);
}

export function listServers(): McpServerRecord[] {
    return clone(loadStore().records);
}

export function getServerById(id: string): McpServerRecord | undefined {
    const record = loadStore().records.find(r => r.id === id);
    return record ? clone(record) : undefined;
}

export function upsertServer(input: Partial<McpServerRecord> & { id?: string }): McpServerRecord {
    const store = loadStore();
    const now = Date.now();
    const recordId = input.id?.trim();
    const existingIndex = recordId
        ? store.records.findIndex(r => r.id === recordId)
        : -1;
    const prev = existingIndex >= 0 ? store.records[existingIndex] : undefined;

    const record: McpServerRecord = {
        ...prev,
        ...input,
        id: prev?.id || recordId || crypto.randomUUID(),
        name: input.name?.trim() || prev?.name || resolveRecordName(input as any),
        createdAt: prev?.createdAt || now,
        updatedAt: now
    };

    if (existingIndex >= 0) {
        store.records[existingIndex] = record;
    } else {
        store.records.push(record);
    }
    saveStore(store);
    return clone(record);
}

export function deleteServer(id: string): boolean {
    const store = loadStore();
    const next = store.records.filter(r => r.id !== id);
    if (next.length === store.records.length) return false;
    saveStore({ version: 1, records: next });
    return true;
}

export function replaceAllServers(items: Record<string, any>[]): McpServerRecord[] {
    const store = loadStore();
    const prevById = new Map(store.records.map(r => [r.id, r]));
    const prevByName = new Map(store.records.map(r => [r.name, r]));

    const records = items
        .filter(item => item && typeof item === 'object')
        .map((item, idx) => {
            const name = resolveRecordName(item);
            const prev = prevByName.get(name);
            const now = Date.now() + idx;
            const { _id, commandString, connectionId, storageScope, workspacePath: _wp, ...rest } = item;
            return {
                ...rest,
                id: prev?.id || crypto.randomUUID(),
                name,
                createdAt: prev?.createdAt || now,
                updatedAt: now
            } as McpServerRecord;
        });

    saveStore({ version: 1, records });
    return clone(records);
}

export function getServersStoragePath(): string {
    return getServersIndexPath();
}
