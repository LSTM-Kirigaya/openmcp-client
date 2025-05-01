<template>
    <el-tooltip :content="t('system-prompt')" placement="top">
        <div class="setting-button" :class="{ 'active': hasSystemPrompt }" size="small"
            @click="showSystemPromptDialog = true">
            <span class="iconfont icon-prompt"></span>
        </div>
    </el-tooltip>

    <el-dialog v-model="showSystemPromptDialog" :title="t('system-prompt')" width="600px">

        <div v-if="!showAdd">
            <el-select v-model="tabStorage.settings.systemPrompt" placeholder="选择预设"
                style="width: 100%; margin-bottom: 20px;">

                <el-option v-for="prompt in systemPrompts"
                    :value="prompt.name" :key="prompt.name"
                    class="choose-system-prompt"
                >
                    <span>{{ prompt.name }}</span>
                    <el-dropdown trigger="hover" @command="handleCommand">
                        <span>
                            <span class="iconfont icon-more"></span>
                        </span>
                        <template #dropdown>
                            <el-dropdown-menu>
                                <el-dropdown-item :command="{ type: 'delete', name: prompt.name }" divided>
                                    <span class="iconfont icon-delete">&emsp;{{ t('delete') }}</span>
                                </el-dropdown-item>
                            </el-dropdown-menu>
                        </template>
                    </el-dropdown>
                </el-option>

                <el-option label="新建预设" value="$new" @click="showAdd = true; newPromptName = ''; newPromptContent = ''">
                    <span class="iconfont icon-add"></span>
                </el-option>
            </el-select>

            <el-input v-model="currentPromptValue" type="textarea" :rows="8"
                :placeholder="t('system-prompt.placeholder')" clearable />
        </div>

        <div v-else class="tool-use">
            <el-input v-model="newPromptName" :placeholder="t('add-system-prompt.name-placeholder')" />
            <el-input v-model="newPromptContent" type="textarea" :rows="8" :placeholder="t('system-prompt.placeholder')"
                clearable />
        </div>

        <template #footer v-if="!showAdd">
            <el-button @click="showSystemPromptDialog = false">{{ t("cancel") }}</el-button>
        </template>

        <template #footer v-else>
            <el-button @click="showAdd = false">{{ t("cancel") }}</el-button>
            <el-button type="primary" @click="addNewPrompt">{{ t("save") }}</el-button>
        </template>

    </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, inject, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChatStorage } from '../chat';
import { systemPrompts, saveSystemPrompts, setSystemPrompt, loadSystemPrompts, deleteSystemPrompt } from './system-prompt';
import { ElMessage } from 'element-plus';
import { debounce } from 'lodash';

const { t } = useI18n();
const tabStorage = inject('tabStorage') as ChatStorage;
const showSystemPromptDialog = ref(false);

const showAdd = ref(false);

const hasSystemPrompt = computed(() => {
    return !!tabStorage.settings.systemPrompt?.trim();
});

const newPromptName = ref('');
const newPromptContent = ref('');

const currentPromptValue = computed({
    get() {
        return systemPrompts.value.find(prompt => prompt.name === tabStorage.settings.systemPrompt)?.content || '';
    },
    set(value) {
        const prompt = systemPrompts.value.find(prompt => prompt.name === tabStorage.settings.systemPrompt);
        if (prompt) {
            prompt.content = value;
            safeSaveSystemPrompts();
        }
    }
});


async function addNewPrompt() {
    const name = newPromptName.value.trim();
    const content = newPromptContent.value.trim();
    // 检查是否命名冲突
    if (systemPrompts.value.some(prompt => prompt.name === name)) {
        ElMessage.warning('预设名称已存在，请选择其他名称。');
        return;
    }

    const res = await setSystemPrompt(name, content);

    if (res.code === 200) {
        ElMessage.success('预设添加成功。');
        showAdd.value = false;
        tabStorage.settings.systemPrompt = name;

    } else {
        ElMessage.error('添加预设失败。' + res.msg);
    }
}

const safeSaveSystemPrompts = debounce(async () => {
    if (!showAdd.value) {
        const prompt = systemPrompts.value.find(prompt => prompt.name === tabStorage.settings.systemPrompt);
        if (prompt) {
            await setSystemPrompt(prompt.name, prompt.content);
        }
    }
}, 500);

async function handleCommand(command: {type: string, name: string}) {
    if (command.type === 'delete') {
        const res = await deleteSystemPrompt(command.name);
        if (res.code === 200) {
            if (tabStorage.settings.systemPrompt === command.name) {
                tabStorage.settings.systemPrompt = systemPrompts.value[0]?.name || '';
            }
        }
    }
}

onMounted(async () => {
    await loadSystemPrompts();
});

</script>

<style>
.setting-button {
    cursor: pointer;
    padding: 8px;
    border-radius: 50%;
    transition: background-color 0.3s;
}

.setting-button:hover {
    background-color: rgba(0, 0, 0, 0.1);
}

.setting-button.active {
    color: var(--el-color-primary);
}

.tool-use .el-input__wrapper {
    margin-bottom: 20px;
    border-radius: .5em;
}

.choose-system-prompt {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
}
</style>