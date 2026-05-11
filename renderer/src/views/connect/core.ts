import { useMessageBridge } from "@/api/message-bridge";
import { reactive, type Reactive } from "vue";
import { type IConnectionResult, type ConnectionTypeOptionItem, type IConnectionArgs, type IConnectionEnvironment, type McpOptions, type McpClientGetCommonOption, CONNECTION_READY_EVENT } from "./type";
import { ElMessage } from "element-plus";
import { loadPanels } from "@/hook/panel";
import { getPlatform } from "@/api/platform";
import type { PromptsGetResponse, PromptsListResponse, PromptTemplate, Resources, ResourcesListResponse, ResourcesReadResponse, ResourceTemplate, ResourceTemplatesListResponse, ToolCallResponse, ToolItem, ToolsListResponse } from "@/hook/type";
import { mcpSetting } from "@/hook/mcp";
import chalk from "chalk";
import I18n from '@/i18n';
import { logTimeStampString } from "@/hook/util";
import { AsyncLock } from "@/hook/async-lock";

const { t } = I18n.global;

export const connectionSelectDataViewOption: ConnectionTypeOptionItem[] = [
    {
        value: 'STDIO',
        label: 'stdio'
    },
    {
        value: 'SSE',
        label: 'sse'
    },
    {
        value: 'STREAMABLE_HTTP',
        label: 'http'
    }
]

function normalizeConnectionType(type?: string): IConnectionArgs['connectionType'] | undefined {
    if (!type) return undefined;
    const normalized = type.trim().toUpperCase().replace(/[-\s]/g, '_');
    if (normalized === 'STDIO') return 'STDIO';
    if (normalized === 'SSE') return 'SSE';
    if (normalized === 'STREAMABLE_HTTP' || normalized === 'STREAMABLEHTTP' || normalized === 'HTTP') return 'STREAMABLE_HTTP';
    return undefined;
}

function normalizeConnectionArgsRecord<T extends Record<string, any>>(record: T): T & { connectionType?: IConnectionArgs['connectionType'] } {
    const item: any = { ...record };
    const connectionType = normalizeConnectionType(item.connectionType || item.type || item.transport);
    if (connectionType) {
        item.connectionType = connectionType;
    } else if (item.url && !item.connectionType) {
        item.connectionType = 'STREAMABLE_HTTP';
    }
    delete item.type;
    delete item.transport;
    return item;
}

function prettifyMapKeys(keys: MapIterator<string>) {
    const result: string[] = [];
    for (const key of keys) {
        result.push('+ ' + key);
    }
    return result.join('\n');
}

function _processSchemaNode(node: any, defs: Record<string, any> = {}): any {
    // Handle $ref references
    if ('$ref' in node) {
        const refPath = node['$ref'];
        if (refPath.startsWith('#/$defs/')) {
            const refName = refPath.split('/').pop();
            if (refName && refName in defs) {
                // Process the referenced definition
                return _processSchemaNode(defs[refName], defs);
            }
        }
    }

    // Start with a new schema object
    const result: Record<string, any> = {};

    // Copy the basic properties
    if ('type' in node) {
        result.type = node.type;
    }

    // Handle anyOf (often used for optional fields with None)
    if ('anyOf' in node) {
        const nonNullTypes = node.anyOf.filter((t: any) => t?.type !== 'null');
        if (nonNullTypes.length > 0) {
            // Process the first non-null type
            const processed = _processSchemaNode(nonNullTypes[0], defs);
            Object.assign(result, processed);
        }
    }

    // Handle description
    if ('description' in node) {
        result.description = node.description;
    }

    // Handle object properties recursively
    if (node?.type === 'object' && 'properties' in node) {
        result.type = 'object';
        result.properties = {};

        // Process each property
        for (const [propName, propSchema] of Object.entries(node.properties)) {
            result.properties[propName] = _processSchemaNode(propSchema as any, defs);
        }

        // Add required fields if present
        if ('required' in node) {
            result.required = node.required;
        }
    }

    // Handle arrays
    if (node?.type === 'array' && 'items' in node) {
        result.type = 'array';
        result.items = _processSchemaNode(node.items, defs);
    }

    return result;
}

