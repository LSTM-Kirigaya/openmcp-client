import { OpenAI } from 'openai';
import { MCPClient } from './connect';

export async function chatCompletionHandler(client: MCPClient | undefined, data: any, webview: { postMessage: (message: any) => void }) {
	if (!client) {
		const connectResult = {
			code: 501,
			msg: 'mcp client 尚未连接'
		};
		webview.postMessage({ command: 'ping', data: connectResult });
		return;
	}


    const { baseURL, apiKey, model, messages, temperature } = data;

    try {
		const client = new OpenAI({
			baseURL,
			apiKey
		});

        const stream = await client.chat.completions.create({
            model,
            messages,
            temperature,
            web_search_options: {},
            stream: true
        });

        // 流式传输结果
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
				const chunkResult = {
					code: 200,
					msg: {
						content,
                        finish_reason: chunk.choices[0]?.finish_reason || null
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
					success: true
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