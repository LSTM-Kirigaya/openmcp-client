import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { RUNNING_CWD, VSCODE_WORKSPACE } from '../hook/setting.js';

export type LocalStorageScope = 'user' | 'workspace';

export interface LocalStorageScopeOptions {
    scope?: LocalStorageScope;
    workspacePath?: string;
    ensure?: boolean;
}

export interface ResolvedLocalStorageScope {
    scope: LocalStorageScope;
    rootDir: string;
    workspacePath?: string;
}

const ROOT_DIR_NAME = '.openmcp';

function uniquePaths(items: Array<string | undefined>): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of items) {
        if (!item) continue;
        const normalized = normalizeStoragePath(item);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        out.push(normalized);
    }
    return out;
}

export function normalizeStoragePath(input: string): string {
    return input.replace(/\\/g, '/');
}

export function ensureStorageDir(dirPath: string): string {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
    return dirPath;
}

export function ensureParentDir(filePath: string): string {
    const dir = path.dirname(filePath);
    ensureStorageDir(dir);
    return dir;
}

export function resolveWorkspacePath(explicitPath?: string): string | undefined {
    const picked = explicitPath || VSCODE_WORKSPACE;
    if (!picked || !picked.trim()) {
        return undefined;
    }
    return normalizeStoragePath(picked.trim());
}

export function resolveLocalStorageScope(options: LocalStorageScopeOptions = {}): ResolvedLocalStorageScope {
    const scope = options.scope ?? (resolveWorkspacePath(options.workspacePath) ? 'workspace' : 'user');
    if (scope === 'workspace') {
        const workspacePath = resolveWorkspacePath(options.workspacePath);
        if (!workspacePath) {
            throw new Error('workspace scope 需要 workspacePath，或当前运行环境已设置 VSCODE_WORKSPACE');
        }
        const rootDir = path.join(workspacePath, ROOT_DIR_NAME);
        if (options.ensure) {
            ensureStorageDir(rootDir);
        }
        return {
            scope,
            rootDir,
            workspacePath
        };
    }
    const rootDir = path.join(os.homedir(), ROOT_DIR_NAME);
    if (options.ensure) {
        ensureStorageDir(rootDir);
    }
    return {
        scope,
        rootDir
    };
}

export function getLocalStorageRoot(options: LocalStorageScopeOptions = {}): string {
    return resolveLocalStorageScope(options).rootDir;
}

