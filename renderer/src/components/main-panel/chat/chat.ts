import { ToolItem } from "@/hook/type";
import { ref } from "vue";

import type { OpenAI } from 'openai';
type ChatCompletionChunk = OpenAI.Chat.Completions.ChatCompletionChunk;

export interface IExtraInfo {
    created: number,
    serverName: string,
    usage?: ChatCompletionChunk['usage'];
    [key: string]: any
}

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    tool_call_id?: string
    name?: string // 工具名称，当 role 为 tool
    tool_calls?: ToolCall[],
    extraInfo: IExtraInfo
}

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