// ==================== 基础类型定义 ====================
export interface SchemaProperty {
	title: string;
	type: string;
	description?: string;
}

export interface InputSchema {
	type: string;
	properties: Record<string, SchemaProperty>;
	required?: string[];
	title?: string;
}

export interface Argument {
	name: string;
	required: boolean;
}

export interface Content {
	uri: string;
	mimeType: string;
	text: string;
}

export interface MessageContent {
	type: string;
	text: string;
}

export interface CasualRestAPI<T> {
	code: number
	msg: T
}

// ==================== 响应接口定义 ====================
export interface ToolItem {
	name: string;
	description: string;
	inputSchema: InputSchema;
}
export interface ToolsListResponse {
	tools: ToolItem[]
}

export interface PromptTemplate {
    name: string;
    description: string;
    arguments: Argument[];
}

export interface PromptsListResponse {
	prompts: PromptTemplate[];
}

export interface ResourceTemplate {
	uriTemplate: string;
	name: string;
	description: string;
}

export interface ResourceTemplatesListResponse {
	resourceTemplates: ResourceTemplate[]
}

export interface ResourcesListResponse {
	resources: any[]; // 根据示例返回空数组，可进一步定义具体类型
}

export interface ResourcesReadResponse {
	contents: Content[];
}

export interface PromptsGetResponse {
	messages: Array<{
		role: string;
		content: MessageContent;
	}>;
}

export interface ToolCallContent {
    type: string;
    text: string;
	[key: string]: any;
}

export interface ToolCallResponse {
    content: ToolCallContent[];
    isError: boolean;
}

// ==================== 请求接口定义 ====================
export interface BaseRequest {
	method: string;
	params: Record<string, any>;
}

export interface ResourcesReadRequest extends BaseRequest {
	method: 'resources/read';
	params: {
		uri: string;
	};
}

export interface PromptsGetRequest extends BaseRequest {
	method: 'prompts/get';
	params: {
		name: string;
		arguments: Record<string, any>;
	};
}

export interface ToolCallRequest extends BaseRequest {
    method: 'tools/call';
    params: {
        name: string;
        arguments: Record<string, any>;
        _meta?: {
            progressToken?: number;
        };
    };
}

// ==================== 合并类型定义 ====================
export type APIResponse =
	| ToolsListResponse
	| PromptsListResponse
	| ResourceTemplatesListResponse
	| ResourcesListResponse
	| ResourcesReadResponse
	| PromptsGetResponse
    | ToolCallResponse;

export type APIRequest =
	| BaseRequest
	| ResourcesReadRequest
	| PromptsGetRequest
    | ToolCallRequest;

export interface IStdioConnectionItem {
	type: 'stdio';
	name: string;
	command: string;
	args: string[];
	cwd?: string;
	env?: { [key: string]: string };
	filePath?: string;
}

export interface ISSEConnectionItem {
	type: 'sse';
	name: string;
	url: string;
	oauth?: string;
	env?: { [key: string]: string };
	filePath?: string;
}


export interface IStdioLaunchSignature {
	type: 'stdio';
	commandString: string;
	cwd: string;
}

export interface ISSELaunchSignature {
	type:'sse';
	url: string;
	oauth: string;
}

export type IConnectionItem = IStdioConnectionItem | ISSEConnectionItem;
export type ILaunchSigature = IStdioLaunchSignature | ISSELaunchSignature;
