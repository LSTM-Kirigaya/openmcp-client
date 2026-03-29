<template>
	<div class="setting-module-container">
		<el-splitter class="setting-splitter">
			<el-splitter-panel :min="120" :max="400" size="200" class="splitter-panel-left">
				<div class="setting-list-panel">
					<div class="list-container">
						<el-scrollbar>
							<div class="list-inner">
								<div
									v-for="opt in settingSections.data"
									:key="opt.value"
									class="list-item"
									:class="{ active: settingSections.current === opt.value }"
									@click="settingSections.current = opt.value"
								>
									<div class="list-item-content">
										<div class="item-title">{{ opt.label }}</div>
									</div>
								</div>
							</div>
						</el-scrollbar>
					</div>
				</div>
			</el-splitter-panel>
			<el-splitter-panel class="splitter-panel-right">
				<div class="setting-detail-panel">
					<el-scrollbar height="100%">
						<div class="setting-content">
							<Service v-show="settingSections.current === 'service'" />
							<General v-show="settingSections.current === 'general'" />
							<Api v-show="settingSections.current === 'api'" />
							<Appearance v-show="settingSections.current === 'appearance'" />
							<CloudAccount v-show="settingSections.current === 'cloud-account'" />
						</div>
					</el-scrollbar>
				</div>
			</el-splitter-panel>
		</el-splitter>
	</div>
</template>

<script setup lang="ts">
import { defineComponent, onMounted } from 'vue';

import { colorManager } from './color';

import Service from './service.vue';
import General from './general.vue';
import Api from './api.vue';
import Appearance from './appearance.vue';
import CloudAccount from './cloud-account.vue';
import { settingSections } from './setting-section';

defineComponent({ name: 'setting' });

onMounted(() => {
	colorManager.initColor();
});



</script>

<style>
/* 与工具调用测试页一致的左右分栏布局 */
.setting-module-container {
	height: 100%;
}

.setting-splitter {
	height: 100%;
}

.setting-splitter :deep(.el-splitter__panel) {
	overflow: hidden;
}

.splitter-panel-left {
	display: flex;
	flex-direction: column;
}

.splitter-panel-right {
	display: flex;
	flex-direction: column;
	min-width: 0;
}

.setting-list-panel {
	width: 100%;
	height: 100%;
	border-right: 1px solid var(--el-border-color-light);
	background-color: var(--el-bg-color);
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

.setting-list-panel .list-container {
	flex: 1;
	min-height: 0;
}

.setting-list-panel .list-container .el-scrollbar {
	height: 100%;
}

.setting-list-panel .list-inner {
	padding: 10px;
}

.setting-list-panel .list-item {
	margin: 3px;
	padding: 10px 12px;
	border-radius: 0.3em;
	user-select: none;
	cursor: pointer;
	display: flex;
	flex-direction: row;
	align-items: center;
	gap: 8px;
	transition: var(--animation-3s);
}

.setting-list-panel .list-item:hover {
	background-color: var(--el-fill-color-light);
}

.setting-list-panel .list-item.active {
	background-color: var(--el-fill-color-light);
	border-left: 3px solid var(--el-color-primary-light-5);
}

.setting-list-panel .list-item-content {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	align-items: flex-start;
}

.setting-list-panel .item-title {
	font-weight: bold;
	font-size: 13px;
	max-width: 100%;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.setting-detail-panel {
	flex: 1;
	min-width: 0;
	width: 100%;
	height: 100%;
	background-color: var(--el-bg-color);
	overflow: hidden;
}

.setting-detail-panel .el-scrollbar {
	height: 100%;
}

.setting-detail-panel :deep(.el-scrollbar__wrap),
.setting-detail-panel :deep(.el-scrollbar__view) {
	height: 100%;
}

.setting-content {
	display: flex;
	flex-direction: column;
    align-items: center;
	gap: 8px;
	padding: 24px 32px;
	height: fit-content;
	min-height: 100%;
	box-sizing: border-box;
}

.setting-section {
	padding: 20px 24px;
	margin: 0;
    width: 550px;
	border-radius: 16px;
	min-height: 50px;
}

.setting-section h2 {
	font-size: 15px;
	font-weight: 600;
	margin: 0 0 16px 0;
	padding-bottom: 12px;
	border-bottom: 1px solid var(--sidebar-border);
	color: var(--foreground);
}

/* 选项列表包装器：仅包含 .setting-option，便于首尾圆角与边框 */
.setting-section .setting-options .setting-option {
	border-top: 1px solid var(--window-button-active);
	border-left: 1px solid var(--window-button-active);
	border-right: 1px solid var(--window-button-active);
    background-color: var(--sidebar);
}

.setting-section .setting-options .setting-option .el-input__wrapper,
.setting-section .setting-options .setting-option .el-select__wrapper {
    border: 1px solid var(--window-button-active);
}

.setting-section .setting-options .setting-option:first-child {
	border-top-left-radius: 16px;
	border-top-right-radius: 16px;
}

.setting-section .setting-options .setting-option:last-child {
	border-bottom: 1px solid var(--window-button-active);
	border-bottom-left-radius: 16px;
	border-bottom-right-radius: 16px;
}

.setting-option {
	padding: 14px 18px;
	min-height: 44px;
	background-color: var(--background);
	display: flex;
	align-items: center;
	justify-content: space-between;
	font-size: 14px;
	gap: 16px;
	transition: var(--animation-3s);
}

.option-group {
	display: flex;
	width: fit-content;
	align-items: center;
	gap: 8px;
}

.option-title {
	font-size: 14px;
	min-width: 100px;
	margin-right: 0;
	user-select: none;
	color: var(--foreground);
}

.setting-option .el-select,
.setting-option .el-input,
.setting-option .el-input__wrapper {
	border-radius: 12px;
}

.setting-section .el-button--primary {
	border-radius: 16px !important;
	background-color: var(--foreground) !important;
	color: var(--background) !important;
	border-color: var(--foreground) !important;
}

.setting-section .el-button--primary:hover,
.setting-section .el-button--primary:focus {
	background-color: var(--foreground) !important;
	color: var(--background) !important;
	border-color: var(--foreground) !important;
	opacity: 0.9;
}

.el-checkbox-button.is-checked:first-child .el-checkbox-button__inner,
.el-checkbox-button__inner {
	font-size: 13px !important;
	border-radius: 16px !important;
}

.el-slider__button {
	background-color: var(--main-color) !important;
	border-color: var(--main-color) !important;
}

.el-slider__stop {
	background-color: var(--main-color) !important;
}

.llm-option img {
	height: 20px;
	width: 20px;
	margin-right: 8px;
}

.llm-option {
	display: flex;
	align-items: center;
	margin: 2px;
}
</style>