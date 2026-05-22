/* eslint-disable */
import { ref, type Ref } from "vue";
import { type ToolCall, type ChatStorage, getToolSchema, MessageState, type ChatMessage, type ChatSetting, type EnableToolItem, richContentToPlainText } from "../chat-box/chat";
import { useMessageBridge, MessageBridge, createMessageBridge } from "@/api/message-bridge";
import type { OpenAI } from 'openai';
import { llmManager, llms, type BasicLlmDescription } from "@/views/setting/llm";
import { redLog } from "@/views/setting/util";
import { ElMessage } from "element-plus";
import { getToolCallIndexAdapter, handleToolCalls, type IToolCallIndex, type ToolCallResult } from "./handle-tool-calls";
import { ENTER_PLAN_MODE_TOOL, EXIT_PLAN_MODE_TOOL, PLAN_MODE_SYSTEM_PROMPT, ASK_USER_QUESTION_TOOL } from "@/api/plan-mode";
import { getPlatform } from "@/api/platform";
import { getSystemPrompt } from "../chat-box/options/system-prompt";
import { mcpSetting } from "@/hook/mcp";
import { loadSkillContent, READ_SKILL_FILE_TOOL } from "@/api/skill";
import { mcpClientAdapter } from "@/views/connect/core";
import type { ToolItem } from "@/hook/type";

import { getXmlWrapperPrompt, getToolCallFromXmlString, getXmlsFromString, handleXmlWrapperToolcall, toNormaliseToolcall, getXmlResultPrompt } from "./xml-wrapper";
import { OmFeedback } from "./feedback";
import { v4 as uuidv4 } from 'uuid';
import type { TokenConsumptionResult } from "./usage";

export type ChatCompletionChunk = OpenAI.Chat.Completions.ChatCompletionChunk;
export interface TaskLoopChatOption {
    id?: string
    sessionId: string;
    proxyServer?: string
    enableXmlWrapper?: boolean
}
export type ChatCompletionCreateParamsBase = OpenAI.Chat.Completions.ChatCompletionCreateParams & TaskLoopChatOption;
export interface TaskLoopOptions {
    maxEpochs?: number;
    maxJsonParseRetry?: number;
    adapter?: any;
    verbose?: 0 | 1 | 2 | 3;
}

export interface IErrorMssage {
    state: MessageState,
    msg: string
}

export { MessageState };

export interface IDoConversationResult {
    stop: boolean;
}

interface CallbackHandler<T> {
    id: string;
    callback: T;
}

/**
 * @description 对任务循环进行的抽象封装
 */
export class TaskLoop {
    private bridge: MessageBridge;
    private streamingContent: Ref<string>;
    private streamingToolCalls: Ref<ToolCall[]>;
    /** DeepSeek thinking 模式的推理内容流，多轮 tool calls 时需回传 */
    private streamingReasoningContent: Ref<string>;
    private aborted = false;

    private currentChatId = '';
    private onError: CallbackHandler<(error: IErrorMssage) => void>[] = [];
    private onChunk: CallbackHandler<(chunk: ChatCompletionChunk) => void>[] = [];
    private onDone: CallbackHandler<() => void>[] = [];
    private onToolCall: CallbackHandler<(toolCall: ToolCall) => ToolCall>[] = [];
    private onToolCalled: CallbackHandler<(toolCallResult: ToolCallResult) => ToolCallResult>[] = [];
    private onEpoch: CallbackHandler<() => void>[] = [];
    private onTokenConsumption: CallbackHandler<(consumption: TokenConsumptionResult) => void>[] = [];
    private completionUsage?: ChatCompletionChunk['usage'];
    private llmConfig?: BasicLlmDescription;
    private feedback;

    // 只会在 nodejs 环境下使用的部分变量
    private nodejsStatus = {
        connectionFut: new Promise<void>(resolve => resolve(void 0))
    };

