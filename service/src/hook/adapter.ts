import { WebSocket } from 'ws';
import { EventEmitter } from 'events';

// WebSocket 消息格式
export interface WebSocketMessage {
    command: string;
    data: any;
}

// 服务器返回的消息格式
export interface WebSocketResponse {
    result?: any;
    timeCost?: number;
    error?: string;
}

export interface PostMessageble {
    postMessage(message: any): void;
}

// 监听器回调类型
export type MessageHandler = (message: any) => void;

export class VSCodeWebViewLike {
    private ws: WebSocket;
    private messageHandlers: Set<MessageHandler>;

    constructor(ws: WebSocket) {
        this.ws = ws;
        this.messageHandlers = new Set();

        // 监听消息并触发回调
        this.ws.on('message', (rawData: Buffer | string) => {
            try {
                const message: any = JSON.parse(rawData.toString());
                this.messageHandlers.forEach((handler) => handler(message));
            } catch (error) {
                console.error('Failed to parse WebSocket message:', error);
            }
        });
    }

    /**
     * 发送消息（模拟 vscode.webview.postMessage）
     * @param message - 包含 command 和 args 的消息
     */
    postMessage(message: WebSocketMessage): void {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.error('WebSocket is not open, cannot send message');
        }
    }

    /**
     * 接收消息（模拟 vscode.webview.onDidReceiveMessage）
     * @param callback - 消息回调
     * @returns {{ dispose: () => void }} - 可销毁的监听器
     */
    onDidReceiveMessage(callback: MessageHandler): { dispose: () => void } {
        this.messageHandlers.add(callback);
        return {
            dispose: () => this.messageHandlers.delete(callback),
        };
    }
}


export class EventAdapter {
    public emitter: EventEmitter;
    private messageHandlers: Set<MessageHandler>;

    constructor(option: any) {
        this.emitter = new EventEmitter(option);
        this.messageHandlers = new Set();
    }

    /**
     * 发送消息
     * @param message - 包含 command 和 args 的消息
     */
    postMessage(message: WebSocketMessage): void {
        this.emitter.emit('message/service', message);
    }

    /**
     * 接收消息
     * @param callback - 消息回调
     * @returns {{ dispose: () => void }} - 可销毁的监听器
     */
    onDidReceiveMessage(callback: MessageHandler): { dispose: () => void } {
        this.messageHandlers.add(callback);
        return {
            dispose: () => this.messageHandlers.delete(callback),
        };
    }
}

