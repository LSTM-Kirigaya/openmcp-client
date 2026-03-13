<template>
    <div class="main-panel-container">
        <div class="tabs-container">
            <el-scrollbar>
                <div class="scroll-tabs-container">
                    <span class="tab" v-for="(tab, index) of tabs.content" :key="tab.id"
                        :class="{ 'active-tab': tabs.activeIndex === index }" @click="setActiveTab(index)">
                        <span>
                            <span :class="`iconfont ${tab.icon}`"></span>
                            <span class="tab-name">{{ tab.name }}</span>
                        </span>
                        <span class="iconfont icon-close" @click.stop="closeTab(index)"></span>
                    </span>
                    <span class="add-button iconfont icon-add" @click="pageAddNewTab"></span>
                </div>
            </el-scrollbar>
        </div>

        <div class="main-panel">
            <router-view />
        </div>
    </div>
</template>

<script setup lang="ts">
import { defineComponent } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { addNewTab, tabs, closeTab } from './panel';

defineComponent({ name: 'main-panel' });

const baseURL = import.meta.env.BASE_URL;

const route = useRoute();
const router = useRouter();

function pageAddNewTab() {
    addNewTab();

    // 如果当前不在 debug 路由，则切换到 debug 路由
    if (route.name !== 'debug') {
        router.push(baseURL + 'debug');
    }
}

function setActiveTab(index: number) {
    if (index >= 0 && index < tabs.content.length) {
        tabs.activeIndex = index;
        // 如果不在 debug 路由，则进入
        if (route.name !== 'debug') {
            router.push(baseURL + 'debug');
        }
    }
}

</script>

<style>
.main-panel-container {
    justify-content: center;
    flex-direction: column;
    width: 100%;
    min-width: 800px;
    height: 100%;
    margin-left: 8px;
}

.main-panel {
    width: 100%;
    height: calc(100% - 46px);
    overflow: hidden;
}

.scroll-tabs-container {
    width: fit-content;
    display: flex;
    align-items: center;
    gap: 6px;
}

.tabs-container {
    height: 38px;
    width: 100%;
    background-color: var(--background);
    display: flex;
    align-items: center;
    user-select: none;
    margin-bottom: 8px;
    padding: 4px 8px;
    border-radius: 12px;
}

.tabs-container .el-scrollbar {
    height: fit-content;
    flex: 1;
}

.tabs-container .tab {
    white-space: nowrap;
    font-size: var(--vscode-font-size, 13px);
    min-width: 110px;
    max-width: 140px;
    border-radius: 12px;
    background-color: transparent;
    padding: 6px 12px;
    display: flex;
    align-items: center;
    transition: var(--animation-3s);
    justify-content: space-between;
    position: relative;
    border: 1px solid transparent;
    color: var(--foreground);
}

.tabs-container .tab:active {
    transform: scale(0.98);
    transition: var(--animation-3s);
}

.tabs-container .tab>span:first-child {
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
}

.tabs-container .tab .tab-name {
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
}

.tabs-container .tab:hover {
    background-color: var(--sidebar-item-hover);
    border-color: var(--main-light-color-20);
}

/* 优化高亮效果：使用品牌色替代白色 */
.tabs-container .tab.active-tab {
    background-color: var(--main-light-color-20);
    color: var(--main-color);
    border-color: var(--main-light-color-40);
}

.tabs-container .tab .iconfont {
    margin-right: 8px;
    flex-shrink: 0;
}

.tabs-container .icon-close {
    margin-left: 6px;
    margin-right: 0 !important;
    border-radius: 8px;
    cursor: pointer;
    padding: 2px 4px;
    transition: var(--animation-3s);
    flex-shrink: 0;
}

.tabs-container .icon-close:hover {
    background-color: var(--main-light-color-30);
    color: var(--main-color);
}

.tabs-container .add-button {
    cursor: pointer;
    font-size: 16px;
    margin-left: 4px;
    border-radius: 12px;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: var(--animation-3s);
    flex-shrink: 0;
}

.tabs-container .add-button:hover {
    color: var(--main-color);
    background-color: var(--main-light-color-20);
    transition: var(--animation-3s);
}

.close-icon {
    margin-left: 8px;
    font-size: 14px;
    padding: 2px;
    border-radius: 8px;
}

.close-icon:hover {
    background-color: var(--sidebar-item-hover);
}
</style>