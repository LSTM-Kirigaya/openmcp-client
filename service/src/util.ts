import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { llms } from './llm';
import { IServerVersion } from './controller/connect';

export let VSCODE_WORKSPACE = '';

export function setVscodeWorkspace(workspace: string) {
    VSCODE_WORKSPACE = workspace;
}

function getConfigurationPath() {
    // 如果是 vscode 插件下，则修改为 ~/.openmcp/config.json
    if (VSCODE_WORKSPACE) {
        // 在 VSCode 插件环境下
        const homeDir = os.homedir();
        const configDir = path.join(homeDir, '.openmcp');
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        return path.join(configDir, 'config.json');
    }
    return 'config.json';
}

function getTabSavePath(serverInfo: IServerVersion) {
    const { name = 'untitle', version = '0.0.0' } = serverInfo || {};
    const tabSaveName = `tabs.${name}.json`;

    // 如果是 vscode 插件下，则修改为 ~/.vscode/openmcp.json
    if (VSCODE_WORKSPACE) {
        // 在 VSCode 插件环境下
        const configDir = path.join(VSCODE_WORKSPACE, '.vscode');
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        return path.join(configDir, tabSaveName);
    }
    return tabSaveName;
}

function getDefaultLanguage() {
    if (process.env.VSCODE_PID) {
        // TODO: 获取 vscode 内部的语言

    }
    return 'zh';
}

interface IConfig {
    MODEL_INDEX: number;
    [key: string]: any;
}

const DEFAULT_CONFIG: IConfig = {
    MODEL_INDEX: 0,
    LLM_INFO: llms,
    LANG: getDefaultLanguage()
};

interface SaveTabItem {
	name: string;
	icon: string;
	type: string;
	componentIndex: number;
	storage: Record<string, any>;
}

interface SaveTab {
	tabs: SaveTabItem[]
	currentIndex: number
}

const DEFAULT_TABS: SaveTab = {
    tabs: [],
    currentIndex: -1
}

function createConfig(): IConfig {
    const configPath = getConfigurationPath();
    const configDir = path.dirname(configPath);
    
    // 确保配置目录存在
    if (configDir && !fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }
    
    // 写入默认配置
    fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
    return DEFAULT_CONFIG;
}

function createSaveTabConfig(serverInfo: IServerVersion): SaveTab {
    const configPath = getTabSavePath(serverInfo);
    const configDir = path.dirname(configPath);
    
    // 确保配置目录存在
    if (configDir && !fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }
    
    // 写入默认配置
    fs.writeFileSync(configPath, JSON.stringify(DEFAULT_TABS, null, 2), 'utf-8');
    return DEFAULT_TABS;
}

export function loadConfig(): IConfig {
    const configPath = getConfigurationPath();
    
    if (!fs.existsSync(configPath)) {
        return createConfig();
    }
    
    try {
        const configData = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(configData) as IConfig;
    } catch (error) {
        console.error('Error loading config file, creating new one:', error);
        return createConfig();
    }
}

export function saveConfig(config: Partial<IConfig>): void {
    const configPath = getConfigurationPath();
    console.log('save to ' + configPath);
    
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
        console.error('Error saving config file:', error);
        throw error;
    }
}

export function loadTabSaveConfig(serverInfo: IServerVersion): SaveTab {
    const tabSavePath = getTabSavePath(serverInfo);
    
    if (!fs.existsSync(tabSavePath)) {
        return createSaveTabConfig(serverInfo);
    }
    
    try {
        const configData = fs.readFileSync(tabSavePath, 'utf-8');
        return JSON.parse(configData) as SaveTab;
    } catch (error) {
        console.error('Error loading config file, creating new one:', error);
        return createSaveTabConfig(serverInfo);
    }
}

export function saveTabSaveConfig(serverInfo: IServerVersion, config: Partial<IConfig>): void {
    const tabSavePath = getTabSavePath(serverInfo);
    
    try {
        fs.writeFileSync(tabSavePath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
        console.error('Error saving config file:', error);
        throw error;
    }
}