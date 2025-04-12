<template>
	<div class="setting-section">
		<h2>{{ "API" }}</h2>
		<div class="setting-option">
			<span>
				<span class="iconfont icon-company"></span>
				<span class="option-title">{{ t('server-provider') }}</span>
			</span>
			<div style="width: 160px;">
				<el-select
					name="language-setting"
					class="language-setting"
					v-model="llmManager.currentModelIndex"
					@change="onmodelchange">

					<el-option v-for="(option, index) in llms" :value="index" :label="option.name" :key="index">
						<div class="llm-option">
							<span :class="`${option.id}-icon server-icon`"></span>
							<span>{{ option.name }}</span>
						</div>
					</el-option>
				</el-select>
			</div>
		</div>

		<!-- 根据不同模型展示不同的接入点 -->
		<div v-if="false">

		</div>
		<div v-else>
			<div class="setting-option">
				<span>
					<span class="iconfont icon-llm"></span>
					<span class="option-title">{{ t('model') }}</span>
				</span>
				<div style="width: 160px;">
					<el-select
						v-if="llms[llmManager.currentModelIndex]"
						name="language-setting" class="language-setting"
						v-model="llms[llmManager.currentModelIndex].userModel"
						@change="onmodelchange"
					>
						<el-option v-for="option in llms[llmManager.currentModelIndex].models"
							:value="option"
							:label="option"
							:key="option"
						></el-option>
					</el-select>
				</div>
			</div>

			<div class="setting-option">
				<span>
					<span class="iconfont icon-url-line"></span>
					<span class="option-title">{{ t('api-root-url') }}</span>
				</span>
				<div style="width: 240px;">
					<el-input
						v-if="llms[llmManager.currentModelIndex]"
						v-model="llms[llmManager.currentModelIndex].baseUrl"
						placeholder="https://"
					/>
				</div>
			</div>

			<div class="setting-option">
				<span>
					<span class="iconfont icon-token"></span>
					<span class="option-title">{{ t('api-token') }}</span>
				</span>
				<div style="width: 240px;">
					<el-input
						v-if="llms[llmManager.currentModelIndex]"
						v-model="llms[llmManager.currentModelIndex].userToken"
						show-password
					/>
				</div>
			</div>
		</div>

		<br>

		<div class="setting-save-container">
			<el-button type="primary" @click="saveLlmSetting">
				{{ t('save') }}
			</el-button>
		</div>
	</div>

</template>

<script setup lang="ts">
import { defineComponent } from 'vue';
import { llmManager, llms, onmodelchange } from './llm';
import { useI18n } from 'vue-i18n';
import { saveSetting } from '@/hook/setting';
import { ElMessage } from 'element-plus';

defineComponent({ name: 'api' });
const { t } = useI18n();

function saveLlmSetting() {
	saveSetting(() => {
		ElMessage({
			message: '成功保存',
			type: 'success'
		});
	});
}

</script>

<style>
.setting-save-container {
	margin: 5px;
}
</style>