export class McpClient {
    // 连接入参
    public connectionArgs: IConnectionArgs;
    // 连接出参
    public connectionResult: IConnectionResult;

    // 预设环境变量，初始化的时候会去获取它们
    public presetsEnvironment: string[] = ['HOME', 'LOGNAME', 'PATH', 'SHELL', 'TERM', 'USER'];
    // 环境变量
    public connectionEnvironment: IConnectionEnvironment;

    // logger 面板的 ref
    public connectionLogRef: any = null;
    // setting 面板的 ref
    public connectionSettingRef: any = null;

    public tools: Map<string, ToolItem> | null = null;
    public promptTemplates: Map<string, PromptTemplate> | null = null;
    public resources: Map<string, Resources> | null = null;
    public resourceTemplates: Map<string, ResourceTemplate> | null = null;
    
    // 变量管理数据（server 级别）
    public variables: Map<string, any> = new Map();

    constructor(
        public clientVersion: string = '0.0.1',
        public clientNamePrefix: string = 'openmcp.connect'
    ) {
        // 连接入参
        this.connectionArgs = {
            connectionType: 'STDIO',
            commandString: '',
            cwd: '',
            url: '',
            oauth: ''
        };

        // 连接出参
        this.connectionResult = {
            success: false,
            reuseConntion: false,
            status: 'disconnected',
            clientId: '',
            name: '',
            version: '',
            logString: []
        };

        // 环境变量
        this.connectionEnvironment = {
            data: [],
            newKey: '',
            newValue: ''
        };
    }

    async acquireConnectionSignature(args: IConnectionArgs) {
        this.connectionArgs.connectionType = args.connectionType;
        this.connectionArgs.commandString = args.commandString || '';
        this.connectionArgs.cwd = args.cwd || '';
        this.connectionArgs.url = args.url || '';
        this.connectionArgs.oauth = args.oauth || '';
        this.connectionArgs.env = args.env || {};
        this.connectionArgs.enableDatasetReflux = args.enableDatasetReflux || false;
        this.connectionArgs.datasetName = args.datasetName || '';
        this.connectionArgs.connectionId = args.connectionId || '';
        this.connectionArgs.storageScope = args.storageScope;
        this.connectionArgs.workspacePath = args.workspacePath || '';
    }

    get clientId() {
        return this.connectionResult.clientId;
    }

    get name() {
        return this.connectionResult.name;
    }

    get version() {
        return this.connectionResult.version;
    }

    get status() {
        return this.connectionResult.status;
    }

    get connected() {
        return this.connectionResult.success;
    }

    get env() {
        const env = {} as Record<string, string>;
        this.connectionEnvironment.data.forEach(item => {
            env[item.key] = item.value;
        });
        return env;
    }

    public async getTools(option?: McpClientGetCommonOption) {

        const {
            cache = true
        } = option || {};

        if (cache && this.tools) {
            return this.tools;
        }

        const bridge = useMessageBridge();

        const { code, msg } = await bridge.commandRequest<ToolsListResponse>('tools/list', { clientId: this.clientId });
        if (code !== 200) {
            return new Map<string, ToolItem>();
        }

        this.tools = new Map<string, ToolItem>();
        msg.tools.forEach(tool => {
            // const standardSchema = _processSchemaNode(tool.inputSchema, tool.inputSchema.$defs || {});
            // tool.inputSchema = standardSchema;

            this.tools!.set(tool.name, tool);
        });

        return this.tools;
    }

    public async getPromptTemplates(option?: McpClientGetCommonOption) {

        const {
            cache = true
        } = option || {};

        if (cache && this.promptTemplates) {
            return this.promptTemplates;
        }

        const bridge = useMessageBridge();

        const { code, msg } = await bridge.commandRequest<PromptsListResponse>('prompts/list', { clientId: this.clientId });

        if (code !== 200) {
            return new Map<string, PromptTemplate>();
        }

        this.promptTemplates = new Map<string, PromptTemplate>();
        msg.prompts.forEach(template => {
            this.promptTemplates!.set(template.name, template);
        });

        return this.promptTemplates;
    }

