import { markRaw, reactive } from 'vue';
import { createTab, debugModes, tabs } from '@/components/main-panel/panel';
import { ToolStorage } from '@/components/main-panel/tool/tools';
import { ToolCall } from '@/components/main-panel/chat/chat';

import I18n from '@/i18n';
const { t } = I18n.global;

export const llms = reactive<any[]>([]);

export const llmManager = reactive({
	currentModelIndex: 0,
});

export function createTest(call: ToolCall) {
	const tab = createTab('tool', 0);
	tab.componentIndex = 2;
	tab.component = markRaw(debugModes[2]);
	tab.icon = 'icon-tool';
	tab.name = t("tools");
	
	const storage: ToolStorage = {
		currentToolName: call.function.name,
		formData: JSON.parse(call.function.arguments)
	};

	tab.storage = storage;
	tabs.content.push(tab);
	tabs.activeIndex = tabs.content.length - 1;
}