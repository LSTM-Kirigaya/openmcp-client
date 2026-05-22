<template>
	<div class="setting-section"
		:ref="el => llmSettingRef = el"
	>
		<h2 class="api-title">
			{{ "API" }}
		</h2>
		<div class="setting-options">
		<div class="setting-option">
			<span>
				<span class="option-title">{{ t('server-provider') }}</span>
			</span>
			<div style="width: 160px;">
				<el-select name="language-setting" class="language-setting" v-model="llmManager.currentModelIndex"
					@change="onmodelchange">

					<el-option v-for="(option, index) in llms" :value="index" :label="option.name" :key="index">
						<div class="llm-option">
							<span>{{ option.name }}</span>
							<el-dropdown trigger="hover" @command="handleCommand">
								<span>
									<span class="iconfont icon-more"></span>
								</span>
								<template #dropdown>
									<el-dropdown-menu>
										<el-dropdown-item :command="{type: 'edit', index}">
											<span class="iconfont icon-edit">&emsp;{{ t('edit') }}</span>
										</el-dropdown-item>
										<el-dropdown-item :command="{type: 'delete', index}" divided>
											<span class="iconfont icon-delete">&emsp;{{ t('delete') }}</span>
										</el-dropdown-item>
									</el-dropdown-menu>
								</template>
							</el-dropdown>
						</div>
					</el-option>
				</el-select>
			</div>
		</div>

		<!-- TODO: 根据不同模型展示不同的接入点 -->
		<template v-if="false"></template>
		<ConnectInterfaceOpenai v-else />

		<div class="setting-option setting-option-actions">
			<div class="setting-option-actions-row">
				<span class="option-title"></span>
				<div class="setting-save-container">
				<el-button-group>
					<el-button
						id="add-new-server-button"
						@click="addNewServer"
					>
						{{ t("add-new-server") }}
					</el-button>

					<el-button
						id="update-model-list-button"
						@click="updateModels"
						:loading="updateModelLoading"
					>
						{{ t('update-model-list') }}
					</el-button>

					<el-popover
						placement="top"
						width="400"
						trigger="click"
						popper-class="setting-popover"
						v-model:visible="testPromptPopoverVisible"
					>
						<template #reference>
							<el-button
								id="test-llm-button"
								class="btn-test"
								:loading="simpleTestResult.start"
							>
								<span>{{ t('test') }}</span>
								<span class="ctrl">CTRL</span>
								<span class="pink-color iconfont icon-enter"></span>
							</el-button>
						</template>
						<div style="margin-bottom: 8px; font-weight: bold;">
							{{ t('prompts') }}
						</div>
						<el-input
							type="textarea"
							v-model="testPrompt"
							:rows="3"
							:placeholder="t('test-prompt-placeholder') || '输入测试内容...'"
							style="margin-bottom: 8px;"
							clearable
						/>
						<div style="text-align: right;">
							<el-button @click="testPromptPopoverVisible = false">{{ t('cancel') }}</el-button>
							<el-button type="primary" @click="testPromptPopoverVisible = false; makeSimpleTalk()">{{ t('confirm') }}</el-button>
						</div>
					</el-popover>

					<el-button
						type="primary"
						id="save-llm-button"
						class="btn-save"
						@click="saveLlmSetting"
					>
						<span>{{ t('save') }}</span>
						<span class="ctrl">CTRL</span>
						<span class="pink-color shortcut-key">S</span>
					</el-button>
				</el-button-group>
				</div>
			</div>
			<ConnectTest />
		</div>
		</div>

		<!-- 当前页面的聊天框 -->
		<el-dialog v-model="dialogVisible" width="50%" class="api-man-dialog">
			
			<br>

			<el-form :model="newProviderForm" label-width="auto">
				<el-form-item :label="t('server-provider')">
					<el-input v-model="newProviderForm.provider" />
				</el-form-item>
				<el-form-item :label="t('model')">
					<el-input-tag
						v-model="newProviderForm.models"
						placeholder="gpt-3.5-turbo"
					/>
				</el-form-item>
				<el-form-item :label="t('api-root-url')">
					<el-input v-model="newProviderForm.baseUrl" placeholder="https://" />
				</el-form-item>
				<el-form-item :label="t('api-token')">
					<el-input v-model="newProviderForm.userToken" show-password />
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="dialogVisible = false">{{ t("cancel") }}</el-button>
				<el-button type="primary" @click="dialogConfirm">{{ t("confirm") }}</el-button>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
