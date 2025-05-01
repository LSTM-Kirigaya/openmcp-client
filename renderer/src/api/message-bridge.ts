import { pinkLog, redLog } from '@/views/setting/util';
import { acquireVsCodeApi, electronApi, getPlatform } from './platform';
import { ref } from 'vue';

export interface VSCodeMessage {
	command: string;
	data?: unknown;
	callbackId?: string;
}

export interface RestFulResponse {
	code: number;
	msg: any;
}

export type MessageHandler = (message: VSCodeMessage) => void;
export type CommandHandler = (data: any) => void;

interface AddCommandListenerOption {
	once: boolean // 只调用一次就销毁
}

class MessageBridge {
	private ws: WebSocket | null = null;
	private handlers = new Map<string, Set<CommandHandler>>();
	private isConnected: Promise<boolean> | null = null;

	constructor(private wsUrl: string = 'ws://localhost:8080') {

		// 环境检测优先级：
		// 1. VS Code WebView 环境
		// 2. 浏览器 WebSocket 环境

		const platform = getPlatform();

		switch (platform) {
			case 'vscode':
				this.setupVsCodeListener();
				pinkLog('当前模式: vscode');
				break;

			case 'electron':
				this.setupElectronListener();
				pinkLog('当前模式: electron');
				break;
			
			case 'web':
				this.setupWebSocket();
				pinkLog('当前模式: web');
				break;
		}
	}

	// VS Code 环境监听
	private setupVsCodeListener() {
		const vscode = acquireVsCodeApi();

		window.addEventListener('message', (event: MessageEvent<VSCodeMessage>) => {
			this.dispatchMessage(event.data);
		});

		this.postMessage = (message) => vscode.postMessage(message);
	}

	// WebSocket 环境连接
	private setupWebSocket() {
		this.ws = new WebSocket(this.wsUrl);

		this.ws.onmessage = (event) => {
			try {				
				const message = JSON.parse(event.data) as VSCodeMessage;
				this.dispatchMessage(message);
			} catch (err) {
				console.error('Message parse error:', err);
				console.log(event);
			}
		};

		this.ws.onclose = () => {
			redLog('WebSocket connection closed');
		};

		this.postMessage = (message) => {
			if (this.ws?.readyState === WebSocket.OPEN) {
				console.log('send', message);
				this.ws.send(JSON.stringify(message));
			}
		};

		const ws = this.ws;

		this.isConnected = new Promise<boolean>((resolve, reject) => {
			ws.onopen = () => {
				resolve(true);
			};
		});
	}

	public async awaitForWebsockt() {
		if (this.isConnected) {
			await this.isConnected;
		}
	}

	private setupElectronListener() {
		electronApi.onReply((event: MessageEvent<VSCodeMessage>) => {
			console.log(event);
			this.dispatchMessage(event.data);
		});

		this.postMessage = (message) => {
			console.log(message);
			electronApi.sendToMain(message);
		};		
	}

	/**
	 * @description 对 message 发起调度，根据 command 类型获取调取器
	 * @param message 
	 */
	private dispatchMessage(message: VSCodeMessage) {
		const command = message.command;
		const data = message.data;

		const handlers = this.handlers.get(command) || [];
		handlers.forEach(handler => handler(data));
	}

	public postMessage(message: VSCodeMessage) {
		throw new Error('PostMessage not initialized');
	}

	/**
	 * @description 注册一个命令的执行器（支持一次性或持久监听）
	 * @example
	 * // 基本用法（持久监听）
	 * const removeListener = bridge.addCommandListener('message', (data) => {
	 *   console.log('收到消息:', data.msg.text);
	 * }, { once: false });
	 * 
	 * // 稍后取消监听
	 * removeListener();
	 * 
	 * @example
	 * // 一次性监听（自动移除）
	 * bridge.addCommandListener('connect', (data) => {
	 *   const { code, msg } = data;
	 *   console.log(`连接结果: ${code === 200 ? '成功' : '失败'}`);
	 * }, { once: true });
	 */
	public addCommandListener(
		command: string,
		commandHandler: CommandHandler,
		option: AddCommandListenerOption
	): () => boolean {
		if (!this.handlers.has(command)) {
			this.handlers.set(command, new Set<CommandHandler>());
		}
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const commandHandlers = this.handlers.get(command)!;

		const wrapperCommandHandler = option.once ? (data: any) => {
			commandHandler(data);
			commandHandlers.delete(wrapperCommandHandler);
		} : commandHandler;

		commandHandlers.add(wrapperCommandHandler);
		return () => commandHandlers.delete(wrapperCommandHandler);
	}

	/**
	 * @description do as axios does
	 * @param command 
	 * @param data 
	 * @returns 
	 */
	public commandRequest(command: string, data?: any) {
		return new Promise<RestFulResponse>((resolve, reject) => {
			this.addCommandListener(command, (data) => {
				resolve(data as RestFulResponse);
			}, { once: true });

			this.postMessage({
				command,
				data
			});
		});
	}

	public destroy() {
		this.ws?.close();
		this.handlers.clear();
	}
}

// 单例实例
const messageBridge = new MessageBridge();

// 向外暴露一个独立函数，保证 MessageBridge 是单例的
export function useMessageBridge() {
	const bridge = messageBridge;

	return {
		postMessage: bridge.postMessage.bind(bridge),
		addCommandListener: bridge.addCommandListener.bind(bridge),
		commandRequest: bridge.commandRequest.bind(bridge),
		awaitForWebsockt: bridge.awaitForWebsockt.bind(bridge)
	};
}