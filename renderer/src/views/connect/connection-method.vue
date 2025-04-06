<template>
	<div class="connection-option">
		<span>{{ t('connection-method') }}</span>
		<span style="width: 200px;">
			<el-select name="language-setting" class="language-setting" v-model="connectionMethods.current">
				<el-option v-for="option in connectionMethods.data" :value="option.value" :label="option.label"
					:key="option.label"></el-option>
			</el-select>
		</span>
	</div>
</template>

<script setup lang="ts">
import { defineComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import { connectionMethods } from './connection';

defineComponent({ name: 'connection-method' });

const { t } = useI18n();

</script>

<style></style>