import { defineComponent, ref, onMounted, onBeforeUnmount } from 'vue';
import { llmManager, llms } from './llm';
import { useI18n } from 'vue-i18n';
import { saveSetting } from '@/hook/setting';
import { ElMessage, ElMessageBox } from 'element-plus';
import { pinkLog } from './util';

import ConnectInterfaceOpenai from './connect-interface-openai.vue';
import ConnectTest from './connect-test.vue';
import { llmSettingRef, makeSimpleTalk, simpleTestResult, testPrompt } from './api';
import { useMessageBridge } from '@/api/message-bridge';
import { mcpSetting } from '@/hook/mcp';

defineComponent({ name: 'api' });
const { t } = useI18n();

function saveLlmSetting() {
	saveSetting(() => {
		ElMessage({
			message: t('success-save'),
			type: 'success'
		});
	});
}

const currentDialogMode = ref('');
const dialogVisible = ref(false);
const testPromptPopoverVisible = ref(false);

function addNewServer() {
	newProviderForm.value = {
        provider: '',
        models: [],
        baseUrl: '',
        userToken: ''
    };

	currentDialogMode.value = 'add';
	dialogVisible.value = true;
}

function editModel(index: number) {
	currentDialogMode.value = 'edit';
	editingIndex.value = index;

	const formData = JSON.parse(JSON.stringify(llms[index]));
	newProviderForm.value = {
		provider: formData.name,
		models: formData.models,
		baseUrl: formData.baseUrl,
		userToken: formData.userToken
	};

	dialogVisible.value = true;
}



const newProviderForm = ref<{
	provider: string;
	models: string[];
	baseUrl: string;
	userToken: string;
}>({
	provider: '',
	models: [],
	baseUrl: '',
	userToken: ''
});

const editingIndex = ref(-1);


function dialogConfirm() {
	if (currentDialogMode.value === 'add') {
		addNewProvider();
	} else if (currentDialogMode.value === 'edit') {
		updateProvider();
	}
}

function addNewProvider() {
	const formData = JSON.parse(JSON.stringify(newProviderForm.value));

	llms.push({
		id: formData.provider,
		name: formData.provider,
		models: formData.models,
		userModel: formData.models[0],
		baseUrl: formData.baseUrl,
		userToken: formData.userToken,
		isOpenAICompatible: true,
		description: "User Defined Server",
		website: "",
	});	

	dialogVisible.value = false;
	newProviderForm.value = {
		provider: '',
		models: [],
		baseUrl: '',
		userToken: ''
	};
}


const updateModelLoading = ref(false);

