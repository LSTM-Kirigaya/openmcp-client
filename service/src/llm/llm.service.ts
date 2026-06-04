import { PostMessageble } from "../hook/adapter.js";
import { OpenAI } from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { MyMessageType, MyToolMessageType } from "./llm.dto.js";
import { RestfulResponse } from "../common/index.dto.js";
import { ocrDB } from "../hook/db.js";
import type { ToolCallContent } from "../mcp/client.dto.js";
import { ocrWorkerStorage } from "../mcp/ocr.service.js";
import { z } from "zod";

// ========== Anthropic Protocol Adapters ==========

function convertOpenAIMessagesToAnthropic(messages: any[]): { system?: string; messages: any[] } {
    const systemParts: string[] = [];
    const anthropicMessages: any[] = [];

    for (const msg of messages) {
        if (msg.role === 'system') {
            systemParts.push(msg.content);
            continue;
        }

        if (msg.role === 'tool') {
            anthropicMessages.push({
                role: 'user',
                content: [{
                    type: 'tool_result',
                    tool_use_id: msg.tool_call_id,
                    content: msg.content
                }]
            });
            continue;
        }

        if (msg.role === 'assistant') {
            const content: any[] = [];

            if (msg.reasoning_content) {
                content.push({
                    type: 'thinking',
                    thinking: msg.reasoning_content,
                });
            }

            if (msg.content) {
                content.push({ type: 'text', text: msg.content });
            }

            if (msg.tool_calls?.length) {
                for (const tc of msg.tool_calls) {
                    content.push({
                        type: 'tool_use',
                        id: tc.id,
                        name: tc.function.name,
                        input: (() => {
                            try {
                                return JSON.parse(tc.function.arguments || '{}');
                            } catch {
                                return {};
                            }
                        })()
                    });
                }
            }

            anthropicMessages.push({ role: 'assistant', content: content.length > 0 ? content : '' });
            continue;
        }

        anthropicMessages.push({ role: msg.role, content: msg.content });
    }

    return {
        system: systemParts.join('\n\n') || undefined,
        messages: anthropicMessages
    };
}

function convertOpenAIToolsToAnthropic(tools: any[]): any[] {
    return tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters
    }));
}

