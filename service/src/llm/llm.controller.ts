import { Controller, RequestClientType } from "../common";
import { PostMessageble } from "../hook/adapter";
import { abortMessageService, streamingChatCompletion } from "./llm.service";

export class LlmController {

    @Controller('llm/chat/completions')
    async chatCompletion(client: RequestClientType, data: any, webview: PostMessageble) {
        if (!client) {
            return {
                code: 501,
                msg:'mcp client 尚未连接'
            };
        }

        
        try {
            await streamingChatCompletion(data, webview);            
        } catch (error) {
            console.log('error' + error);
            
            webview.postMessage({
                command: 'llm/chat/completions/error',
                data: {
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
    async abortChatCompletion(client: RequestClientType, data: any, webview: PostMessageble) {
        return abortMessageService(data, webview);
    }

}