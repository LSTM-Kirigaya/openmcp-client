<template>
	<el-scrollbar height="100%">
		<div class="setting-container">
			<div>
				<el-segmented
					v-model="settingSections.current"
					:options="settingSections.data"
					size="large"
					style="margin: 10px; font-size: 16px; background-color: var(--background);"
				>
				<template #default="scope">
					<div class="setting-section-option">
						{{ scope.item.label }}
					</div>
				</template>
				</el-segmented>
				<div>

					<General v-show="settingSections.current === 'general'"></General>
					<Api v-show="settingSections.current === 'api'"></Api>
					<Appearance v-show="settingSections.current === 'appearance'"></Appearance>

				</div>
			</div>
		</div>
	</el-scrollbar>
</template>

<script setup lang="ts">
import { defineComponent, ref, onMounted } from 'vue';

import { colorManager } from './color';

import General from './general.vue';
import Api from './api.vue';
import Appearance from './appearance.vue';
import { settingSections } from './setting-section';

defineComponent({ name: 'setting' });

onMounted(() => {
	colorManager.initColor();
});



</script>

<style>
.setting-container {
	position: relative;
	width: 60%;
	padding: 5px 20px;
	height: fit-content;
	display: flex;
	flex-direction: column;
	justify-content: center;
	border-radius: .5em;
}

.setting-drag {
	height: 20px;
	width: 100%;
	background-color: var(--main-color);
	position: relative;
	border-radius: .5em .5em 0 0;
}

.setting-section-option {
	padding: 10px;

}

.setting-container .el-scrollbar {
	width: 400px;
	user-select: none;
}

.setting-section {
	padding: 10px;
	margin: 10px;
	border-radius: .3em;
	min-height: 50px;
}

.setting-option {
	margin: 3px;
	margin-bottom: 10px;
	padding: 8px 12px;
	height: 40px;
	border-radius: .5em;
	background-color: var(--background);
	display: flex;
	align-items: center;
	justify-content: space-between;
	font-size: 0.9rem;
}

.setting-option .iconfont {
	margin-right: 8px;
	font-size: 15px;
}

.option-group {
	display: flex;
	width: fit-content;
}

.option-title {
	font-size: 0.8rem;
	min-width: 80px;
	margin-right: 12px;
	user-select: none;
}

.el-checkbox-button.is-checked:first-child .el-checkbox-button__inner,
.el-checkbox-button__inner {
	font-size: 0.8rem !important;
}

.el-slider__button {
	background-color: var(--background) !important;
}

.el-slider__stop {
	background-color: var(--vscode-foreground) !important;
}

.llm-option img {
	height: 20px;
	width: 20px;
	margin-right: 7px;
}

.llm-option {
	display: flex;
	align-items: center;
	margin: 2px;
}
</style>