    public async getResources(option?: McpClientGetCommonOption) {

        const {
            cache = true
        } = option || {};

        if (cache && this.resources) {
            return this.resources;
        }

        const bridge = useMessageBridge();

        const { code, msg } = await bridge.commandRequest<ResourcesListResponse>('resources/list', { clientId: this.clientId });
        if (code !== 200) {
            return new Map<string, Resources>();
        }

        this.resources = new Map<string, Resources>();
        msg.resources.forEach(resource => {
            this.resources!.set(resource.name, resource);
        });
        return this.resources;
    }

    public async getResourceTemplates(option?: McpClientGetCommonOption) {

        const {
            cache = true
        } = option || {};

        if (cache && this.resourceTemplates) {
            return this.resourceTemplates;
        }

        const bridge = useMessageBridge();

        const { code, msg } = await bridge.commandRequest<ResourceTemplatesListResponse>('resources/templates/list', { clientId: this.clientId });
        if (code !== 200) {
            return new Map();
        }
        this.resourceTemplates = new Map<string, ResourceTemplate>();
        msg.resourceTemplates.forEach(template => {
            this.resourceTemplates!.set(template.name, template);
        });
        return this.resourceTemplates;
    }

    private get commandAndArgs() {
        const commandString = this.connectionArgs.commandString;

        if (!commandString) {
            return { command: '', args: [] };
        }

        const args = commandString.split(' ');
        const command = args.shift() || '';

        return { command, args };
    }

    get connectOption() {
        const { command, args } = this.commandAndArgs;
        const url = this.connectionArgs.url;
        const cwd = this.connectionArgs.cwd;
        const oauth = this.connectionArgs.oauth;
        const connectionType = this.connectionArgs.connectionType;
        const enableDatasetReflux = this.connectionArgs.enableDatasetReflux;
        const datasetName = this.connectionArgs.datasetName;
        const connectionId = this.connectionArgs.connectionId;
        const storageScope = this.connectionArgs.storageScope;
        const workspacePath = this.connectionArgs.workspacePath;

        const clientName = this.clientNamePrefix + '.' + this.connectionArgs.connectionType;
        const clientVersion = this.clientVersion;

        // 合并 this.env 和 this.connectionArgs.env
        const env = {
            // 软件层面设置的 env
            ...this.env,
            // sdk 层面设置的 env
            ...this.connectionArgs.env
        };

        const option: McpOptions = {
            connectionType,
            command,
            args,
            url,
            cwd,
            oauth,
            clientName,
            clientVersion,
            env,
            serverInfo: {
                name: this.connectionResult.name,
                version: this.connectionResult.version
            },
            enableDatasetReflux,
            datasetName,
            connectionId,
            storageScope,
            workspacePath
        };

        return option;
    }

    public async connect() {
        const bridge = useMessageBridge();
        const { code, msg } = await bridge.commandRequest<IConnectionResult>('connect', this.connectOption);

        this.connectionResult.success = (code === 200);

        if (code !== 200) {
            const message = msg.toString();
            this.connectionResult.logString.push({
                type: 'error',
                title: t('connect-fail'),
                message
            });

            ElMessage.error(message);
            return false;
        } else {
            this.connectionResult.logString.push({
                type: 'info',
                title: msg.name + ' ' + msg.version + ' ' + t('connect-success'),
                message: JSON.stringify(msg, null, 2)
            });
        }

        this.connectionResult.reuseConntion = msg.reuseConnection ?? msg.reuseConntion;
        this.connectionResult.status = msg.status;
        this.connectionResult.clientId = msg.clientId;
        this.connectionResult.name = msg.name;
        this.connectionResult.version = msg.version;

        if (!mcpSetting.datasetName) {
            mcpSetting.datasetName = msg.name;
        }

        // 刷新所有资源
        const tools = await this.getTools({ cache: false });
        this.connectionResult.logString.push({
            type: 'info',
            title: `${this.name}'s tools loaded (${tools.size})`,
            message: prettifyMapKeys(tools.keys())
        });

        const prompts = await this.getPromptTemplates({ cache: false });
        this.connectionResult.logString.push({
            type: 'info',
            title: `${this.name}'s prompts loaded (${prompts.size})`,
            message: prettifyMapKeys(prompts.keys())
        });

        const resources = await this.getResources({ cache: false });
        this.connectionResult.logString.push({
            type: 'info',
            title: `${this.name}'s resources loaded (${resources.size})`,
            message: prettifyMapKeys(resources.keys())
        });

        const resourceTemplates = await this.getResourceTemplates({ cache: false });
        this.connectionResult.logString.push({
            type: 'info',
            title: `${this.name}'s resourceTemplates loaded (${resourceTemplates.size})`,
            message: prettifyMapKeys(resourceTemplates.keys())
        });

        return true;
    }

