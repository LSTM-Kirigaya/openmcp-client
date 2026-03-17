import { Controller } from "../common/index.js";
import { RequestData } from "../common/index.dto.js";
import { PostMessageble } from "../hook/adapter.js";
import { abortMessageService, streamingChatCompletion, chatCompletion } from "./llm.service.js";
import { OpenAI } from "openai";
import { fetchOpenRouterModels, getSimplifiedModels } from "../hook/openrouter.js";
export class LlmController {

    @Controller('llm/chat/completions')
    async chatCompletion(data: RequestData, webview: PostMessageble) {

        try {
            await streamingChatCompletion(data, webview);
        } catch (error) {            
            webview.postMessage({
                command: 'llm/chat/completions/error',
                data: {
                    sessionId: data.sessionId,
                    code: 500,
                    msg: error
                }
            });
        }


        return {
            code: -1,
            msg: 'terminate'
        };
    }

    @Controller('llm/chat/completions/abort')
    async abortChatCompletion(data: RequestData, webview: PostMessageble) {
        return abortMessageService(data, webview);
    }


    @Controller('llm/models')
    async getModels(data: RequestData, webview: PostMessageble) {
        const {
            baseURL,
            apiKey,
            proxyServer
        } = data;
        

        const client = new OpenAI({
            apiKey,
            baseURL,
        });
        const models = await client.models.list();

        return {
            code: 200,
            msg: models.data
        }
    }

    @Controller('llm/models/openrouter')
    async getOpenRouterModels(data: RequestData, webview: PostMessageble) {
        try {
            const models = await fetchOpenRouterModels();
            const simplifiedModels = getSimplifiedModels(models);
        
            // 转换为标准格式，与其他模型API保持一致
            const standardModels = simplifiedModels.map(model => ({
                id: model.id,
                object: 'model',
                name: model.name,
                pricing: model.pricing
            }));

            return {
                code: 200,
                msg: standardModels
            };
        } catch (error) {
            console.error('Failed to fetch OpenRouter models:', error);
            return {
                code: 500,
                msg: `Failed to fetch OpenRouter models: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    @Controller('llm/chat/completions/sync')
    async chatCompletionSync(data: RequestData, webview: PostMessageble) {
        try {
            const { baseURL, apiKey, model, messages, temperature } = data;
            const result = await chatCompletion({ baseURL, apiKey, model, messages, temperature });
            return {
                code: 200,
                msg: { content: result.content, usage: result.usage }
            };
        } catch (error) {
            return {
                code: 500,
                msg: `Chat completion failed: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    @Controller('llm/models/dynamic')
    async getDynamicModels(data: RequestData, webview: PostMessageble) {
        const { providerId } = data;
        
        try {
            if (providerId === 'openrouter') {
                const models = await fetchOpenRouterModels();
                const simplifiedModels = getSimplifiedModels(models);
                
                const standardModels = simplifiedModels.map(model => ({
                    id: model.id,
                    object: 'model',
                    name: model.name,
                    pricing: model.pricing
                }));

                return {
                    code: 200,
                    msg: standardModels
                };
            } else {
                return {
                    code: 400,
                    msg: `Unsupported dynamic provider: ${providerId}`
                };
            }
        } catch (error) {
            console.error(`Failed to fetch dynamic models for ${providerId}:`, error);
            return {
                code: 500,
                msg: `Failed to fetch models: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
}