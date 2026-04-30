import type { ToolCallContent, ToolCallResponse } from "@/hook/type";
import { MessageState, type ToolCall, type ChatStorage } from "../chat-box/chat";
import { mcpClientAdapter } from "@/views/connect/core";
import { readSkillFile } from "@/api/skill";
import type { BasicLlmDescription } from "@/views/setting/llm";
import type OpenAI from "openai";
import { readPlan, writePlan, getPlanFilePath, type PlanApprovalMeta, createAskUserQuestionPromise, type AskUserQuestionMeta, type AskUserQuestionInput } from "@/api/plan-mode";

export interface TaskLoopChatOption {
    id?: string
    proxyServer?: string
    enableXmlWrapper?: boolean
}
export type ChatCompletionCreateParamsBase = OpenAI.Chat.Completions.ChatCompletionCreateParams & TaskLoopChatOption;

export interface ToolCallResult {
    id?: string;
    function?: {
        name?: string;
        arguments?: string;
    };
    index: number;
    state: MessageState;
    timecost: number;
    content: ToolCallContent[];
}

export type IToolCallIndex = number;

export async function handleToolCalls(toolCall: ToolCall, tabStorage?: ChatStorage): Promise<ToolCallResult> {
    if (!toolCall.function) {
        return {
            index: toolCall.index,
            id: toolCall.id,
            function: toolCall.function,
            timecost: 0,
            content: [{
                type: 'error',
                text: 'no tool function'
            }],
            state: MessageState.NoToolFunction
        }
    }

    // 反序列化 streaming 来的参数字符串
    // TODO: check as string
    const toolName = toolCall.function.name as string;
    const argsResult = deserializeToolCallResponse(toolCall.function.arguments as string);
    
    if (argsResult.error) {
        return {
            index: toolCall.index,
            id: toolCall.id,
            function: toolCall.function,
            timecost: 0,
            content: [{
                type: 'error',
                text: parseErrorObject(argsResult.error)
            }],
            state: MessageState.ParseJsonError
        };
    }

    const toolArgs = argsResult.value;

    // 内置工具 read_skill_file：当用户设置了 skill 入口时由 service 处理
    if (toolName === 'read_skill_file') {
        const start = Date.now();
        const skillName = toolArgs?.skill_name ?? '';
        const filePath = toolArgs?.file_path ?? '';
        const toolResponse = await readSkillFile(skillName, filePath);
        const timecost = Date.now() - start;
        const response = handleToolResponse(toolResponse as ToolCallResponse);
        return {
            index: toolCall.index,
            id: toolCall.id,
            function: toolCall.function,
            timecost,
            ...response
        };
    }

    // 内置工具 EnterPlanMode
    if (toolName === 'EnterPlanMode') {
        const start = Date.now();
        if (tabStorage) {
            if (!tabStorage.planMode) {
                tabStorage.planMode = { isPlanMode: false, planContent: null, planFilePath: null };
            }
            tabStorage.planMode.isPlanMode = true;
            tabStorage.planMode.planFilePath = await getPlanFilePath(tabStorage.id);
        }
        const timecost = Date.now() - start;
        return {
            index: toolCall.index,
            id: toolCall.id,
            function: toolCall.function,
            timecost,
            content: [{
                type: 'text',
                text: 'Entered plan mode. You should now focus on exploring the codebase and designing an implementation approach.\n\nIn plan mode, you should:\n1. Thoroughly explore the codebase to understand existing patterns\n2. Identify similar features and architectural approaches\n3. Consider multiple approaches and their trade-offs\n4. Use AskUserQuestion if you need to clarify the approach\n5. Design a concrete implementation strategy\n6. When ready, use ExitPlanMode to present your plan for approval\n\nRemember: DO NOT write or edit any files yet. This is a read-only exploration and planning phase.'
            }],
            state: MessageState.Success
        };
    }

    // 内置工具 AskUserQuestion
    if (toolName === 'AskUserQuestion') {
        const start = Date.now();
        const questions = (toolArgs?.questions || []) as AskUserQuestionInput['questions'];

        if (!questions || questions.length === 0) {
            return {
                index: toolCall.index,
                id: toolCall.id,
                function: toolCall.function,
                timecost: Date.now() - start,
                content: [{
                    type: 'error',
                    text: 'No questions provided. Please provide at least one question with options.'
                }],
                state: MessageState.ToolCall
            };
        }

        const meta: AskUserQuestionMeta = {
            type: 'ask_user_question',
            questions,
            awaitingAnswer: true
        };

        // 保存问题到 tabStorage，前端会检测到并渲染交互 UI
        if (tabStorage) {
            (tabStorage as any)._pendingAskUserQuestion = {
                questions,
                toolCallId: toolCall.id,
                toolCallIndex: toolCall.index
            };
        }

        // 等待用户回答（Promise 阻塞）
        const answers = await createAskUserQuestionPromise(tabStorage!.id);

        // 用户回答后清除 pending 状态
        if (tabStorage) {
            delete (tabStorage as any)._pendingAskUserQuestion;
        }

        const timecost = Date.now() - start;
        const answersText = Object.entries(answers)
            .map(([q, a]) => `"${q}"="${a}"`)
            .join(', ');

        return {
            index: toolCall.index,
            id: toolCall.id,
            function: toolCall.function,
            timecost,
            content: [{
                type: 'text',
                text: `User has answered your questions: ${answersText}. You can now continue with the user's answers in mind.`
            }],
            state: MessageState.Success
        };
    }

    // 内置工具 ExitPlanMode
    if (toolName === 'ExitPlanMode') {
        const start = Date.now();
        let planContent: string | null = null;
        let isInPlanMode = false;

        if (tabStorage?.planMode?.isPlanMode) {
            isInPlanMode = true;
            // 优先从参数获取 plan
            if (toolArgs?.plan && typeof toolArgs.plan === 'string') {
                planContent = toolArgs.plan;
                // 同时写入文件
                await writePlan(tabStorage!.id, toolArgs.plan);
            } else {
                // 从文件读取
                planContent = await readPlan(tabStorage!.id);
            }
        }

        const timecost = Date.now() - start;

        if (!isInPlanMode) {
            return {
                index: toolCall.index,
                id: toolCall.id,
                function: toolCall.function,
                timecost,
                content: [{
                    type: 'error',
                    text: 'You are not in plan mode. This tool is only for exiting plan mode after writing a plan. If your plan was already approved, continue with implementation.'
                }],
                state: MessageState.ToolCall
            };
        }

        if (!planContent || planContent.trim() === '') {
            return {
                index: toolCall.index,
                id: toolCall.id,
                function: toolCall.function,
                timecost,
                content: [{
                    type: 'text',
                    text: 'No plan found. Please write your plan to the plan file first before calling ExitPlanMode.'
                }],
                state: MessageState.ToolCall
            };
        }

        const meta: PlanApprovalMeta = {
            type: 'plan_approval',
            plan: planContent,
            sessionId: tabStorage!.id
        };

        return {
            index: toolCall.index,
            id: toolCall.id,
            function: toolCall.function,
            timecost,
            content: [{
                type: 'text',
                text: `Plan ready for approval:\n\n${planContent}`,
                _meta: meta as any
            }],
            state: MessageState.Success
        };
    }

    // 进行调用，根据结果返回不同的值
    const start = Date.now();
    const toolResponse = await mcpClientAdapter.callTool(toolName, toolArgs);
    const timecost = Date.now() - start;
    const response = handleToolResponse(toolResponse);

    return {
        index: toolCall.index,
        id: toolCall.id,
        function: toolCall.function,
        timecost,
        ...response
    };
}