    constructor(
        private taskOptions: TaskLoopOptions = {
            maxEpochs: 50,
            maxJsonParseRetry: 3,
            adapter: undefined,
            verbose: 0
        },
    ) {
        this.streamingContent = ref('');
        this.streamingToolCalls = ref([]);
        this.streamingReasoningContent = ref('');

        // 根据当前环境决定是否要开启 messageBridge
        const platform = getPlatform();

        if (platform === 'nodejs') {
            const adapter = taskOptions.adapter;

            if (!adapter) {
                throw new Error('adapter is required');
            }

            // 根据 adapter 创建 nodejs 下特殊的、基于 event 的 message bridge （不占用任何端口）
            createMessageBridge(adapter.emitter);

            // 用于进行连接同步
            this.nodejsStatus.connectionFut = mcpClientAdapter.launch();
        }

        // web 环境下 bridge 会自动加载完成
        this.bridge = useMessageBridge();

        // 注册 HMR
        mcpClientAdapter.addConnectRefreshListener();

        // 注册回流系统
        this.feedback = new OmFeedback(taskOptions.verbose || 0);
    }

    public async waitConnection() {
        await this.nodejsStatus.connectionFut;
    }

    public setTaskLoopOptions(taskOptions: TaskLoopOptions) {
        const {
            maxEpochs = 50,
            maxJsonParseRetry = 3,
            verbose = 1,
        } = taskOptions;

        this.taskOptions = {
            maxEpochs,
            maxJsonParseRetry,
            verbose,
            ...this.taskOptions
        };
    }

    /**
     * @description 处理 streaming 输出的每一个分块的 content 和 reasoning_content 部分
     * reasoning_content 为 DeepSeek thinking 模式字段，多轮 tool calls 时必须回传
     * @param chunk 
     * @param chatData 
     */
    private handleChunkDeltaContent(chunk: ChatCompletionChunk, chatData: ChatCompletionCreateParamsBase) {
        const delta = chunk.choices[0]?.delta;
        const content = delta?.content || '';
        if (content) {
            this.streamingContent.value += content;
        }
        // DeepSeek thinking 模式：累积 reasoning_content
        const reasoningContent = (delta as { reasoning_content?: string })?.reasoning_content || '';
        if (reasoningContent) {
            this.streamingReasoningContent.value += reasoningContent;
        }
    }

    /**
     * @description 处理 streaming 输出的每一个 chunk 的 tool_calls 部分
     * @param chunk 
     * @param chatData 
     * @param toolcallIndexAdapter 
     */
    private handleChunkDeltaToolCalls(chunk: ChatCompletionChunk, chatData: ChatCompletionCreateParamsBase, toolcallIndexAdapter: (toolCall: ToolCall) => IToolCallIndex) {
        const toolCall = chunk.choices[0]?.delta?.tool_calls?.[0];

        if (toolCall) {
            if (toolCall.index === undefined || toolCall.index === null) {
                console.warn('tool_call.index is undefined or null, 使用默认索引 0');
                // 如果 index 未定义，使用默认值 0
                toolCall.index = 0;
            }

            const index = toolcallIndexAdapter(toolCall);
            const currentCall = this.streamingToolCalls.value[index];

            if (currentCall === undefined) {
                // 新的工具调用开始
                this.streamingToolCalls.value[index] = {
                    id: toolCall.id,
                    index,
                    type: 'function',
                    function: {
                        name: toolCall.function?.name || '',
                        arguments: toolCall.function?.arguments || ''
                    }
                };
            } else {
                // 累积现有工具调用的信息
                if (currentCall) {
                    if (toolCall.id) {
                        currentCall.id = toolCall.id;
                    }
                    if (toolCall.function?.name) {
                        currentCall.function!.name = toolCall.function.name;
                    }
                    if (toolCall.function?.arguments) {
                        currentCall.function!.arguments += toolCall.function.arguments;
                    }
                }
            }

        }
    }

    private handleChunkUsage(chunk: ChatCompletionChunk) {
        const usage = chunk.usage;

        if (usage) {
            this.completionUsage = usage;
        } else {
            // 有一些模型会把 usage 放在 completion 中
            const choice = chunk.choices[0] as any;
            if (choice.usage) {
                this.completionUsage = choice.usage;
            } else {
                this.completionUsage = undefined;
            }
        }
    }

