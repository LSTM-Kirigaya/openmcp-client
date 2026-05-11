<template>
	<div class="setting-section">
		<h2>{{ t('connection-settings') }}</h2>
		<div class="setting-options">
			<div class="setting-option connection-method-option">
				<span class="option-title">{{ t('connection-type') }}</span>
				<el-radio-group v-model="client.connectionArgs.connectionType" size="default" class="connection-method-radio">
					<el-radio-button
						v-for="option in connectionSelectDataViewOption"
						:key="option.value"
						:value="option.value"
					>
						{{ option.label }}
					</el-radio-button>
				</el-radio-group>
			</div>
			<template v-if="client.connectionArgs.connectionType === 'STDIO'">
				<div class="setting-option">
					<span class="option-title">{{ t('command') }}</span>
					<div class="setting-option-input">
						<el-input v-model="client.connectionArgs.commandString" placeholder="mcp run <your script>" />
					</div>
				</div>
				<div class="setting-option">
					<span class="option-title">{{ t('cwd') }}</span>
					<div class="setting-option-input">
						<el-input v-model="client.connectionArgs.cwd" :placeholder="t('server-cwd-placeholder')" />
					</div>
				</div>
			</template>
			<template v-else>
				<div class="setting-option">
					<span class="option-title">URL</span>
					<div class="setting-option-input">
						<el-input v-model="client.connectionArgs.url" :placeholder="t('server-url-placeholder')" />
					</div>
				</div>
				<div v-if="client.connectionArgs.connectionType === 'STREAMABLE_HTTP'" class="setting-option setting-option--vertical">
					<div class="option-heading">
						<span class="option-title">{{ t('http-request-headers') }}</span>
						<span class="option-description">{{ t('http-request-headers-desc') }}</span>
					</div>
					<div class="setting-option-input http-headers-input">
						<KInputObject
							v-model="client.connectionArgs.headers"
							:placeholder="t('http-request-headers-placeholder')"
							:schema="headersSchema"
						/>
					</div>
				</div>
			</template>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, defineComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import KInputObject from '@/components/k-input-object/index.vue';
import { connectionSelectDataViewOption, mcpClientAdapter } from './core';

defineComponent({ name: 'connection-method-and-args' });

const props = defineProps({
	index: { type: Number, required: true }
});

const client = computed(() => mcpClientAdapter.clients[props.index]);
const { t } = useI18n();

const headersSchema = {
	type: 'object',
	properties: {
		Authorization: {
			type: 'string',
			description: 'Authorization header',
			default: 'Bearer '
		},
		'X-API-Key': {
			type: 'string',
			description: 'API key header',
			default: ''
		}
	}
};
</script>

<style scoped>
.connection-method-option {
	display: flex;
	align-items: center;
}

.connection-method-radio {
	flex: 1;
	min-width: 0;
}

.connection-method-radio :deep(.el-radio-button) {
	flex: 1;
}

.connection-method-radio :deep(.el-radio-button__inner) {
	width: 100%;
}

.setting-option-input {
	flex: 1;
	min-width: 0;
}

.setting-option-input :deep(.el-input) {
	width: 100%;
}

.setting-option-input :deep(.el-input__wrapper) {
	border-radius: 12px;
}

.setting-option--vertical {
	align-items: stretch;
	flex-direction: column;
	gap: 8px;
}

.option-heading {
	display: flex;
	align-items: baseline;
	gap: 10px;
}

.option-description {
	font-size: 12px;
	color: var(--el-text-color-secondary);
	line-height: 1.5;
}

.http-headers-input {
	width: 100%;
}

.http-headers-input :deep(.k-input-object) {
	margin-bottom: 0;
	background-color: transparent;
}

.http-headers-input :deep(.cm-editor) {
	min-height: 108px;
	max-height: 220px;
	font-size: 12px;
}

.http-headers-input :deep(.cm-scroller) {
	font-family: var(--font-family-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace);
}
</style>
