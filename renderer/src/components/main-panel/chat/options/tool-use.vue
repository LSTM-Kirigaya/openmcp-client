<template>
    <el-tooltip :content="t('tool-use')" placement="top">
        <div class="setting-button" :class="{ 'active': availableToolsNum > 0 }" size="small" @click="toggleTools">
            <span class="iconfont icon-tool badge-outer">
                <span class="badge-inner">
                    {{ availableToolsNum }}
                </span>
            </span>
        </div>

    </el-tooltip>

    <el-dialog v-model="showToolsDialog" title="工具管理" width="800px">
        <div class="tools-dialog-container">
            <el-scrollbar height="400px" class="tools-list">
                <div v-for="(tool, index) in tabStorage.settings.enableTools" :key="index" class="tool-item">
                    <div class="tool-info">
                        <div class="tool-name">{{ tool.name }}</div>
                        <div v-if="tool.description" class="tool-description">{{ tool.description }}</div>
                    </div>
                    <el-switch v-model="tool.enabled" />
                </div>
            </el-scrollbar>

            <el-scrollbar height="400px" class="schema-viewer">
                <div v-html="activeToolsSchemaHTML"></div>
            </el-scrollbar>
        </div>
        <template #footer>
            <el-button type="primary" @click="enableAllTools">激活所有工具</el-button>
            <el-button type="danger" @click="disableAllTools">禁用所有工具</el-button>
            <el-button type="primary" @click="showToolsDialog = false">{{ t("cancel") }}</el-button>
        </template>
    </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, inject, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { allTools, ChatStorage, getToolSchema } from '../chat';
import { markdownToHtml } from '../markdown/markdown';
import { useMessageBridge } from '@/api/message-bridge';

const { t } = useI18n();

const tabStorage = inject('tabStorage') as ChatStorage;

const showToolsDialog = ref(false);

const availableToolsNum = computed(() => {
	return tabStorage.settings.enableTools.filter(tool => tool.enabled).length;
});



// 修改 toggleTools 方法
const toggleTools = () => {
	showToolsDialog.value = true;
};

const activeToolsSchemaHTML = computed(() => {
	const toolsSchema = getToolSchema(tabStorage.settings.enableTools);
	const jsonString = JSON.stringify(toolsSchema, null, 2);

	return markdownToHtml(
		"```json\n" + jsonString + "\n```"
	);
});

// 新增方法 - 激活所有工具
const enableAllTools = () => {
	tabStorage.settings.enableTools.forEach(tool => {
        tool.enabled = true;
    });
};

// 新增方法 - 禁用所有工具
const disableAllTools = () => {
    tabStorage.settings.enableTools.forEach(tool => {
        tool.enabled = false;
    });
};

onMounted(async () => {
    const bridge = useMessageBridge();
    const res = await bridge.commandRequest('tools/list');
    if (res.code === 200) {
        allTools.value = res.msg.tools || [];
        tabStorage.settings.enableTools = [];
		for (const tool of allTools.value) {
			tabStorage.settings.enableTools.push({
				name: tool.name,
				description: tool.description,
				enabled: true
			});
		}
    }
});

</script>

<style></style>