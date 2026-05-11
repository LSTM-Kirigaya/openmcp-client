<template>
	<div class="sidebar-container">
		<div class="sidebar-top">
			<McpTitle></McpTitle>
			<div class="sidebar-buttons-wrapper">
				<SidebarItemContainer></SidebarItemContainer>
			</div>
		</div>

		<div class="sidebar-bottom">
			<Connected></Connected>
		</div>
	</div>
</template>

<script setup lang="ts">
import { defineComponent } from 'vue';
import McpTitle from './mcp-title.vue';
import SidebarItemContainer from './sidebar-item-container.vue';
import Connected from './connected.vue';

defineComponent({ name: 'sidebar' });
</script>

<style>
.sidebar-container {
	width: var(--sidebar-width, 56px);
	min-width: var(--sidebar-width, 56px);
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

.sidebar-container > hr {
	height: 1px;
	width: 90%;
	background-color: var(--sidebar-border);
	border: none;
}
</style>
