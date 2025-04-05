<template>
	<div class="setting-section">
		<h2>{{ t('general-setting') }}</h2>
		<div class="setting-option">
			<span>
				<span class="iconfont icon-i18n"></span>
				<span class="option-title">{{ t('language-setting') }}</span>
			</span>
			<div style="width: 100px;">
				<el-select name="language-setting" class="language-setting" v-model="locale" @change="onlanguagechange">
					<el-option v-for="option in languageSetting.options" :value="option.value" :label="option.text"
						:key="option.value">
					</el-option>
				</el-select>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { defineComponent, ref } from 'vue';
import { languageSetting } from './language';
import { useI18n } from 'vue-i18n';
import { saveSetting } from '@/hook/setting';

defineComponent({ name: 'appearance' });

const { t, locale } = useI18n();

const currentLanguage = ref('简体中文');

function onlanguagechange(code: string) {
	const option = languageSetting.options.find(item => item.value === code);
	if (option) {
		currentLanguage.value = option.text;
	}
	// languageDialogShow.value = true;

	saveSetting();	
}
</script>

<style></style>