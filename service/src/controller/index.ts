
import { PostMessageble } from '../adapter';
import { connect, MCPClient, type MCPOptions } from './connect';
import { callTool, getPrompt, listPrompts, listResources, listResourceTemplates, listTools, readResource } from './handler';
import { chatCompletionHandler } from './llm';
import { panelLoadHandler, panelSaveHandler } from './panel';
import { settingLoadHandler, settingSaveHandler } from './setting';
import { ping } from './util';


// TODO: 支持更多的 client
let client: MCPClient | undefined = undefined;

async function connectHandler(option: MCPOptions, webview: PostMessageble) {
	try {
		console.log('ready to connect', option);
		
		client = await connect(option);
		const connectResult = {
			code: 200,
			msg: 'connect success\nHello from OpenMCP | virtual client version: 0.0.1'
		};
		webview.postMessage({ command: 'connect', data: connectResult });
	} catch (error) {

		// TODO: 这边获取到的 error 不够精致，如何才能获取到更加精准的错误
		// 比如	error: Failed to spawn: `server.py`
  		//		  Caused by: No such file or directory (os error 2)

		const connectResult = {
			code: 500,
			msg: (error as any).toString()
		};
		webview.postMessage({ command: 'connect', data: connectResult });
	}
}


export function messageController(command: string, data: any, webview: PostMessageble) {
	switch (command) {
		case 'connect':
			connectHandler(data, webview);
			break;

		case 'prompts/list':
			listPrompts(client, webview);
			break;

		case 'prompts/get':
			getPrompt(client, data, webview);
			break;

		case 'resources/list':
			listResources(client, webview);
			break;

		case 'resources/templates/list':
			listResourceTemplates(client, webview);
			break;

		case 'resources/read':
			readResource(client, data, webview);
			break;

        case 'tools/list':
            listTools(client, webview);
            break;

		case 'tools/call':
			callTool(client, data, webview);
			break;

		case 'ping':
			ping(client, webview);
			break;

        case 'setting/save':
            settingSaveHandler(client, data, webview);
            break;
		
        case 'setting/load':
            settingLoadHandler(client, webview);
            break;

		case 'panel/save':
			panelSaveHandler(client, data, webview);
			break;
		
		case 'panel/load':
			panelLoadHandler(client, webview);
			break;
		
		case 'llm/chat/completions':
			chatCompletionHandler(client, data, webview);
			break;

		default:
			break;
	}
}