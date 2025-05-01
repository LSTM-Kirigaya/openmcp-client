<template>
    <div class="setting-option">
        <span>
            <span class="iconfont icon-llm"></span>
            <span class="option-title">{{ t('model') }}</span>
        </span>
        <div style="width: 160px;">
            <el-select v-if="llms[llmManager.currentModelIndex]"
                name="language-setting"
                v-model="llms[llmManager.currentModelIndex].userModel"
                @change="onmodelchange"
            >
                <el-option
                    v-for="option in llms[llmManager.currentModelIndex].models"
                    :value="option"
                    :label="option"
                    :key="option.id"
                ></el-option>
            </el-select>
        </div>
    </div>

    <div class="setting-option">
        <span>
            <span class="iconfont icon-url-line"></span>
            <span class="option-title">{{ t('api-root-url') }}</span>
        </span>
        <div style="width: 240px;">
            <el-input v-if="llms[llmManager.currentModelIndex]"
                v-model="llms[llmManager.currentModelIndex].baseUrl" placeholder="https://" />
        </div>
    </div>

    <div class="setting-option">
        <span>
            <span class="iconfont icon-token"></span>
            <span class="option-title">{{ t('api-token') }}</span>
        </span>
        <div style="width: 240px;">
            <el-input v-if="llms[llmManager.currentModelIndex]"
                v-model="llms[llmManager.currentModelIndex].userToken" show-password />
        </div>
    </div>
</template>

<script setup lang="ts">
/* eslint-disable */

import { defineComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import { llmManager, llms } from './llm';
import { pinkLog } from './util';
import { saveSetting } from '@/hook/setting';
import { ElMessage } from 'element-plus';

defineComponent({ name: 'connect-interface-openai' });

const { t } = useI18n();

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

</script>

<style>
</style>