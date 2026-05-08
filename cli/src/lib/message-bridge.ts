import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { buildGatewayUnreachableError } from './gateway-errors.js';
import { appendRpcHistory } from './rpc-history.js';

export interface VSCodeMessage {
  command: string;
  data?: unknown;
  callbackId?: string;
}

export interface RestFulResponse<T = any> {
  _id?: string;
  code: number;
  msg: T;
  /** 业务载荷（云/Auth 等成功响应）；与 HTTP API 的 data 一致 */
  data?: unknown;
}

export type CommandHandler = (data: any) => void;

function isVerboseConnectionLogEnabled(): boolean {
  const value = (process.env.OPENMCP_CLI_VERBOSE || '').toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

export class MessageBridge {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<CommandHandler>>();
  private isConnected: Promise<boolean> | null = null;
  /** 是否曾成功 open（用于区分「从未连上」与「用后断开」） */
  private socketEverOpened = false;
  /** 首次连接失败时底层错误信息 */
  private connectErrorDetail: string | undefined;

  constructor(private wsUrl: string) {}

  public getConnectErrorDetail(): string | undefined {
    return this.connectErrorDetail;
  }

  public connect(): Promise<boolean> {
    if (this.isConnected) {
      return this.isConnected;
    }

    this.isConnected = new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (value: boolean) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(value);
      };

      this.ws = new WebSocket(this.wsUrl);

      this.ws.on('open', () => {
        this.socketEverOpened = true;
        if (isVerboseConnectionLogEnabled()) {
          console.error(`✅ Connected to ${this.wsUrl}`);
        }
        finish(true);
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString()) as VSCodeMessage;
          this.dispatchMessage(message);
        } catch (err) {
          console.error('❌ Message parse error:', err);
        }
      });

      this.ws.on('error', (err: Error & { code?: string }) => {
        const detail =
          err?.message ||
          (err as { code?: string })?.code ||
          String(err) ||
          '连接被拒绝或网络不可达';
        this.connectErrorDetail = detail;
        if (this.socketEverOpened) {
          console.error('❌ WebSocket error:', detail);
        }
        finish(false);
      });

      this.ws.on('close', () => {
        if (this.socketEverOpened && isVerboseConnectionLogEnabled()) {
          console.error('🔌 Connection closed');
        }
        finish(false);
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

  public postMessage(message: VSCodeMessage) {
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
    const startedAt = Date.now();
    const requestPayload = (data && typeof data === 'object') ? { ...data } : {};

    return new Promise<RestFulResponse>((resolve, reject) => {
      const handler = this.addCommandListener(command, (responseData: any) => {
        if (responseData._id === _id) {
          clearTimeout(timer);
          handler();
          appendRpcHistory({
            gateway: this.wsUrl,
            command,
            request: requestPayload,
            durationMs: Date.now() - startedAt,
            ok: responseData?.code === 200,
            response: {
              code: Number(responseData?.code ?? 500),
              msg: responseData?.msg,
              data: responseData?.data
            }
          });
          resolve(responseData as RestFulResponse<T>);
        }
      });

      this.postMessage({
        command,
        data: { ...data, _id }
      });

      const timer = setTimeout(() => {
        handler();
        appendRpcHistory({
          gateway: this.wsUrl,
          command,
          request: requestPayload,
          durationMs: Date.now() - startedAt,
          ok: false,
          error: `Command ${command} timeout after ${timeoutMs}ms`
        });
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
  const ok = await bridge.connect();
  if (!ok) {
    throw buildGatewayUnreachableError(wsUrl, bridge.getConnectErrorDetail());
  }
  return bridge;
}
