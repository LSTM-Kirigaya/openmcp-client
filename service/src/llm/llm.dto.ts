import { OpenAI } from "openai";

export type MyMessageType = OpenAI.Chat.ChatCompletionMessageParam & {
	extraInfo?: any;
}

export type MyToolMessageType = OpenAI.Chat.ChatCompletionToolMessageParam & {
	extraInfo?: any;
}