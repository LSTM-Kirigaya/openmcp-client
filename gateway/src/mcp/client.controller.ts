import { Controller } from "../common/index.js";
import { RequestData } from "../common/index.dto.js";
import { PostMessageble } from "../hook/adapter.js";
import { postProcessMcpToolcallResponse } from "./client.service.js";
import { getClient } from "./connect.service.js";

export class ClientController {

    @Controller('server/version')
    async getServerVersion(data: RequestData, webview: PostMessageble) {	
        const client = getClient(data.clientId);
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
    async listPrompts(data: RequestData, webview: PostMessageble) {
        const client = getClient(data.clientId);
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
    async getPrompt(data: RequestData, webview: PostMessageble) {
        const client = getClient(data.clientId);
        if (!client) {
            return {
                code: 501,
                msg: 'mcp client 尚未连接'
            };
        }        

        const prompt = await client.getPrompt(data.promptId, data.args || {});
        return {
            code: 200,
            msg: prompt
        };
    }

    @Controller('resources/list')
    async listResources(data: RequestData, webview: PostMessageble) {
        const client = getClient(data.clientId);
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
    async listResourceTemplates(data: RequestData, webview: PostMessageble) {
        const client = getClient(data.clientId);
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
    async readResource(data: RequestData, webview: PostMessageble) {
        const client = getClient(data.clientId);
        if (!client) {
            return {
                code: 501,
                msg: 'mcp client 尚未连接'
            };
        }

        const resource = await client.readResource(data.resourceUri);
        
        return {
            code: 200,
            msg: resource
        };
    }

    @Controller('tools/list')
    async listTools(data: RequestData, webview: PostMessageble) {
        const client = getClient(data.clientId);
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
    async callTool(data: RequestData, webview: PostMessageble) {
        const client = getClient(data.clientId);
        if (!client) {
            return {
                code: 501,
                msg: 'mcp client 尚未连接'
            };
        }

        const toolResult = await client.callTool({
            name: data.toolName,
            arguments: data.toolArgs,
            callToolOption: data.callToolOption
        });

        postProcessMcpToolcallResponse(toolResult, webview);

        return {
            code: 200,
            msg: toolResult
        };
    }
}