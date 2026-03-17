import { OpenAI } from "openai";

export type MyMessageType = OpenAI.Chat.ChatCompletionMessageParam & {
	extraInfo?: any;
}

export type MyToolMessageType = OpenAI.Chat.ChatCompletionToolMessageParam & {
	extraInfo?: any;
}

export interface OpenMcpChatOption {
	baseURL: string;
	apiKey: string;
	model: string;
	messages: any[];
	temperature?: number;
	tools?: any[];
	parallelToolCalls?: boolean;
}

export interface MyStream<T> extends AsyncIterable<T> {
    [Symbol.asyncIterator](): AsyncIterator<T>;
    controller: {
        abort(): void;
    };
}