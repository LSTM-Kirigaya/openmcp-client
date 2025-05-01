<template>
		<el-tooltip :content="t('websearch')" placement="top">
			<div class="setting-button" :class="{ 'active': tabStorage.settings.enableWebSearch }" size="small"
				@click="toggleWebSearch">
				<span class="iconfont icon-web"></span>
			</div>
		</el-tooltip>
</template>

<script setup lang="ts">
import { inject } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChatStorage } from '../chat';

const { t } = useI18n();

const tabStorage = inject('tabStorage') as ChatStorage;

const toggleWebSearch = () => {
	tabStorage.settings.enableWebSearch = !tabStorage.settings.enableWebSearch;
};

</script>

<style>
</style>