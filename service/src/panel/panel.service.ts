import { IServerVersion } from '../mcp/client.dto.js';
import { SaveTab } from './panel.dto.js';
import { IConfig } from '../setting/setting.dto.js';
import type { ClientStorageBinding } from '../storage/client-binding.js';
import {
    loadStoredExtractionRules,
    loadStoredPanelTabs,
    loadStoredVariables,
    saveStoredExtractionRules,
    saveStoredPanelTabs,
    saveStoredVariables
} from '../storage/panel-state.repository.js';
import { listStoredToolCases, replaceStoredToolCases } from '../storage/tool-cases.repository.js';
import type { LocalStorageScopeOptions } from '../storage/paths.js';

function resolveConnectionKey(serverInfo: IServerVersion, binding?: ClientStorageBinding): string {
    return binding?.connectionId || binding?.connectionKey || serverInfo?.name || 'default';
}

function resolveStorageOptions(binding?: ClientStorageBinding): LocalStorageScopeOptions {
    if (!binding) {
        return {};
    }
    return {
        scope: binding.scope,
        workspacePath: binding.workspacePath
    };
}

/**
 * 加载 Tab 配置
 */
export function loadTabSaveConfig(serverInfo: IServerVersion, binding?: ClientStorageBinding): SaveTab {
    return loadStoredPanelTabs(resolveConnectionKey(serverInfo, binding), resolveStorageOptions(binding));
}

/**
 * 保存 Tab 配置
 */
export function saveTabSaveConfig(serverInfo: IServerVersion, config: Partial<IConfig>, binding?: ClientStorageBinding): void {
    saveStoredPanelTabs(resolveConnectionKey(serverInfo, binding), config as SaveTab, resolveStorageOptions(binding));
}

/**
 * 保存变量配置
 */
export function saveVariableConfig(serverInfo: IServerVersion, data: { variables: any[] }, binding?: ClientStorageBinding): void {
    saveStoredVariables(resolveConnectionKey(serverInfo, binding), data.variables, resolveStorageOptions(binding));
}

/**
 * 加载变量配置
 */
export function loadVariableConfig(serverInfo: IServerVersion, binding?: ClientStorageBinding): { variables: any[] } {
    return loadStoredVariables(resolveConnectionKey(serverInfo, binding), resolveStorageOptions(binding));
}

/**
 * 保存变量提取规则配置
 */
export function saveExtractionRulesConfig(
    serverInfo: IServerVersion,
    data: { extractionRules: Record<string, Array<{ path: string; name: string }>> },
    binding?: ClientStorageBinding
): void {
    saveStoredExtractionRules(resolveConnectionKey(serverInfo, binding), data.extractionRules, resolveStorageOptions(binding));
}

/**
 * 加载变量提取规则配置
 */
export function loadExtractionRulesConfig(
    serverInfo: IServerVersion,
    binding?: ClientStorageBinding
): { extractionRules: Record<string, Array<{ path: string; name: string }>> } {
    return loadStoredExtractionRules(resolveConnectionKey(serverInfo, binding), resolveStorageOptions(binding));
}

/**
 * 保存测试用例配置
 */
export function saveTestCasesConfig(serverInfo: IServerVersion, data: { testCases: any[] }, binding?: ClientStorageBinding): void {
    replaceStoredToolCases(resolveConnectionKey(serverInfo, binding), data.testCases as any[], resolveStorageOptions(binding));
}

/**
 * 加载测试用例配置
 */
export function loadTestCasesConfig(serverInfo: IServerVersion, binding?: ClientStorageBinding): { testCases: any[] } {
    return {
        testCases: listStoredToolCases(resolveConnectionKey(serverInfo, binding), resolveStorageOptions(binding))
    };
}