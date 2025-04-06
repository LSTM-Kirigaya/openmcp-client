import { watch, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import Resource from './resource/index.vue';
import Chat from './chat/index.vue';
import Prompt from './prompt/index.vue';
import Tool from './tool/index.vue';
import I18n from '@/i18n/index';
import { safeSavePanels, savePanels } from '@/hook/panel';

const { t } = I18n.global;

interface Tab {
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

function createTab(type: string, index: number): Tab {
	let customName: string | null = null;

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
		componentIndex: -1,
		component: undefined,
		storage: {},
	};
}

export function addNewTab() {
	const newTab = createTab('blank', ++tabCounter);
	tabs.content.push(newTab);
	tabs.activeIndex = tabs.content.length - 1;
}

export function setActiveTab(index: number) {
	if (index >= 0 && index < tabs.content.length) {
		tabs.activeIndex = index;
	}
}

export function closeTab(index: number) {
	if (tabs.content.length <= 1) return; // 至少保留一个标签页

	tabs.content.splice(index, 1);

	// 调整活动标签索引
	if (tabs.activeIndex >= index) {
		tabs.activeIndex = Math.max(0, tabs.activeIndex - 1);
	}
}