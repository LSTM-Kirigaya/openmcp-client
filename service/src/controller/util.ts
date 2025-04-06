import { VSCodeWebViewLike } from "../adapter";
import { MCPClient } from "./connect";

export function ping(client: MCPClient | undefined, webview: VSCodeWebViewLike) {
	if (!client) {
		const connectResult = {
			code: 501,
			msg: 'mcp client 尚未连接'
		};
		webview.postMessage({ command: 'ping', data: connectResult });
		return;
	}

	webview.postMessage({
		command: 'ping', data: {
			code: 200,
			msg: {}
		}
	});
}