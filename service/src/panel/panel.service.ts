import * as fs from 'fs';
import * as path from 'path';
import { VSCODE_WORKSPACE } from '../hook/setting.js';
import { IServerVersion } from '../mcp/client.dto.js';
import { SaveTab } from './panel.dto.js';
import { IConfig } from '../setting/setting.dto.js';

/**
 * 服务器数据默认结构
 */
interface ServerData {
    tabs: SaveTab;
    variables: any[];
    extractionRules: Record<string, Array<{ path: string; name: string }>>;
    testCases: any[];
    // 未来可以添加更多字段
    // testCases?: any[];
    // settings?: any;
}

const DEFAULT_SERVER_DATA: ServerData = {
    tabs: {
        tabs: [],
        currentIndex: -1
    },
    variables: [],
    extractionRules: {},
    testCases: []
}

/**
 * 获取服务器数据保存路径
 * 统一格式: data.{serverName}.json
 * 包含: tabs, variables 等所有需要持久化的数据
 */
function getServerDataPath(serverInfo: IServerVersion) {
    const { name = 'untitle', version = '0.0.0' } = serverInfo || {};

    // 过滤所有不能成为路径的字符
    const escapeName = name.replace(/[\\/:*?"<>|]/g, '_');

    const dataFileName = `openmcp.${escapeName}.json`;

    // 如果是 vscode 插件下，则修改为 ~/.openmcp/data.xxx.json
    if (VSCODE_WORKSPACE) {
        // 在 VSCode 插件环境下
        const configDir = path.join(VSCODE_WORKSPACE, '.openmcp');
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        return path.join(configDir, dataFileName);
    }
    return dataFileName;
}

/**
 * 创建默认的服务器数据文件
 */
function createDefaultServerData(serverInfo: IServerVersion): ServerData {
    const configPath = getServerDataPath(serverInfo);
    const configDir = path.dirname(configPath);
    
    // 确保配置目录存在
    if (configDir && !fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }
    
    // 写入默认配置
    fs.writeFileSync(configPath, JSON.stringify(DEFAULT_SERVER_DATA, null, 2), 'utf-8');
    return DEFAULT_SERVER_DATA;
}

/**
 * 读取服务器数据文件
 */
function loadServerData(serverInfo: IServerVersion): ServerData {
    const dataPath = getServerDataPath(serverInfo);
    
    if (!fs.existsSync(dataPath)) {
        return createDefaultServerData(serverInfo);
    }
    
    try {
        const configData = fs.readFileSync(dataPath, 'utf-8');
        const data = JSON.parse(configData) as ServerData;
        
        // 确保数据结构完整（向后兼容）
        return {
            tabs: data.tabs || DEFAULT_SERVER_DATA.tabs,
            variables: data.variables || DEFAULT_SERVER_DATA.variables,
            extractionRules: data.extractionRules || DEFAULT_SERVER_DATA.extractionRules,
            testCases: data.testCases || DEFAULT_SERVER_DATA.testCases
        };
    } catch (error) {
        console.error('Error loading server data file, creating new one:', error);
        return createDefaultServerData(serverInfo);
    }
}

/**
 * 保存服务器数据文件
 */
function saveServerData(serverInfo: IServerVersion, data: Partial<ServerData>): void {
    const dataPath = getServerDataPath(serverInfo);
    
    // 读取现有数据
    const existingData = loadServerData(serverInfo);
    
    // 合并数据
    const mergedData: ServerData = {
        ...existingData,
        ...data
    };
    
    try {
        fs.writeFileSync(dataPath, JSON.stringify(mergedData, null, 2), 'utf-8');
    } catch (error) {
        console.error('Error saving server data file:', error);
        throw error;
    }
}

/**
 * 加载 Tab 配置
 */
export function loadTabSaveConfig(serverInfo: IServerVersion): SaveTab {
    const serverData = loadServerData(serverInfo);
    return serverData.tabs;
}

/**
 * 保存 Tab 配置
 */
export function saveTabSaveConfig(serverInfo: IServerVersion, config: Partial<IConfig>): void {
    saveServerData(serverInfo, { tabs: config as SaveTab });
}

/**
 * 保存变量配置
 */
export function saveVariableConfig(serverInfo: IServerVersion, data: { variables: any[] }): void {
    saveServerData(serverInfo, { variables: data.variables });
}

/**
 * 加载变量配置
 */
export function loadVariableConfig(serverInfo: IServerVersion): { variables: any[] } {
    const serverData = loadServerData(serverInfo);
    return { variables: serverData.variables };
}

/**
 * 保存变量提取规则配置
 */
export function saveExtractionRulesConfig(
    serverInfo: IServerVersion,
    data: { extractionRules: Record<string, Array<{ path: string; name: string }>> }
): void {
    saveServerData(serverInfo, { extractionRules: data.extractionRules });
}

/**
 * 加载变量提取规则配置
 */
export function loadExtractionRulesConfig(
    serverInfo: IServerVersion
): { extractionRules: Record<string, Array<{ path: string; name: string }>> } {
    const serverData = loadServerData(serverInfo);
    return { extractionRules: serverData.extractionRules };
}

/**
 * 保存测试用例配置
 */
export function saveTestCasesConfig(serverInfo: IServerVersion, data: { testCases: any[] }): void {
    saveServerData(serverInfo, { testCases: data.testCases });
}

/**
 * 加载测试用例配置
 */
export function loadTestCasesConfig(serverInfo: IServerVersion): { testCases: any[] } {
    const serverData = loadServerData(serverInfo);
    return { testCases: serverData.testCases };
}