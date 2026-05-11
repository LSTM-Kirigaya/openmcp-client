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
	border-radius: 10px;
    background-color: var(--sidebar);
    border: 1px solid var(--border);
}

.sidebar-option-item {
	margin: 0;
	height: 40px;
	width: 42px;
	min-width: 42px;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 0;
	border-radius: 10px;
	transition: var(--animation-3s);
	cursor: pointer;
	border: 1px solid transparent;
	background-color: transparent;
	color: var(--sidebar-item-text);
}

.sidebar-option-item:hover {
	background-color: var(--sidebar-item-hover);
	border-color: var(--main-light-color-20);
	color: var(--foreground);
	transition: var(--animation-3s);
}

.sidebar-option-item .iconfont {
	width: 16px;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 20px;
}

/* 优化高亮效果：使用品牌色替代白色 */
.sidebar-option-item.active {
	background-color: var(--main-light-color-20);
	color: var(--main-color);
	border-color: var(--main-light-color-40);
	transition: var(--animation-3s);
}

.sidebar-option-item.active:hover {
	background-color: var(--main-light-color-30);
	border-color: var(--main-light-color-50);
}
</style>