async function updateModels() {
	updateModelLoading.value = true;

	const llm = llms[llmManager.currentModelIndex];
	const apiKey = llm.userToken;
	const baseURL = llm.baseUrl;
    const proxyServer = mcpSetting.proxyServer;

	const bridge = useMessageBridge();
	
	// 检查是否为动态模型加载（如OpenRouter）
	let result;
	if (llm.isDynamic && llm.id === 'openrouter') {
		result = await bridge.commandRequest('llm/models/openrouter', {});
	} else {
		result = await bridge.commandRequest('llm/models', {
			apiKey,
			baseURL,
			proxyServer,
			useAnthropicProtocol: llm.useAnthropicProtocol
		});
	}

	const { code, msg } = result;
	const isGemini = baseURL.includes('googleapis');
	const isOpenRouter = llm.id === 'openrouter';

	if (code === 200 && Array.isArray(msg)) {
		const models = msg
			.filter(item => item.object === 'model')
			.map(item => {
				let modelName = item.id as string;
				if (isGemini && modelName.includes('/')) {
					modelName = modelName.split('/')[1];
				}
				return modelName;
			});
		
		llm.models = models;
		
		// 如果是OpenRouter且尚未设置默认模型，设置一个推荐的模型
		if (isOpenRouter && !llm.userModel && models.length > 0) {
			// 寻找GPT-4或类似的推荐模型
			const recommendedModel = models.find(model => 
				model.includes('gpt-4') || 
				model.includes('claude') || 
				model.includes('gemini')
			) || models[0];
			llm.userModel = recommendedModel;
		}
		
		saveLlmSetting();
		
		if (isOpenRouter) {
			ElMessage.success(`已更新 ${models.length} 个 OpenRouter 模型`);
		} else {
			ElMessage.success('模型列表更新成功');
		}
	} else {
		ElMessage.error('模型列表更新失败: ' + msg);
	}
	updateModelLoading.value = false;
}

function updateProvider() {
	if (editingIndex.value < 0) {
		return;
	}

    const formData = JSON.parse(JSON.stringify(newProviderForm.value));
	
    llms[editingIndex.value] = {
        ...llms[editingIndex.value],
		id: formData.provider,
        name: formData.provider,
        models: formData.models,
        userModel: formData.models[0] || '',
        baseUrl: formData.baseUrl,
        userToken: formData.userToken
    };

	console.log(llms[editingIndex.value]);
	
    newProviderForm.value = {
        provider: '',
        models: [],
        baseUrl: '',
        userToken: ''
    };

	dialogVisible.value = false;
	saveLlmSetting();
}

function onmodelchange() {
	pinkLog('切换模型到：' + llms[llmManager.currentModelIndex].id);
	saveLlmSetting();
}

function deleteModel(index: number) {
    if (llms.length <= 1) {
        ElMessage.warning(t('reserve-one-last-model'));
        return;
    }
    
    ElMessageBox.confirm(
        t('confirm-delete-model'),
        'warning',
        {
            confirmButtonText: t('confirm'),
            cancelButtonText: t('cancel'),
            type: 'warning',
        }
    ).then(() => {
        llms.splice(index, 1);
        
        if (llmManager.currentModelIndex === index) {
            llmManager.currentModelIndex = 0;
        } else if (llmManager.currentModelIndex > index) {
            llmManager.currentModelIndex --;
        }

		saveLlmSetting();
    }).catch(() => {
        // 用户取消删除
    });
}

function handleCommand(command: {type: string, index: number}) {
    if (command.type === 'edit') {
        editModel(command.index);
    } else if (command.type === 'delete') {
        deleteModel(command.index);
    }
}

function onKeydown(e: KeyboardEvent) {
	if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
		e.preventDefault();
		if (!simpleTestResult.start) {
			makeSimpleTalk();
		}
		return;
	}
	if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
		e.preventDefault();
		saveLlmSetting();
	}
}

onMounted(() => {
	window.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
	window.removeEventListener('keydown', onKeydown);
});
</script>

<style>

.api-man-dialog {
	min-width: 500px;
	max-width: 800px;
	padding: 20px;
}

.api-man-dialog .el-tag {
	background-color: var(--main-light-color) !important;
}

.api-man-dialog .el-button--primary {
	border-radius: 8px !important;
	background-color: var(--main-color) !important;
	color: #ffffff !important;
	border-color: var(--main-color) !important;
	transition: var(--animation-3s);
}

.api-man-dialog .el-button--primary:hover,
.api-man-dialog .el-button--primary:focus {
	background-color: var(--main-light-color-90) !important;
	border-color: var(--main-light-color-90) !important;
	opacity: 1;
}

.setting-popover .el-button--primary {
	border-radius: 8px !important;
	background-color: var(--main-color) !important;
	color: #ffffff !important;
	border-color: var(--main-color) !important;
	transition: var(--animation-3s);
}

