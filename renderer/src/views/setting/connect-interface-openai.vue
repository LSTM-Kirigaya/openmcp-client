<template>
    <div class="setting-option">
        <span>
            <span class="option-title">{{ t('model') }}</span>
        </span>
        <div style="width: 240px;">
            <el-select v-if="llms[llmManager.currentModelIndex]"
                name="model-setting"
                v-model="llms[llmManager.currentModelIndex].userModel"
                @change="onmodelchange"
                filterable
                :placeholder="getPlaceholderText()"
                :reserve-keyword="false"
                size="default"
                :popper-class="isOpenRouter ? 'openrouter-select-dropdown' : ''"
            >
                <el-option
                    v-for="option in llms[llmManager.currentModelIndex].models"
                    :value="option"
                    :label="option"
                    :key="option"
                >
                    <div v-if="isOpenRouter" class="openrouter-model-option">
                        <div class="model-info">
                            <span class="model-name">{{ getModelDisplayName(option) }}</span>
                            <span class="model-provider">{{ getModelProvider(option) }}</span>
                        </div>
                        <span v-if="getModelBadge(option)" class="model-badge">{{ getModelBadge(option) }}</span>
                    </div>
                    <span v-else class="regular-model-option">{{ option }}</span>
                </el-option>
                
                <!-- 当没有搜索结果时显示 -->
                <el-option v-if="filteredModels.length === 0 && searchKeyword" 
                           value="" 
                           disabled
                           class="search-result-info">
                    <div class="search-empty">
                        <span>{{ `找到 0 个模型匹配 "${searchKeyword}"` }}</span>
                    </div>
                </el-option>
            </el-select>
        </div>
    </div>

    <div class="setting-option">
        <span>
            <span class="option-title">{{ t('api-root-url') }}</span>
        </span>
        <div style="width: 240px;">
            <el-input v-if="llms[llmManager.currentModelIndex]"
                v-model="llms[llmManager.currentModelIndex].baseUrl" placeholder="https://" />
        </div>
    </div>

    <div class="setting-option">
        <span>
            <span class="option-title">{{ t('api-token') }}</span>
        </span>
        <div style="width: 240px;">
            <el-input v-if="llms[llmManager.currentModelIndex]"
                v-model="llms[llmManager.currentModelIndex].userToken" show-password />
        </div>
    </div>

    <div class="setting-option">
        <span>
            <span class="option-title">{{ t('use-anthropic-protocol') }}</span>
        </span>
        <div style="width: 240px;">
            <el-switch
                v-if="llms[llmManager.currentModelIndex]"
                v-model="llms[llmManager.currentModelIndex].useAnthropicProtocol"
                @change="onAnthropicChange"
                active-text="Anthropic"
                inactive-text="OpenAI"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
/* eslint-disable */

import { defineComponent, computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { llmManager, llms } from './llm';
import { pinkLog } from './util';
import { saveSetting } from '@/hook/setting';
import { ElMessage } from 'element-plus';

defineComponent({ name: 'connect-interface-openai' });

const { t } = useI18n();

// 搜索关键词
const searchKeyword = ref('');

// 检测当前是否为OpenRouter提供商
const isOpenRouter = computed(() => {
    return llms[llmManager.currentModelIndex]?.id === 'openrouter';
});

// 过滤后的模型列表
const filteredModels = computed(() => {
    if (!llms[llmManager.currentModelIndex]) return [];
    
    const models = llms[llmManager.currentModelIndex].models;
    if (!searchKeyword.value) return models;
    
    const keyword = searchKeyword.value.toLowerCase();
    return models.filter(model => 
        model.toLowerCase().includes(keyword) ||
        getModelDisplayName(model).toLowerCase().includes(keyword) ||
        getModelProvider(model).toLowerCase().includes(keyword)
    );
});

function saveLlmSetting() {
	saveSetting(() => {
		ElMessage({
			message: t('success-save'),
			type: 'success'
		});
	});
}

function onmodelchange() {
	pinkLog('切换模型到：' + llms[llmManager.currentModelIndex].id);
	saveLlmSetting();
}

function onAnthropicChange() {
	pinkLog('切换 Anthropic 协议：' + llms[llmManager.currentModelIndex].useAnthropicProtocol);
	saveLlmSetting();
}

// 自定义过滤方法
function filterModels(query: string) {
    searchKeyword.value = query;
    // 返回 false 禁用 Element Plus 内置过滤，使用我们的 filteredModels
    return false;
}

// 获取占位符文本
function getPlaceholderText() {
    if (isOpenRouter.value) {
        const modelCount = llms[llmManager.currentModelIndex]?.models?.length || 0;
        return `搜索 ${modelCount} 个模型... (可输入模型名或提供商)`;
    }
    return '选择模型';
}

// 获取模型显示名称（去掉提供商前缀）
function getModelDisplayName(modelId: string) {
    if (!modelId.includes('/')) return modelId;
    return modelId.split('/')[1] || modelId;
}

// 获取模型提供商
function getModelProvider(modelId: string) {
    if (!modelId.includes('/')) return '';
    return modelId.split('/')[0];
}

// 获取模型标签（如free等）
function getModelBadge(modelId: string) {
    if (modelId.includes(':free')) return 'FREE';
    if (modelId.includes(':thinking')) return 'THINKING';
    if (modelId.includes(':beta')) return 'BETA';
    if (modelId.includes('preview')) return 'PREVIEW';
    if (modelId.includes('exp')) return 'EXP';
    return '';
}

</script>

<style scoped>
/* OpenRouter 模型选项样式 */
.openrouter-model-option {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 4px 0;
}

.model-info {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
}

.model-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.model-provider {
    font-size: 12px;
    color: var(--foreground);
    opacity: 0.7;
    margin-top: 2px;
}

.model-badge {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 6px;
    background-color: var(--main-light-color);
    color: var(--main-color);
    font-weight: 600;
    margin-left: 8px;
    white-space: nowrap;
}

/* 普通模型选项样式 */
.regular-model-option {
    font-size: 14px;
    color: var(--foreground);
    font-weight: 500;
}

/* 搜索为空时的样式 */
.search-empty {
    text-align: center;
    color: var(--foreground);
    opacity: 0.7;
    font-size: 13px;
    padding: 12px 0;
}

/* 下拉框样式优化 */
:global(.openrouter-select-dropdown) {
    max-height: 300px !important;
}

:global(.openrouter-select-dropdown .el-select-dropdown__item) {
    height: auto !important;
    padding: 8px 12px !important;
    line-height: normal !important;
}

/* 搜索框样式 */
:global(.el-select .el-input .el-input__wrapper) {
    transition: all 0.3s ease;
}

:global(.el-select .el-input.is-focus .el-input__wrapper) {
    box-shadow: 0 0 0 1px var(--main-color) inset;
}
</style>