function deserializeToolCallResponse(toolArgs: string) {
    try {
        const args = JSON.parse(toolArgs);
        return {
            value: args,
            error: undefined
        }
    } catch (error) {
        return {
            value: undefined,
            error
        }
    }
}

export function handleToolResponse(toolResponse: ToolCallResponse) {
    if (typeof toolResponse === 'string') {

        return {
            content: [{
                type: 'error',
                text: toolResponse
            }],
            state: MessageState.ToolCall
        }

    } else if (!toolResponse.isError) {

        return {
            content: toolResponse.content,
            state: MessageState.Success
        };

    } else {

        return {
            content: toolResponse.content,
            state: MessageState.ToolCall
        };

    }
}

function parseErrorObject(error: any): string {
    if (typeof error === 'string') {
        return error;
    } else if (typeof error === 'object') {
        return JSON.stringify(error, null, 2);
    } else {
        return error.toString();
    }
}


/**
 * @description 将工具调用的ID映射为索引
 * @param toolCall 工具调用对象
 * @param callId2Index ID到索引的映射表
 * @returns 映射后的索引值
 */
export function idAsIndexAdapter(toolCall: ToolCall | string, callId2Index: Map<string, number>): IToolCallIndex {
    // grok 采用 id 作为 index，需要将 id 映射到 zero-based 的 index
    const id = typeof toolCall === 'string' ? toolCall : toolCall.id;
    if (!id) {
        return 0;
    }
    if (!callId2Index.has(id)) {
        callId2Index.set(id, callId2Index.size);
    }
    return callId2Index.get(id)!;
}


/**
 * @description 单次调用的索引适配器（暂未实现）
 * @param toolCall 工具调用对象
 * @returns 固定返回0
 */
export function singleCallIndexAdapter(toolCall: ToolCall): IToolCallIndex {
    // TODO: 等待后续支持
    return 0;
}

/**
 * @description
 * @param toolCall 
 * @returns 
 */
export function defaultIndexAdapter(toolCall: ToolCall): IToolCallIndex {
    return toolCall.index || 0;
}

export function getToolCallIndexAdapter(llm: BasicLlmDescription, chatData: ChatCompletionCreateParamsBase) {

    // 如果是 xml 模式，那么 index adapter 必须是 idAsIndexAdapter

    if (chatData.enableXmlWrapper) {
        const callId2Index = new Map<string, number>();
        return (toolCall: ToolCall) => idAsIndexAdapter(toolCall, callId2Index);
    }

    if (llm.userModel.startsWith('gemini')) {
        return singleCallIndexAdapter;
    }

    if (llm.userModel.startsWith('grok')) {
        const callId2Index = new Map<string, number>();
        return (toolCall: ToolCall) => idAsIndexAdapter(toolCall, callId2Index);
    }

    return defaultIndexAdapter;
}

export function getIdAsIndexAdapter() {
    const callId2Index = new Map<string, number>();
    return (toolCall: ToolCall) => idAsIndexAdapter(toolCall, callId2Index);
}