async function* anthropicStreamToOpenAIChunks(
    stream: any,
    sessionId: string
): AsyncGenerator<any> {
    let promptTokens = 0;
    let nextToolCallIndex = 0;
    const toolCallState = new Map<number, { id: string; name: string; arguments: string; toolCallIndex: number }>();
    let thinkingContent = '';

    for await (const event of stream) {
        console.log('[LLM Anthropic] event type:', event.type, 'sessionId:', sessionId);
        switch (event.type) {
            case 'message_stop': {
                break;
            }

            case 'message_start': {
                promptTokens = event.message?.usage?.input_tokens || 0;
                break;
            }

            case 'content_block_start': {
                if (event.content_block?.type === 'thinking') {
                    thinkingContent = '';
                } else if (event.content_block?.type === 'tool_use') {
                    const toolCallIndex = nextToolCallIndex++;
                    toolCallState.set(event.index, {
                        id: event.content_block.id,
                        name: event.content_block.name,
                        arguments: '',
                        toolCallIndex
                    });
                    yield {
                        id: sessionId,
                        object: 'chat.completion.chunk',
                        choices: [{
                            index: 0,
                            delta: {
                                tool_calls: [{
                                    index: toolCallIndex,
                                    id: event.content_block.id,
                                    type: 'function',
                                    function: {
                                        name: event.content_block.name,
                                        arguments: ''
                                    }
                                }]
                            }
                        }]
                    };
                }
                break;
            }

            case 'content_block_delta': {
                if (event.delta?.type === 'text_delta') {
                    yield {
                        id: sessionId,
                        object: 'chat.completion.chunk',
                        choices: [{
                            index: 0,
                            delta: {
                                content: event.delta.text
                            }
                        }]
                    };
                } else if (event.delta?.type === 'thinking_delta') {
                    thinkingContent += event.delta.thinking || '';
                    yield {
                        id: sessionId,
                        object: 'chat.completion.chunk',
                        choices: [{
                            index: 0,
                            delta: {
                                reasoning_content: event.delta.thinking
                            }
                        }]
                    };
                } else if (event.delta?.type === 'input_json_delta') {
                    const state = toolCallState.get(event.index);
                    if (state) {
                        state.arguments += event.delta.partial_json;
                        yield {
                            id: sessionId,
                            object: 'chat.completion.chunk',
                            choices: [{
                                index: 0,
                                delta: {
                                    tool_calls: [{
                                        index: state.toolCallIndex,
                                        function: {
                                            arguments: event.delta.partial_json
                                        }
                                    }]
                                }
                            }]
                        };
                    }
                }
                break;
            }

            case 'content_block_stop': {
                const state = toolCallState.get(event.index);
                if (state && state.arguments === '') {
                    state.arguments = '{}';
                    yield {
                        id: sessionId,
                        object: 'chat.completion.chunk',
                        choices: [{
                            index: 0,
                            delta: {
                                tool_calls: [{
                                    index: state.toolCallIndex,
                                    function: {
                                        arguments: '{}'
                                    }
                                }]
                            }
                        }]
                    };
                }
                break;
            }

            case 'message_delta': {
                const outputTokens = event.usage?.output_tokens || 0;
                if (outputTokens > 0) {
                    yield {
                        id: sessionId,
                        object: 'chat.completion.chunk',
                        choices: [{
                            index: 0,
                            delta: {},
                            usage: {
                                prompt_tokens: promptTokens,
                                completion_tokens: outputTokens,
                                total_tokens: promptTokens + outputTokens
                            }
                        }]
                    };
                }
                break;
            }
        }
    }
}

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
        tools?: any[];
        response_format?: any;
        useAnthropicProtocol?: boolean;
    }
): Promise<{ content: string; usage?: ChatCompletionUsage; reasoning_content?: string; tool_calls?: any[] }> {
    const {
        baseURL,
        apiKey,
        model,
        messages,
        temperature = 0,
        tools,
        response_format,
        useAnthropicProtocol
    } = data;

    console.log('[chatCompletion] START model=', model, 'baseURL=', baseURL, 'msgCount=', messages.length, 'anthropic=', useAnthropicProtocol);

    if (useAnthropicProtocol) {
        const { system, messages: anthropicMessages } = convertOpenAIMessagesToAnthropic(messages);
        const anthropicTools = tools?.length ? convertOpenAIToolsToAnthropic(tools) : undefined;

        const client = new Anthropic({
            baseURL,
            authToken: apiKey,
            timeout: 60000,
        });

        const createParams: any = {
            model,
            max_tokens: 4096,
            system,
            messages: anthropicMessages,
            temperature,
        };
        if (anthropicTools && anthropicTools.length > 0) {
            createParams.tools = anthropicTools;
        }

        console.log('[chatCompletion] Anthropic request BEGIN');
        const response = await client.messages.create(createParams);
        console.log('[chatCompletion] Anthropic request DONE');

        const textBlocks = (response.content || []).filter((c: any) => c.type === 'text');
        const text = textBlocks.map((c: any) => c.text).join('');

        const thinkingBlocks = (response.content || []).filter((c: any) => c.type === 'thinking');
        const reasoningContent = thinkingBlocks.map((c: any) => c.thinking).join('');

        const toolUseBlocks = (response.content || []).filter((c: any) => c.type === 'tool_use');
        const toolCalls = toolUseBlocks.map((c: any, index: number) => ({
            id: c.id,
            index,
            type: 'function',
            function: {
                name: c.name,
                arguments: JSON.stringify(c.input || {})
            }
        }));

        const usage = response.usage
            ? {
                prompt_tokens: response.usage.input_tokens ?? 0,
                completion_tokens: response.usage.output_tokens ?? 0,
                total_tokens: (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0)
            }
            : undefined;

        return {
            content: text,
            usage,
            reasoning_content: reasoningContent || undefined,
            tool_calls: toolCalls.length > 0 ? toolCalls : undefined
        };
    }

    const defaultHeaders: Record<string, string> = {};
    if (baseURL && baseURL.includes('openrouter.ai')) {
        defaultHeaders['HTTP-Referer'] = 'https://github.com/openmcp/openmcp-client';
        defaultHeaders['X-Title'] = 'OpenMCP Client';
    }

    const client = new OpenAI({
        baseURL,
        apiKey,
        defaultHeaders: Object.keys(defaultHeaders).length > 0 ? defaultHeaders : undefined,
        timeout: 60000,
    });

    if (!model || model.trim() === '') {
        throw new Error('Model name is empty. Please configure a valid model in settings.');
    }

    const createParams: any = {
        model,
        messages,
        temperature,
        stream: false,
    };
    if (tools && tools.length > 0) {
        createParams.tools = tools;
    }
    if (response_format) {
        createParams.response_format = response_format;
    }

    console.log('[chatCompletion] OpenAI request BEGIN model=', model);
    const response = await client.chat.completions.create(createParams);
    console.log('[chatCompletion] OpenAI request DONE');

    const content = response.choices?.[0]?.message?.content;
    const text = typeof content === 'string' ? content : '';
    const usage = response.usage
        ? {
            prompt_tokens: response.usage.prompt_tokens ?? 0,
            completion_tokens: response.usage.completion_tokens ?? 0,
            total_tokens: response.usage.total_tokens
        }
        : undefined;
    const toolCalls = response.choices?.[0]?.message?.tool_calls;
    console.log('[chatCompletion] RETURN contentLength=', text.length, 'usage=', usage);
    return { content: text, usage, tool_calls: toolCalls };
}

