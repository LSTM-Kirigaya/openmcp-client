import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { VSCODE_WORKSPACE } from '../hook/setting';
import { IConfig } from './setting.dto';
import { llms } from '../hook/llm';

function getConfigurationPath() {
    // 如果是 vscode 插件下，则修改为 ~/.openmcp/config.json
    if (VSCODE_WORKSPACE) {
        // 在 VSCode 插件环境下
        const homeDir = os.homedir();
        const configDir = path.join(homeDir, '.openmcp');
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        return path.join(configDir, 'setting.json');
    }
    return 'setting.json';
}

function getDefaultLanguage() {
    if (process.env.VSCODE_PID) {
        // TODO: 获取 vscode 内部的语言

    }
    return 'zh';
}

const DEFAULT_CONFIG: IConfig = {
    MODEL_INDEX: 0,
    LLM_INFO: llms,
    LANG: getDefaultLanguage()
};


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

export function loadSetting(): IConfig {
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

export function saveSetting(config: Partial<IConfig>): void {
    const configPath = getConfigurationPath();
    console.log('save to ' + configPath);
    
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
        console.error('Error saving config file:', error);
        throw error;
    }
}