    public async disconnect() {
        const bridge = useMessageBridge();
        const { code, msg } = await bridge.commandRequest<IConnectionResult>('disconnect', {
            clientId: this.connectionResult.clientId,
        });

        this.connectionResult.success = (code === 200);

        if (code !== 200) {
            const message = msg.toString();
            this.connectionResult.logString.push({
                type: 'error',
                title: t('disconnect-fail'),
                message
            });

            ElMessage.error(message);
            return false;
        } else {
            this.connectionResult.logString.push({
                type: 'info',
                title: t('disconnect-success'),
                message: JSON.stringify(msg, null, 2)
            });
        }

        // 清理本地连接状态
        this.connectionResult.status = 'disconnected';
        this.connectionResult.success = false;
        this.connectionResult.clientId = '';
        this.connectionResult.name = '';
        this.connectionResult.version = '';
        this.connectionResult.reuseConntion = false;

        return true;
    }


    /**
     * @description 处理环境变量开关
     * - 开启时，刷新预设环境变量的数值
     * - 关闭时，清空预设环境变量的数值
     * @param enabled 
     */
    public async handleEnvSwitch(enabled: boolean) {
        const presetVars = this.presetsEnvironment;
        if (enabled) {
            const values = await this.lookupEnvVar(presetVars);

            const env = this.connectOption.env || {};

            if (values) {
                // 将 key values 合并进 connectionEnv.data 中
                for (let i = 0; i < presetVars.length; i++) {
                    const varName = presetVars[i];
                    const varValue = values[i];

                    if (Object.hasOwn(env, varName)) {
                        // 若已有相同的 key, 采用原本的
                    } else {
                        env[varName] = varValue;
                    }
                }

                for (const varName of Object.keys(env)) {
                    this.connectionEnvironment.data.push({ key: varName, value: env[varName] });
                }
            }
        } else {
            // 清空 connectionEnv.data 中所有 key 为 presetVars 的项
            const reserveItems = this.connectionEnvironment.data.filter(item => !presetVars.includes(item.key));
            this.connectionEnvironment.data = reserveItems;
        }
    }


    /**
     * @description 查询环境变量
     * @param varNames
     * @returns 
     */
    public async lookupEnvVar(varNames: string[]) {
        const bridge = useMessageBridge();
        const { code, msg } = await bridge.commandRequest('lookup-env-var', {
            keys: varNames
        });

        if (code === 200) {

            this.connectionResult.logString.push({
                type: 'info',
                title: t('preset-env-sync.success')
            });

            return msg;
        } else {
            this.connectionResult.logString.push({
                type: 'error',
                title: t('preset-env-sync.fail'),
                message: msg.toString()
            });
        }
    }

    // 添加资源刷新方法，支持超时控制
    public async refreshAllResources(timeoutMs = 30000): Promise<void> {
        const controller = new AbortController();
        const signal = controller.signal;

        // 设置超时
        const timeoutId = setTimeout(() => {
            controller.abort();
            console.error(`[REFRESH TIMEOUT] Client ${this.clientId}`);
        }, timeoutMs);

        try {
            console.log(`[REFRESH START] Client ${this.clientId}`);

            // 按顺序刷新资源
            await this.getTools({ cache: false });
            await this.getPromptTemplates({ cache: false });
            await this.getResources({ cache: false });
            await this.getResourceTemplates({ cache: false });
            console.log(
                chalk.gray(`[${new Date().toLocaleString()}]`),
                chalk.green(`🚀 [${this.name}] REFRESH COMPLETE`)
            );

        } catch (error) {
            if (signal.aborted) {
                throw new Error(`Refresh timed out after ${timeoutMs}ms`);
            }
            console.error(`[REFRESH ERROR] Client ${this.clientId}:`, error);
            console.error(
                chalk.gray(`[${new Date().toLocaleString()}]`),
                chalk.red(`🚀 [${this.name}] REFRESH FAILED`),
                error
            );
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }
}


class McpClientAdapter {
    public clients: Reactive<McpClient[]> = reactive([]);
    public currentClientIndex: number = 0;
    public refreshSignal = reactive({ value: 0 });