    private doConversation(chatData: ChatCompletionCreateParamsBase, toolcallIndexAdapter: (toolCall: ToolCall) => IToolCallIndex) {
        const sessionId = chatData.sessionId;

        return new Promise<IDoConversationResult>((resolve, reject) => {
            const chunkHandler = this.bridge.addCommandListener('llm/chat/completions/chunk', data => {

                if (data.sessionId !== sessionId) {
                    return;
                }

                // data.code 一定为 200，否则不会走这个 route
                const { chunk } = data.msg as { chunk: ChatCompletionChunk };

                // 处理增量的 content 和 tool_calls
                if (chatData.enableXmlWrapper) {
                    this.handleChunkDeltaContent(chunk, chatData);
                    // no tool call in enableXmlWrapper
                    this.handleChunkUsage(chunk);
                } else {
                    this.handleChunkDeltaContent(chunk, chatData);
                    this.handleChunkDeltaToolCalls(chunk, chatData, toolcallIndexAdapter);
                    this.handleChunkUsage(chunk);
                }

                this.consumeChunks(chunk);
            }, { once: false });

            const doneHandler = this.bridge.addCommandListener('llm/chat/completions/done', data => {

                if (data.sessionId !== sessionId) {
                    return;
                }

                this.consumeDones();

                chunkHandler();
                errorHandler();
                doneHandler();

                resolve({
                    stop: false
                });
            }, { once: false });

            const errorHandler = this.bridge.addCommandListener('llm/chat/completions/error', data => {
                if (data.sessionId !== sessionId) {
                    return;
                }

                const errorMsg = typeof data.msg === 'string'
                    ? data.msg
                    : (data.msg && typeof data.msg === 'object' ? JSON.stringify(data.msg) : '请求模型服务时发生错误');
                this.consumeErrors({
                    state: MessageState.ReceiveChunkError,
                    msg: errorMsg
                });

                chunkHandler();
                errorHandler();
                doneHandler();

                resolve({
                    stop: true
                });

            }, { once: false });

            this.bridge.postMessage({
                command: 'llm/chat/completions',
                data: JSON.parse(JSON.stringify(chatData)),
            });
        });
    }

    public setProxyServer(proxyServer: string) {
        mcpSetting.proxyServer = proxyServer;
    }

    public setRefluxSetting(enableDatasetReflux: boolean) {
        mcpSetting.enableDatasetReflux = enableDatasetReflux;
    }

    public setDatasetName(name: string) {
        mcpSetting.datasetName = name;
    }

