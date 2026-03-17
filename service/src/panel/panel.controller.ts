import { Controller } from "../common/index.js";
import { PostMessageble } from "../hook/adapter.js";
import { RequestData } from "../common/index.dto.js";
import { getClient } from "../mcp/connect.service.js";
import { systemPromptDB } from "../hook/db.js";
import { loadTabSaveConfig, saveTabSaveConfig, saveVariableConfig, loadVariableConfig, saveExtractionRulesConfig, loadExtractionRulesConfig, saveTestCasesConfig, loadTestCasesConfig } from "./panel.service.js";
import { getBatchValidationRepository } from "./batch-validation.repository.js";

export class PanelController {
    @Controller('panel/save')
    async savePanel(data: RequestData, webview: PostMessageble) {
        const client = getClient(data.clientId);
        const serverInfo = client?.getServerVersion();
        saveTabSaveConfig(serverInfo, data);

        return {
            code: 200,
            msg: 'Settings saved successfully'
        };
    }

    @Controller('panel/load')
    async loadPanel(data: RequestData, webview: PostMessageble) {
        const client = getClient(data.clientId);
        const serverInfo = client?.getServerVersion();
        const config = loadTabSaveConfig(serverInfo);

        return {
            code: 200,
            msg: config
        };
    }

    @Controller('system-prompts/set')
    async setSystemPrompt(data: RequestData, webview: PostMessageble) {
        const client = getClient(data.clientId);
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
    async deleteSystemPrompt(data: RequestData, webview: PostMessageble) {
        const client = getClient(data.clientId);
        const { name } = data;
        await systemPromptDB.delete(name);
        return {
            code: 200,
            msg: 'Settings saved successfully'
        }
    }

    @Controller('system-prompts/save')
    async saveSystemPrompts(data: RequestData, webview: PostMessageble) {
        const client = getClient(data.clientId);
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
    async loadSystemPrompts(data: RequestData, webview: PostMessageble) {
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

    @Controller('variables/save')
    async saveVariables(data: RequestData, webview: PostMessageble) {
        const client = getClient(data.clientId);
        const serverInfo = client?.getServerVersion();
        const { variables } = data;
        
        // 保存到 .openmcp/variables.{serverName}.json
        saveVariableConfig(serverInfo, { variables });

        return {
            code: 200,
            msg: 'Variables saved successfully'
        };
    }

    @Controller('variables/load')
    async loadVariables(data: RequestData, webview: PostMessageble) {
        const client = getClient(data.clientId);
        const serverInfo = client?.getServerVersion();
        
        // 从 .openmcp/variables.{serverName}.json 加载
        const config = loadVariableConfig(serverInfo);

        return {
            code: 200,
            msg: config || { variables: [] }
        };
    }

    @Controller('extraction-rules/save')
    async saveExtractionRules(data: RequestData, webview: PostMessageble) {
        const client = getClient(data.clientId);
        const serverInfo = client?.getServerVersion();
        const { extractionRules } = data as any;

        saveExtractionRulesConfig(serverInfo, { extractionRules });

        return {
            code: 200,
            msg: 'Extraction rules saved successfully'
        };
    }

    @Controller('extraction-rules/load')
    async loadExtractionRules(data: RequestData, webview: PostMessageble) {
        const client = getClient(data.clientId);
        const serverInfo = client?.getServerVersion();

        const config = loadExtractionRulesConfig(serverInfo);

        return {
            code: 200,
            msg: config || { extractionRules: {} }
        };
    }

    @Controller('test-cases/save')
    async saveTestCases(data: RequestData, webview: PostMessageble) {
        const client = getClient(data.clientId);
        const serverInfo = client?.getServerVersion();
        const { testCases } = data as any;

        saveTestCasesConfig(serverInfo, { testCases });

        return {
            code: 200,
            msg: 'Test cases saved successfully'
        };
    }

    @Controller('test-cases/load')
    async loadTestCases(data: RequestData, webview: PostMessageble) {
        const client = getClient(data.clientId);
        const serverInfo = client?.getServerVersion();

        const config = loadTestCasesConfig(serverInfo);

        return {
            code: 200,
            msg: config || { testCases: [] }
        };
    }

    @Controller('batch-validation/load')
    async loadBatchValidation(data: RequestData, _webview: PostMessageble) {
        const clientId = data.clientId as string;
        if (!clientId) {
            return { code: 400, msg: { storage: null } };
        }
        const client = getClient(clientId);
        const serverName = client?.getServerVersion()?.name ?? 'default';
        const repo = getBatchValidationRepository(serverName);
        const storage = await repo.load();
        return { code: 200, msg: { storage } };
    }

    @Controller('batch-validation/save')
    async saveBatchValidation(data: RequestData, _webview: PostMessageble) {
        const clientId = data.clientId as string;
        const storage = data.storage as any;
        if (!clientId || !storage) {
            return { code: 400, msg: 'Missing clientId or storage' };
        }
        const client = getClient(clientId);
        const serverName = client?.getServerVersion()?.name ?? 'default';
        const repo = getBatchValidationRepository(serverName);
        await repo.save({
            testCases: Array.isArray(storage.testCases) ? storage.testCases : [],
            selectedCaseIndex: typeof storage.selectedCaseIndex === 'number' ? storage.selectedCaseIndex : 0,
            sourceTabIndex: typeof storage.sourceTabIndex === 'number' ? storage.sourceTabIndex : 0,
            evaluationMode: storage.evaluationMode === 'score' ? 'score' : 'pass-fail',
            resultGroups: Array.isArray(storage.resultGroups) ? storage.resultGroups : [],
            comprehensiveSelectedIndices: Array.isArray(storage.comprehensiveSelectedIndices) ? storage.comprehensiveSelectedIndices : [],
            comprehensivePresets: Array.isArray(storage.comprehensivePresets) ? storage.comprehensivePresets : [],
            currentPresetId: typeof storage.currentPresetId === 'string' ? storage.currentPresetId : undefined
        });
        return { code: 200, msg: 'ok' };
    }
}