<template>
	<div class="connection-option">
		<div class="env-switch">
			<span>{{ t('env-var') }}</span>

			<el-switch
				v-model="envEnabled"
				@change="handleEnvSwitch"
				inline-prompt
				active-text="预设"
				inactive-text="预设"
			></el-switch>
		</div>
		<div class="input-env">
			<span class="input-env-container">
				<span>
					<el-input v-model="connectionEnv.newKey" @keyup.enter="addEnvVar"></el-input>
				</span>
				<span>
					<el-input v-model="connectionEnv.newValue" @keyup.enter="addEnvVar"></el-input>
				</span>
				<span>
					<div @click="addEnvVar">
						<span class="iconfont icon-add"></span>
					</div>
				</span>
			</span>
		</div>
		<el-scrollbar height="200px" width="350px" class="display-env-container">
			<div class="display-env">
				<div class="input-env-container" v-for="option of connectionEnv.data" :key="option.key">
					<span> <el-input v-model="option.key"></el-input></span>
					<span> <el-input v-model="option.value" show-password></el-input></span>
					<span @click="deleteEnvVar(option)">
						<span class="iconfont icon-delete"></span>
					</span>
				</div>
			</div>
		</el-scrollbar>
	</div>
</template>


<script setup lang="ts">
import { defineComponent, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { connectionEnv, EnvItem, handleEnvSwitch } from './connection';

defineComponent({ name: 'env-var' });

const { t } = useI18n();

/**
 * @description 添加环境变量
 */
function addEnvVar() {
	// 检查是否存在一样的 key
	const currentKey = connectionEnv.newKey;
	const currentValue = connectionEnv.newValue;

	if (currentKey.length === 0 || currentValue.length === 0) {
		return;
	}

	const sameNameItems = connectionEnv.data.filter(item => item.key === currentKey);

	if (sameNameItems.length > 0) {
		const conflictItem = sameNameItems[0];
		conflictItem.value = currentValue;
	} else {
		connectionEnv.data.push({
			key: currentKey, value: currentValue
		});
		connectionEnv.newKey = '';
		connectionEnv.newValue = '';
	}
}

/**
 * @description 删除环境变量
 */
function deleteEnvVar(option: EnvItem) {
	const currentKey = option.key;
	const reserveItems = connectionEnv.data.filter(item => item.key !== currentKey);
	connectionEnv.data = reserveItems;
}


const envEnabled = ref(true);

</script>

<style>
.env-switch {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 12px;
}

.env-switch .el-switch .el-switch__action {
	background-color: var(--main-color);
}

.env-switch .el-switch.is-checked .el-switch__action {
    background-color: var(--sidebar);
}

.env-switch .el-switch__core {
    border: 1px solid var(--main-color) !important;
}
</style>