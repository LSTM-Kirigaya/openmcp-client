import { useMessageBridge } from "@/api/message-bridge";
import { llmManager, llms } from "@/views/setting/llm";
import { pinkLog } from "@/views/setting/util";
import I18n from '@/i18n/index';
import { debugModes, tabs } from "@/components/main-panel/panel";
import { markRaw, ref } from "vue";

interface SaveTabItem {
	name: string;
	icon: string;
	type: string;
	componentIndex: number;
	storage: Record<string, any>;
}

interface SaveTab {
	tabs: SaveTabItem[]
	currentIndex: number
}

export const panelLoaded = ref(false);

export function loadPanels() {
    const bridge = useMessageBridge();
    
    bridge.addCommandListener('panel/load', data => {
		if (data.code !== 200) {
			pinkLog('tabs 加载失败');
			console.log(data.msg);
			
		} else {
			const persistTab = data.msg as SaveTab;

			pinkLog('tabs 加载成功');
	
			if (persistTab.tabs.length === 0) {
				// 空的，直接返回不需要管
				return;
			}
			
			tabs.activeIndex = 0;
			tabs.content = [];
	
			for (const tab of persistTab.tabs || []) {
				tabs.content.push({
					name: tab.name,
					icon: tab.icon,
					type: tab.type,
					componentIndex: tab.componentIndex,
					component: markRaw(debugModes[tab.componentIndex]),
					storage: tab.storage
				});
			}
	
			tabs.activeIndex = persistTab.currentIndex;
		}

		panelLoaded.value = true;
    }, { once: true });

    bridge.postMessage({
        command: 'panel/load'
    });
}

let debounceHandler: NodeJS.Timeout;

export function safeSavePanels() {
	clearTimeout(debounceHandler);
	debounceHandler = setTimeout(() => {
		savePanels();
	}, 1000);
}

export function savePanels(saveHandler?: () => void) {
    const bridge = useMessageBridge();

    const saveTabs: SaveTab = {
		currentIndex: tabs.activeIndex,
		tabs: []
	};
	for (const tab of tabs.content) {
		saveTabs.tabs.push({
			name: tab.name,
			icon: tab.icon,
			type: tab.type,
			componentIndex: tab.componentIndex,
			storage: JSON.parse(JSON.stringify(tab.storage))
		});
	}

    bridge.addCommandListener('panel/save', data => {
        const saveStatusCode = data.code;
        pinkLog('配置保存状态：' + saveStatusCode);
        
        if (saveHandler) {
            saveHandler();
        }
    }, { once: true });

    bridge.postMessage({
        command: 'panel/save',
        data: saveTabs
    });
}