/**
 * 将 JSON Schema 转换为 Zod Schema（轻量递归实现）
 */
export function jsonSchemaToZod(schema: any): z.ZodTypeAny {
    if (!schema || typeof schema !== 'object') {
        return z.any();
    }

    // 处理 anyOf / oneOf：取第一个非 null 的类型
    if (schema.anyOf && Array.isArray(schema.anyOf)) {
        const nonNull = schema.anyOf.find((s: any) => s?.type !== 'null');
        if (nonNull) {
            return jsonSchemaToZod(nonNull);
        }
        return z.any();
    }

    // 处理 type 为数组的情况，如 ["object", "null"]
    if (Array.isArray(schema.type)) {
        const nonNullType = schema.type.find((t: any) => t !== 'null');
        if (nonNullType) {
            return jsonSchemaToZod({ ...schema, type: nonNullType });
        }
        return z.any();
    }

    switch (schema.type) {
        case 'object': {
            const shape: Record<string, z.ZodTypeAny> = {};
            for (const [key, prop] of Object.entries(schema.properties || {})) {
                shape[key] = jsonSchemaToZod(prop);
            }
            let objSchema = z.object(shape);
            if (schema.required && Array.isArray(schema.required)) {
                // z.object 默认所有 key 都是 required，不需要额外处理
            }
            return objSchema;
        }
        case 'string': {
            if (schema.enum && Array.isArray(schema.enum)) {
                return z.enum(schema.enum as [string, ...string[]]);
            }
            return z.string();
        }
        case 'number':
        case 'integer':
            return z.number();
        case 'boolean':
            return z.boolean();
        case 'array': {
            const itemSchema = schema.items ? jsonSchemaToZod(schema.items) : z.any();
            return z.array(itemSchema);
        }
        default:
            return z.any();
    }
}

/**
 * 从 LLM 响应文本中提取 JSON（支持 markdown code block）
 */
function extractJsonFromContent(content: string): any {
    const trimmed = content.trim();
    // 尝试匹配 markdown code block
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonText = codeBlockMatch ? codeBlockMatch[1].trim() : trimmed;
    return JSON.parse(jsonText);
}

/**
 * 结构化聊天补全（instructor-js 风格的轻量实现）
 * 通过 prompt 注入 schema 描述 + zod 验证 + 自动重试，实现最大兼容性
 */
