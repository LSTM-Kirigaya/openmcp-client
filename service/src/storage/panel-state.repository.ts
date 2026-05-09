import * as fs from 'fs';
import type { SaveTab } from '../panel/panel.dto.js';
import type { LocalStorageScopeOptions } from './paths.js';
import { ensureParentDir, getLegacyServerDataCandidates, getPanelStatePath } from './paths.js';

interface PanelStateFile {
    version: 1;
    tabs: SaveTab;
    variables: any[];
    extractionRules: Record<string, Array<{ path: string; name: string }>>;
}

const EMPTY_PANEL_STATE: PanelStateFile = {
    version: 1,
    tabs: {
        tabs: [],
        currentIndex: -1
    },
    variables: [],
    extractionRules: {}
};

function cloneValue<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
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

function normalizeState(value: Partial<PanelStateFile> | undefined): PanelStateFile {
    return {
        version: 1,
        tabs: value?.tabs || EMPTY_PANEL_STATE.tabs,
        variables: Array.isArray(value?.variables) ? value!.variables : [],
        extractionRules:
            value?.extractionRules && typeof value.extractionRules === 'object'
                ? value.extractionRules
                : {}
    };
}

function writeState(filePath: string, state: PanelStateFile): void {
    ensureParentDir(filePath);
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');
}

function migrateLegacyState(connectionKey: string, options: LocalStorageScopeOptions): PanelStateFile | undefined {
    for (const candidate of getLegacyServerDataCandidates(connectionKey, options)) {
        const legacy = readJsonFile<{
            tabs?: SaveTab;
            variables?: any[];
            extractionRules?: Record<string, Array<{ path: string; name: string }>>;
        }>(candidate);
        if (!legacy) {
            continue;
        }
        return normalizeState({
            tabs: legacy.tabs,
            variables: legacy.variables,
            extractionRules: legacy.extractionRules
        });
    }
    return undefined;
}

function loadState(connectionKey: string, options: LocalStorageScopeOptions = {}): PanelStateFile {
    const filePath = getPanelStatePath(connectionKey, options);
    const existing = readJsonFile<PanelStateFile>(filePath);
    if (existing) {
        return normalizeState(existing);
    }
    const migrated = migrateLegacyState(connectionKey, options);
    if (migrated) {
        writeState(filePath, migrated);
        return migrated;
    }
    return cloneValue(EMPTY_PANEL_STATE);
}

function saveState(connectionKey: string, state: PanelStateFile, options: LocalStorageScopeOptions = {}): void {
    writeState(getPanelStatePath(connectionKey, options), normalizeState(state));
}

export function loadStoredPanelTabs(connectionKey: string, options: LocalStorageScopeOptions = {}): SaveTab {
    return loadState(connectionKey, options).tabs;
}

export function saveStoredPanelTabs(connectionKey: string, tabs: SaveTab, options: LocalStorageScopeOptions = {}): void {
    const state = loadState(connectionKey, options);
    saveState(connectionKey, { ...state, tabs }, options);
}

export function loadStoredVariables(connectionKey: string, options: LocalStorageScopeOptions = {}): { variables: any[] } {
    return {
        variables: loadState(connectionKey, options).variables
    };
}

export function saveStoredVariables(connectionKey: string, variables: any[], options: LocalStorageScopeOptions = {}): void {
    const state = loadState(connectionKey, options);
    saveState(connectionKey, { ...state, variables }, options);
}

export function loadStoredExtractionRules(
    connectionKey: string,
    options: LocalStorageScopeOptions = {}
): { extractionRules: Record<string, Array<{ path: string; name: string }>> } {
    return {
        extractionRules: loadState(connectionKey, options).extractionRules
    };
}

export function saveStoredExtractionRules(
    connectionKey: string,
    extractionRules: Record<string, Array<{ path: string; name: string }>>,
    options: LocalStorageScopeOptions = {}
): void {
    const state = loadState(connectionKey, options);
    saveState(connectionKey, { ...state, extractionRules }, options);
}
