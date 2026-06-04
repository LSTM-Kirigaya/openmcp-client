import { pinkLog, redLog } from '@/views/setting/util';
import { acquireVsCodeApi, electronApi, getPlatform } from './platform';
import { getRuntimeWebSocketUrl } from './runtime-config';
import { isReactive } from 'vue';
import { v4 as uuidv4 } from 'uuid';

export interface VSCodeMessage {
	command: string;
	data?: unknown;
	callbackId?: string;
}

export interface RestFulResponse<T = any> {
    _id?: string
	code: number;
	msg: T;
	data?: unknown;
}

export type MessageHandler = (message: VSCodeMessage) => void;
export type CommandHandler = (data: any) => void;

interface AddCommandListenerOption {
	once: boolean // 只调用一次就销毁
}

export interface ICommandRequestData {
	clientId?: string;
	[key: string]: any;
}

export function getWebSocketSetupSignature(): string | undefined {
	return getRuntimeWebSocketUrl();
}

export class MessageBridge {
	private ws: WebSocket | null = null;
	private handlers = new Map<string, Set<CommandHandler>>();
	private isConnected: Promise<boolean> | null = null;

	constructor(
		private setupSignature: any
	) {

		const platform = getPlatform();

		switch (platform) {
			case 'vscode':
				this.setupVsCodeListener();
				pinkLog('[PLATFORM] Vscode');
				break;

			case 'electron':
				this.setupElectronListener();
				pinkLog('[PLATFORM] Electron');
				break;
			
			case 'nodejs':
				this.setupNodejsListener();
				pinkLog('[PLATFORM] NodeJS');
				break;
			
			case 'web':
				this.setupWebSocket();
				pinkLog('[PLATFORM] Web');
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
	public setupWebSocket(setupSignature?: string) {
		const wsUrl = setupSignature || this.setupSignature;

		if (typeof wsUrl !== 'string') {
			throw new Error('setupSignature must be a string. Static Web UI should inject window.__OPENMCP_RUNTIME_CONFIG__.websocketUrl.');
		}
		
		console.log(wsUrl);
		
		this.ws = new WebSocket(wsUrl);
		const ws = this.ws;

		this.isConnected = new Promise<boolean>((resolve, reject) => {
			ws.onopen = () => {
				resolve(true);
			};

			ws.onmessage = (event) => {
				try {				
					const message = JSON.parse(event.data) as VSCodeMessage;
					this.dispatchMessage(message);
				} catch (err) {
					console.error('Message parse error:', err);
					console.log(event);
				}
			};
	
			ws.onerror = (err) => {
				redLog('WebSocket error:');				
				resolve(false);
			};
	
			ws.onclose = () => {
				redLog('WebSocket connection closed');
				resolve(false);
			};
	
			this.postMessage = (message) => {
				if (this.ws?.readyState === WebSocket.OPEN) {
					console.log('send', message);
					this.ws.send(JSON.stringify(message));
				} else {
					console.error('WebSocket not open, message dropped:', message.command);
					throw new Error(`WebSocket is not open (readyState=${this.ws?.readyState}), cannot send ${message.command}`);
				}
			};
		});

		return this.isConnected;
	}

	public async awaitForWebsocket() {
		
		if (this.isConnected) {
			return await this.isConnected;
		}
		return false;
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

	private setupNodejsListener() {
		
		const emitter = this.setupSignature;
		if (!emitter.on || !emitter.emit) {
			return;
		}

		emitter.on('message/service', (message: VSCodeMessage) => {
			this.dispatchMessage(message);
		});

		this.postMessage = (message) => {
			emitter.emit('message/renderer', message);
		};
	}

	/**
	 * @description 对 message 发起调度，根据 command 类型获取调取器
	 * @param message 
	 */
	private dispatchMessage(message: VSCodeMessage) {
		const command = message.command;
		const data = message.data;

		const handlers = this.handlers.get(command) || new Set();
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

	private deserializeReactiveData(data: any) {
		if (isReactive(data)) {
			return JSON.parse(JSON.stringify(data));
		}

		// 只对第一层进行遍历
		for (const key in data) {
			if (isReactive(data[key])) {
				data[key] = JSON.parse(JSON.stringify(data[key]));
			}
		}

		return data;
	}

	/**
	 * @description do as axios does
	 * @param command 
	 * @param data 
	 * @returns 
	 */
	public async commandRequest<T = any>(command: string, data?: ICommandRequestData): Promise<RestFulResponse<T>>  {
		// Web 端在 WS 未 OPEN 时 postMessage 会直接丢包，请求永远无响应（刷新后 auth/status 先于连接完成会导致一直未登录）
		const platform = getPlatform();
		if (platform === 'web') {
			const ok = await this.awaitForWebsocket();
			if (!ok || this.ws?.readyState !== WebSocket.OPEN) {
				throw new Error('WebSocket is not connected');
			}
		} else {
			await this.awaitForWebsocket();
		}

		const _id = uuidv4();

		return new Promise<RestFulResponse>((resolve, reject) => {
			const handler = this.addCommandListener(command, (data) => {
				if (data._id === undefined) {
					console.warn('detect data without id, data: ' + JSON.stringify(data, null, 2));
				}

				if (data._id === _id) {
					handler();
					resolve(data as RestFulResponse);
				}
			}, { once: false });

			this.postMessage({
				command,
				data: this.deserializeReactiveData({
					_id,
					...data
				})
			});
		});
	}

	public destroy() {
		this.ws?.close();
		this.handlers.clear();
	}
}

// 单例实例
let messageBridge: MessageBridge;

export function createMessageBridge(setupSignature: any) {
	messageBridge = new MessageBridge(setupSignature);
}

// 向外暴露一个独立函数，保证 MessageBridge 是单例的
export function useMessageBridge() {
	if (!messageBridge && getPlatform() !== 'nodejs') {		
		messageBridge = new MessageBridge(getWebSocketSetupSignature());
	}
	const bridge = messageBridge;

	return bridge;
}

/** 与 extension 侧 service 通信的便捷封装（auth、cloud-backup 等 API 使用） */
export async function sendRequest<T = unknown>(
	command: string,
	data?: ICommandRequestData
): Promise<RestFulResponse<T>> {
	const bridge = useMessageBridge();
	return bridge.commandRequest<T>(command, data);
}
