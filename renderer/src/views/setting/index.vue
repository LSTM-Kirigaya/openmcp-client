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
	border-right: 1px solid var(--border);
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
	padding: 12px 10px;
}

.setting-list-panel .list-item {
	margin: 2px 4px;
	padding: 10px 14px;
	border-radius: 8px;
	user-select: none;
	cursor: pointer;
	display: flex;
	flex-direction: row;
	align-items: center;
	gap: 8px;
	transition: var(--animation-3s);
	border: 1px solid transparent;
}

.setting-list-panel .list-item:hover {
	background-color: var(--sidebar-item-hover);
	border-color: var(--main-light-color-20);
}

/* 优化高亮效果：使用品牌色替代白色 */
.setting-list-panel .list-item.active {
	background-color: var(--main-light-color-10);
	border: 1px solid var(--main-light-color-30);
}

/* 活跃项的标题使用品牌色 */
.setting-list-panel .list-item.active .item-title {
	color: var(--main-color);
	font-weight: 600;
}

.setting-list-panel .list-item-content {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	align-items: flex-start;
}

.setting-list-panel .item-title {
	font-weight: 500;
	font-size: 13px;
	max-width: 100%;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	color: var(--foreground);
	transition: var(--animation-3s);
}

/* 非活跃项标题使用更柔和的颜色 */
.setting-list-panel .list-item:not(.active) .item-title {
	color: var(--foreground-muted);
}

.setting-list-panel .list-item:hover .item-title {
	color: var(--foreground);
}

.setting-detail-panel {
	flex: 1;
	min-width: 0;
	width: 100%;
	height: 100%;
	background-color: var(--background);
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

/* 设置卡片：优化边框为更 subtle 的风格 */
.setting-section {
	padding: 20px 24px;
	margin: 0;
    width: 550px;
	border-radius: 12px;
	min-height: 50px;
}

.setting-section h2 {
	font-size: 15px;
	font-weight: 600;
	margin: 0 0 16px 0;
	padding-bottom: 12px;
}

/* 选项列表包装器：与 connect 页面一致 */
.setting-section .setting-options .setting-option {
	border-top: 1px solid var(--window-button-active);
	border-left: 1px solid var(--window-button-active);
	border-right: 1px solid var(--window-button-active);
    background-color: var(--sidebar);
}

.setting-section .setting-options .setting-option .el-input__wrapper,
.setting-section .setting-options .setting-option .el-select__wrapper {
    border: 1px solid var(--window-button-active);
	transition: var(--animation-3s);
}

/* 输入框聚焦时使用品牌色 */
.setting-section .setting-options .setting-option .el-input__wrapper:hover,
.setting-section .setting-options .setting-option .el-select__wrapper:hover {
	border-color: var(--main-light-color-50);
}

.setting-section .setting-options .setting-option .el-input__wrapper.is-focus,
.setting-section .setting-options .setting-option .el-select__wrapper.is-focused {
	border-color: var(--main-color);
	box-shadow: 0 0 0 1px var(--main-light-color-20);
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
	background-color: var(--sidebar);
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
	border-radius: 8px;
}

/* 按钮样式优化 */
.setting-section .el-button--primary {
	border-radius: 8px !important;
	background-color: var(--main-color) !important;
	color: #ffffff !important;
	border-color: var(--main-color) !important;
	transition: var(--animation-3s);
}

.setting-section .el-button--primary:hover,
.setting-section .el-button--primary:focus {
	background-color: var(--main-light-color-90) !important;
	border-color: var(--main-light-color-90) !important;
	opacity: 1;
}

.el-checkbox-button.is-checked:first-child .el-checkbox-button__inner,
.el-checkbox-button__inner {
	font-size: 13px !important;
	border-radius: 8px !important;
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
