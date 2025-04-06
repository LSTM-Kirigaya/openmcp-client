import { ToolsListResponse, ToolCallResponse } from '@/hook/type';
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