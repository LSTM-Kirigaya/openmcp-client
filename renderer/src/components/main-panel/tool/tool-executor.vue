<template>
    <div>
        <h3>{{ currentTool?.name }}</h3>
    </div>
    <div class="tool-executor-container">
        <el-form :model="formData" :rules="formRules" ref="formRef" label-position="top">
            <template v-if="currentTool?.inputSchema?.properties">
                <el-scrollbar height="150px">
                    <el-form-item 
                        v-for="[name, property] in Object.entries(currentTool.inputSchema.properties)" 
                        :key="name"
                        :label="property.title || name" 
                        :prop="name"
                        :required="currentTool.inputSchema.required?.includes(name)"
                    >
                        <el-input 
                            v-if="property.type === 'string'" 
                            v-model="formData[name]"
                            :placeholder="t('enter') + ' ' + (property.title || name)" 
                        />

                        <el-input-number 
                            v-else-if="property.type === 'number' || property.type === 'integer'" 
                            v-model="formData[name]"
                            controls-position="right"
                            :placeholder="t('enter') + ' ' + (property.title || name)" 
                        />

                        <el-switch 
                            v-else-if="property.type === 'boolean'" 
                            v-model="formData[name]" 
                        />
                    </el-form-item>
                </el-scrollbar>
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
import { toolsManager, ToolStorage } from './tools';
import { CasualRestAPI, ToolCallResponse } from '@/hook/type';
import { useMessageBridge } from '@/api/message-bridge';

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

const formRef = ref<FormInstance>();
const formData = ref<Record<string, any>>({});
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
    formData.value = {};
    if (!currentTool.value?.inputSchema?.properties) return;
    
    Object.entries(currentTool.value.inputSchema.properties).forEach(([name, property]) => {
        formData.value[name] = (property.type === 'number' || property.type === 'integer') ? 0 :
            property.type === 'boolean' ? false : '';
    });
};

const resetForm = () => {
    formRef.value?.resetFields();
    tabStorage.lastToolCallResponse = undefined;
};

function handleExecute() {
    if (!currentTool.value) return;
    
    const bridge = useMessageBridge();

    bridge.addCommandListener('tools/call', (data: CasualRestAPI<ToolCallResponse>) => {
        console.log(data.msg);
        
        tabStorage.lastToolCallResponse = data.msg;
    }, { once: true });

    bridge.postMessage({
        command: 'tools/call',
        data: {
            toolName: tabStorage.currentToolName,
            toolArgs: formData.value
        }
    });
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
</style>