    public async makeChatData(tabStorage: ChatStorage): Promise<ChatCompletionCreateParamsBase | undefined> {
        const baseURL = this.getLlmConfig().baseUrl;
        const apiKey = this.getLlmConfig().userToken || '';

        if (apiKey.trim() === '') {

            if (tabStorage.messages.length > 0 && tabStorage.messages[tabStorage.messages.length - 1].role === 'user') {
                tabStorage.messages.pop();
                ElMessage.error('请先设置 API Key');
            }
            return undefined;
        }

        const model = this.getLlmConfig().userModel;
        const temperature = tabStorage.settings.temperature;
        const parallelToolCalls = tabStorage.settings.parallelToolCalls;
        const proxyServer = mcpSetting.proxyServer || '';

        // 如果是 xml 模式，则 tools 为空
        const enableXmlWrapper = tabStorage.settings.enableXmlWrapper;
        let tools = enableXmlWrapper ? [] : getToolSchema(tabStorage.settings.enableTools);

        // 当用户设置了 skill 入口时，加载 skill 并添加 read_skill_file 工具（仅当有 skill 时才添加）
        // 支持 /skillname 手动触发：优先使用 slash 指定的 skill
        const skillOverride = (tabStorage as any)._skillOverrideForNextMessage as string | undefined;
        const skillContent = await loadSkillContent(skillOverride);
        if (skillContent) {
            tools = [...tools, READ_SKILL_FILE_TOOL];
        }

        // 添加 Plan Mode 内置工具
        const isPlanMode = tabStorage.planMode?.isPlanMode ?? false;
        if (isPlanMode) {
            // 在 plan mode 中始终提供 ExitPlanMode
            tools = [...tools, EXIT_PLAN_MODE_TOOL];
        } else {
            // 在非 plan mode 中始终提供 EnterPlanMode
            tools = [...tools, ENTER_PLAN_MODE_TOOL];
        }

        // 始终提供 AskUserQuestion
        tools = [...tools, ASK_USER_QUESTION_TOOL];

        const userMessages = [];

        // 尝试获取 system prompt，在 api 模式下，systemPrompt 就是目标提词
        // 但是在 UI 模式下，systemPrompt 只是一个 index，需要从后端数据库中获取真实 prompt

        let prompt = '';

        // 如果存在系统提示词，则从数据库中获取对应的数据
        if (tabStorage.settings.systemPrompt) {
            prompt += getSystemPrompt(tabStorage.settings.systemPrompt) || tabStorage.settings.systemPrompt;
        }

        // 如果加载了 skill，追加到 system prompt
        if (skillContent) {
            if (prompt) prompt += '\n\n---\n\n';
            prompt += `## Skill: ${skillContent.name}\n${skillContent.description ? skillContent.description + '\n\n' : ''}${skillContent.body}`;
        }

        // 如果是 xml 模式，则在开头注入 xml
        if (enableXmlWrapper) {
            prompt += getXmlWrapperPrompt(tabStorage.settings.enableTools, tabStorage);
        }

        if (prompt) {
            userMessages.push({
                role: 'system',
                content: prompt
            });
        }

        // 如果超出了 tabStorage.settings.contextLength, 则删除最早的消息
        const loadMessages = tabStorage.messages.slice(- tabStorage.settings.contextLength);
        // 预处理：只去掉 richContent/extraInfo 等渲染用字段，保留 API 要求的 role/content/tool_calls 等
        const apiMessages = loadMessages.map((m: ChatMessage) => {
            if (m.role === 'user' || m.role === 'system') {
                const textMsg = m as { content: string; richContent?: import('../chat-box/chat').RichTextItem[] };
                const content = textMsg.content || (textMsg.richContent && richContentToPlainText(textMsg.richContent)) || '';
                return { role: m.role, content };
            }
            if (m.role === 'assistant') {
                const textMsg = m as { content: string; tool_calls?: any[]; reasoning_content?: string; richContent?: import('../chat-box/chat').RichTextItem[] };
                const content = textMsg.content || (textMsg.richContent && richContentToPlainText(textMsg.richContent)) || '';
                const out: any = { role: 'assistant' as const, content };
                if (textMsg.tool_calls?.length) out.tool_calls = textMsg.tool_calls;
                if (textMsg.reasoning_content) out.reasoning_content = textMsg.reasoning_content;
                return out;
            }
            if (m.role === 'tool') {
                return { role: 'tool', content: m.content, tool_call_id: m.tool_call_id, name: m.name };
            }
            return m as any;
        });
        userMessages.push(...apiMessages);

        // 增加一个id用于锁定状态
        const id = uuidv4();

        const chatData = {
            sessionId: id,
            baseURL,
            apiKey,
            model,
            temperature,
            tools,
            parallelToolCalls,
            messages: userMessages,
            proxyServer,
            enableXmlWrapper,
            useAnthropicProtocol: this.getLlmConfig().useAnthropicProtocol || false,
        } as ChatCompletionCreateParamsBase;

        return chatData;
    }

    public abort() {
        this.bridge.postMessage({
            command: 'llm/chat/completions/abort',
            data: {
                id: this.currentChatId
            }
        });
        this.streamingContent.value = '';
        this.streamingToolCalls.value = [];
        this.streamingReasoningContent.value = '';
        this.aborted = true;
    }

    /**
     * @description 注册 error 发生时触发的回调函数
     * @param handler 
     * @returns 取消注册的函数
     */
    public registerOnError(handler: (msg: IErrorMssage) => void): () => void {
        const id = uuidv4();
        this.onError.push({ id, callback: handler });
        return () => {
            const index = this.onError.findIndex(h => h.id === id);
            if (index !== -1) {
                this.onError.splice(index, 1);
            }
        };
    }

    public registerOnChunk(handler: (chunk: ChatCompletionChunk) => void): () => void {
        const id = uuidv4();
        this.onChunk.push({ id, callback: handler });
        return () => {
            const index = this.onChunk.findIndex(h => h.id === id);
            if (index !== -1) {
                this.onChunk.splice(index, 1);
            }
        };
    }

