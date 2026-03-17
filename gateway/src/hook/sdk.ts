import { EventEmitter } from 'events';
import { routeMessage } from '../common/router.js';
import * as fs from 'fs';
import { loadSetting, saveSetting } from '../setting/setting.service.js';
import { OmdbStore } from '../common/omdb-store.js';

import {
    MessageState,
    type TaskLoopOptions,
    type ChatMessage,
    type ChatSetting,
    type TaskLoop,
    type TextMessage,
    type ToolCallResult,
    type ToolCall
} from '../../task-loop.js';
import { IConnectionArgs, MessageHandler, WebSocketMessage } from './adapter.js';
import { ConnectionType } from 'src/mcp/client.dto.js';
import { FORBIDDEN_MONITOR, setForbiddenMonitor, setRefluxHome } from './setting.js';

// sdk 模式禁用 monitor
setForbiddenMonitor(true);

export class TaskLoopAdapter {
    public emitter: EventEmitter;
    private messageHandlers: Set<MessageHandler>;
    private connectionOptions: IConnectionArgs[] = [];

    constructor(option?: any) {
        this.emitter = new EventEmitter(option);
        this.messageHandlers = new Set();

        this.emitter.on('message/renderer', (message: WebSocketMessage) => {
            this.messageHandlers.forEach((handler) => handler(message));
        });

        // 默认需要将监听的消息导入到 routeMessage 中
        this.onDidReceiveMessage((message) => {
            const { command, data } = message;

            switch (command) {
                case 'nodejs/launch-signature':
                    this.postMessage({
                        command: 'nodejs/launch-signature',
                        data: {
                            _id: data._id,
                            code: 200,
                            msg: this.connectionOptions
                        }
                    })
                    break;

                case 'nodejs/update-connection-signature':
                    // sdk 模式下不需要自动保存连接参数
                    break;

                default:
                    routeMessage(command, data, this);
                    break;
            }
        });

    }

    /**
     * @description 发送消息
     * @param message - 包含 command 和 args 的消息
     */
    public postMessage(message: WebSocketMessage): void {
        this.emitter.emit('message/service', message);
    }

    /**
     * @description 注册接受消息的句柄
     * @param callback - 消息回调
     * @returns {{ dispose: () => void }} - 可销毁的监听器
     */
    public onDidReceiveMessage(callback: MessageHandler): { dispose: () => void } {
        this.messageHandlers.add(callback);
        return {
            dispose: () => this.messageHandlers.delete(callback),
        };
    }

    /**
     * @description 连接到 mcp 服务端
     * @param mcpOption 
     */
    public addMcp(mcpOption: IConnectionArgs) {

        // 0.1.4 新版本开始，此处修改为懒加载连接
        // 实际的连接移交给前端 mcpAdapter 中进行统一的调度
        // 调度步骤如下：
        // getLaunchSignature 先获取访问签名，访问签名通过当前函数 push 到 class 中

        this.connectionOptions.push(mcpOption);
    }
}

interface StdioMCPConfig {
    command: string;
    args: string[];
    env?: {
        [key: string]: string;
    };
    cwd?: string,
    description?: string;
    prompts?: string[];
    resources?: string[];
}

interface HttpMCPConfig {
    url: string;
    type?: string;
    env?: {
        [key: string]: string;
    };
    description?: string;
    prompts?: string[];
    resources?: string[];
}

export interface OmAgentConfiguration {
    version?: string;
    mcpServers: {
        [key: string]: StdioMCPConfig | HttpMCPConfig;
    };
    defaultLLM: {
        baseURL: string;
        apiToken: string;
        model: string;
    };
    /** Path to SKILL.md file or skill directory */
    skillPath?: string;
}

export interface DefaultLLM {
    baseURL: string;
    apiToken?: string;
    model: string;
}

export interface AinvokeConfig {
    messages: ChatMessage[] | string;
    settings?: Partial<ChatSetting & TaskLoopOptions>;
    until?: {
        toolName: string;
        needCall?: boolean;
        forceCall?: boolean;
    };
    reflux?: {
        enabled?: boolean;
        saveDir?: string;
        /** 回流数据集名称，用于 omdb 文件名，如 'word-mcp' */
        datasetName?: string;
    }
}

