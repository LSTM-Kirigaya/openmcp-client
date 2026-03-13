<template>
	<el-tooltip content="访问 OpenMCP 官网" placement="right" effect="light">
		<div class="mcp-title" @click="clickLogo">
			<img src="/favicon.svg" alt="OpenMCP" class="mcp-logo-icon" />
		</div>
	</el-tooltip>
</template>

<script setup lang="ts">
import { defineComponent } from 'vue';

defineComponent({ name: 'mcp-title' });


function clickLogo() {
	window.open('https://openmcp.kirigaya.cn/', '_blank');
}

</script>

<style>
.mcp-title {
	height: 52px;
	display: flex;
	align-items: center;
	justify-content: center;
	user-select: none;
	-webkit-user-drag: none;
	transition: var(--animation-3s);
	cursor: pointer;
	background: transparent;
	border: none;
}

.mcp-title:hover {
	opacity: 0.8;
}

.mcp-title .mcp-logo-icon {
	width: 32px;
	height: 32px;
	object-fit: contain;
	transition: var(--animation-3s);
}

.mcp-title:hover .mcp-logo-icon {
	transform: scale(1.05);
}
</style>
