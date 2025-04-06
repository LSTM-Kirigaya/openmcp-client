import { useMessageBridge } from "@/api/message-bridge";
import { llmManager, llms } from "@/views/setting/llm";
import { pinkLog } from "@/views/setting/util";
import I18n from '@/i18n/index';

export function loadSetting() {
    const bridge = useMessageBridge();
    
    bridge.addCommandListener('setting/load', data => {
        const persistConfig = data.msg;
        
        llmManager.currentModelIndex = persistConfig.MODEL_INDEX;
        I18n.global.locale.value = persistConfig.LANG;
        
        persistConfig.LLM_INFO.forEach((element: any) => {
            llms.push(element);        
        });

    }, { once: true });

    bridge.postMessage({
        command: 'setting/load'
    });
}

export function saveSetting(saveHandler?: () => void) {
    const bridge = useMessageBridge();

    const saveConfig = {
        MODEL_INDEX: llmManager.currentModelIndex,
        LLM_INFO: JSON.parse(JSON.stringify(llms)),
        LANG: I18n.global.locale.value
    };

    bridge.addCommandListener('setting/save', data => {
        const saveStatusCode = data.code;
        pinkLog('配置保存状态：' + saveStatusCode);
        
        if (saveHandler) {
            saveHandler();
        }
    }, { once: true });

    bridge.postMessage({
        command: 'setting/save',
        data: saveConfig
    });
}