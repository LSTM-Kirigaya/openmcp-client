<template>
	<div class="setting-section">
		<h2>{{ t('appearance-setting') }}</h2>
		<div class="setting-option">
			<span class="option-title">
				<span class="iconfont icon-bg-colors"></span>

				{{ t('setting.general-color-setting') }}
			</span>
			<div class="option-group">
				<div style="height: 20px; width: 20px;"></div>
				<el-color-picker v-model="colorManager.mainColor" @change="onGeneralColorChange"
					:predefine="predefinedColors" />
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { defineComponent } from 'vue';
import { colorManager, onGeneralColorChange, predefinedColors } from './color';
import { useI18n } from 'vue-i18n';

defineComponent({ name: 'general' });
const { t } = useI18n();

</script>

<style></style>