    /**
     * @description 注册 chat.completion 完成时触发的回调函数
     * @param handler 
     * @returns 取消注册的函数
     */
    public registerOnDone(handler: () => void): () => void {
        const id = uuidv4();
        this.onDone.push({ id, callback: handler });
        return () => {
            const index = this.onDone.findIndex(h => h.id === id);
            if (index !== -1) {
                this.onDone.splice(index, 1);
            }
        };
    }

    /**
     * @description 注册每一个 epoch 开始时触发的回调函数
     * @param handler 
     * @returns 取消注册的函数
     */
    public registerOnEpoch(handler: () => void): () => void {
        const id = uuidv4();
        this.onEpoch.push({ id, callback: handler });
        return () => {
            const index = this.onEpoch.findIndex(h => h.id === id);
            if (index !== -1) {
                this.onEpoch.splice(index, 1);
            }
        };
    }

    /**
     * @description 注册当工具调用前的回调函数，可以拦截并修改 toolcall 的输入
     * @param handler 
     * @returns 取消注册的函数
     */
    public registerOnToolCall(handler: (toolCall: ToolCall) => ToolCall): () => void {
        const id = uuidv4();
        this.onToolCall.push({ id, callback: handler });
        return () => {
            const index = this.onToolCall.findIndex(h => h.id === id);
            if (index !== -1) {
                this.onToolCall.splice(index, 1);
            }
        };
    }

    /**
     * @description 注册当工具调用完成时的回调函数，会调用这个方法，可以拦截并修改 toolcall 的输出
     * @param handler 
     * @returns 取消注册的函数
     */
    public registerOnToolCalled(handler: (toolCallResult: ToolCallResult) => ToolCallResult): () => void {
        const id = uuidv4();
        this.onToolCalled.push({ id, callback: handler });
        return () => {
            const index = this.onToolCalled.findIndex(h => h.id === id);
            if (index !== -1) {
                this.onToolCalled.splice(index, 1);
            }
        };
    }

    public registerOnTokenConsumption(handler: (consumption: TokenConsumptionResult) => void) {
        const id = uuidv4();
        this.onTokenConsumption.push({ id, callback: handler });
        return () => {
            const index = this.onTokenConsumption.findIndex(h => h.id === id);
            if (index !== -1) {
                this.onTokenConsumption.splice(index, 1);
            }
        };
    }

    private consumeErrors(error: IErrorMssage) {
        this.feedback.consumeErrors(error);
        this.onError.forEach(handler => handler.callback(error));
    }

    private consumeChunks(chunk: ChatCompletionChunk) {
        this.feedback.consumeChunks(chunk);
        this.onChunk.forEach(handler => handler.callback(chunk));
    }

    private consumeToolCalls(toolCall: ToolCall) {
        this.feedback.consumeToolCalls(toolCall);
        let result = toolCall;
        this.onToolCall.forEach(handler => {
            result = handler.callback(result);
        });
        return result;
    }

    private consumeToolCalleds(result: ToolCallResult) {
        this.feedback.consumeToolCalleds(result);
        let finalResult = result;
        this.onToolCalled.forEach(handler => {
            finalResult = handler.callback(finalResult);
        });
        return finalResult;
    }

    private consumeEpochs() {
        this.feedback.consumeEpochs();
        this.onEpoch.forEach(handler => handler.callback());
    }

    private consumeDones() {
        this.feedback.consumeDones();
        this.onDone.forEach(handler => handler.callback());
    }

    private consumeTokenConsumption(storage: ChatStorage, llmConfig?: BasicLlmDescription) {
        const result = this.feedback.consumeTokenConsumption(storage, llmConfig);
        this.onTokenConsumption.forEach(handler => handler.callback(result));
    }

    public setMaxEpochs(maxEpochs: number) {
        this.taskOptions.maxEpochs = maxEpochs;
    }

    /**
     * @description 设置当前的 LLM 配置，用于 nodejs 环境运行
     * @param config 配置
     */
    public setLlmConfig(config: Partial<BasicLlmDescription>) {
        this.llmConfig = {
            name: config.name || 'sdk',
            pricing: config.pricing,
            baseUrl: config.baseUrl || 'https://api.openai.com/v1',
            userToken: config.userToken || '',
            userModel: config.userModel || 'gpt-3.5-turbo',
            id: config.id || 'openai',
            models: config.models || ['gpt-3.5-turbo'],
            isOpenAICompatible: config.isOpenAICompatible || true,
            description: config.description || '',
            website: config.website || '',
            supportsPricing: config.supportsPricing || false,
            isDynamic: config.isDynamic || false,
            modelsEndpoint: config.modelsEndpoint || '/models',
            ...config,
        }
    }

