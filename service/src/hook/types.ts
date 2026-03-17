// server/src/types.ts
export interface IMessage {
    type: string;
    data: Record<string, unknown>;
    timestamp?: number;
}

export type MessageHandler = (message: IMessage) => void;

// ==================== 基础类型定义 ====================
export interface SchemaProperty {
	title: string;
	type: string;
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

// ==================== 响应接口定义 ====================
export interface ToolsListResponse {
	tools: Array<{
		name: string;
		description: string;
		inputSchema: InputSchema;
	}>;
}

export interface PromptsListResponse {
	prompts: Array<{
		name: string;
		description: string;
		arguments: Argument[];
	}>;
}

export interface ResourceTemplatesListResponse {
	resourceTemplates: Array<{
		uriTemplate: string;
		name: string;
		description: string;
	}>;
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

export interface ToolListItem {
    name: string;
    description: string;
    inputSchema: InputSchema;
}

export interface ToolsListResponse {
    tools: ToolListItem[];
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

// ==================== 合并类型定义 ====================
export type APIResponse =
	| ToolsListResponse
	| PromptsListResponse
	| ResourceTemplatesListResponse
	| ResourcesListResponse
	| ResourcesReadResponse
	| PromptsGetResponse;

export type APIRequest =
	| BaseRequest
	| ResourcesReadRequest
	| PromptsGetRequest;