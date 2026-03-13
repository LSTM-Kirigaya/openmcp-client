<template>
	<div class="sidebar-container">
		<div class="sidebar-top">
			<McpTitle></McpTitle>
			<div class="sidebar-buttons-wrapper">
				<SidebarItemContainer></SidebarItemContainer>
			</div>
		</div>

		<div class="sidebar-bottom">
			<div class="sidebar-external-links">
				<el-tooltip :content="t('sidebar-github')" placement="right" effect="light">
					<a class="sidebar-link" href="https://github.com/LSTM-Kirigaya/openmcp-client" target="_blank" rel="noopener noreferrer">
						<span class="iconfont icon-github"></span>
					</a>
				</el-tooltip>
				<el-tooltip :content="t('openmcp-document')" placement="right" effect="light">
					<a class="sidebar-link" href="https://openmcp.kirigaya.cn" target="_blank" rel="noopener noreferrer">
						<span class="iconfont icon-wendang"></span>
					</a>
				</el-tooltip>
				<el-tooltip :content="t('sidebar-author-homepage')" placement="right" effect="light">
					<a class="sidebar-link" href="https://kirigaya.cn/about" target="_blank" rel="noopener noreferrer">
						<span class="iconfont icon-home-page"></span>
					</a>
				</el-tooltip>
			</div>
			<Connected></Connected>
		</div>
	</div>
</template>

<script setup lang="ts">
import { defineComponent } from 'vue';
import { useI18n } from 'vue-i18n';

import McpTitle from './mcp-title.vue';
import SidebarItemContainer from './sidebar-item-container.vue';
import Connected from './connected.vue';

defineComponent({ name: 'sidebar' });
const { t } = useI18n();

</script>

<style>
.sidebar-container {
	width: var(--sidebar-width, 52px);
	min-width: var(--sidebar-width, 52px);
	height: 100%;
	display: flex;
	flex-direction: column;
	justify-content: space-between;
}

.sidebar-top {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	min-height: 0;
}

.sidebar-buttons-wrapper {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
}

.sidebar-bottom {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;
}

.sidebar-external-links {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 4px;
}

.sidebar-external-links .sidebar-link {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 36px;
	height: 32px;
	border-radius: 8px;
	color: var(--sidebar-item-text);
	transition: var(--animation-3s);
	text-decoration: none;
	border: 1px solid transparent;
}

.sidebar-external-links .sidebar-link:hover {
	background-color: var(--sidebar-item-hover);
	border-color: var(--main-light-color-20);
	color: var(--foreground);
}

.sidebar-external-links .sidebar-link .iconfont {
	font-size: 16px;
}

.sidebar-container > hr {
	height: 1px;
	width: 90%;
	background-color: var(--sidebar-border);
	border: none;
}

</style>