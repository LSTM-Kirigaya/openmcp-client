import { pinkLog } from '@/views/setting/util';
import { onUnmounted, ref } from 'vue';

export interface VSCodeMessage {
	command: string;
	data?: unknown;
	callbackId?: string;
}

export type MessageHandler = (message: VSCodeMessage) => void;
export type CommandHandler = (data: any) => void;

export const acquireVsCodeApi = (window as any)['acquireVsCodeApi'];

interface AddCommandListenerOption {
	once: boolean // 只调用一次就销毁
}

class MessageBridge {
	private ws: WebSocket | null = null;
	private handlers = new Map<string, Set<CommandHandler>>();
	public isConnected = ref(false);

	constructor(private wsUrl: string = 'ws://localhost:8080') {
		this.init();
	}

	private init() {
		// 环境检测优先级：
		// 1. VS Code WebView 环境
		// 2. 浏览器 WebSocket 环境
		if (typeof acquireVsCodeApi !== 'undefined') {
			this.setupVSCodeListener();
			pinkLog('当前模式：release');
		} else {
			this.setupWebSocket();
			pinkLog('当前模式：debug');
		}
	}

	// VS Code 环境监听
	private setupVSCodeListener() {
		const vscode = acquireVsCodeApi();

		window.addEventListener('message', (event: MessageEvent<VSCodeMessage>) => {
			this.dispatchMessage(event.data);
		});

		this.postMessage = (message) => vscode.postMessage(message);
		this.isConnected.value = true;
	}

	// WebSocket 环境连接
	private setupWebSocket() {
		this.ws = new WebSocket(this.wsUrl);

		this.ws.onopen = () => {
			this.isConnected.value = true;
		};

		this.ws.onmessage = (event) => {
			try {
				const message = JSON.parse(event.data) as VSCodeMessage;
				this.dispatchMessage(message);
			} catch (err) {
				console.error('Message parse error:', err);
			}
		};

		this.ws.onclose = () => {
			this.isConnected.value = false;
		};

		this.postMessage = (message) => {
			if (this.ws?.readyState === WebSocket.OPEN) {
				console.log(message);

				this.ws.send(JSON.stringify(message));
			}
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
		const commandHandlers = this.handlers.get(command)!;

		const wrapperCommandHandler = option.once ? (data: any) => {
			commandHandler(data);
			commandHandlers.delete(wrapperCommandHandler);
		} : commandHandler;

		commandHandlers.add(wrapperCommandHandler);
		return () => commandHandlers.delete(wrapperCommandHandler);
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
		isConnected: bridge.isConnected
	};
}