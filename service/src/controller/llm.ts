import { OpenAI } from 'openai';
import { MCPClient } from './connect';
import { PostMessageble } from '../adapter';

let currentStream: AsyncIterable<any> | null = null;

export async function chatCompletionHandler(client: MCPClient | undefined, data: any, webview: PostMessageble) {
	if (!client) {
		const connectResult = {
			code: 501,
			msg: 'mcp client 尚未连接'
		};
		webview.postMessage({ command: 'ping', data: connectResult });
		return;
	}


    let { baseURL, apiKey, model, messages, temperature, tools = [] } = data;

    try {
		const client = new OpenAI({
			baseURL,
			apiKey
		});

        if (tools.length === 0) {
        	tools = undefined;
        }
        

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

    } catch (error) {
        webview.postMessage({
            command: 'llm/chat/completions/chunk',
            data: {
                code: 500,
                msg: `OpenAI API error: ${(error as Error).message}`
            }
        });
    }
}

// 处理中止消息的函数
export function handleAbortMessage(webview: PostMessageble) {
    if (currentStream) {
        // 标记流已中止
        currentStream = null;
        // 发送中止消息给前端
        webview.postMessage({
            command: 'llm/chat/completions/abort',
            data: {
                code: 200,
                msg: {
                    success: true
                }
            }
        });
    }
}