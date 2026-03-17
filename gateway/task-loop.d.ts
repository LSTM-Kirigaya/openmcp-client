/* eslint-disable */
import type { OpenAI } from 'openai';

export type ChatCompletionChunk = OpenAI.Chat.Completions.ChatCompletionChunk;
export type ChatCompletionCreateParamsBase = OpenAI.Chat.Completions.ChatCompletionCreateParams & { id?: string };

interface SchemaProperty {
    title: string;
    type: string;
    description?: string;
}

interface InputSchema {
    type: string;
    properties: Record<string, SchemaProperty>;
    required?: string[];
    title?: string;
    $defs?: any;
}

interface ToolItem {
    name: string;
    description: string;
    inputSchema: InputSchema;
    enabled: boolean;
    anyOf?: any;
}

interface IExtraInfo {
    created: number,
    state: MessageState,
    serverName: string,
    usage?: ChatCompletionChunk['usage'];
    enableXmlWrapper: boolean;
    [key: string]: any;
}


interface ToolMessage {
    role: 'tool';
    index: number;
    content: ToolCallContent[];
    tool_call_id?: string
    name?: string // 工具名称，当 role 为 tool
    tool_calls?: ToolCall[],
    extraInfo: IExtraInfo
}

interface TextMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    tool_call_id?: string
    name?: string // 工具名称，当 role 为 tool
    tool_calls?: ToolCall[],
    extraInfo: IExtraInfo
}

export type ChatMessage = ToolMessage | TextMessage;

interface ChatStorage {
    messages: ChatMessage[]
    settings: ChatSetting
}

interface EnableToolItem {
    name: string;
    description: string;
    enabled: boolean;
    inputSchema: InputSchema;
}


export type Ref<T> = {
    value: T;
};

export interface ToolCall {
    id?: string;
    index?: number;
    type: string;
    function: {
        name: string;
        arguments: string;
    }
}

export interface ToolCallContent {
    type: string;
    text: string;
    [key: string]: any;
}

export interface ToolCallResult {
    id?: string;
    function?: {
        name?: string;
        arguments?: string;
    };
    index: number;
    state: MessageState;
    timecost: number;
    content: ToolCallContent[];
}

export interface TokenConsumptionResult {
    totalInput?: number,
    totalOutput?: number,
    totalHitInput?: number,
    cost?: number,
    pricing?: {
        inputPerMilleHitCache: number,
        inputPerMille: number,
        outputPerMille: number,
        unit: string,
    },
    avgCacheHitRatio: number,
}

export interface BasicLlmDescription {
	id: string,
	name: string,
	baseUrl: string,
	models: string[],
	isOpenAICompatible: boolean,
	description: string,
	website: string,
	userToken: string,
	userModel: string,
	isDynamic?: boolean,
	modelsEndpoint?: string,
	supportsPricing?: boolean,
    pricing?: {
        // 百万tokens输入（缓存命中）
        inputPerMilleHitCache: number,
        // 百万tokens输出（缓存未命中）
        inputPerMille: number,
        // 百万tokens输出
        outputPerMille: number,
        // 单位：比如「人民币」
        unit: string,
    }
	[key: string]: any
}

export enum MessageState {
    ServerError = 'server internal error',
    ReceiveChunkError = 'receive chunk error',
    Timeout = 'timeout',
    MaxEpochs = 'max epochs',
    Unknown = 'unknown error',
    Abort = 'abort',
    ToolCall = 'tool call failed',
    None = 'none',
    Success = 'success',
    ParseJsonError = 'parse json error'
}

export interface IErrorMssage {
    state: MessageState;
    msg: string;
}

export interface IDoConversationResult {
    stop: boolean;
}

export interface TaskLoopOptions {
    /**
     * The maximum number of epochs (conversation rounds) to perform.
     */
    maxEpochs?: number;

    /**
     * The maximum number of retries allowed when parsing JSON responses fails.
     */
    maxJsonParseRetry?: number;

    /**
     * A custom adapter that can be used to modify behavior or integrate with different environments.
     */
    adapter?: any;

    /**
     * Verbosity level for logging:
     * 0 - Silent, 1 - Errors only, 2 - Warnings and errors, 3 - Full debug output.
     */
    verbose?: 0 | 1 | 2 | 3;
}

interface ChatSetting {
    /**
     * Index of the selected language model from a list of available models.
     */
    modelIndex: number;

    /**
     * System-level prompt used to guide the behavior of the assistant.
     */
    systemPrompt: string;