    public bindStreaming(content: Ref<string>, toolCalls: Ref<ToolCall[]>) {
        this.streamingContent = content;
        this.streamingToolCalls = toolCalls;
    }

    public getLlmConfig() {
        if (this.llmConfig) {
            return this.llmConfig;
        }
        return llms[llmManager.currentModelIndex];
    }

    public async listTools() {
        const platform = getPlatform();
        if (platform === 'nodejs') {
            // 等待连接完成
            await this.nodejsStatus.connectionFut;
        }

        const allTools = [] as ToolItem[];
        for (const client of mcpClientAdapter.clients) {
            if (!client.connected) {
                continue;
            }

            const tools = await client.getTools();
            allTools.push(...Array.from(tools.values()).map(
                item => ({
                    ...item,
                    enabled: true
                })
            ));
        }

        return allTools;
    }

    /**
     * @description 开启循环，异步更新 DOM
     */
    public async start(
        tabStorage: ChatStorage,
        userMessage: string,
        config: any = {}
    ) {

        const {
            mode = 'normal',
        } = config || {};

        const platform = getPlatform();
        if (platform === 'nodejs') {
            // 等待连接完成            
            await this.nodejsStatus.connectionFut;
        }
        const enableXmlWrapper = tabStorage.settings.enableXmlWrapper;

        // 添加目前的消息（如果不是特殊标记的话）
        if (userMessage !== '__SKIP_USER_MESSAGE__') {
            tabStorage.messages.push({
                role: 'user',
                content: userMessage,
                extraInfo: {
                    created: Date.now(),
                    state: MessageState.Success,
                    serverName: this.getLlmConfig().id || 'unknown',
                    enableXmlWrapper
                }
            });
        }

        let jsonParseErrorRetryCount = 0;
        const {
            maxEpochs = 50,
            verbose = 0
        } = this.taskOptions || {};
        this.aborted = false;

        for (let i = 0; i < maxEpochs; ++i) {

            this.consumeEpochs();

            // 初始累计清空
            this.streamingContent.value = '';
            this.streamingToolCalls.value = [];
            this.streamingReasoningContent.value = '';
            this.completionUsage = undefined;

            // 构造 chatData
            const chatData = await this.makeChatData(tabStorage);

            if (!chatData) {
                this.consumeDones();
                break;
            }

            this.currentChatId = chatData.sessionId;
            const llm = this.getLlmConfig();
            const toolcallIndexAdapter = getToolCallIndexAdapter(llm, chatData);

            // 发送请求
            const doConverationResult = await this.doConversation(chatData, toolcallIndexAdapter);

            // 如果在调用过程中出发了 abort，则直接中断
            if (this.aborted) {
                this.aborted = false;
                break;
            }

            // 如果存在需要调度的工具
            if (this.streamingToolCalls.value.length > 0) {

                const usage = this.completionUsage;
                const extraInfo = {
                    created: Date.now(),
                    state: MessageState.Success,
                    serverName: this.getLlmConfig().id || 'unknown',
                    enableXmlWrapper,
                    usage
                };

                const assistantMsg: any = {
                    role: 'assistant',
                    content: this.streamingContent.value || '',
                    tool_calls: this.streamingToolCalls.value,
                    extraInfo
                };
                if (this.streamingReasoningContent.value) {
                    assistantMsg.reasoning_content = this.streamingReasoningContent.value;
                }
                tabStorage.messages.push(assistantMsg);

                this.feedback.consumeLlmResponse(this.streamingToolCalls.value, extraInfo);

                for (let toolCall of this.streamingToolCalls.value || []) {

                    // ready to call tools
                    toolCall = this.consumeToolCalls(toolCall);

                    if (this.aborted) {
                        this.aborted = false;
                        break;
                    }

                    let toolCallResult = await handleToolCalls(toolCall, tabStorage);

                    if (this.aborted) {
                        this.aborted = false;
                        break;
                    }

                    // hook : finish call tools
                    toolCallResult = this.consumeToolCalleds(toolCallResult);

                    if (toolCallResult.state === MessageState.ParseJsonError) {
                        // 如果是因为解析 JSON 错误，则重新开始
                        jsonParseErrorRetryCount ++;

                        redLog('解析 JSON 错误 ' + toolCall?.function?.arguments);

                        tabStorage.messages.push({
                            role: 'user',
                            content: `你调用 ${toolCall.function?.name} 提供的参数解析 JSON 错误，请生成合法 JSON 作为参数 (累计错误次数 ${jsonParseErrorRetryCount})`,
                            extraInfo: {
                                created: Date.now(),
                                state: MessageState.ParseJsonError,
                                serverName: this.getLlmConfig().id || 'unknown',
                                usage: undefined,
                                enableXmlWrapper
                            }
                        });

                        // 如果因为 JSON 错误而失败太多，就只能中断了
                        if (jsonParseErrorRetryCount >= (this.taskOptions.maxJsonParseRetry || 3)) {
                            tabStorage.messages.push({
                                role: 'assistant',
                                content: `解析 JSON 错误，无法继续调用工具 (累计错误次数 ${this.taskOptions.maxJsonParseRetry})`,
                                extraInfo: {
                                    created: Date.now(),
                                    state: toolCallResult.state,
                                    serverName: this.getLlmConfig().id || 'unknown',
                                    usage: undefined,
                                    enableXmlWrapper
                                }
                            });
                            break;
                        }
                    } else if (toolCallResult.state === MessageState.Success) {
                        tabStorage.messages.push({
                            role: 'tool',
                            index: toolcallIndexAdapter(toolCall),
                            tool_call_id: toolCall.id || '',
                            content: toolCallResult.content,
                            extraInfo: {
                                created: Date.now(),
                                state: toolCallResult.state,
                                serverName: this.getLlmConfig().id || 'unknown',
                                usage: this.completionUsage,
                                enableXmlWrapper
                            }
                        });
                    } else if (toolCallResult.state === MessageState.ToolCall) {

                        tabStorage.messages.push({
                            role: 'tool',
                            index: toolcallIndexAdapter(toolCall),
                            tool_call_id: toolCall.id || toolCall.function!.name,
                            content: toolCallResult.content,
                            extraInfo: {
                                created: Date.now(),
                                state: toolCallResult.state,
                                serverName: this.getLlmConfig().id || 'unknown',
                                usage: this.completionUsage,
                                enableXmlWrapper
                            }
                        });
                    }
                }

                if (this.aborted) {
                    this.aborted = false;
                    break;
                }

            } else if (this.streamingContent.value) {
                const assistantMsg: any = {
                    role: 'assistant',
                    content: this.streamingContent.value,
                    extraInfo: {
                        created: Date.now(),
                        state: MessageState.Success,
                        serverName: this.getLlmConfig().id || 'unknown',
                        usage: this.completionUsage,
                        enableXmlWrapper
                    }
                };
                if (this.streamingReasoningContent.value) {
                    assistantMsg.reasoning_content = this.streamingReasoningContent.value;
                }
                tabStorage.messages.push(assistantMsg);

                // 如果 xml 模型，需要检查内部是否含有有效的 xml 进行调用
                if (tabStorage.settings.enableXmlWrapper) {
                    const xmls = getXmlsFromString(this.streamingContent.value);
                    if (xmls.length === 0) {
                        // 没有 xml 了，说明对话结束
                        break;
                    }

                    // 使用 user 作为身份来承载 xml 调用的结果
                    // 并且在 extra 内存储结构化信息
                    const fakeUserMessage = {
                        role: 'user',
                        content: '',
                        extraInfo: {
                            created: Date.now(),
                            state: MessageState.Success,
                            serverName: this.getLlmConfig().id || 'unknown',
                            usage: this.completionUsage,
                            enableXmlWrapper,
                        }
                    } as ChatMessage;

                    // 有 xml 了，需要检查 xml 内部是否有有效的 xml 进行调用
                    for (const xml of xmls) {
                        const toolcall = await getToolCallFromXmlString(xml);

                        if (!toolcall) {
                            continue;
                        }

                        // toolcall 事件
                        // 此处使用的是 xml 使用的 toolcall，为了保持一致性，需要转换成 openai 标准下的 toolcall
                        const normaliseToolcall = toNormaliseToolcall(toolcall, toolcallIndexAdapter);
                        this.consumeToolCalls(normaliseToolcall);

                        // 调用 XML 调用，其实可以考虑后续把这个循环改成 Promise.race
                        const toolCallResult = await handleXmlWrapperToolcall(toolcall);

                        // toolcalled 事件
                        // 因为是交付给后续进行统一消费的，所以此处的输出满足 openai 接口规范
                        this.consumeToolCalleds(toolCallResult);

                        // XML 模式下只存在 assistant 和 user 这两个角色，因此，以 user 为身份来存储
                        if (toolCallResult.state === MessageState.InvalidXml) {
                            // 如果是因为解析 XML 错误，则重新开始
                            tabStorage.messages.pop();
                            jsonParseErrorRetryCount++;

                            redLog('解析 XML 错误 ' + normaliseToolcall?.function?.arguments);

                            // 如果因为 XML 错误而失败太多，就只能中断了
                            if (jsonParseErrorRetryCount >= (this.taskOptions.maxJsonParseRetry || 3)) {

                                const prompt = getXmlResultPrompt(toolcall.callId, `解析 XML 错误，无法继续调用工具 (累计错误次数 ${this.taskOptions.maxJsonParseRetry})`);

                                fakeUserMessage.content += prompt;

                                break;
                            }
                        } else if (toolCallResult.state === MessageState.Success) {
                            // TODO: xml 目前只支持 text 类型的回复
                            const toolCallResultString = toolCallResult.content
                                .filter(c => c.type === 'text')
                                .map(c => c.text)
                                .join('\n');

                            fakeUserMessage.content += getXmlResultPrompt(toolcall.callId, toolCallResultString);

                        } else if (toolCallResult.state === MessageState.ToolCall) {
                            // TODO: xml 目前只支持 text 类型的回复
                            const toolCallResultString = toolCallResult.content
                                .filter(c => c.type === 'text')
                                .map(c => c.text)
                                .join('\n');

                            fakeUserMessage.content += getXmlResultPrompt(toolcall.callId, toolCallResultString);
                        }
                    }

                    tabStorage.messages.push(fakeUserMessage);

                } else {
                    // 普通对话直接结束
                    break;
                }

            } else {
                // 一些提示
                break;
            }

            // 回答聚合完成后根据 stop 来决定是否提前中断
            if (doConverationResult.stop) {
                break;
            }
        }

        this.consumeTokenConsumption(tabStorage, this.llmConfig);

        if (mode === 'single-chat') {
            this.feedback.reflux(tabStorage);
        }
    }