    private defaultClient: McpClient = new McpClient();
    public connectLogListenerCancel: (() => void) | null = null;
    public connectrefreshListener: (() => void) | null = null;
    public lock: AsyncLock = new AsyncLock();

    constructor(
        public platform: string
    ) {
        if (platform !== 'nodejs') {
            this.addConnectRefreshListener();
        }
    }

    /**
     * @description 获取连接参数签名（优先使用 servers/list，兼容旧 launch-signature）
     * @returns 
     */
    public async getLaunchSignature(): Promise<IConnectionArgs[]> {

        const bridge = useMessageBridge();

        // 先尝试新 RPC
        try {
            const res = await bridge.commandRequest<{ servers: any[] }>('servers/list', {});
            const payload = (res.data as any) || res.msg;
            if (res.code === 200 && payload?.servers) {
                const locals = payload.servers.filter((s: any) => s.source === 'local');
                return locals.map((s: any) => {
                    const item = normalizeConnectionArgsRecord(s);
                    if (item.connectionType === 'STDIO' && item.command) {
                        item.commandString = [item.command, ...(item.args || [])].join(' ');
                    }
                    return item;
                });
            }
        } catch {
            // fallback to legacy RPC
        }

        const { code, msg } = await bridge.commandRequest(this.platform + '/launch-signature');
        if (code !== 200) {
            const message = msg.toString();
            ElMessage.error(message);
            return [];
        }
        if (Array.isArray(msg)) {
            return msg.map((item: any) => normalizeConnectionArgsRecord(item));
        }
        return [normalizeConnectionArgsRecord(msg as any)];
    }

    get masterNode() {
        if (this.clients.length === 0) {
            return this.defaultClient;
        }
        return this.clients[0];
    }

    get datasetName() {
        return this.masterNode.connectionArgs.datasetName || '';
    }

    public async saveLaunchSignature() {
        const bridge = useMessageBridge();

        const options: McpOptions[] = [];

        for (const client of this.clients) {
            const option = client.connectOption;
            const env = {} as Record<string, string>;

            for (const item of client.connectionEnvironment.data) {
                env[item.key] = item.value;
            }

            option.env = env;
            options.push(option);
        }

        const deserializeOption = JSON.parse(JSON.stringify(options));

        // 使用新 RPC 逐条保存；同时保持旧接口兼容
        try {
            await bridge.commandRequest('servers/replace-all', { items: deserializeOption });
        } catch {
            bridge.postMessage({
                command: platform + '/update-connection-signature',
                data: deserializeOption
            });
        }
    }

    private findClientIndexByUuid(uuid: string): number {
        // 检查客户端数组是否存在且不为空
        if (!this.clients || this.clients.length === 0) {
            return -1;
        }

        const index = this.clients.findIndex(client => client.clientId === uuid);
        return index;
    }

    /**
     * @description register HMR
     */
    public addConnectRefreshListener() {
        // 创建对于 connect/refresh 的监听        
        if (!this.connectrefreshListener) {
            const bridge = useMessageBridge();
            this.connectrefreshListener = bridge.addCommandListener('connect/refresh', async (message) => {
                const { code, msg } = message;

                if (code === 200) {
                    // 查找目标客户端
                    const clientIndex = this.findClientIndexByUuid(msg.uuid);

                    if (clientIndex > -1) {
                        await this.clients[clientIndex].refreshAllResources();

                        // 更新 refreshSignal，所有 watch refreshSignal 的部分会发生更新
                        this.refreshSignal.value++;
                    } else {
                        console.error(
                            chalk.gray(`[${new Date().toLocaleString()}]`),
                            chalk.red(`No client found with ID: ${msg.uuid}`),
                        );
                    }
                }
            }, { once: false });
        }
    }

