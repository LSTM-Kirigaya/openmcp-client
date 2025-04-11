import { PostMessageble } from "../adapter";
import { MCPClient } from "./connect";

// ==================== 接口定义 ====================
export interface GetPromptOption {
	promptId: string;
	args?: Record<string, any>;
}

export interface ReadResourceOption {
	resourceUri: string;
}

export interface CallToolOption {
	toolName: string;
	toolArgs: Record<string, any>;
}

// ==================== 函数实现 ====================

/**
 * @description 列出所有 prompts
 */
export async function listPrompts(
	client: MCPClient | undefined,
	webview: PostMessageble
) {
	if (!client) {
		const connectResult = {
			code: 501,
			msg: 'mcp client 尚未连接'
		};
		webview.postMessage({ command: 'prompts/list', data: connectResult });
		return;
	}

	try {
		const prompts = await client.listPrompts();
		const result = {
			code: 200,
			msg: prompts
		};
		webview.postMessage({ command: 'prompts/list', data: result });
	} catch (error) {
		const result = {
			code: 500,
			msg: (error as any).toString()
		};
		webview.postMessage({ command: 'prompts/list', data: result });
	}
}

/**
 * @description 获取特定 prompt
 */
export async function getPrompt(
	client: MCPClient | undefined,
	option: GetPromptOption,
	webview: PostMessageble
) {
	if (!client) {
		const connectResult = {
			code: 501,
			msg: 'mcp client 尚未连接'
		};
		webview.postMessage({ command: 'prompts/get', data: connectResult });
		return;
	}

	try {
		const prompt = await client.getPrompt(option.promptId, option.args || {});
		const result = {
			code: 200,
			msg: prompt
		};
		webview.postMessage({ command: 'prompts/get', data: result });
	} catch (error) {
		const result = {
			code: 500,
			msg: (error as any).toString()
		};
		webview.postMessage({ command: 'prompts/get', data: result });
	}
}

/**
 * @description 列出所有resources
 */
export async function listResources(
	client: MCPClient | undefined,
	webview: PostMessageble
) {
	if (!client) {
		const connectResult = {
			code: 501,
			msg: 'mcp client 尚未连接'
		};
		webview.postMessage({ command: 'resources/list', data: connectResult });
		return;
	}

	try {
		const resources = await client.listResources();
		const result = {
			code: 200,
			msg: resources
		};
		webview.postMessage({ command: 'resources/list', data: result });
	} catch (error) {
		const result = {
			code: 500,
			msg: (error as any).toString()
		};
		webview.postMessage({ command: 'resources/list', data: result });
	}
}


/**
 * @description 列出所有resources
 */
export async function listResourceTemplates(
	client: MCPClient | undefined,
	webview: PostMessageble
) {
	if (!client) {
		const connectResult = {
			code: 501,
			msg: 'mcp client 尚未连接'
		};
		webview.postMessage({ command: 'resources/templates/list', data: connectResult });
		return;
	}

	try {
		const resources = await client.listResourceTemplates();
		const result = {
			code: 200,
			msg: resources
		};
		webview.postMessage({ command: 'resources/templates/list', data: result });
	} catch (error) {
		const result = {
			code: 500,
			msg: (error as any).toString()
		};
		webview.postMessage({ command: 'resources/templates/list', data: result });
	}
}


/**
 * @description 读取特定resource
 */
export async function readResource(
	client: MCPClient | undefined,
	option: ReadResourceOption,
	webview: PostMessageble
) {
	if (!client) {
		const connectResult = {
			code: 501,
			msg: 'mcp client 尚未连接'
		};
		webview.postMessage({ command: 'resources/read', data: connectResult });
		return;
	}

	try {
		const resource = await client.readResource(option.resourceUri);
		const result = {
			code: 200,
			msg: resource
		};
		webview.postMessage({ command: 'resources/read', data: result });
	} catch (error) {
		const result = {
			code: 500,
			msg: (error as any).toString()
		};
		webview.postMessage({ command: 'resources/read', data: result });
	}
}

/**
 * @description 获取工具列表
 */
export async function listTools(
    client: MCPClient | undefined,
    webview: PostMessageble
) {
    if (!client) {
        const connectResult = {
            code: 501,
            msg: 'mcp client 尚未连接'
        };
        webview.postMessage({ command: 'tools/list', data: connectResult });
        return;
    }

    try {
        const tools = await client.listTools();

        const result = {
            code: 200,
            msg: tools
        };
        
        webview.postMessage({ command: 'tools/list', data: result });
    } catch (error) {
        const result = {
            code: 500,
            msg: (error as any).toString()
        };
        webview.postMessage({ command: 'tools/list', data: result });
    }
}


/**
 * @description 调用工具
 */
export async function callTool(
	client: MCPClient | undefined,
	option: CallToolOption,
	webview: PostMessageble
) {
	if (!client) {
		const connectResult = {
			code: 501,
			msg: 'mcp client 尚未连接'
		};
		webview.postMessage({ command: 'tools/call', data: connectResult });
		return;
	}

	try {
		const toolResult = await client.callTool({
			name: option.toolName,
			arguments: option.toolArgs
		});

		const result = {
			code: 200,
			msg: toolResult
		};
		webview.postMessage({ command: 'tools/call', data: result });
	} catch (error) {
		const result = {
			code: 500,
			msg: (error as any).toString()
		};
		webview.postMessage({ command: 'tools/call', data: result });
	}
}