    public async createStorage(settings?: Partial<ChatSetting>): Promise<ChatStorage> {
        let {
            enableXmlWrapper = false,
            systemPrompt = '',
            temperature = 0.6,
            contextLength = 100,
            parallelToolCalls = true,
            enableWebSearch = false,
            enableTools = undefined,
        } = settings || {};

        if (enableTools === undefined) {
            // 默认缺省的情况下使用全部工具
            const tools = await this.listTools();
            enableTools = tools.map(tool => ({
                ...tool,
                enabled: true
            })) as EnableToolItem[];
        }

        const _settings = {
            enableXmlWrapper,
            systemPrompt,
            temperature,
            contextLength,
            parallelToolCalls,
            enableTools,
            enableWebSearch
        } as ChatSetting;

        return {
            id: uuidv4(),
            messages: [],
            settings: _settings
        }
    }

    public async getPrompt(promptId: string, args?: Record<string, any>) {
        const prompt = await mcpClientAdapter.readPromptTemplate(promptId, args);
        if (!prompt) return '';
        const messages = prompt.messages;
        if (!Array.isArray(messages) || messages.length === 0) {
            return (prompt as { description?: string }).description ?? '';
        }
        return messages.map(m => (m.content as { text?: string })?.text ?? '').filter(Boolean).join('\n');
    }

    public async getResource(resourceUri: string) {
        const resource = await mcpClientAdapter.readResource(resourceUri);
        return resource;
    }

    // === sdk ===

    public reflux(storage: ChatStorage) {
        this.feedback.reflux(storage);
    }

    
}