    /**
     * 注册 connect/log 和 connect/refresh 监听器，不再自动连接已保存的 Server。
     * 用户需要在 Server Tab 手动选择要连接的 Server。
     */
    public async launch() {
        // 创建对于 log/output 的监听
        if (!this.connectLogListenerCancel) {
            const bridge = useMessageBridge();
            this.connectLogListenerCancel = bridge.addCommandListener('connect/log', (message) => {
                const { code, msg } = message;

                const client = this.clients.at(-1);

                if (!client) {
                    return;
                }

                client.connectionResult.logString.push({
                    type: code === 200 ? 'info' : 'error',
                    title: msg.title,
                    message: msg.message
                });

            }, { once: false });
        }

        // 释放信号，告知应用已就绪（不再等待连接完成）
        if (platform === 'web') {
            const event = new CustomEvent(CONNECTION_READY_EVENT, { detail: { message: 'ready' } });
            document.dispatchEvent(event);
        }
    }

    /**
     * 将 Gateway 上已存在的会话挂到本机 UI（例如 CLI 或其它客户端已 connect）。
     * 不发起新的 connect RPC，仅用 clientId 拉取 tools 等元数据。
     */
    public async attachExistingGatewaySession(session: {
        clientId: string;
        name: string;
        version: string;
        connectionType?: IConnectionArgs['connectionType'];
        type?: string;
        transport?: string;
        command?: string;
        args?: string[];
        commandString?: string;
        url?: string;
        cwd?: string;
        env?: Record<string, string>;
        connectionId?: string;
        storageScope?: 'user' | 'workspace';
        workspacePath?: string;
    }): Promise<number> {
        const existing = this.findClientIndexByUuid(session.clientId);
        if (existing >= 0) {
            const c = this.clients[existing];
            await c.acquireConnectionSignature(this.toConnectionArgs(session));
            if (session.env) {
                c.connectionEnvironment.data = Object.entries(session.env).map(([key, value]) => ({ key, value }));
            }
            c.connectionResult.success = true;
            c.connectionResult.status = 'connected';
            c.connectionResult.name = session.name;
            c.connectionResult.version = session.version;
            return existing;
        }
        const rawClient = new McpClient();
        rawClient.connectionResult.success = true;
        rawClient.connectionResult.status = 'connected';
        rawClient.connectionResult.clientId = session.clientId;
        rawClient.connectionResult.name = session.name;
        rawClient.connectionResult.version = session.version;
        await rawClient.acquireConnectionSignature(this.toConnectionArgs(session));
        if (session.env) {
            rawClient.connectionEnvironment.data = Object.entries(session.env).map(([key, value]) => ({ key, value }));
        }
        this.clients.push(rawClient);
        const idx = this.clients.length - 1;
        try {
            await this.clients[idx].getTools({ cache: false });
        } catch (e) {
            console.error('[attachExistingGatewaySession] getTools', e);
        }
        return idx;
    }

    private toConnectionArgs(session: {
        connectionType?: IConnectionArgs['connectionType'];
        type?: string;
        transport?: string;
        command?: string;
        args?: string[];
        commandString?: string;
        url?: string;
        cwd?: string;
        env?: Record<string, string>;
        connectionId?: string;
        storageScope?: 'user' | 'workspace';
        workspacePath?: string;
    }): IConnectionArgs {
        const commandString = session.commandString
            || [session.command, ...(session.args || [])].filter(Boolean).join(' ');
        const connectionType = normalizeConnectionType(session.connectionType || session.type || session.transport)
            || (session.url ? 'STREAMABLE_HTTP' : 'STDIO');

        return {
            connectionType,
            commandString,
            cwd: session.cwd || '',
            url: session.url || '',
            env: session.env || {},
            connectionId: session.connectionId || '',
            storageScope: session.storageScope,
            workspacePath: session.workspacePath || ''
        };
    }

