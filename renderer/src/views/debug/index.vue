<template>
	<div style="height: 100%;">
		<Welcome v-show="!haveActiveTab"></Welcome>
		
		<!-- 如果存在激活标签页，则根据标签页进行渲染 -->
		<div v-show="haveActiveTab" v-if="panelLoaded" style="height: 100%;">
			<!-- vscode/trae 中，下面存在初始化问题 -->
			<component
                v-show="tab === tabs.content[tabs.activeIndex]"
                v-for="(tab, index) of tabs.content"
				:key="index"
				:is="tab.component"
                :tab-id="index"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { defineComponent, computed } from 'vue';

import Welcome from './welcome.vue';
import { tabs } from '@/components/main-panel/panel';
import { panelLoaded } from '@/hook/panel';

defineComponent({ name: 'debug' });

const haveActiveTab = computed(() => {
	const activeTab = tabs.activeTab;
	if (activeTab && activeTab.component) {
		return true;
	}
	return false;
});

</script>

<style>
</style>