    /**
     * List of tools that are enabled and available during the chat.
     */
    enableTools: EnableToolItem[];

    /**
     * Sampling temperature for generating responses.
     * Higher values (e.g., 0.8) make output more random; lower values (e.g., 0.2) make it more focused and deterministic.
     */
    temperature: number;

    /**
     * Whether web search is enabled for enhancing responses with real-time information.
     */
    enableWebSearch: boolean;

    /**
     * Maximum length of the conversation context to keep.
     */
    contextLength: number;

    /**
     * Whether multiple tools can be called in parallel within a single message.
     */
    parallelToolCalls: boolean;

    /**
     * Whether to wrap tool call responses in XML format.
     */
    enableXmlWrapper: boolean;
}

/**
 * @description 对任务循环进行的抽象封装
 */
export class TaskLoop {
    constructor(taskOptions?: TaskLoopOptions);

    /**
     * @description wait for connection
     */
    waitConnection(): Promise<void>;

    /**
     * @description Set the task loop options
     * @param taskOptions 
     */
    setTaskLoopOptions(taskOptions: TaskLoopOptions): void;

    /**
     * @description make chat data
     * @param tabStorage 
     */
    makeChatData(tabStorage: any): ChatCompletionCreateParamsBase | undefined;

    /**
     * @description stop the task loop
     */
    abort(): void;

    /**
     * @description Register a callback function triggered on error
     * @param handler 
     */
    registerOnError(handler: (msg: IErrorMssage) => void): void;

    /**
     * @description Register a callback function triggered on chunk
     * @param handler 
     */
    registerOnChunk(handler: (chunk: ChatCompletionChunk) => void): void;

    /**
     * @description Register a callback function triggered at the beginning of each epoch
     * @param handler 
     */
    registerOnDone(handler: () => void): void;

    /**
     * @description Register a callback function triggered at the beginning of each epoch
     * @param handler 
     */
    registerOnEpoch(handler: () => void): void;

    /**
     * @description Registers a callback function that is triggered when a tool call is completed. This method allows you to intercept and modify the output of the tool call.
     * @param handler 
     */
    registerOnToolCalled(handler: (toolCallResult: ToolCallResult) => ToolCallResult): void;

    /**
     * @description Register a callback triggered after tool call finishes. You can intercept and modify the output.
     * @param handler 
     */
    registerOnToolCall(handler: (toolCall: ToolCall) => ToolCall): void;

    /**
     * @description Register a callback triggered after each token consumption.
     * @param handler 
     */
    registerOnTokenConsumption(handler: (consumption: TokenConsumptionResult) => void): void;

    /**
     * @description Get current LLM configuration
     */
    getLlmConfig(): any;

    /**
     * @description Set the current LLM configuration, for Node.js environment
     * @param config 
     */
    setLlmConfig(config: Partial<BasicLlmDescription>): void;

    /**
     * @description Set proxy server
     * @param maxEpochs 
     */
    setMaxEpochs(maxEpochs: number): void;

    /**
     * @description bind streaming content and tool calls
     */
    bindStreaming(content: Ref<string>, toolCalls: Ref<ToolCall[]>): void;

    /**
     * @description not finish
     */
    connectToService(): Promise<void>;

    /**
     * @description 设置代理服务器
     * @param proxyServer 
     */
    setProxyServer(proxyServer: string): void;

    /**
     * @description 启用数据集回流
     * @param enableDatasetReflux 
     */
    setRefluxSetting(enableDatasetReflux: boolean): void;

    /**
     * @description 设置回流数据集名称（用于 JSON 归档目录）
     * @param name 
     */
    setDatasetName(name: string): void;

    /**
     * @description Get all available tool list
     */
    listTools(): Promise<ToolItem[]>;

    /**
     * @description Start the loop and asynchronously update the DOM
     */
    start(tabStorage: ChatStorage, userMessage: string, config?: any): Promise<void>;

    /**
     * @description Create single conversation context
     */
    createStorage(settings?: Partial<ChatSetting>): Promise<ChatStorage>;

    /**
     * @description Get prompt template from mcp server
     */
    getPrompt(promptId: string, args?: Record<string, any>): Promise<string>;

    /**
     * @description Get resource template from mcp server
     */
    getResource(resourceUri: string): Promise<string>;
}

export declare const getToolSchema: any;
export declare const useMessageBridge: any;
export declare const llmManager: any;
export declare const llms: any;
export declare const pinkLog: any;
export declare const redLog: any;
export declare const ElMessage: any;
export declare const handleToolCalls: any;
export declare const getPlatform: any;
