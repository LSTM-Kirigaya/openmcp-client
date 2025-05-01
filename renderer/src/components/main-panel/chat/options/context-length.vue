<template>
    <el-tooltip :content="t('context-length')" placement="top">
        <div class="setting-button" @click="showContextLengthDialog = true">
            <span class="iconfont icon-length"></span>
            <span class="value-badge">{{ tabStorage.settings.contextLength }}</span>
        </div>
    </el-tooltip>

    <!-- 上下文长度设置 - 改为滑块形式 -->
    <el-dialog v-model="showContextLengthDialog" :title="t('context-length') + ' ' + tabStorage.settings.contextLength"
        width="400px">
        <div class="slider-container">
            <el-slider v-model="tabStorage.settings.contextLength" :min="1" :max="99" :step="1" />
            <div class="slider-tips">
                <span> 1: {{ t('single-dialog') }}</span>
                <span> >1: {{ t('multi-dialog') }}</span>
            </div>
        </div>
        <template #footer>
            <el-button @click="showContextLengthDialog = false">{{ t("cancel") }}</el-button>
        </template>
    </el-dialog>
</template>

<script setup lang="ts">
import { defineComponent, inject, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChatStorage } from '../chat';

const { t } = useI18n();

const tabStorage = inject('tabStorage') as ChatStorage;

const showContextLengthDialog = ref(false);

</script>

<style>
.icon-length {
	font-size: 16px;
}
</style>