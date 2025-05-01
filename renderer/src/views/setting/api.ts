import { ChatStorage } from '@/components/main-panel/chat/chat';
import { TaskLoop } from '@/components/main-panel/chat/task-loop';
import { llmManager } from './llm';
import { reactive, ref } from 'vue';

export const simpleTestResult = reactive<{
    done: boolean,
    start: boolean,
    error: any
}>({
    done: false,
    start: false,
    error: '',
});

export function makeSimpleTalk() {
    simpleTestResult.done = false;
    simpleTestResult.start = true;

    // 使用最简单的 hello 来测试
    const testMessage = 'hello';

    const s1 = ref('');
    const s2 = ref([]);
    const loop = new TaskLoop(s1, s2);

    const chatStorage: ChatStorage = {
        messages: [],
        settings: {
            temperature: 0.7,
            modelIndex: llmManager.currentModelIndex,
            systemPrompt: '',
            enableTools: [],
            enableWebSearch: false,
            contextLength: 5
        }
    };
    
    loop.registerOnDone(() => {
        console.log('done');
        simpleTestResult.error = '';
        simpleTestResult.done = true;
        simpleTestResult.start = false;
    });

    loop.registerOnError(error => {
        console.log(error);
        simpleTestResult.error = error;
        simpleTestResult.start = false;
    });

    loop.start(chatStorage, testMessage);
}