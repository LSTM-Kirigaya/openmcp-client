import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

export interface VSCodeMessage {
  command: string;
  data?: unknown;
  callbackId?: string;
}

export interface RestFulResponse<T = any> {
  _id?: string;
  code: number;
  msg: T;
}

export type CommandHandler = (data: any) => void;

export class MessageBridge {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<CommandHandler>>();
  private isConnected: Promise<boolean> | null = null;
  private resolveConnected: ((value: boolean) => void) | null = null;

  constructor(private wsUrl: string) {}

  public connect(): Promise<boolean> {
    if (this.isConnected) {
      return this.isConnected;
    }

    this.isConnected = new Promise<boolean>((resolve) => {
      this.resolveConnected = resolve;
      this.ws = new WebSocket(this.wsUrl);

      this.ws.on('open', () => {
        console.log(`✅ Connected to ${this.wsUrl}`);
        resolve(true);
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString()) as VSCodeMessage;
          this.dispatchMessage(message);
        } catch (err) {
          console.error('❌ Message parse error:', err);
        }
      });

      this.ws.on('error', (err) => {
        console.error('❌ WebSocket error:', err.message);
        resolve(false);
      });

      this.ws.on('close', () => {
        console.log('🔌 Connection closed');
        resolve(false);
      });
    });

    return this.isConnected;
  }

  private dispatchMessage(message: VSCodeMessage) {
    const command = message.command;
    const data = message.data;
    const handlers = this.handlers.get(command) || new Set();
    handlers.forEach((handler) => handler(data));
  }

  public addCommandListener(
    command: string,
    commandHandler: CommandHandler
  ): () => boolean {
    if (!this.handlers.has(command)) {
      this.handlers.set(command, new Set<CommandHandler>());
    }
    const commandHandlers = this.handlers.get(command)!;
    commandHandlers.add(commandHandler);
    return () => commandHandlers.delete(commandHandler);
  }

  private postMessage(message: VSCodeMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('❌ WebSocket is not connected');
    }
  }

  public async commandRequest<T = any>(
    command: string,
    data?: any,
    timeoutMs: number = 30000
  ): Promise<RestFulResponse<T>> {
    const _id = uuidv4();

    return new Promise<RestFulResponse>((resolve, reject) => {
      const handler = this.addCommandListener(command, (responseData: any) => {
        if (responseData._id === _id) {
          clearTimeout(timer);
          handler();
          resolve(responseData as RestFulResponse<T>);
        }
      });

      this.postMessage({
        command,
        data: { _id, ...data }
      });

      const timer = setTimeout(() => {
        handler();
        reject(new Error(`Command ${command} timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  public async close() {
    this.ws?.close();
    this.handlers.clear();
  }

  public isSocketConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export async function createMessageBridge(wsUrl: string): Promise<MessageBridge> {
  const bridge = new MessageBridge(wsUrl);
  await bridge.connect();
  return bridge;
}
