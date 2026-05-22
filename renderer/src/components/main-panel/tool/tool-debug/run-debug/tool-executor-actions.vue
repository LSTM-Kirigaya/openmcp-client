<template>
    <div v-if="executor" class="executor-actions-wrapper">
        <el-button-group class="executor-actions-group">
            <el-button
                class="btn-secondary btn-reset"
                :disabled="executor.loading || executor.aiMockLoading"
                @click="onReset"
            >
                {{ executor.t('reset') }}
            </el-button>
            <el-button
                class="btn-secondary"
                :disabled="executor.loading || executor.aiMockLoading"
                @click="executor.variableExtractionVisible = true"
            >
                {{ executor.t('variable-extraction') }}
            </el-button>
            <el-dropdown
                trigger="hover"
                class="mock-dropdown"
                :class="{ 'is-disabled': executor.loading || executor.mockLoading || executor.aiMockLoading }"
                @command="executor.onMockCommand"
            >
                <span
                    class="el-dropdown-link mock-dropdown-link"
                    :class="{ 'is-disabled': executor.loading || executor.mockLoading || executor.aiMockLoading }"
                >
                    <el-icon v-if="executor.aiMockLoading" class="is-loading mock-loading-icon">
                        <Loading />
                    </el-icon>
                    <span>Mock</span>
                    <el-icon class="el-icon--right">
                        <ArrowDown />
                    </el-icon>
                </span>
                <template #dropdown>
                    <el-dropdown-menu>
                        <el-dropdown-item command="schema">Mock (Schema)</el-dropdown-item>
                        <el-dropdown-item command="ai">AI Mock</el-dropdown-item>
                    </el-dropdown-menu>
                </template>
            </el-dropdown>
            <el-button
                v-if="executor.currentTool"
                class="btn-secondary"
                :disabled="executor.loading || executor.aiMockLoading"
                @click="executor.saveAsTestCase"
            >
                {{ executor.t('save-as-test-case') }}
            </el-button>
            <el-button
                type="primary"
                :loading="executor.loading"
                :disabled="executor.aiMockLoading"
                @click="executor.handleExecute"
                class="btn-execute"
            >
                <span>{{ executor.t('execute-tool') }}</span>
                <span class="ctrl">CTRL</span>
                <span class="iconfont icon-enter"></span>
            </el-button>
        </el-button-group>
    </div>
</template>

<script setup lang="ts">
import { inject, computed } from 'vue';
import { ArrowDown, Loading } from '@element-plus/icons-vue';

const executorRef = inject<{ value?: any }>('toolExecutorRef', { value: null });
const executor = computed(() => executorRef?.value ?? null);
const executorReset = inject<() => void>('toolExecutorReset', () => {});

function onReset() {
    executorReset();
}
</script>

<style scoped>
/* 与设置页 API 的 setting-save-container 一致：右对齐 + 按钮组 */
.executor-actions-wrapper {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    flex-wrap: wrap;
    margin: 16px 0;
}

.executor-actions-group {
    display: inline-flex;
}

.executor-actions-group .el-button:first-child {
    border-top-left-radius: 8px !important;
    border-bottom-left-radius: 8px !important;
}

.executor-actions-group .el-button:last-child {
    border: 1px solid var(--main-light-color-50) !important;
    border-bottom-right-radius: 8px !important;
    border-top-right-radius: 8px !important;
}

.executor-actions-group .el-button {
    border-radius: 0 !important;
    border-color: var(--window-button-active) !important;
    border-top: 1px solid var(--window-button-active);
    border-left: 1px solid var(--window-button-active);
    border-bottom: 1px solid var(--window-button-active);
    border-right: 1px solid var(--window-button-active);
    background-color: var(--el-fill-color-blank);
    color: var(--el-text-color-regular);
    padding: 8px 18px;
    font-size: 14px;
    transition: var(--animation-3s);
}

.executor-actions-group .btn-secondary {
    border-radius: 0;
}

.executor-actions-group .el-button:hover:not(:disabled):not(.btn-execute) {
    border-color: var(--el-border-color-hover);
    background-color: var(--main-light-color-30);
    color: var(--el-text-color-primary);
}

.executor-actions-group .btn-secondary.is-disabled {
    opacity: 0.5;
}

.btn-reset {
    border-top-left-radius: 8px !important;
    border-bottom-left-radius: 8px !important;
}

.executor-actions-group > *:last-child .el-button {
    border-top-right-radius: 8px !important;
    border-bottom-right-radius: 8px !important;
    border: 1px solid var(--main-light-color-70) !important;
}

.executor-actions-group .el-button:only-child {
    border-radius: 8px !important;
}

.mock-dropdown {
    display: inline-flex;
}

.mock-dropdown-link {
    cursor: pointer;
    color: var(--el-text-color-regular);
    display: flex;
    align-items: center;
    padding: 8px 18px;
    font-size: 14px;
    border-top: 1px solid var(--window-button-active);
    border-bottom: 1px solid var(--window-button-active);
    border-left: 1px solid var(--window-button-active);
    background-color: var(--el-fill-color-blank);
    transition: var(--animation-3s);
}

.mock-dropdown-link:hover:not(.is-disabled) {
    color: var(--el-text-color-primary);
    background-color: var(--main-light-color-50);
}

.mock-dropdown-link.is-disabled {
    cursor: not-allowed;
    opacity: 0.5;
}

.mock-dropdown-link .el-icon--right {
    margin-left: 4px;
}

.mock-loading-icon {
    margin-right: 6px;
    font-size: 14px;
}

/* 执行按钮与设置页「保存」按钮一致：强调色 */
.btn-execute {
    background-color: var(--main-light-color-20) !important;
    color: var(--el-text-color-primary) !important;
    border-color: var(--main-light-color-50) !important;
    font-weight: 600;
}

.btn-execute:hover:not(:disabled),
.btn-execute:focus {
    background-color: var(--main-light-color-50) !important;
    color: var(--el-text-color-primary) !important;
    border-color: var(--main-light-color-90) !important;
}

/* 与设置页测试/保存按钮一致的快捷键提示 */
.btn-execute .ctrl {
    margin-left: 5px;
    opacity: 0.6;
    font-weight: 100;
}

.btn-execute .iconfont {
    color: var(--main-color);
}

</style>
