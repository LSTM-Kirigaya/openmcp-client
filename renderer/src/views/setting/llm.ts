import { reactive } from 'vue';
import { createTab, tabs } from '@/components/main-panel/panel';
import type { ToolStorage } from '@/components/main-panel/tool/tools';
import type { ToolCall } from '@/components/main-panel/chat/chat-box/chat';
import { mcpClientAdapter } from '@/views/connect/core';

import I18n from '@/i18n';
const { t } = I18n.global;

export const llms = reactive<BasicLlmDescription[]>([]);

export const llmManager = reactive({
	currentModelIndex: 0,
});

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
	useAnthropicProtocol?: boolean,
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

export function createTest(call: ToolCall) {
	const tab = createTab('tool', 0);
	tab.componentIndex = 2;
	tab.icon = 'icon-tool';
	tab.name = t("tools");

	const toolName = call.function!.name!;
	let currentClientIndex: number | undefined;
	for (let i = 0; i < mcpClientAdapter.clients.length; i++) {
		if (mcpClientAdapter.clients[i].tools?.has(toolName)) {
			currentClientIndex = i;
			break;
		}
	}

	const storage: ToolStorage = {
		activeNames: [0],
		currentClientIndex,
		currentToolName: toolName,
		formData: JSON.parse(call.function!.arguments ?? '{}'),
		testCases: [],
	};

	tab.storage = storage;
	tabs.content.push(tab);
	tabs.activeIndex = tabs.content.length - 1;
}