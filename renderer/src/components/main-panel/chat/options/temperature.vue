<template>
		<el-tooltip :content="t('temperature-parameter')" placement="top">
			<div class="setting-button" @click="showTemperatureSlider = true">
				<span class="iconfont icon-temperature"></span>
				<span class="value-badge">{{ tabStorage.settings.temperature.toFixed(1) }}</span>
			</div>
		</el-tooltip>

        <!-- 温度参数滑块 -->
		<el-dialog v-model="showTemperatureSlider" :title="t('temperature-parameter')" width="400px">
			<div class="slider-container">
				<el-slider v-model="tabStorage.settings.temperature" :min="0" :max="2" :step="0.1" />
				<div class="slider-tips">
					<span> {{ t('precise') }}(0)</span>
					<span>{{ t('moderate') }}(1)</span>
					<span>{{ t('creative') }}(2)</span>
				</div>
			</div>
			<template #footer>
				<el-button @click="showTemperatureSlider = false">{{ t("cancel") }}</el-button>
			</template>
		</el-dialog>
</template>

<script setup lang="ts">
import { inject, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChatStorage } from '../chat';

const { t } = useI18n();
const tabStorage = inject('tabStorage') as ChatStorage;

const showTemperatureSlider = ref(false);

</script>

<style>
.icon-temperature {
	font-size: 18px;
}

</style>