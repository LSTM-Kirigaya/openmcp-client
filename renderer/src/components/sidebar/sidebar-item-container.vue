<template>
	<div class="sidebar-item-container">
		<div v-for="(item, index) of sidebarItems" :key="index"
			:id="`sidebar-${item.ident}`"
		>
			<el-tooltip :content="t(item.labelKey ?? item.ident)" placement="right" effect="light">
				<div class="sidebar-option-item" :class="{ 'active': isActive(item.ident) }"
					@click="gotoOption(item.ident)">
					<span :class="`iconfont ${item.icon}`"></span>
				</div>
			</el-tooltip>
		</div>
	</div>
</template>

<script setup lang="ts">
import { defineComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { sidebarItems } from './sidebar';

defineComponent({ name: 'sidebar-item-container' });

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

function isActive(name: string) {
	return route.name === name;
}

const baseUrl = import.meta.env.BASE_URL;

function gotoOption(ident: string) {
	router.push(baseUrl + ident);
}

</script>

<style>
.sidebar-item-container {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 4px;
	padding: 6px 4px;
	border-radius: 8px;
    background-color: var(--sidebar);
    border: 1px solid var(--window-button-active);
}

.sidebar-option-item {
	margin: 0;
	height: 32px;
	width: 36px;
	min-width: 36px;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 0;
	border-radius: 8px;
	transition: var(--animation-3s);
	cursor: pointer;
	border: 1px solid transparent;
	background-color: transparent;
	color: var(--sidebar-item-text);
}

.sidebar-option-item:hover {
	background-color: var(--sidebar-item-hover);
	color: var(--foreground);
	transition: var(--animation-3s);
}

.sidebar-option-item .iconfont {
	width: 14px;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 16px;
}

.sidebar-option-item.active {
	background-color: var(--foreground);
	color: var(--background);
	transition: var(--animation-3s);
}
</style>