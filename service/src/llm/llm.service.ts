import { PostMessageble } from "../hook/adapter";
import { OpenAI } from "openai";
import { MyMessageType, MyToolMessageType } from "./llm.dto";
import { RestfulResponse } from "../common/index.dto";
import { ocrDB } from "../hook/db";
import { ToolCallContent } from "../mcp/client.dto";
import { ocrWorkerStorage } from "../mcp/ocr.service";

export let currentStream: AsyncIterable<any> | null = null;

export async function streamingChatCompletion(
    data: any,
    webview: PostMessageble
) {
    let { baseURL, apiKey, model, messages, temperature, tools = [] } = data;

    const client = new OpenAI({
        baseURL,
        apiKey
    });

    if (tools.length === 0) {
        tools = undefined;
    }
    
    await postProcessMessages(messages);

    const stream = await client.chat.completions.create({
        model,
        messages,
        temperature,
        tools,
        tool_choice: 'auto',
        web_search_options: {},
        stream: true
    });

    // 存储当前的流式传输对象
    currentStream = stream;

    // 流式传输结果
    for await (const chunk of stream) {
        if (!currentStream) {
            // 如果流被中止，则停止循环
            // TODO: 为每一个标签页设置不同的 currentStream 管理器
            stream.controller.abort();
            // 传输结束
            webview.postMessage({
                command: 'llm/chat/completions/done',
                data: {
                    code: 200,
                    msg: {
                        success: true,
                        stage: 'abort'
                    }
                }
            });
            break;
        }
        
        if (chunk.choices) {
            const chunkResult = {
                code: 200,
                msg: {
                    chunk
                }
            };

            webview.postMessage({
                command: 'llm/chat/completions/chunk',
                data: chunkResult
            });
        }
    }

    // 传输结束
    webview.postMessage({
        command: 'llm/chat/completions/done',
        data: {
            code: 200,
            msg: {
                success: true,
                stage: 'done'
            }
        }
    });
}


// 处理中止消息的函数
export function abortMessageService(data: any, webview: PostMessageble): RestfulResponse {
    if (currentStream) {
        // 标记流已中止
        currentStream = null;
    }

    return {
        code: 200,
        msg: {
            success: true
        }
    }
}

async function postProcessToolMessages(message: MyToolMessageType) {
	if (typeof message.content === 'string') {
		return;
	}

	for (const content of message.content) {
		const contentType = content.type as string;
		const rawContent = content as ToolCallContent;

		if (contentType === 'image') {			
			rawContent.type = 'text';
			
			// 此时图片只会存在三个状态
            // 1. 图片在 ocrDB 中
            // 2. 图片的 OCR 仍然在进行中
            // 3. 图片已被删除


            // rawContent.data 就是 filename
            const result = await ocrDB.findById(rawContent.data);
            if (result) {
                rawContent.text = result.text || '';            
            } else if (rawContent._meta) {
                const workerId = rawContent._meta.workerId;
                const worker = ocrWorkerStorage.get(workerId);
                if (worker) {
                    const text = await worker.fut;
                    rawContent.text = text;
                }
            } else {
                rawContent.text = '无效的图片';
            }

            delete rawContent._meta;
		}
	}

	message.content = JSON.stringify(message.content);
}

export async function postProcessMessages(messages: MyMessageType[]) {
	for (const message of messages) {
		// 去除 extraInfo 属性
		delete message.extraInfo;

		switch (message.role) {
			case 'user':

                break;

			case 'assistant':

                break;
			
			case 'system':

				break;

			case 'tool':
				await postProcessToolMessages(message);
				break;
			default:
				break;
		}
	}
}