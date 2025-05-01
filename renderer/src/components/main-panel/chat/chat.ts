import { ToolCallContent, ToolItem } from "@/hook/type";
import { Ref, ref } from "vue";

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
    ParseJsonError = 'parse json error'
}

export interface IExtraInfo {
    created: number,
    state: MessageState,
    serverName: string,
    usage?: ChatCompletionChunk['usage'];
    [key: string]: any;
}

export interface ToolMessage {
    role: 'tool';
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
interface EnableToolItem {
	name: string;
	description: string;
	enabled: boolean;
}

export interface ChatSetting {
    modelIndex: number
    systemPrompt: string
    enableTools: EnableToolItem[]
    temperature: number
    enableWebSearch: boolean
    contextLength: number
}

export interface ChatStorage {
	messages: ChatMessage[]
    settings: ChatSetting
}

export interface ToolCall {
    id?: string;
    index?: number;
    type: string;
    function: {
        name: string;
        arguments: string;
    }
}

export const allTools = ref<ToolItem[]>([]);

export interface IRenderMessage {
    role: 'user' | 'assistant/content' | 'assistant/tool_calls' | 'tool';
    content: string;
    toolResult?: ToolCallContent[];
    tool_calls?: ToolCall[];
    showJson?: Ref<boolean>;
    extraInfo: IExtraInfo;
}

export function getToolSchema(enableTools: EnableToolItem[]) {
    const toolsSchema = [];
	for (let i = 0; i < enableTools.length; i++) {
		if (enableTools[i].enabled) {
			const tool = allTools.value[i];
			
			toolsSchema.push({
				type: 'function',
				function: {
					name: tool.name,
					description: tool.description || "",
					parameters: tool.inputSchema
				}
			});
		}
	}
    return toolsSchema;
}

