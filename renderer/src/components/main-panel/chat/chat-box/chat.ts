import type { InputSchema, ToolCallContent, ToolItem } from "@/hook/type";
import type { Ref } from "vue";

import type { OpenAI } from 'openai';
type ChatCompletionChunk = OpenAI.Chat.Completions.ChatCompletionChunk;

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
    InvalidXml = 'invalid xml',
    AwaitingUserInput = 'awaiting user input',
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
    /** 富文本内容（提示词块、资源块等），用于历史记录渲染，需持久化 */
    richContent?: RichTextItem[];
    /** DeepSeek thinking 模式的推理内容，多轮 tool calls 时必须回传 */
    reasoning_content?: string;
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
    inputSchema: InputSchema;
    enabled: boolean;
    deferLoading?: boolean;
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
    llmIndex?: number  // 对应的LLM配置索引
}

export interface ChatStorage {
    id: string
    messages: ChatMessage[]
    settings: ChatSetting
    parallelMode?: boolean
    parallelChats?: ParallelChatInstance[]
    selectedModels?: string[]
    /** Plan mode state */
    planMode?: {
        isPlanMode: boolean;
        planContent: string | null;
        planFilePath: string | null;
    }
}

export type ToolCall = OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta.ToolCall;

export interface PromptTextItem {
    type: 'prompt'
    text: string
    name?: string
    args?: Record<string, string>
}

export interface ResourceTextItem {
    type: 'resource'
    text: string
    name?: string
    args?: Record<string, string>
}

export interface TextItem {
    type: 'text'
    text: string
}

export type RichTextItem = PromptTextItem | ResourceTextItem | TextItem;

/** 将富文本数组转换为纯文本（用于发送给大模型） */
export function richContentToPlainText(items: RichTextItem[]): string {
    return items.map(item => item.text).join(' ');
}

export interface ICommonRenderMessage {
    role: 'user' | 'assistant/content';
    content: string;
    /** 富文本内容（提示词块、资源块等），用于历史记录渲染 */
    richContent?: RichTextItem[];
    showJson?: any;
    extraInfo: IExtraInfo;
}

export interface IToolRenderMessage {
    role: 'assistant/tool_calls';
    content: string;
    toolResults: ToolCallContent[][];
    tool_calls: ToolCall[];
    toolIndex?: number;
    showJson?: any;
    extraInfo: IExtraInfo;
}

export type IRenderMessage = ICommonRenderMessage | IToolRenderMessage;

export function getToolSchema(enableTools: EnableToolItem[]): any[] {
    const visitedTools = new Set<string>();
    const toolsSchema = [];

    for (let i = 0; i < enableTools.length; i++) {
        const enableTool = enableTools[i];

        const {
            enabled = false,
            deferLoading = false,
        } = enableTool;

        if (enabled && !deferLoading && !visitedTools.has(enableTool.name)) {
            toolsSchema.push({
                type: 'function',
                function: {
                    name: enableTool.name,
                    description: enableTool.description || "",
                    parameters: enableTool.inputSchema
                }
            });

            // 记录已添加的工具名称
            visitedTools.add(enableTool.name);
        }
    }

    return toolsSchema;
}

export interface EditorContext {
    editor: Ref<HTMLDivElement>;
    [key: string]: any;
}
