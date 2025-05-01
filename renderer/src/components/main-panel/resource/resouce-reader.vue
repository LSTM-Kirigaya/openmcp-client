<template>
    <div>
        <h3>{{ currentResource.template?.name }}</h3>
    </div>
    <div class="resource-reader-container">
        <el-form :model="tabStorage.formData" :rules="formRules" ref="formRef" label-position="top">
            <el-form-item v-for="param in currentResource?.params" :key="param.name"
                :label="param.name" :prop="param.name">
                <!-- 根据不同类型渲染不同输入组件 -->
                <el-input v-if="param.type === 'string'" v-model="tabStorage.formData[param.name]"
                    :placeholder="param.placeholder || `请输入${param.name}`"
                    @keydown.enter.prevent="handleSubmit" />

                <el-input-number v-else-if="param.type === 'number'" v-model="tabStorage.formData[param.name]"
                    :placeholder="param.placeholder || `请输入${param.name}`"
                    @keydown.enter.prevent="handleSubmit" />
                    
                <el-switch v-else-if="param.type === 'boolean'" v-model="tabStorage.formData[param.name]" />
            </el-form-item>

            <el-form-item>
                <el-button type="primary" :loading="loading" @click="handleSubmit">
                    {{ t('read-resource') }}
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
import { parseResourceTemplate, resourcesManager, ResourceStorage } from './resources';
import { CasualRestAPI, ResourcesReadResponse } from '@/hook/type';
import { useMessageBridge } from '@/api/message-bridge';
import { getDefaultValue, normaliseJavascriptType } from '@/hook/mcp';

defineComponent({ name: 'resource-reader' });

const { t } = useI18n();

const props = defineProps({
    tabId: {
        type: Number,
        required: true
    }
});

const tab = tabs.content[props.tabId];
const tabStorage = tab.storage as ResourceStorage;

if (!tabStorage.formData) {
    tabStorage.formData = {};
}

// 表单相关状态
const formRef = ref<FormInstance>();
const loading = ref(false);
const responseData = ref<ResourcesReadResponse>();

// 当前 resource 的模板参数
const currentResource = computed(() => {
    const template = resourcesManager.templates.find(template => template.name === tabStorage.currentResourceName);
    const { params, fill } = parseResourceTemplate(template?.uriTemplate || ''); 

    const viewParams = params.map(param => ({
        name: param,
        type: 'string',
        placeholder: t('enter') +' ' + param,
        required: true
    }));

    return {
        template,
        params: viewParams,
        fill
    };
});

// 表单验证规则
const formRules = computed<FormRules>(() => {
    const rules: FormRules = {}
    currentResource.value?.params.forEach(param => {
        rules[param.name] = [
            {
                message: `${param.name} 是必填字段`,
                trigger: 'blur'
            }
        ]
    });

    return rules;
});




// 初始化表单数据
const initFormData = () => {
    if (!currentResource.value?.params) return;
    
    const newSchemaDataForm: Record<string, number | boolean | string> = {};

    currentResource.value.params.forEach(param => {
        newSchemaDataForm[param.name] = getDefaultValue(param);
        const originType = normaliseJavascriptType(typeof tabStorage.formData[param.name]);

        if (tabStorage.formData[param.name]!== undefined && originType === param.type) {
            newSchemaDataForm[param.name] = tabStorage.formData[param.name];
        }
    })
}

// 重置表单
const resetForm = () => {
    formRef.value?.resetFields();
    responseData.value = undefined;
}

// 提交表单
function handleSubmit() {
    const fillFn = currentResource.value.fill;    
    const uri = fillFn(tabStorage.formData);

    const bridge = useMessageBridge();

    bridge.addCommandListener('resources/read', (data: CasualRestAPI<ResourcesReadResponse>) => {
        tabStorage.lastResourceReadResponse = data.msg;
    }, { once: true });

    bridge.postMessage({
        command: 'resources/read',
        data: { resourceUri: uri }
    });
}

// 监听资源变化重置表单
watch(() => tabStorage.currentResourceName, () => {
    initFormData();
    resetForm();
}, { immediate: true });

</script>

<style>
.resource-reader-container {
    background-color: var(--background);
    padding: 10px 12px;
    border-radius: .5em;
    margin-bottom: 15px;
}
</style>