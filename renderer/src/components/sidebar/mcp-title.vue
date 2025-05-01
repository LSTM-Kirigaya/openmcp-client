<template>
	<div class="mcp-title">
		<div class="simple-logo"
			@click="clickLogo"
		>
			<span class="iconfont icon-openmcp"></span>
			<span style="font-size: 12px;">openmcp</span>
		</div>
	</div>
</template>

<script setup lang="ts">
import { defineComponent } from 'vue';

defineComponent({ name: 'mcp-title' });


function clickLogo() {
	window.open('https://kirigaya.cn/blog/article?seq=311', '_blank');
}

</script>

<style>
.mcp-title {
	display: flex;
	align-items: center;
	padding: 5px 10px;
}

.mcp-title>div {
	font-size: 24px;
}

.simple-logo {
	height: 73px;
	display: flex;
	flex-direction: column;
	user-select: none;
	-webkit-user-drag: none;
	transition: var(--animation-3s);
	cursor: pointer;
}

.simple-logo:hover {
	color: var(--main-color);
}

.simple-logo .iconfont {
	font-size: 48px;
}

</style>