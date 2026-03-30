import { useMessageBridge } from "@/api/message-bridge";
import { pinkLog } from "@/views/setting/util";
import { tabs } from "@/components/main-panel/panel";
import { ref, type Reactive } from "vue";
import { v4 as uuidv4 } from 'uuid';
import { mcpClientAdapter, type McpClient } from "@/views/connect/core";
import type { BatchValidationStorage } from "@/components/main-panel/batch-validation/storage";
import { ensureBatchValidationStorage } from "@/components/main-panel/batch-validation/storage";
import { cloudContext } from "@/hook/cloud-context";

const BATCH_VALIDATION_COMPONENT_INDEX = 5;

interface SaveTabItem {
	name: string;
	icon: string;
	type: string;
	componentIndex: number;
	storage: Record<string, any>;
}

export interface SaveTab {
	tabs: SaveTabItem[]
	currentIndex: number
}

export const panelLoaded = ref(false);

export async function loadPanels(client: McpClient | Reactive<McpClient>) {
	const bridge = useMessageBridge();
	const { code, msg } = await bridge.commandRequest<SaveTab>('panel/load', {
		clientId: client.clientId
	});
	if (code !== 200) {
		pinkLog('tabs 加载失败');
		console.log(msg);
		
	} else {
		const persistTab = msg;				

		pinkLog('tabs 加载成功');

		if (persistTab.tabs.length === 0) {
			// 空的，直接返回不需要管
			panelLoaded.value = true;
			return;
		}
		
		tabs.activeIndex = 0;
		tabs.content = [];

		for (const tab of persistTab.tabs || []) {
			
			tabs.content.push({
				id: uuidv4(),
				name: tab.name,
				icon: tab.icon,
				type: tab.type,
				componentIndex: tab.componentIndex,
				storage: tab.storage
			});
		}

		tabs.activeIndex = persistTab.currentIndex;

		// 云端模式下不从本地 batch-validation/load 覆盖，以免冲掉云端项目内容。
		if (cloudContext.mode !== 'cloud') {
			const bvRes = await bridge.commandRequest<{ storage: BatchValidationStorage }>('batch-validation/load', {
				clientId: client.clientId
			});
			if (bvRes.code === 200 && bvRes.msg?.storage) {
				const loaded = bvRes.msg.storage;
				for (const tab of tabs.content) {
					if (tab.componentIndex === BATCH_VALIDATION_COMPONENT_INDEX) {
						Object.assign(tab.storage, loaded);
						ensureBatchValidationStorage(tab.storage);
					}
				}
			}
		}
	}

	panelLoaded.value = true;
}

let debounceHandler: NodeJS.Timeout;

export function safeSavePanels() {
	clearTimeout(debounceHandler);
	debounceHandler = setTimeout(() => {
		savePanels();
	}, 100);
}

export function savePanels(saveHandler?: () => void) {
	// // 没有完成 panel 加载就不保存
	// if (!panelLoaded.value) {
	// 	return;
	// }

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

	const masterNode = mcpClientAdapter.masterNode;
    bridge.postMessage({
        command: 'panel/save',
        data: {
			clientId: masterNode.clientId,
			...saveTabs
		}
    });
}