import * as fs from 'fs';
import * as path from 'path';
import { getConfigDir, ensureParentDir } from './paths.js';

const CURRENT_WORKSPACE_FILE = 'current-workspace.json';

interface CurrentWorkspaceStore {
    version: 1;
    workspaceId: string | null;
    lastOpenedAt: number;
}

const EMPTY_STORE: CurrentWorkspaceStore = { version: 1, workspaceId: null, lastOpenedAt: 0 };

function getCurrentWorkspacePath(): string {
    return path.join(getConfigDir(), CURRENT_WORKSPACE_FILE);
}

function readJson<T>(filePath: string): T | undefined {
    try {
        if (!fs.existsSync(filePath)) return undefined;
        return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
    } catch {
        return undefined;
    }
}

function writeJson<T>(filePath: string, value: T): void {
    ensureParentDir(filePath);
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8');
}

export function loadCurrentWorkspaceId(): string | undefined {
    const store = readJson<CurrentWorkspaceStore>(getCurrentWorkspacePath());
    if (store && typeof store.workspaceId === 'string' && store.workspaceId.trim()) {
        return store.workspaceId;
    }
    return undefined;
}

export function saveCurrentWorkspaceId(id: string | null): void {
    const store: CurrentWorkspaceStore = {
        version: 1,
        workspaceId: id,
        lastOpenedAt: Date.now()
    };
    writeJson(getCurrentWorkspacePath(), store);
}
