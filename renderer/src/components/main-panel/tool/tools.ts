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
    lastToolCallResponse?: ToolCallResponse | string;
    formData: Record<string, any>;
}

const bridge = useMessageBridge();

export function callTool(toolName: string, toolArgs: Record<string, any>) {
    return new Promise<ToolCallResponse>((resolve, reject) => {
        bridge.addCommandListener('tools/call', (data: CasualRestAPI<ToolCallResponse>) => {
            console.log(data.msg);

            if (data.code !== 200) {
                resolve(data.msg);
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
                toolArgs: JSON.parse(JSON.stringify(toolArgs))
            }
        });
    });
}