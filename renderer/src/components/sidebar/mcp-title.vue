<template>
	<div class="mcp-title">
		<img src="/images/openmcp.svg" alt="">
		<div>OpenMCP</div>
	</div>
</template>

<script setup lang="ts">
import { defineComponent } from 'vue';

defineComponent({ name: 'mcp-title' });
</script>

<style>
.mcp-title {
	display: flex;
	align-items: center;
}

.mcp-title > img {
	height: 48px;
	margin-right: 10px;
}

.mcp-title > div {
	font-size: 24px;
}

</style>