<template>
	<div class="sidebar-container">
		<div>
			<McpTitle></McpTitle>
			<SidebarItemContainer></SidebarItemContainer>
		</div>

		<div>
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
	width: fit-content;
	height: 100%;
	display: flex;
	flex-direction: column;
	justify-content: space-between;
}

.sidebar-container > hr {
	height: 1px;
	width: 90%;
	fill: var(--main-color);
}

</style>