import { PostMessageble } from "../hook/adapter.js";
import { OpenAI } from "openai";
import { MyMessageType, MyToolMessageType } from "./llm.dto.js";
import { RestfulResponse } from "../common/index.dto.js";
import { ocrDB } from "../hook/db.js";
import type { ToolCallContent } from "../mcp/client.dto.js";
import { ocrWorkerStorage } from "../mcp/ocr.service.js";

// 用 Map<string, AsyncIterable<any> | null> 管理多个流
export const chatStreams = new Map<string, AsyncIterable<any>>();

export interface ChatCompletionUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens?: number;
}

/**
 * 非流式聊天补全，用于批量验证等需要完整响应的场景
 */
export async function chatCompletion(
    data: {
        baseURL: string;
        apiKey: string;
        model: string;
        messages: any[];
        temperature?: number;
    }
): Promise<{ content: string; usage?: ChatCompletionUsage }> {
    const {
        baseURL,
        apiKey,
        model,
        messages,
        temperature = 0
    } = data;

    const defaultHeaders: Record<string, string> = {};
    if (baseURL && baseURL.includes('openrouter.ai')) {
        defaultHeaders['HTTP-Referer'] = 'https://github.com/openmcp/openmcp-client';
        defaultHeaders['X-Title'] = 'OpenMCP Client';
    }

    const client = new OpenAI({
        baseURL,
        apiKey,
        defaultHeaders: Object.keys(defaultHeaders).length > 0 ? defaultHeaders : undefined
    });

    const response = await client.chat.completions.create({
        model,
        messages,
        temperature,
        stream: false
    });

    const content = response.choices?.[0]?.message?.content;
    const text = typeof content === 'string' ? content : '';
    const usage = response.usage
        ? {
            prompt_tokens: response.usage.prompt_tokens ?? 0,
            completion_tokens: response.usage.completion_tokens ?? 0,
            total_tokens: response.usage.total_tokens
        }
        : undefined;
    return { content: text, usage };
}

export async function streamingChatCompletion(
    data: any,
    webview: PostMessageble
) {
    const {
        sessionId,
        baseURL,
        apiKey,
        model,
        messages,
        temperature,
        tools = [],
        parallelToolCalls = true,
        proxyServer = ''
    } = data;


    // 构建OpenRouter特定的请求头
    const defaultHeaders: Record<string, string> = {};
    if (baseURL && baseURL.includes('openrouter.ai')) {
        defaultHeaders['HTTP-Referer'] = 'https://github.com/openmcp/openmcp-client';
        defaultHeaders['X-Title'] = 'OpenMCP Client';
    }

    const client = new OpenAI({
        baseURL,
        apiKey,
        defaultHeaders: Object.keys(defaultHeaders).length > 0 ? defaultHeaders : undefined
    });

    const seriableTools = (tools.length === 0) ? undefined : tools;
    const seriableParallelToolCalls = (tools.length === 0) ?
        undefined : model.startsWith('gemini') ? undefined : parallelToolCalls;

    await postProcessMessages(messages);

    const stream = await client.chat.completions.create({
        model,
        messages,
        temperature,
        tools: seriableTools,
        parallel_tool_calls: seriableParallelToolCalls,
        stream: true
    });

    // 用 sessionId 作为 key 存储流
    if (sessionId) {
        chatStreams.set(sessionId, stream);
    }

    // 流式传输结果
    for await (const chunk of stream) {        
        if (!chatStreams.has(sessionId)) {            
            // 如果流被中止，则停止循环
            stream.controller.abort();
            webview.postMessage({
                command: 'llm/chat/completions/done',
                data: {
                    sessionId,
                    code: 200,
                    msg: {
                        success: true,
                        stage: 'abort'
                    }
                }
            });
            break;
        }

        if (chunk.choices) {
            webview.postMessage({
                command: 'llm/chat/completions/chunk',
                data: {
                    sessionId,
                    code: 200,
                    msg: {
                        chunk
                    }
                }
            });
        }
    }

    // console.log('sessionId finish ' + sessionId);

    // 传输结束，移除对应的 stream
    if (sessionId) {
        chatStreams.delete(sessionId);
    }
    webview.postMessage({
        command: 'llm/chat/completions/done',
        data: {
            sessionId,
            code: 200,
            msg: {
                success: true,
                stage: 'done'
            }
        }
    });
}


// 处理中止消息的函数
export function abortMessageService(data: any, webview: PostMessageble): RestfulResponse {
    const sessionId = data?.sessionId;
    if (sessionId) {
        chatStreams.delete(sessionId);
    }

    return {
        code: 200,
        msg: {
            success: true
        }
    }
}

async function postProcessToolMessages(message: MyToolMessageType) {
    if (typeof message.content === 'string') {
        return;
    }

    for (const content of message.content) {
        const contentType = content.type as string;
        const rawContent = content as ToolCallContent;

        if (contentType === 'image') {
            rawContent.type = 'text';

            // 此时图片只会存在三个状态
            // 1. 图片在 ocrDB 中
            // 2. 图片的 OCR 仍然在进行中
            // 3. 图片已被删除


            // rawContent.data 就是 filename
            const result = await ocrDB.findById(rawContent.data);
            if (result) {
                rawContent.text = result.text || '';
            } else if (rawContent._meta) {
                const workerId = rawContent._meta.workerId;
                const worker = ocrWorkerStorage.get(workerId);
                if (worker) {
                    const text = await worker.fut;
                    rawContent.text = text;
                }
            } else {
                rawContent.text = '无效的图片';
            }

            delete rawContent._meta;
        }
    }

    message.content = JSON.stringify(message.content);
}

export async function postProcessMessages(messages: MyMessageType[]) {
    for (const message of messages) {
        // 去除 extraInfo 属性
        delete message.extraInfo;

        switch (message.role) {
            case 'user':

                break;

            case 'assistant':

                break;

            case 'system':

                break;

            case 'tool':
                await postProcessToolMessages(message);
                break;
            default:
                break;
        }
    }
}