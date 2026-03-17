import axios from "axios";
import { HttpsProxyAgent } from 'https-proxy-agent';

interface FetchOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: string | Buffer | FormData | URLSearchParams | object;
    [key: string]: any;
}

interface FetchResponse {
    ok: boolean;
    status: number;
    statusText: string;
    headers: Headers;
    url: string;
    redirected: boolean;
    type: string;
    body: any;

    json(): Promise<any>;
    text(): Promise<string>;
    arrayBuffer(): Promise<ArrayBuffer>;
    getReader(): ReadableStreamDefaultReader;
}

interface ReadableStreamDefaultReader {
    read(): Promise<{ done: boolean, value?: any }>;
    cancel(): Promise<void>;
    releaseLock(): void;
    get closed(): boolean;
}

/**
 * 将 axios 配置转换为 fetch 风格的配置
 */
function adaptRequestOptions(url: string, options: FetchOptions = {}): any {
    const axiosConfig: any = {
        url,
        method: options.method || 'GET',
        headers: options.headers,
        responseType: 'stream'
    };

    // 处理 body/data 转换
    if (options.body) {
        if (typeof options.body === 'string' || Buffer.isBuffer(options.body)) {
            axiosConfig.data = options.body;
        } else if (typeof options.body === 'object') {
            // 如果是 FormData、URLSearchParams 等特殊类型需要特殊处理
            if (options.body instanceof FormData) {
                axiosConfig.data = options.body;
                axiosConfig.headers = {
                    ...axiosConfig.headers,
                    'Content-Type': 'multipart/form-data'
                };
            } else if (options.body instanceof URLSearchParams) {
                axiosConfig.data = options.body.toString();
                axiosConfig.headers = {
                    ...axiosConfig.headers,
                    'Content-Type': 'application/x-www-form-urlencoded'
                };
            } else {
                // 普通 JSON 对象
                axiosConfig.data = JSON.stringify(options.body);
                axiosConfig.headers = {
                    ...axiosConfig.headers,
                    'Content-Type': 'application/json'
                };
            }
        }
    }

    return axiosConfig;
}

/**
 * 将 axios 响应转换为 fetch 风格的 Response 对象
 */
function adaptResponse(axiosResponse: FetchOptions): FetchResponse {
    // 创建 Headers 对象
    const headers = new Headers();
    Object.entries(axiosResponse.headers || {}).forEach(([key, value]) => {
        headers.append(key, value);
    });

    // 创建符合 Fetch API 的 Response 对象
    const fetchResponse = {
        ok: axiosResponse.status >= 200 && axiosResponse.status < 300,
        status: axiosResponse.status,
        statusText: axiosResponse.statusText,
        headers: headers,
        url: axiosResponse.config.url,
        redirected: false, // axios 不直接提供此信息
        type: 'basic', // 简单类型
        body: null,

        // 标准方法
        json: async () => {
            if (typeof axiosResponse.data === 'object') {
                return axiosResponse.data;
            }
            throw new Error('Response is not JSON');
        },
        text: async () => {
            if (typeof axiosResponse.data === 'string') {
                return axiosResponse.data;
            }
            return JSON.stringify(axiosResponse.data);
        },
        arrayBuffer: async () => {
            throw new Error('arrayBuffer not implemented for streaming');
        },

        // 流式支持
        getReader: () => {
            if (!axiosResponse.data.on || typeof axiosResponse.data.on !== 'function') {
                throw new Error('Not a stream response');
            }

            // 将 Node.js 流转换为 Web Streams 的 ReadableStream
            const nodeStream = axiosResponse.data;
            let isCancelled = false;

            return {
                read: () => {
                    if (isCancelled) {
                        return Promise.resolve({ done: true });
                    }

                    return new Promise((resolve, reject) => {
                        const onData = (chunk: any) => {
                            cleanup();
                            resolve({ done: false, value: chunk });
                        };

                        const onEnd = () => {
                            cleanup();
                            resolve({ done: true });
                        };

                        const onError = (err: Error) => {
                            cleanup();
                            reject(err);
                        };

                        const cleanup = () => {
                            nodeStream.off('data', onData);
                            nodeStream.off('end', onEnd);
                            nodeStream.off('error', onError);
                        };

                        nodeStream.once('data', onData);
                        nodeStream.once('end', onEnd);
                        nodeStream.once('error', onError);
                    });
                },

                cancel: () => {
                    isCancelled = true;
                    nodeStream.destroy();
                    return Promise.resolve();
                },

                releaseLock: () => {
                    // TODO: 实现 releaseLock 方法
                },

                get closed() {
                    return isCancelled;
                }
            };
        }
    } as FetchResponse;

    // 设置 body 为可读流
    if (axiosResponse.data.on && typeof axiosResponse.data.on === 'function') {
        fetchResponse.body = {
            getReader: fetchResponse.getReader
        };
    }

    return fetchResponse;
}

/**
 * @description 主函数 - 用 axios 实现 fetch
 */
export async function axiosFetch(input: any, init: any, requestOption: { proxyServer?: string } = {}): Promise<any> {
    const axiosConfig = adaptRequestOptions(input, init);

    const {
        proxyServer = ''
    } = requestOption;

    if (proxyServer) {
        const proxyAgent = new HttpsProxyAgent(proxyServer);
        axiosConfig.httpsAgent = proxyAgent;
        axiosConfig.httpAgent = proxyAgent;
    }

    try {
        const response = await axios(axiosConfig) as FetchOptions;
        return adaptResponse(response);
    } catch (error: any) {
        if (error.response) {
            return adaptResponse(error.response);
        }
        throw error;
    }
}