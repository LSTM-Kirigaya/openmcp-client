import { useMessageBridge } from "@/api/message-bridge";
import { pinkLog } from "@/views/setting/util";
import { ref } from "vue";

interface SystemPrompt {
    name: string;
    content: string;
}

export const systemPrompts = ref<SystemPrompt[]>([{
    name: 'Default',
    content: '你是一个AI助手, 你可以回答任何问题。'
}]);

export async function saveSystemPrompts() {
    const bridge = useMessageBridge();

    const payload = JSON.parse(JSON.stringify(systemPrompts.value));
    const res = await bridge.commandRequest('system-prompts/save', { prompts: payload });
    if (res.code === 200) {
        pinkLog('system prompt 保存成功');
    }
}

export async function setSystemPrompt(name: string, content: string) {
    const bridge = useMessageBridge();
    const res = await bridge.commandRequest('system-prompts/set', { name, content });
    if (res.code === 200) {
        pinkLog('system prompt 添加成功');
        if (!systemPrompts.value.some(prompt => prompt.name === name)) {
            systemPrompts.value.push({ name, content });
        }
    }
    return res;
}

export async function deleteSystemPrompt(name: string) {
    const bridge = useMessageBridge();
    const res = await bridge.commandRequest('system-prompts/delete', { name });
    if (res.code === 200) {
        pinkLog('system prompt 删除成功');
        systemPrompts.value = systemPrompts.value.filter((prompt) => prompt.name !== name);
    }
    return res;
}

export async function loadSystemPrompts() {
    const bridge = useMessageBridge();
    const res = await bridge.commandRequest('system-prompts/load');
    if (res.code === 200) {
        pinkLog('system prompt 加载成功');
        systemPrompts.value = res.msg;
    }

    return res;
}