export interface LoadMcpConfigParam {
    deferLoading?: boolean;
}

export function UserMessage(content: string): TextMessage {
    return {
        role: 'user',
        content,
        extraInfo: {
            created: Date.now(),
            state: MessageState.None,
            serverName: '',
            enableXmlWrapper: false
        }
    }
}

export function AssistantMessage(content: string): TextMessage {
    return {
        role: 'assistant',
        content,
        extraInfo: {
            created: Date.now(),
            state: MessageState.None,
            serverName: '',
            enableXmlWrapper: false
        }
    }
}

export { OmdbStore };

export class OmAgent {
    private _adapter: TaskLoopAdapter;
    private _loop?: TaskLoop;
    private _defaultLLM?: DefaultLLM;

    constructor() {
        this._adapter = new TaskLoopAdapter();
    }

    /**
     * @description Load MCP configuration from file.
     * Supports multiple MCP backends and a default LLM model configuration.
     *
     * @example
     * Example configuration:
     * {
     *   "version": "1.0.0",
     *   "mcpServers": {
     *     "openmemory": {
     *       "command": "npx",
     *       "args": ["-y", "openmemory"],
     *       "env": {
     *         "OPENMEMORY_API_KEY": "YOUR_API_KEY",
     *         "CLIENT_NAME": "openmemory"
     *       },
     *       "description": "A MCP for long-term memory support"
     *     }
     *   },
     *   "defaultLLM": {
     *     "baseURL": "https://api.openmemory.ai",
     *     "apiToken": "YOUR_API_KEY",
     *     "model": "deepseek-chat"
     *   }
     * }
     *
     * @param configPath - Path to the configuration file
     */
    public loadMcpConfig(configPath: string, params?: LoadMcpConfigParam) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as OmAgentConfiguration;
        this.loadMcp(config);
    }

    public loadMcp(config: OmAgentConfiguration) {
        const { mcpServers, defaultLLM, skillPath } = config;
        // set default llm
        this.setDefaultLLM(defaultLLM);

        // 始终同步 skillPath 到 setting：若配置中未显式传入 skillPath，则清除 SKILL_PATH，避免沿用上次会话的 skill 导致误添加 read_skill_file
        const currentConfig = loadSetting();
        const resolvedSkillPath = skillPath && skillPath.trim() ? skillPath.trim() : '';
        saveSetting({ ...currentConfig, SKILL_PATH: resolvedSkillPath });

        for (const key in mcpServers) {
            const mcpConfig = mcpServers[key];
            if ('command' in mcpConfig) {
                const commandString = (
                    mcpConfig.command + ' ' + mcpConfig.args.join(' ')
                ).trim();

                this._adapter.addMcp({
                    commandString,
                    cwd: mcpConfig.cwd,
                    connectionType: 'STDIO',
                    env: mcpConfig.env,
                    description: mcpConfig.description,
                });
            } else {
                const connectionType: ConnectionType = mcpConfig.type === 'http' ? 'STREAMABLE_HTTP' : 'SSE';
                this._adapter.addMcp({
                    url: mcpConfig.url,
                    env: mcpConfig.env,
                    connectionType,
                    description: mcpConfig.description,
                });
            }
        }
    }

    /**
     * @description Add MCP server
     */
    public addMcpServer(connectionArgs: IConnectionArgs) {
        this._adapter.addMcp(connectionArgs);
    }

    /**
     * @description Set skill path (SKILL.md file or skill directory). When set, skill content is added to system prompt and read_skill_file tool is enabled.
     */
    public setSkillPath(path: string) {
        if (path && path.trim()) {
            const currentConfig = loadSetting();
            saveSetting({ ...currentConfig, SKILL_PATH: path.trim() });
        }
    }

    public async getLoop(loopOption?: TaskLoopOptions) {

        if (this._loop) {
            if (loopOption) {
                this._loop.setTaskLoopOptions(loopOption);
            }
            return this._loop;
        }

        const {
            verbose = 1,
            maxEpochs = 50,
            maxJsonParseRetry = 3,
        } = loopOption || {}

        const adapter = this._adapter;
        const { TaskLoop } = await import('../../task-loop.js');

        this._loop = new TaskLoop({ adapter, verbose, maxEpochs, maxJsonParseRetry });
        await this._loop.waitConnection();        

        return this._loop;
    }

    public setDefaultLLM(option: DefaultLLM) {
        this._defaultLLM = option;
    }

    public async getPrompt(promptId: string, args: Record<string, any>) {
        const loop = await this.getLoop();

        const prompt = await loop.getPrompt(promptId, JSON.parse(JSON.stringify(args)));
                
        return prompt;
    }

    /**
     * @description Asynchronous invoking agent by string or messages
     * @param messages Chat message or string
     * @param settings Chat setting and task loop options
     * @returns 
     */
    private async _ainvoke(
        { messages, settings, reflux }: AinvokeConfig
    ) {
        if (messages.length === 0) {
            throw new Error('messages is empty');
        }

        // detach taskloop option from settings and set default value
        const {
            maxEpochs = 50,
            maxJsonParseRetry = 3,
            verbose = 1
        } = settings || {};

        const loop = await this.getLoop({ maxEpochs, maxJsonParseRetry, verbose });
        const storage = await loop.createStorage(settings);

        // set input message
        // user can invoke [UserMessage("CONTENT")] to make messages quickly
        // or use string directly
        let userMessage: string;
        if (typeof messages === 'string') {
            userMessage = messages;
        } else {
            // 获取messages数组
            const messagesArray = Array.isArray(messages) ? messages : [messages];
            
            // 将最后一个消息赋值给lastMessage
            const lastMessage = messagesArray.at(-1);
            if (lastMessage && typeof lastMessage.content === 'string') {
                userMessage = lastMessage.content;
            } else {
                throw new Error('last message content is undefined');
            }
            
            // 将剩余消息存入storage.messages
            if (messagesArray.length > 1) {
                storage.messages = messagesArray.slice(0, -1);
            }
        }

        // select correct llm config
        // user can set llm config via omagent.setDefaultLLM()
        // or write "defaultLLM" in mcpconfig.json to specify
        if (this._defaultLLM) {
            loop.setLlmConfig({
                baseUrl: this._defaultLLM.baseURL,
                userToken: this._defaultLLM.apiToken,
                userModel: this._defaultLLM.model,
                ...this._defaultLLM,
            });
        } else {
            // throw error to user and give the suggestion
            throw new Error('default LLM is not set, please set it via omagent.setDefaultLLM() or write "defaultLLM" in mcpconfig.json');
        }

        // lookup reflux setting
        const {
            enabled = false,
            saveDir = '',
            datasetName = '',
        } = reflux || {};

        if (saveDir) {
            setRefluxHome(saveDir);
        }
        if (datasetName) {
            loop.setDatasetName(datasetName);
        }

        const loopMode = enabled ? 'single-chat' : 'normal';
        loop.setRefluxSetting(enabled);

        await loop.start(storage, userMessage, { mode: loopMode });

        // get response from last message in message list
        const lastMessage = storage.messages.at(-1)?.content;
        return lastMessage;
    }

    public async ainvoke({ messages, settings, until, reflux }: AinvokeConfig) {
        const {
            toolName = '',
            needCall = true,
            // TODO: finish force
        } = until || {};

        if (toolName === '') {
            return this._ainvoke({ messages, settings, reflux });
        }

        const loop = await this.getLoop();
        
        if (needCall) {
            let returnToolCallResult: ToolCallResult | undefined;
            loop.registerOnToolCalled(toolCallResult => {
                if (toolCallResult.function?.name === toolName) {
                    returnToolCallResult = toolCallResult;
                    loop.abort();
                }
                return toolCallResult;
            });

            await this._ainvoke({ messages, settings, reflux });

            return returnToolCallResult;

        } else {
            let returnToolCall: ToolCall | undefined;
            loop.registerOnToolCall(toolCall => {
                if (toolCall.function.name === toolName) {
                    returnToolCall = toolCall;
                    loop.abort();
                }
                return toolCall;
            });

            await this._ainvoke({ messages, settings, reflux });

            return returnToolCall;
        }
    }

}