.setting-popover .el-button--primary:hover,
.setting-popover .el-button--primary:focus {
	background-color: var(--main-light-color-90) !important;
	border-color: var(--main-light-color-90) !important;
	opacity: 1;
}

/* 与工具调试页 executor-actions 一致：右对齐 + 按钮组样式 */
.setting-save-container {
	margin: 16px 0;
	display: flex;
	justify-content: flex-end;
	align-items: center;
	flex-wrap: wrap;
}

/* 按钮组 + 测试结果纵向排列：先一行按钮，下方为测试结果 */
.setting-option-actions {
	flex-direction: column;
	align-items: stretch;
	gap: 0;
}

.setting-option-actions-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	width: 100%;
	min-height: 44px;
}

.setting-option-actions .setting-save-container {
	margin: 0;
	flex: 1;
	justify-content: flex-end;
}

.setting-save-container .el-button-group {
	display: inline-flex;
}

.setting-save-container .el-button-group .el-button {
	border-radius: 0 !important;
	border-color: var(--el-border-color);
	background-color: var(--el-fill-color-blank);
	color: var(--el-text-color-regular);
	padding: 8px 10px;
	font-size: 13px;
	transition: var(--animation-3s);
}

.setting-save-container .el-button-group .el-button:hover:not(:disabled):not(.btn-save) {
	border-color: var(--el-border-color-hover);
	background-color: var(--main-light-color-50);
	color: var(--el-text-color-primary);
}

.setting-save-container .el-button-group .el-button:first-child {
	border-top-left-radius: 8px !important;
	border-bottom-left-radius: 8px !important;
}

.setting-save-container .el-button-group .el-button:last-child {
	border-top-right-radius: 8px !important;
	border-bottom-right-radius: 8px !important;
}

.setting-save-container .el-button-group .el-button:only-child {
	border-radius: 8px !important;
}


.setting-save-container .el-button-group button {
    border-top: 1px solid var(--window-button-active);
    border-bottom: 1px solid var(--window-button-active);
    border-left: 1px solid var(--window-button-active);
}

.setting-save-container .el-button-group .el-button {
    border-color: var(--window-button-active) !important;
    border-right: 1px solid var(--window-button-active);
}


.setting-save-container .el-button-group button:last-child {
    border: 1px solid var(--main-light-color-50);
}

/* 保存按钮使用半透明品牌色 */
.setting-save-container .el-button-group .btn-save {
	background-color: var(--main-light-color-20) !important;
	color: var(--main-color) !important;
	border-color: var(--main-light-color-50) !important;
	font-weight: 600;
}

.setting-save-container .el-button-group .btn-save:hover,
.setting-save-container .el-button-group .btn-save:focus {
	background-color: var(--main-light-color-40) !important;
	border-color: var(--main-light-color-70) !important;
}

/* 测试/保存按钮右侧快捷键提示，与工具调试执行按钮一致 */
.setting-save-container .el-button-group .btn-test .ctrl,
.setting-save-container .el-button-group .btn-save .ctrl {
	margin-left: 5px;
	opacity: 0.6;
	font-weight: 100;
}

.setting-save-container .el-button-group .btn-test .iconfont {
	opacity: 0.8;
}

.setting-save-container .el-button-group .btn-save .shortcut-key {
	margin-left: 2px;
	opacity: 0.6;
	font-weight: 100;
}

.setting-save-container .iconfont {
	margin-right: 6px;
	font-weight: 600;
}

.api-title {
	display: flex;
	align-items: center;
	font-size: 15px;
	font-weight: 600;
}

.api-title .iconfont {
	font-weight: 300;
	font-size: 18px;
	margin-left: 10px;
	cursor: pointer;
	transition: var(--animation-3s);
}

.api-title .iconfont:hover {
	color: var(--main-color);
}

.llm-option {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
	--el-color-primary: white;
}

.delete-icon {
    color: var(--el-color-danger);
    cursor: pointer;
    margin-left: 10px;
}

.delete-icon:hover {
    opacity: 0.8;
}

.pink-color {
    color: var(--main-color);
}
</style>