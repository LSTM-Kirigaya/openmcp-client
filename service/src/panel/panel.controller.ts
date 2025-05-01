import { Controller, RequestClientType } from "../common";
import { PostMessageble } from "../hook/adapter";
import { systemPromptDB } from "../hook/db";
import { loadTabSaveConfig, saveTabSaveConfig } from "./panel.service";

export class PanelController {
    @Controller('panel/save')
    async savePanel(client: RequestClientType, data: any, webview: PostMessageble) {
        const serverInfo = client?.getServerVersion();
		saveTabSaveConfig(serverInfo, data);

        return {
            code: 200,
            msg: 'Settings saved successfully'
        };
    }


    @Controller('panel/load')
    async loadPanel(client: RequestClientType, data: any, webview: PostMessageble) {
        const serverInfo = client?.getServerVersion();
		const config = loadTabSaveConfig(serverInfo);

        return {
            code: 200,
            msg: config
        };
    }

    @Controller('system-prompts/set')
    async setSystemPrompt(client: RequestClientType, data: any, webview: PostMessageble) {
        const { name, content } = data;

        await systemPromptDB.insert({
            id: name,
            name,
            content
        });

        return {
            code: 200,
            msg: 'Settings saved successfully'
        }
    }

    @Controller('system-prompts/delete')
    async deleteSystemPrompt(client: RequestClientType, data: any, webview: PostMessageble) {
        const { name } = data;
        await systemPromptDB.delete(name);
        return {
            code: 200,
            msg: 'Settings saved successfully'
        }
    }

    @Controller('system-prompts/save')
    async saveSystemPrompts(client: RequestClientType, data: any, webview: PostMessageble) {
        const { prompts } = data;
        
        await Promise.all(prompts.map((prompt: any) => {
            systemPromptDB.insert({
                id: prompt.name,
                name: prompt.name,
                content: prompt.content
            })
        }));

        return {
            code: 200,
            msg: 'Settings saved successfully'
        }
    }

    @Controller('system-prompts/load')
    async loadSystemPrompts(client: RequestClientType, data: any, webview: PostMessageble) {
    	
        const queryPrompts = await systemPromptDB.findAll();
        const prompts = [];
        for (const prompt of queryPrompts) {
            prompts.push({
                name: prompt.name,
                content: prompt.content
            })
        }
        
        return {
            code: 200,
            msg: prompts
        }
    }
}