export async function chatCompletionStructured<T extends z.ZodTypeAny>(
    data: {
        baseURL: string;
        apiKey: string;
        model: string;
        messages: any[];
        temperature?: number;
        schema: T;
        name: string;
        maxRetries?: number;
        useAnthropicProtocol?: boolean;
    }
): Promise<{ data: z.infer<T>; usage?: ChatCompletionUsage }> {
    const {
        baseURL,
        apiKey,
        model,
        temperature = 0.6,
        schema,
        name,
        maxRetries = 3,
        useAnthropicProtocol
    } = data;

    // 构建 schema 描述 prompt
    const schemaDescription = JSON.stringify(
        schema instanceof z.ZodObject ? (schema as any).shape : schema,
        null,
        2
    );

    const systemPrompt = `You are a structured data generator. You must output a valid JSON object inside a markdown code block.

The JSON must strictly conform to the following schema for "${name}":
${schemaDescription}

Rules:
1. Output ONLY a JSON object inside \`\`\`json ... \`\`\` block.
2. Do not include any explanation, comments, or extra text outside the code block.
3. All required fields must be present and have valid types.`;

    const messages = [
        { role: 'system', content: systemPrompt },
        ...data.messages
    ];

    let lastError = '';
    let totalUsage: ChatCompletionUsage | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const currentMessages = attempt > 0 && lastError
            ? [
                ...messages,
                { role: 'assistant', content: lastError },
                { role: 'user', content: `Your previous output was invalid. Please fix the errors and output a valid JSON object inside \`\`\`json ... \`\`\` block. Errors: ${lastError}` }
            ]
            : messages;

        const result = await chatCompletion({
            baseURL,
            apiKey,
            model,
            messages: currentMessages,
            temperature,
            useAnthropicProtocol
        });

        if (totalUsage && result.usage) {
            totalUsage.prompt_tokens += result.usage.prompt_tokens;
            totalUsage.completion_tokens += result.usage.completion_tokens;
            if (result.usage.total_tokens) {
                totalUsage.total_tokens = (totalUsage.total_tokens || 0) + result.usage.total_tokens;
            }
        } else if (result.usage) {
            totalUsage = result.usage;
        }

        try {
            const parsed = extractJsonFromContent(result.content);
            const validated = schema.parse(parsed);
            return { data: validated, usage: totalUsage };
        } catch (e) {
            lastError = e instanceof Error ? e.message : String(e);
            console.warn(`Structured completion attempt ${attempt + 1} failed:`, lastError, 'Content:', result.content);
        }
    }

    throw new Error(`Failed to generate valid structured output after ${maxRetries} attempts. Last error: ${lastError}`);
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
        proxyServer = '',
        useAnthropicProtocol = false
    } = data;

    await postProcessMessages(messages);

    if (useAnthropicProtocol) {
        const { system, messages: anthropicMessages } = convertOpenAIMessagesToAnthropic(messages);
        const anthropicTools = tools?.length ? convertOpenAIToolsToAnthropic(tools) : undefined;

        const client = new Anthropic({
            baseURL,
            authToken: apiKey,
            timeout: 120000,
        });

        if (!model || model.trim() === '') {
            throw new Error('Model name is empty. Please configure a valid model in settings.');
        }

        const createParams: any = {
            model,
            max_tokens: 4096,
            system,
            messages: anthropicMessages,
            temperature,
            stream: true
        };
        if (anthropicTools && anthropicTools.length > 0) {
            createParams.tools = anthropicTools;
        }

        const stream = client.messages.stream(createParams);

        // 用 sessionId 作为 key 存储一个可 abort 的控制器
        const abortController = new AbortController();
        if (sessionId) {
            chatStreams.set(sessionId, {
                [Symbol.asyncIterator]: () => stream[Symbol.asyncIterator](),
                controller: {
                    abort: () => {
                        abortController.abort();
                        stream.abort();
                    }
                }
            } as any);
        }

        let lastChunkTime = Date.now();
        const STREAM_IDLE_TIMEOUT_MS = 30000;

        try {
            for await (const chunk of anthropicStreamToOpenAIChunks(stream, sessionId)) {
                if (!chatStreams.has(sessionId)) {
                    stream.abort();
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
                    return;
                }

                if (Date.now() - lastChunkTime > STREAM_IDLE_TIMEOUT_MS) {
                    console.warn(`[LLM] Anthropic stream idle timeout for sessionId=${sessionId}`);
                    stream.abort();
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
                    if (sessionId) chatStreams.delete(sessionId);
                    return;
                }
                lastChunkTime = Date.now();

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
        } catch (error) {
            if (abortController.signal.aborted) {
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
                if (sessionId) {
                    chatStreams.delete(sessionId);
                }
                return;
            }
            throw error;
        }

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
        return;
    }

    // 构建OpenRouter特定的请求头
    const defaultHeaders: Record<string, string> = {};
    if (baseURL && baseURL.includes('openrouter.ai')) {
        defaultHeaders['HTTP-Referer'] = 'https://github.com/openmcp/openmcp-client';
        defaultHeaders['X-Title'] = 'OpenMCP Client';
    }

    const client = new OpenAI({
        baseURL,
        apiKey,
        defaultHeaders: Object.keys(defaultHeaders).length > 0 ? defaultHeaders : undefined,
        timeout: 120000,
    });

    if (!model || model.trim() === '') {
        throw new Error('Model name is empty. Please configure a valid model in settings.');
    }

    const seriableTools = (tools.length === 0) ? undefined : tools;
    const seriableParallelToolCalls = (tools.length === 0) ?
        undefined : model.startsWith('gemini') ? undefined : parallelToolCalls;

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
    let lastChunkTime = Date.now();
    const STREAM_IDLE_TIMEOUT_MS = 30000;

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

        if (Date.now() - lastChunkTime > STREAM_IDLE_TIMEOUT_MS) {
            console.warn(`[LLM] OpenAI stream idle timeout for sessionId=${sessionId}`);
            stream.controller.abort();
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
            break;
        }
        lastChunkTime = Date.now();

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