    /**
     * 手动连接指定的 Server 配置（由 UI 触发，替代旧的自动批量连接逻辑）。
     */
    public async connectServer(item: IConnectionArgs) {
        await this.lock.acquire();

        const rawClient = new McpClient();
        await rawClient.acquireConnectionSignature(item);

        this.clients.push(rawClient);
        const client = this.clients[this.clients.length - 1];

        await client.handleEnvSwitch(true);

        const ok = await client.connect();

        let wrapperChalk = chalk as any;
        if (platform === 'web') {
            wrapperChalk = {
                gray: (s: string) => s,
                green: (s: string) => s,
                red: (s: string) => s
            }
        }

        if (ok) {
            console.log(
                wrapperChalk.gray(`${logTimeStampString()} |`),
                wrapperChalk.green(`🚀 [${client.name}] ${client.version} connected, type ${client.connectOption.connectionType}`)
            );

            mcpSetting.enableDatasetReflux = client.connectionArgs.enableDatasetReflux || false;
            if (!mcpSetting.datasetName) {
                mcpSetting.datasetName = client.connectionArgs.datasetName || client.connectionResult.name || '';
            }

            this.saveLaunchSignature();
        } else {
            console.log(
                wrapperChalk.gray(`${logTimeStampString()} |`),
                wrapperChalk.red(`❌ fail to connect `),
                wrapperChalk.red(JSON.stringify(client.connectionResult.logString, null, 2))
            );
            // 连接失败，移除这个 client
            const idx = this.clients.indexOf(client);
            if (idx >= 0) {
                this.clients.splice(idx, 1);
            }
        }

        this.lock.releaseAll();
        return ok;
    }

    public async readResource(resourceUri?: string, clientIndex?: number) {
        if (!resourceUri) {
            return undefined;
        }

        let clientId: string;
        if (clientIndex !== undefined && clientIndex >= 0 && clientIndex < this.clients.length) {
            clientId = this.clients[clientIndex].clientId;
        } else {
            clientId = this.clients[0].clientId;
            for (const client of this.clients) {
                const resources = await client.getResources();
                const resource = Array.from(resources.values()).find(r => r.uri === resourceUri || r.name === resourceUri);
                if (resource) {
                    clientId = client.clientId;
                    break;
                }
            }
        }

        const bridge = useMessageBridge();
        const { code, msg } = await bridge.commandRequest<ResourcesReadResponse>('resources/read', { clientId, resourceUri });

        return msg;
    }

    public async readPromptTemplate(promptId: string, args?: Record<string, any>, clientIndex?: number) {
        let clientId: string;
        if (clientIndex !== undefined && clientIndex >= 0 && clientIndex < this.clients.length) {
            clientId = this.clients[clientIndex].clientId;
        } else {
            clientId = this.clients[0].clientId;
            for (const client of this.clients) {
                const promptTemplates = await client.getPromptTemplates();
                const promptTemplate = promptTemplates.get(promptId);
                if (promptTemplate) {
                    clientId = client.clientId;
                    break;
                }
            }
        }
        const bridge = useMessageBridge();
        const { code, msg } = await bridge.commandRequest<PromptsGetResponse>('prompts/get', { clientId, promptId, args });
        return msg;
    }

    public async callTool(toolName: string, toolArgs: Record<string, any>, clientIndex?: number) {
        let clientId: string;
        if (clientIndex !== undefined && clientIndex >= 0 && clientIndex < this.clients.length) {
            clientId = this.clients[clientIndex].clientId;
        } else {
            clientId = this.clients[0]?.clientId ?? '';
            for (const client of this.clients) {
                const tools = await client.getTools();
                const tool = tools.get(toolName);
                if (tool) {
                    clientId = client.clientId;
                    break;
                }
            }
        }

        const bridge = useMessageBridge();
        const { msg } = await bridge.commandRequest<ToolCallResponse>('tools/call', {
            clientId,
            toolName,
            toolArgs: JSON.parse(JSON.stringify(toolArgs)),
            callToolOption: {
                timeout: mcpSetting.timeout * 1000
            }
        });

        return msg;
    }

    public get connected() {
        return this.clients.length > 0 && this.clients[0].connectionResult.success;
    }

    public async loadPanels() {
        const masterNode = this.clients[0];
        await loadPanels(masterNode);
    }
}

const platform = getPlatform();
export const mcpClientAdapter = reactive(
    new McpClientAdapter(platform)
);

export interface ISegmentViewItem {
    value: any;
    label: string;
    client: McpClient;
    index: number;
}

export const segmentsView = reactive<ISegmentViewItem[]>([]);
