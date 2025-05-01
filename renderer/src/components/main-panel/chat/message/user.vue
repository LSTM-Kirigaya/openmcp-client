<template>
    <div class="message-role"></div>
    <div class="message-text">
        <div v-if="!isEditing" class="message-content">
            <span>
                {{ props.message.content.trim() }}
            </span>
        </div>
        
        <KCuteTextarea v-else
            v-model="userInput"
            placeholder="输入消息..."
            @press-enter="handleKeydown"
        />
        <div class="message-actions" v-if="!isEditing">
            <el-button @click="copy">
                <span class="iconfont icon-copy"></span>
            </el-button>
            <el-button @click="toggleEdit">
                <span class="iconfont icon-edit2"></span>
            </el-button>
        </div>
        <div class="message-actions" v-else>
            <el-button @click="toggleEdit">
                {{ '取消' }}
            </el-button>
            <el-button @click="handleKeydown" type="primary">
                {{ '发送' }}
            </el-button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { defineProps, ref, PropType, inject } from 'vue';
import { tabs } from '../../panel';
import { ChatStorage, IRenderMessage } from '../chat';

import KCuteTextarea from '@/components/k-cute-textarea/index.vue';
import { ElMessage } from 'element-plus';

const props = defineProps({
    message: {
        type: Object as PropType<IRenderMessage>,
        required: true
    },
    tabId: {
        type: Number,
        required: true
    }
});

const tab = tabs.content[props.tabId];
const tabStorage = tab.storage as ChatStorage;
const isEditing = ref(false);
const userInput = ref('');

const handleSend = inject<(newMessage: string | undefined) => void>('handleSend');

const toggleEdit = () => {
    isEditing.value = !isEditing.value;
    if (isEditing.value) {
        userInput.value = props.message.content;
    }
};

const handleKeydown = (event: KeyboardEvent) => {
    const index = tabStorage.messages.findIndex(msg => msg.extraInfo === props.message.extraInfo);
    
    if (index !== -1 && handleSend) {
        // 把 index 之后的全部删除（包括 index）
        tabStorage.messages.splice(index);
        handleSend(userInput.value);

        isEditing.value = false;
    }
};

const copy = async () => {
    try {
        await navigator.clipboard.writeText(userInput.value);
        ElMessage.success('内容已复制到剪贴板');
    } catch (err) {
        console.error('无法复制内容: ', err);
    }
};

</script>

<style>

.message-text {
    position: relative;
}

.message-text:hover .message-actions {
    opacity: 1;
}

.message-actions {
    opacity: 0;
    transition: var(--animation-3s);
    position: absolute;
    bottom: -34px;
    right: 0;    
}

.message-actions .el-button {
    border-radius: .5em;
    padding: 5px 8px;
}

.message-actions .el-button:hover {
    background-color: var(--main-light-color);
}

.message-actions .el-button+.el-button {
    margin-left: 10px;
}

.user .message-content {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    width: 100%;
}

.user .message-content > span {
    max-width: calc(100% - 48px);
    border-radius: .9em;
    background-color: var(--main-light-color);
    padding: 10px 15px;
    box-sizing: border-box;
    white-space: pre-wrap;
    word-break: break-word;
    text-align: left;
}

</style>