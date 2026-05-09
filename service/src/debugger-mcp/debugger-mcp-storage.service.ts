import * as fs from 'fs';
import type { DebuggerMcpConfig } from './debugger-mcp.dto.js';
import {
    ensureParentDir,
    getDebuggerMcpConfigPath,
    getLegacyDebuggerMcpConfigPath
} from '../storage/paths.js';

const DEFAULT_CONFIG: DebuggerMcpConfig = {
    enabled: false,
    port: 1145,
    enabledTools: {}
};

function getConfigPath() {
    const configPath = getDebuggerMcpConfigPath();
    ensureParentDir(configPath);
    if (!fs.existsSync(configPath)) {
        const legacyPath = getLegacyDebuggerMcpConfigPath();
        if (legacyPath !== configPath && fs.existsSync(legacyPath)) {
            fs.copyFileSync(legacyPath, configPath);
        }
    }
    return configPath;
}

export function loadDebuggerMcpConfig(): DebuggerMcpConfig {
    const configPath = getConfigPath();
    if (!fs.existsSync(configPath)) return { ...DEFAULT_CONFIG };
    try {
        const c = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (!c || typeof c !== 'object') return { ...DEFAULT_CONFIG };
        return {
            enabled: !!c.enabled,
            port: typeof c.port === 'number' ? c.port : DEFAULT_CONFIG.port,
            enabledTools: typeof c.enabledTools === 'object' && c.enabledTools ? c.enabledTools : {}
        };
    } catch {
        return { ...DEFAULT_CONFIG };
    }
}

export function saveDebuggerMcpConfig(config: Partial<DebuggerMcpConfig>): void {
    const configPath = getConfigPath();
    const existing = loadDebuggerMcpConfig();
    const next = { ...existing, ...config };
    fs.writeFileSync(configPath, JSON.stringify(next, null, 2), 'utf-8');
}
