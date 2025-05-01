<template>
    <el-tooltip :content="t('choose-model')" placement="top">
        <div class="setting-button" @click="showModelDialog = true">
            <span class="iconfont icon-model">
                {{ currentServerName }}/{{ currentModelName }}
            </span>
        </div>
    </el-tooltip>

    <!-- 模型选择对话框 -->
    <el-dialog v-model="showModelDialog" :title="t('choose-model')" width="400px">
        <el-radio-group v-model="selectedModelIndex" @change="onRadioGroupChange">
            <el-radio v-for="(model, index) in availableModels" :key="index" :value="index">
                {{ model }}
            </el-radio>
        </el-radio-group>
        <template #footer>
            <el-button @click="showModelDialog = false">{{ t("cancel") }}</el-button>
            <el-button type="primary" @click="confirmModelChange">{{ t("confirm") }}</el-button>
        </template>
    </el-dialog>
</template>

<script setup lang="ts">
import { saveSetting } from '@/hook/setting';
import { llmManager, llms } from '@/views/setting/llm';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();

const showModelDialog = ref(false);
const currentModel = llms[llmManager.currentModelIndex].userModel;
const selectedModelIndex = ref(llms[llmManager.currentModelIndex].models.indexOf(currentModel));

const currentServerName = computed(() => {
	const currentLlm = llms[llmManager.currentModelIndex];
	if (currentLlm) {
		return currentLlm.name;
	}
	return '';
});

const currentModelName = computed(() => {
	const currentLlm = llms[llmManager.currentModelIndex];
	if (currentLlm) {
		return currentLlm.models[selectedModelIndex.value];
	}
	return '';
});

const availableModels = computed(() => {
	return llms[llmManager.currentModelIndex].models;
});

const confirmModelChange = () => {
	showModelDialog.value = false;
};

const onRadioGroupChange = () => {
	const currentModel = llms[llmManager.currentModelIndex].models[selectedModelIndex.value];
	llms[llmManager.currentModelIndex].userModel = currentModel;
	saveSetting();
};

</script>

<style></style>