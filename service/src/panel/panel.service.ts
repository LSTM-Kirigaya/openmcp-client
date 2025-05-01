import * as fs from 'fs';
import * as path from 'path';
import { VSCODE_WORKSPACE } from '../hook/setting';
import { IServerVersion } from '../mcp/client.dto';
import { SaveTab } from './panel.dto';
import { IConfig } from '../setting/setting.dto';

const DEFAULT_TABS: SaveTab = {
    tabs: [],
    currentIndex: -1
}

function getTabSavePath(serverInfo: IServerVersion) {
    const { name = 'untitle', version = '0.0.0' } = serverInfo || {};

    // 过滤所有不能成为路径的字符
    const escapeName = name.replace(/[\\/:*?"<>|]/g, '_');

    const tabSaveName = `tabs.${escapeName}.json`;

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