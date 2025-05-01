<template>
    <div>
        <h3>{{ currentPrompt.name }}</h3>
    </div>
    <div class="prompt-reader-container">
        <el-form :model="tabStorage.formData" :rules="formRules" ref="formRef" label-position="top">
            <el-form-item v-for="param in currentPrompt?.params" :key="param.name"
                :label="param.name" :prop="param.name">
                <el-input v-if="param.type === 'string'" v-model="tabStorage.formData[param.name]"
                    :placeholder="param.placeholder || `请输入${param.name}`"
                    @keydown.enter.prevent="handleSubmit"
                    />

                <el-input-number v-else-if="param.type === 'number'" v-model="tabStorage.formData[param.name]"
                    :placeholder="param.placeholder || `请输入${param.name}`"
                    @keydown.enter.prevent="handleSubmit"
                    />

                <el-switch v-else-if="param.type === 'boolean'" v-model="tabStorage.formData[param.name]" />
            </el-form-item>

            <el-form-item>
                <el-button type="primary" :loading="loading" @click="handleSubmit">
                    {{ t('read-prompt') }}
                </el-button>
                <el-button @click="resetForm">
                    {{ t('reset') }}
                </el-button>
            </el-form-item>
        </el-form>
    </div>
</template>

<script setup lang="ts">
import { defineComponent, defineProps, watch, ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { FormInstance, FormRules } from 'element-plus';
import { tabs } from '../panel';
import { parsePromptTemplate, promptsManager, PromptStorage } from './prompts';
import { CasualRestAPI, PromptsGetResponse } from '@/hook/type';
import { useMessageBridge } from '@/api/message-bridge';
import { getDefaultValue, normaliseJavascriptType } from '@/hook/mcp';

defineComponent({ name: 'prompt-reader' });

const { t } = useI18n();

const props = defineProps({
    tabId: {
        type: Number,
        required: true
    }
});

const tab = tabs.content[props.tabId];
const tabStorage = tab.storage as PromptStorage;

if (!tabStorage.formData) {
    tabStorage.formData = {};
}

const formRef = ref<FormInstance>();
const loading = ref(false);
const responseData = ref<PromptsGetResponse>();

const currentPrompt = computed(() => {
    const template = promptsManager.templates.find(template => template.name === tabStorage.currentPromptName);
    const name = template?.name || '';
    const params = template?.arguments || [];

    const viewParams = params.map(param => ({
        name: param.name,
        type: 'string',
        placeholder: t('enter') +' ' + param.name,
        required: param.required
    }));

    return {
        name,
        params: viewParams
    };
});

const formRules = computed<FormRules>(() => {
    const rules: FormRules = {}
    currentPrompt.value?.params.forEach(param => {
        rules[param.name] = [
            {
                message: `${param.name} 是必填字段`,
                trigger: 'blur'
            }
        ]
    });

    return rules;
});

const initFormData = () => {
    
    if (!currentPrompt.value?.params) return;

    const newSchemaDataForm: Record<string, number | boolean | string> = {};

    currentPrompt.value.params.forEach(param => {
        newSchemaDataForm[param.name] = getDefaultValue(param);
        const originType = normaliseJavascriptType(typeof tabStorage.formData[param.name]);
        if (tabStorage.formData[param.name]!== undefined && originType === param.type) {
            newSchemaDataForm[param.name] = tabStorage.formData[param.name];
        }
    });

}

const resetForm = () => {
    formRef.value?.resetFields();
    responseData.value = undefined;
}

function handleSubmit() {
    const bridge = useMessageBridge();

    bridge.addCommandListener('prompts/get', (data: CasualRestAPI<PromptsGetResponse>) => {
        tabStorage.lastPromptGetResponse = data.msg;
    }, { once: true });

    bridge.postMessage({
        command: 'prompts/get',
        data: { promptId: currentPrompt.value.name, args: JSON.parse(JSON.stringify(tabStorage.formData)) }
    });
}

watch(() => tabStorage.currentPromptName, () => {
    initFormData();
    resetForm();
}, { immediate: true });

</script>

<style>
.prompt-reader-container {
    background-color: var(--background);
    padding: 10px 12px;
    border-radius: .5em;
    margin-bottom: 15px;
}
</style>