import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_LANG } from '../hook/setting.js';
import { IConfig } from './setting.dto.js';
import { llms } from '../hook/llm.js';
import {
    ensureParentDir,
    getLegacySettingsFilePath,
    getLegacyTourKeyPath,
    getSettingsFilePath,
    getTourKeyPath
} from '../storage/paths.js';

function getConfigurationPath() {
    const configPath = getSettingsFilePath();
    ensureParentDir(configPath);
    return configPath;
}

function readConfigFromDisk(configPath: string): IConfig | undefined {
    try {
        if (!fs.existsSync(configPath)) {
            return undefined;
        }
        return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as IConfig;
    } catch {
        return undefined;
    }
}

function getDefaultConfig() {
    return {
        MODEL_INDEX: 0,
        LLM_INFO: llms,
        LANG: DEFAULT_LANG,
        MCP_TIMEOUT_SEC: 60,
        PROXY_SERVER: '',
        SKILL_PATH: '',
    }
}


function createConfig(): IConfig {
    const configPath = getConfigurationPath();
    // 写入默认配置
    const defaultConfig = getDefaultConfig();
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    return defaultConfig;
}

export function loadSetting(): IConfig {
    const configPath = getConfigurationPath();
    const legacyPath = getLegacySettingsFilePath();
    
    if (!fs.existsSync(configPath) && fs.existsSync(legacyPath)) {
        const legacyConfig = readConfigFromDisk(legacyPath);
        if (legacyConfig) {
            saveSetting(legacyConfig);
        }
    }

    if (!fs.existsSync(configPath)) {
        return createConfig();
    }
    
    try {
        const config = readConfigFromDisk(configPath) || createConfig();
        
        if (!config.LLM_INFO || (Array.isArray(config.LLM_INFO) && config.LLM_INFO.length === 0)) {
            config.LLM_INFO = llms;
        } else {
            // 首先清理可能存在的重复和临时配置
            const cleanLlmInfo = config.LLM_INFO.filter((llm: any) => 
                llm && !llm._isTemporary && typeof llm.id === 'string'
            );
            
            // 去重：使用 Map 按 id 去重，保留第一个出现的配置
            const uniqueLlmMap = new Map();
            cleanLlmInfo.forEach((llm: any) => {
                if (!uniqueLlmMap.has(llm.id)) {
                    uniqueLlmMap.set(llm.id, llm);
                } else {
                    console.log(`[DEDUP] 发现重复配置，跳过: ${llm.id}`);
                }
            });
            
            config.LLM_INFO = Array.from(uniqueLlmMap.values());
            
            // 自动同步新的提供商：检查默认配置中是否有新的提供商未在用户配置中
            const existingIds = new Set(config.LLM_INFO.map((llm: any) => llm.id));
            const newProviders = llms.filter((llm: any) => !existingIds.has(llm.id));
            
            if (newProviders.length > 0) {
                console.log(`Adding ${newProviders.length} new providers:`, newProviders.map(p => p.name));
                config.LLM_INFO.push(...newProviders);
                
                // 自动保存更新后的配置
                try {
                    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
                    console.log('Configuration updated with new providers');
                } catch (saveError) {
                    console.error('Failed to save updated configuration:', saveError);
                }
            }
        }
        
        return config;
    } catch (error) {
        console.error('Error loading config file, creating new one:', error);
        return createConfig();
    }
}

export function saveSetting(config: Partial<IConfig>): void {
    const configPath = getConfigurationPath();

    try {
        ensureParentDir(configPath);
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
        console.error('Error saving config file:', error);
        throw error;
    }
}

export function getTour() {
    const KEY = getTourKeyPath();
    const legacyKey = getLegacyTourKeyPath();
    console.log(KEY);
    
    if (!fs.existsSync(KEY) && fs.existsSync(legacyKey)) {
        ensureParentDir(KEY);
        fs.copyFileSync(legacyKey, KEY);
    }

    if (!fs.existsSync(KEY)) {
        return {
            userHasReadGuide: false
        };
    }
    return {
        userHasReadGuide: true
    };
}

export function setTour(userHasReadGuide: boolean): void {
    const KEY = getTourKeyPath();
    if (userHasReadGuide) {
        const key = `直面恐惧，创造未来
Face your fears, create the future
恐怖に直面し、未来を創り出す`;
        ensureParentDir(KEY);
        fs.writeFileSync(KEY, key, 'utf-8');
    }
}