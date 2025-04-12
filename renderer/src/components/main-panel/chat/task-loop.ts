/* eslint-disable */
import { Ref } from "vue";
import { ToolCall, ChatStorage, getToolSchema } from "./chat";
import { useMessageBridge } from "@/api/message-bridge";
import type { OpenAI } from 'openai';
import { callTool } from "../tool/tools";
import { llmManager, llms } from "@/views/setting/llm";

type ChatCompletionChunk = OpenAI.Chat.Completions.ChatCompletionChunk;
type ChatCompletionCreateParamsBase = OpenAI.Chat.Completions.ChatCompletionCreateParams & { id?: string };
interface TaskLoopOptions {
    maxEpochs: number;
}

/**
 * @description 对任务循环进行的抽象封装
 */
export class TaskLoop {
    private bridge = useMessageBridge();
    private currentChatId = '';

    constructor(
        private readonly streamingContent: Ref<string>,
        private readonly streamingToolCalls: Ref<ToolCall[]>,
        private onError: (msg: string) => void = (msg) => {},
        private onChunk: (chunk: ChatCompletionChunk) => void = (chunk) => {},
        private onDone: () => void = () => {},
        private onEpoch: () => void = () => {},
        private readonly taskOptions: TaskLoopOptions = { maxEpochs: 20 },
    ) {}

    private async handleToolCalls(toolCalls: ToolCall[]) {
        // TODO: 调用多个工具并返回调用结果？
        const toolCall = toolCalls[0];
        try {
            const toolName = toolCall.function.name;
            const toolArgs = JSON.parse(toolCall.function.arguments);
            const toolResponse = await callTool(toolName, toolArgs);
            if (!toolResponse.isError) {
                const content = JSON.stringify(toolResponse.content);
                return content;
            } else {
                this.onError(`工具调用失败: ${toolResponse.content}`);
            }

        } catch (error) {
            this.onError(`工具调用失败: ${(error as Error).message}`);
        }
    }

    private handleChunkDeltaContent(chunk: ChatCompletionChunk) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
            this.streamingContent.value += content;
        }
    }

    private handleChunkDeltaToolCalls(chunk: ChatCompletionChunk) {
        const toolCall = chunk.choices[0]?.delta?.tool_calls?.[0];
        if (toolCall) {
            const currentCall = this.streamingToolCalls.value[toolCall.index];

            if (currentCall === undefined) {
                // 新的工具调用开始
                this.streamingToolCalls.value = [{
                    id: toolCall.id,
                    index: 0,
                    type: 'function',
                    function: {
                        name: toolCall.function?.name || '',
                        arguments: toolCall.function?.arguments || ''
                    }
                }];
            } else {
                // 累积现有工具调用的信息
                if (currentCall) {
                    if (toolCall.id) {
                        currentCall.id = toolCall.id;
                    }
                    if (toolCall.function?.name) {
                        currentCall.function.name = toolCall.function.name;
                    }
                    if (toolCall.function?.arguments) {
                        currentCall.function.arguments += toolCall.function.arguments;
                    }
                }
            }

        }        
    }

    private doConversation(chatData: ChatCompletionCreateParamsBase) {

        return new Promise<void>((resolve, reject) => {
            const chunkHandler = this.bridge.addCommandListener('llm/chat/completions/chunk', data => {
                if (data.code !== 200) {
                    this.onError(data.msg || '请求模型服务时发生错误');
                    reject(new Error(data.msg || '请求模型服务时发生错误'));
                    return;
                }
                const { chunk } = data.msg as { chunk: ChatCompletionChunk };
                
                // 处理增量的 content 和 tool_calls
                this.handleChunkDeltaContent(chunk);
                this.handleChunkDeltaToolCalls(chunk);
                
                this.onChunk(chunk);
            }, { once: false });
        
            this.bridge.addCommandListener('llm/chat/completions/done', data => {
                this.onDone();
                chunkHandler();

                resolve();
            }, { once: true });

            this.bridge.postMessage({
                command: 'llm/chat/completions',
                data: JSON.parse(JSON.stringify(chatData)),
            });
        });
    }


    public makeChatData(tabStorage: ChatStorage): ChatCompletionCreateParamsBase {
        const baseURL = llms[llmManager.currentModelIndex].baseUrl;
        const apiKey = llms[llmManager.currentModelIndex].userToken;
        const model = llms[llmManager.currentModelIndex].userModel;
        const temperature = tabStorage.settings.temperature;
        const tools = getToolSchema(tabStorage.settings.enableTools);

        const userMessages = [];
        if (tabStorage.settings.systemPrompt) {
            userMessages.push({
                role: 'system',
                content: tabStorage.settings.systemPrompt
            });
        }

        // 如果超出了 tabStorage.settings.contextLength, 则删除最早的消息
        const loadMessages = tabStorage.messages.slice(- tabStorage.settings.contextLength);
        userMessages.push(...loadMessages);
        // 增加一个id用于锁定状态
        const id = crypto.randomUUID();

        const chatData = {
            id,
            baseURL,
            apiKey,
            model,
            temperature,
            tools,
            messages: userMessages,
        } as ChatCompletionCreateParamsBase;

        return chatData;
    }

    public abort() {
        this.bridge.postMessage({
            command: 'llm/chat/completions/abort',
            data: {
                id: this.currentChatId
            }
        });
        this.streamingContent.value = '';
        this.streamingToolCalls.value = [];
    }

    public registerOnError(handler: (msg: string) => void) {
        this.onError = handler;
    }

    public registerOnChunk(handler: (chunk: ChatCompletionChunk) => void) {
        this.onChunk = handler;
    }
    
    public registerOnDone(handler: () => void) {
        this.onDone = handler;
    }

    public registerOnEpoch(handler: () => void) {
        this.onEpoch = handler;
    }

    /**
     * @description 开启循环，异步更新 DOM
     */
    public async start(tabStorage: ChatStorage, userMessage: string) {
        // 添加目前的消息
        tabStorage.messages.push({ role: 'user', content: userMessage });

        for (let i = 0; i < this.taskOptions.maxEpochs; ++ i) {

            this.onEpoch();

            // 初始累计清空
            this.streamingContent.value = '';
            this.streamingToolCalls.value = [];

            // 构造 chatData
            const chatData = this.makeChatData(tabStorage);

            this.currentChatId = chatData.id!;

            // 发送请求
            await this.doConversation(chatData);

            // 如果存在需要调度的工具
            if (this.streamingToolCalls.value.length > 0) {

                tabStorage.messages.push({
                    role: 'assistant',
                    content: this.streamingContent.value || '',
                    tool_calls: this.streamingToolCalls.value
                });

                const toolCallResult = await this.handleToolCalls(this.streamingToolCalls.value);
                if (toolCallResult) {
                    const toolCall = this.streamingToolCalls.value[0];

                    tabStorage.messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id || toolCall.function.name,
                        content: toolCallResult
                    });
                }

            } else if (this.streamingContent.value) {
                tabStorage.messages.push({
                    role: 'assistant',
                    content: this.streamingContent.value
                });
                break;

            } else {
                // 一些提示

                break;
            }
        }
    }
}