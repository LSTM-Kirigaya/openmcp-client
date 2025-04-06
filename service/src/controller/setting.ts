import { VSCodeWebViewLike } from '../adapter';
import { loadConfig, saveConfig } from '../util';
import { MCPClient } from './connect';

export async function settingSaveHandler(client: MCPClient | undefined, data: any, webview: VSCodeWebViewLike) {
    if (!client) {
		const connectResult = {
			code: 501,
			msg: 'mcp client 尚未连接'
		};
		webview.postMessage({ command: 'ping', data: connectResult });
		return;
	}


    try {
        // 保存配置
        saveConfig(data);
        
        webview.postMessage({
            command: 'setting/save',
            data: {
                code: 200,
                msg: 'Settings saved successfully'
            }
        });
    } catch (error) {
        webview.postMessage({
            command: 'setting/save',
            data: {
                code: 500,
                msg: `Failed to save settings: ${(error as Error).message}`
            }
        });
    }
}

export async function settingLoadHandler(client: MCPClient | undefined, webview: VSCodeWebViewLike) {
    if (!client) {
		const connectResult = {
			code: 501,
			msg: 'mcp client 尚未连接'
		};
		webview.postMessage({ command: 'ping', data: connectResult });
		return;
	}


    try {
        // 加载配置
        const config = loadConfig();
        
        webview.postMessage({
            command: 'setting/load',
            data: {
                code: 200,
                msg: config // 直接返回配置对象
            }
        });
    } catch (error) {
        webview.postMessage({
            command: 'setting/load',
            data: {
                code: 500,
                msg: `Failed to load settings: ${(error as Error).message}`
            }
        });
    }
}