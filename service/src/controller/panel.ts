import { PostMessageble } from '../hook/adapter';
import { loadConfig, loadTabSaveConfig, saveConfig, saveTabSaveConfig } from '../hook/setting';
import { MCPClient } from '../hook/client';

export async function panelSaveHandler(client: MCPClient | undefined, data: any, webview: PostMessageble) {
	try {
		// 保存配置
		const serverInfo = client?.getServerVersion();
		saveTabSaveConfig(serverInfo, data);
		
		webview.postMessage({
			command: 'panel/save',
			data: {
				code: 200,
				msg: 'Settings saved successfully'
			}
		});
	} catch (error) {
		webview.postMessage({
			command: 'panel/save',
			data: {
				code: 500,
				msg: `Failed to save settings: ${(error as Error).message}`
			}
		});
	}
}

export async function panelLoadHandler(client: MCPClient | undefined, webview: PostMessageble) {
	try {
		// 加载配置
		const serverInfo = client?.getServerVersion();
		const config = loadTabSaveConfig(serverInfo);
		
		webview.postMessage({
			command: 'panel/load',
			data: {
				code: 200,
				msg: config // 直接返回配置对象
			}
		});
	} catch (error) {
		webview.postMessage({
			command: 'panel/load',
			data: {
				code: 500,
				msg: `Failed to load settings: ${(error as Error).message}`
			}
		});
	}
}