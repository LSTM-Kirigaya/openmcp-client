<template>
	<div class="main-panel-container">
		<div class="tabs-container">
            <el-scrollbar>
                <div class="scroll-tabs-container">
                    <span
                        class="tab"
                        v-for="(tab, index) of tabs.content"
                        :key="index"
                        :class="{ 'active-tab': tabs.activeIndex === index }"
                        @click="setActiveTab(index)"
                    >
                        <span>
                            <span :class="`iconfont ${tab.icon}`"></span>
                            <span class="tab-name">{{ tab.name }}</span>
                        </span>
                        <span 
                            class="iconfont icon-close"
                            @click.stop="closeTab(index)"
                        ></span>
                    </span>
                </div>
            </el-scrollbar>

			<span
				class="add-button iconfont icon-add"
				@click="pageAddNewTab"
			>
			</span>
		</div>


		<div class="main-panel">
			<router-view />
		</div>
	</div>
</template>

<script setup lang="ts">
import { defineComponent } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { addNewTab, tabs, setActiveTab, closeTab } from './panel';

defineComponent({ name: 'main-panel' });

const route = useRoute();
const router = useRouter();

function pageAddNewTab() {
	addNewTab();	

	// 如果当前不在 debug 路由，则切换到 debug 路由
	if (route.name !== 'debug') {
		router.push('/debug');
	}
}

</script>

<style>
.main-panel-container {
	display: flex;
	justify-content: center;
	flex-direction: column;
	width: 100%;
	min-width: 800px;
	height: 100%;
	margin-left: 20px;
}

.main-panel {
	background-color: var(--sidebar);
	border-radius: 1.2em;
	width: 100%;
	height: 90%;
}

.scroll-tabs-container {
    width: fit-content;
    display: flex;
}

.tabs-container {
	height: 78px;
	width: 90%;
	background-color: var(--background);
	display: flex;
	align-items: center;
    user-select: none;
	padding: 0 10px;
}

.tabs-container .el-scrollbar {
    height: fit-content;
}

.tabs-container .tab {
	white-space: nowrap;
	margin: 5px;
    font-size: 13px;
    width: 120px;
	border-radius: .5em;
	background-color: var(--sidebar);
	padding: 10px;
	display: flex;
	align-items: center;
	transition: var(--animation-3s);
    justify-content: space-between;
	position: relative;
}

.tabs-container .tab > span:first-child {
    display: flex;
    align-items: center;
}

.tabs-container .tab .tab-name {
	max-width: 70px;
	overflow: hidden;
	text-overflow: ellipsis;
}

.tabs-container .tab:hover {
	background-color: var(--input-active-background);
}

.tabs-container .tab.active-tab {
	background-color: var(--main-color);
	color: white;
}

.tabs-container .tab .iconfont {
	margin-right: 10px;
}

.tabs-container .icon-close {
    margin-left: 10px;
    margin-right: 0 !important;
    border-radius: .5em;
    cursor: pointer;
    padding: 3px;
    transition: var(--animation-3s);
}

.tabs-container .icon-close:hover {
    background-color: var(--main-light-color);
    transition: var(--animation-3s);
}

.tabs-container .add-button {
	cursor: pointer;
	font-size: 20px;
	margin-left: 5px;
	border-radius: .5em;
	height: 35px;
	width: 35px;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: var(--animation-3s);
}

.tabs-container .add-button:hover {
	color: var(--main-color);
	background-color: var(--sidebar);
	transition: var(--animation-3s);
}

.close-icon {
	margin-left: 8px;
	font-size: 14px;
	padding: 2px;
	border-radius: 50%;
}

.close-icon:hover {
	background-color: rgba(255, 255, 255, 0.2);
}
</style>