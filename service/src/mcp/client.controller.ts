import { Controller, RequestClientType } from "../common";
import { PostMessageble } from "../hook/adapter";
import { postProcessMcpToolcallResponse } from "./client.service";

export class ClientController {

    @Controller('server/version')
    async getServerVersion(client: RequestClientType, data: any, webview: PostMessageble) {	
        if (!client) {
            return {
                code: 501,
                msg:'mcp client 尚未连接'
            };
        }
    
        const version = client.getServerVersion();
        return {
            code: 200,
            msg: version
        };
    }

    @Controller('prompts/list')
    async listPrompts(client: RequestClientType, data: any, webview: PostMessageble) {
        if (!client) {
            const connectResult = {
                code: 501,
                msg: 'mcp client 尚未连接'
            };
            return connectResult;
        }

        const prompts = await client.listPrompts();
        const result = {
            code: 200,
            msg: prompts
        };
        return result;
    }

    @Controller('prompts/get')
    async getPrompt(client: RequestClientType, option: any, webview: PostMessageble) {
        if (!client) {
            return {
                code: 501,
                msg: 'mcp client 尚未连接'
            };
        }

        const prompt = await client.getPrompt(option.promptId, option.args || {});
        return {
            code: 200,
            msg: prompt
        };
    }

    @Controller('resources/list')
    async listResources(client: RequestClientType, data: any, webview: PostMessageble) {
        if (!client) {
            return {
                code: 501,
                msg: 'mcp client 尚未连接'
            };
        }
        
        const resources = await client.listResources();
        return {
            code: 200,
            msg: resources
        };
    }

    @Controller('resources/templates/list')
    async listResourceTemplates(client: RequestClientType, data: any, webview: PostMessageble) {
        
        if (!client) {
            return {
                code: 501,
                msg: 'mcp client 尚未连接'
            };
        }

        const resources = await client.listResourceTemplates();
        return {
            code: 200,
            msg: resources
        };
    }

    @Controller('resources/read')
    async readResource(client: RequestClientType, option: any, webview: PostMessageble) {
        if (!client) {
            return {
                code: 501,
                msg: 'mcp client 尚未连接'
            };
        }

        const resource = await client.readResource(option.resourceUri);
        return {
            code: 200,
            msg: resource
        };
    }

    @Controller('tools/list')
    async listTools(client: RequestClientType, data: any, webview: PostMessageble) {
        if (!client) {
            return {
                code: 501,
                msg: 'mcp client 尚未连接'
            };
        }

        const tools = await client.listTools();
        return {
            code: 200,
            msg: tools
        };
    }

    @Controller('tools/call')
    async callTool(client: RequestClientType, option: any, webview: PostMessageble) {
        if (!client) {
            return {
                code: 501,
                msg: 'mcp client 尚未连接'
            };
        }

        const toolResult = await client.callTool({
            name: option.toolName,
            arguments: option.toolArgs
        });

        // console.log(JSON.stringify(toolResult, null, 2));
        
        postProcessMcpToolcallResponse(toolResult, webview);

        // console.log(JSON.stringify(toolResult, null, 2));
        

        return {
            code: 200,
            msg: toolResult
        };
    }
}