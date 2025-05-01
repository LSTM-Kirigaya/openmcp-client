<template>
    <div>
        <h3>{{ currentTool?.name }}</h3>
    </div>
    <div class="tool-executor-container">
        <el-form :model="tabStorage.formData" :rules="formRules" ref="formRef" label-position="top">
            <template v-if="currentTool?.inputSchema?.properties">
                <el-form-item 
                    v-for="[name, property] in Object.entries(currentTool.inputSchema.properties)" 
                    :key="name"
                    :label="property.title || name" 
                    :prop="name"
                    :required="currentTool.inputSchema.required?.includes(name)"
                >
                    <el-input 
                        v-if="property.type === 'string'" 
                        v-model="tabStorage.formData[name]"
                        type="text"
                        :placeholder="property.description || t('enter') + ' ' + (property.title || name)"
                        @keydown.enter.prevent="handleExecute"
                    />

                    <el-input-number 
                        v-else-if="property.type === 'number' || property.type === 'integer'" 
                        v-model="tabStorage.formData[name]"
                        controls-position="right"
                        :placeholder="property.description || t('enter') + ' ' + (property.title || name)"
                        @keydown.enter.prevent="handleExecute" 
                    />

                    <el-switch 
                        v-else-if="property.type === 'boolean'"
                        active-text="true"
                        inactive-text="false"
                        v-model="tabStorage.formData[name]"
                    />

                    <k-input-object
                        v-else-if="property.type === 'object'"
                        v-model="tabStorage.formData[name]"
                        :placeholder="property.description || t('enter') + ' ' + (property.title || name)"
                    />
                </el-form-item>
            </template>

            <el-form-item>
                <el-button type="primary" :loading="loading" @click="handleExecute">
                    {{ t('execute-tool') }}
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
import { callTool, toolsManager, ToolStorage } from './tools';
import { getDefaultValue, normaliseJavascriptType } from '@/hook/mcp';

import KInputObject from '@/components/k-input-object/index.vue';

defineComponent({ name: 'tool-executor' });

const { t } = useI18n();

const props = defineProps({
    tabId: {
        type: Number,
        required: true
    }
});

const tab = tabs.content[props.tabId];
const tabStorage = tab.storage as ToolStorage;

if (!tabStorage.formData) {
    tabStorage.formData = {};
}

console.log(tabStorage.formData);


const formRef = ref<FormInstance>();
const loading = ref(false);

const currentTool = computed(() => {
    return toolsManager.tools.find(tool => tool.name === tabStorage.currentToolName);
});


const formRules = computed<FormRules>(() => {
    const rules: FormRules = {};
    if (!currentTool.value?.inputSchema?.properties) return rules;
    
    Object.entries(currentTool.value.inputSchema.properties).forEach(([name, property]) => {
        if (currentTool.value?.inputSchema?.required?.includes(name)) {
            rules[name] = [
                {
                    required: true,
                    message: `${property.title || name} 是必填字段`,
                    trigger: 'blur'
                }
            ];
        }
    });

    return rules;
});


const initFormData = () => {
    // 初始化，根据输入的 inputSchema 校验
    // 1. 当前是否存在缺失的 key value，如果有，则根据 schema 给与默认值
    // 2. 如果有多余的 key value，则删除

    if (!currentTool.value?.inputSchema?.properties) return;

    const newSchemaDataForm: Record<string, number | boolean | string | object> = {};

    console.log(currentTool.value.inputSchema.properties);
    
    Object.entries(currentTool.value.inputSchema.properties).forEach(([name, property]) => {
        newSchemaDataForm[name] = getDefaultValue(property);
        const originType = normaliseJavascriptType(typeof tabStorage.formData[name]);        

        if (tabStorage.formData[name] !== undefined && originType === property.type) {
            newSchemaDataForm[name] = tabStorage.formData[name]; 
        }
    });

    tabStorage.formData = newSchemaDataForm;
};

const resetForm = () => {
    formRef.value?.resetFields();
};

async function handleExecute() {
    if (!currentTool.value) return;    
    const toolResponse = await callTool(tabStorage.currentToolName, tabStorage.formData);
    tabStorage.lastToolCallResponse = toolResponse;
}

watch(() => tabStorage.currentToolName, () => {
    initFormData();
    resetForm();
}, { immediate: true });
</script>

<style>
.tool-executor-container {
    background-color: var(--background);
    padding: 10px 12px;
    border-radius: .5em;
    margin-bottom: 15px;
}

.tool-executor-container {

}

.tool-executor-container .el-switch .el-switch__action {
    background-color: var(--main-color);
}

.tool-executor-container .el-switch.is-checked .el-switch__action {
    background-color: var(--sidebar);
}

.tool-executor-container .el-switch__core {
    border: 1px solid var(--main-color) !important;
}

</style>