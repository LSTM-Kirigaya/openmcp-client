import type { InputSchema } from "../hook/types.js";
import type { Ref } from "vue";
import type { OpenAI } from 'openai';
import type { ToolCallContent } from '../mcp/client.dto.js';

export type ChatCompletionChunk = OpenAI.Chat.Completions.ChatCompletionChunk;

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
    ParseJsonError = 'parse json error', 
    NoToolFunction = 'no tool function', 
    InvalidXml = 'invalid xml' 
}

export interface IExtraInfo { 
    created: number, 
    state: MessageState, 
    serverName: string, 
    usage?: ChatCompletionChunk['usage']; 
    enableXmlWrapper: boolean; 
    [key: string]: any; 
}

export interface ToolMessage { 
    role: 'tool'; 
    index: number; 
    content: ToolCallContent[]; 
    tool_call_id?: string 
    name?: string // 工具名称，当 role 为 tool 
    tool_calls?: ToolCall[], 
    extraInfo: IExtraInfo 
}

export interface TextMessage { 
    role: 'user' | 'assistant' | 'system'; 
    content: string; 
    tool_call_id?: string 
    name?: string // 工具名称，当 role 为 tool 
    tool_calls?: ToolCall[], 
    extraInfo: IExtraInfo 
}

export type ChatMessage = ToolMessage | TextMessage;

// 新增状态和工具数据 
export interface EnableToolItem { 
    name: string; 
    description: string; 
    enabled: boolean; 
    inputSchema: InputSchema; 
}

export interface ChatSetting { 
    modelIndex?: number 
    systemPrompt: string 
    enableTools: EnableToolItem[] 
    temperature: number 
    enableWebSearch: boolean 
    contextLength: number 
    parallelToolCalls: boolean 
    enableXmlWrapper: boolean 
}

export interface ParallelChatInstance { 
    modelId: string 
    messages: ChatMessage[] 
    llmIndex?: number // 对应的LLM配置索引 
}

export interface ChatStorage {
    id: string
    messages: ChatMessage[] 
    settings: ChatSetting 
    parallelMode?: boolean 
    parallelChats?: ParallelChatInstance[] 
    selectedModels?: string[] 
}

export type ToolCall = OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta.ToolCall;

interface PromptTextItem { 
    type: 'prompt' 
    text: string 
    name: string 
    args?: Record<string, string> 
}

interface ResourceTextItem { 
    type: 'resource' 
    text: string 
    name: string 
    args?: Record<string, string> 
}

interface TextItem { 
    type: 'text' 
    text: string 
}

export type RichTextItem = PromptTextItem | ResourceTextItem | TextItem;

export interface ICommonRenderMessage { 
    role: 'user' | 'assistant/content'; 
    content: string; 
    showJson?: any; 
    extraInfo: IExtraInfo; 
}

export interface IToolRenderMessage { 
    role: 'assistant/tool_calls'; 
    content: string; 
    toolResults: ToolCallContent[][]; 
    tool_calls: ToolCall[]; 
    showJson?: any; 
    extraInfo: IExtraInfo; 
}

export type IRenderMessage = ICommonRenderMessage | IToolRenderMessage;

export interface TokenConsumption {
    total: number;
    input: number;
    output: number;
    cacheRatio: number;
}

export interface EditorContext { 
    editor: Ref<HTMLDivElement>; 
    [key: string]: any; 
}