export function sanitizeStorageKey(value: string): string {
    const trimmed = (value || 'default').trim();
    return trimmed.replace(/[\\/:*?"<>|]/g, '_') || 'default';
}

export function getConnectionsDir(options: LocalStorageScopeOptions = {}): string {
    return path.join(getLocalStorageRoot({ ...options, ensure: true }), 'connections');
}

export function getConnectionsIndexPath(options: LocalStorageScopeOptions = {}): string {
    return path.join(getConnectionsDir(options), 'index.json');
}

export function getServersDir(): string {
    return path.join(getLocalStorageRoot({ scope: 'user', ensure: true }), 'servers');
}

export function getServersIndexPath(): string {
    return path.join(getServersDir(), 'index.json');
}

export function getPanelStateDir(options: LocalStorageScopeOptions = {}): string {
    return path.join(getLocalStorageRoot({ ...options, ensure: true }), 'panel-state');
}

export function getPanelStatePath(connectionKey: string, options: LocalStorageScopeOptions = {}): string {
    return path.join(getPanelStateDir(options), `${sanitizeStorageKey(connectionKey)}.json`);
}

export function getToolCasesDir(options: LocalStorageScopeOptions = {}): string {
    return path.join(getLocalStorageRoot({ ...options, ensure: true }), 'tool-cases');
}

export function getToolCasesPath(connectionKey: string, options: LocalStorageScopeOptions = {}): string {
    return path.join(getToolCasesDir(options), `${sanitizeStorageKey(connectionKey)}.json`);
}

export function getValidationSuitesDir(connectionKey: string, options: LocalStorageScopeOptions = {}): string {
    return path.join(getLocalStorageRoot({ ...options, ensure: true }), 'validation-suites', sanitizeStorageKey(connectionKey));
}

export function getValidationSuitesIndexPath(connectionKey: string, options: LocalStorageScopeOptions = {}): string {
    return path.join(getValidationSuitesDir(connectionKey, options), 'index.json');
}

export function getValidationSuiteFilePath(
    connectionKey: string,
    suiteId: string,
    options: LocalStorageScopeOptions = {}
): string {
    return path.join(getValidationSuitesDir(connectionKey, options), `${sanitizeStorageKey(suiteId)}.json`);
}

export function getConfigDir(): string {
    return path.join(getLocalStorageRoot({ scope: 'user', ensure: true }), 'config');
}

export function getLegacyUserStorageRoot(): string {
    return path.join(os.homedir(), ROOT_DIR_NAME);
}

export function getSettingsFilePath(): string {
    return path.join(getConfigDir(), 'settings.json');
}

export function getLegacySettingsFilePath(): string {
    return path.join(getLegacyUserStorageRoot(), 'setting.json');
}

export function getTourKeyPath(): string {
    return path.join(getConfigDir(), 'KEY');
}

export function getLegacyTourKeyPath(): string {
    return path.join(getLegacyUserStorageRoot(), 'KEY');
}

export function getTokenFilePath(): string {
    const fromEnv = process.env.OPENMCP_TOKEN_PATH;
    if (fromEnv && fromEnv.trim()) {
        return fromEnv.trim();
    }
    return path.join(getConfigDir(), 'token.json');
}

export function getLegacyTokenFilePath(): string {
    return path.join(getLegacyUserStorageRoot(), 'token.json');
}

export function getDebuggerMcpConfigPath(): string {
    return path.join(getConfigDir(), 'debugger-mcp.json');
}

export function getLegacyDebuggerMcpConfigPath(): string {
    return path.join(getLegacyUserStorageRoot(), 'debugger-mcp.json');
}

export function getGatewayEnvPath(): string {
    return path.join(getConfigDir(), 'gateway.env');
}

export function getLegacyGatewayEnvPath(): string {
    return path.join(getLegacyUserStorageRoot(), 'gateway.env');
}

export function getDataDir(): string {
    return path.join(getLocalStorageRoot({ scope: 'user', ensure: true }), 'data');
}

export function getNedbDir(): string {
    return path.join(getDataDir(), 'nedb');
}

export function getBinaryStorageDir(): string {
    return path.join(getDataDir(), 'storage');
}

export function getRuntimeDir(): string {
    return path.join(getLocalStorageRoot({ scope: 'user', ensure: true }), 'runtime');
}

export function getGatewayLogDir(): string {
    return path.join(getLocalStorageRoot({ scope: 'user', ensure: true }), 'logs', 'gateway');
}

export function getLegacyConnectionConfigPath(options: LocalStorageScopeOptions = {}): string {
    const resolved = resolveLocalStorageScope(options);
    return path.join(resolved.rootDir, 'connection.json');
}

export function getLegacyServerDataCandidates(connectionKey: string, options: LocalStorageScopeOptions = {}): string[] {
    const fileName = `openmcp.${sanitizeStorageKey(connectionKey)}.json`;
    const resolved = resolveLocalStorageScope(options);
    if (resolved.scope === 'workspace' && resolved.workspacePath) {
        return [path.join(resolved.workspacePath, ROOT_DIR_NAME, fileName)];
    }
    return uniquePaths([
        path.join(process.cwd(), fileName),
        RUNNING_CWD ? path.join(RUNNING_CWD, fileName) : undefined
    ]);
}

export function getLegacyBatchValidationDirCandidates(
    connectionKey: string,
    options: LocalStorageScopeOptions = {}
): string[] {
    const dirName = `batch-validation-${sanitizeStorageKey(connectionKey)}`;
    const resolved = resolveLocalStorageScope(options);
    if (resolved.scope === 'workspace' && resolved.workspacePath) {
        return [path.join(resolved.workspacePath, ROOT_DIR_NAME, 'data', dirName)];
    }
    return uniquePaths([
        path.join(process.cwd(), ROOT_DIR_NAME, 'data', dirName),
        RUNNING_CWD ? path.join(RUNNING_CWD, ROOT_DIR_NAME, 'data', dirName) : undefined
    ]);
}
