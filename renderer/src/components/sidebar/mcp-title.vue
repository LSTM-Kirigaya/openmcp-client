<template>
	<div class="mcp-title">
		<div class="openmcp-logo" style="width: 48px; height: 48px; margin-top: 10px; margin-bottom: 15px; margin-right: 10px;"></div>
		<!-- <div>OpenMCP</div> -->
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

.mcp-title > div {
	font-size: 24px;
}
</style>