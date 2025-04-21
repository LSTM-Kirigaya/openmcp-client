import { useMessageBridge } from '@/api/message-bridge';
import { ToolsListResponse, ToolCallResponse, CasualRestAPI } from '@/hook/type';
import { pinkLog } from '@/views/setting/util';
import { reactive } from 'vue';

export const toolsManager = reactive<{
    tools: ToolsListResponse['tools']
}>({
    tools: []
});

export interface ToolStorage {
    currentToolName: string;
    lastToolCallResponse?: ToolCallResponse;
}

const bridge = useMessageBridge();

export function callTool(toolName: string, toolArgs: Record<string, any>) {
    return new Promise<ToolCallResponse>((resolve, reject) => {
        bridge.addCommandListener('tools/call', (data: CasualRestAPI<ToolCallResponse>) => {
            console.log(data.msg);

            if (data.code !== 200) {
                reject(new Error(data.msg + ''));
            } else {
                resolve(data.msg);
            }
        }, { once: true });

        pinkLog('callTool');
        console.log(toolArgs);
    
        bridge.postMessage({
            command: 'tools/call',
            data: {
                toolName,
                toolArgs: JSON.parse(JSON.stringify(toolArgs, (key, value) => {
                    // 确保所有值都保持原始字符串形式
                    return typeof value === 'number' ? String(value) : value;
                }))
            }
        });
    });
}