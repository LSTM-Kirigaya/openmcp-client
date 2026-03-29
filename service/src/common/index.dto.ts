import { PostMessageble } from "../hook/adapter.js";
import { McpClient } from "../mcp/client.service.js";

export type RequestClientType = McpClient | undefined;

export interface RequestData {
    clientId?: string;
    [key: string]: any;
}

export type RequestHandler<T, R> = (
    data: T & RequestData,
    webview: PostMessageble
) => Promise<R>;

export interface RequestHandlerStore<T, R> {
    handler: RequestHandler<T, R>
    option?: ControllerOption;
}

export interface MapperDescriptor<T> {
    configurable?: boolean;
    enumerable?: boolean;
    value?: RequestHandler<T, RestfulResponse>;
    writable?: boolean;
    get?(): any;
    set?(v: any): void;
}

export interface RestfulResponse {
    code: number;
    /** 简短说明；错误时为错误文案，成功且带业务数据时建议为 "ok" */
    msg: any;
    /** 与 HTTP 后端 `data` 对齐；无载荷的成功响应可省略 */
    data?: any;
}

export interface ControllerOption {
    [key: string]: any;
}