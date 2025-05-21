import { watch, reactive } from 'vue';
import { v4 as uuidv4 } from 'uuid';

import Resource from './resource/index.vue';
import Chat from './chat/index.vue';
import Prompt from './prompt/index.vue';
import Tool from './tool/index.vue';
import I18n from '@/i18n/index';
import { safeSavePanels, savePanels } from '@/hook/panel';

const { t } = I18n.global;

interface Tab {
	id: string;
	name: string;
	icon: string;
	type: string;
	component: any;
	componentIndex: number;
	storage: Record<string, any>;
}

export const debugModes = [
	Resource, Prompt, Tool, Chat
]

// TODO: 实现对于 tabs 这个数据的可持久化
export const tabs = reactive<{
	content: Tab[]
	activeIndex: number
	activeTab: Tab
}>({
	content: [
		createTab('blank', 1)
	],
	activeIndex: 0,
	get activeTab() {
		return this.content[this.activeIndex];
	}
});

let tabCounter = 1;

// 监控 tabs

watch(
	() => tabs,
	(newValue, oldValue) => {
		safeSavePanels();
	},
	{ deep: true }
);

export function createTab(type: string, index: number): Tab {
	let customName: string | null = null;
	const id = uuidv4();

	return {
		get name() {
			if (customName !== null) {
				return customName;
			}
			return t('blank-test') + ` ${index}`;
		},
		set name(value: string) {
			customName = value; // 允许外部修改 name
		},
		icon: 'icon-blank',
		type,
		id,
		componentIndex: -1,
		component: undefined,
		storage: {
			// 默认打开一个 mcp server 的面板
			activeNames: [0]
		},
	};
}

export function addNewTab() {
	const newTab = createTab('blank', ++tabCounter);
	tabs.content.push(newTab);
	tabs.activeIndex = tabs.content.length - 1;
}


export function closeTab(index: number) {
	if (tabs.content.length <= 1) return; // 至少保留一个标签页

	tabs.content.splice(index, 1);

	console.log(tabs.content);

	// 调整活动标签索引
	if (tabs.activeIndex >= index) {
		tabs.activeIndex = Math.max(0, tabs.activeIndex - 1);
	}
}