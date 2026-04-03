import { Controller } from '../common/index.js';
import type { RequestData, RestfulResponse } from '../common/index.dto.js';
import type { PostMessageble } from '../hook/adapter.js';
import { getClient } from '../mcp/connect.service.js';
import { getClientStorageBinding } from './client-binding.js';
import {
    deleteStoredToolCase,
    getStoredToolCase,
    getStoredToolCasesPath,
    listStoredToolCases,
    upsertStoredToolCase
} from './tool-cases.repository.js';
import {
    deleteValidationSuite,
    getValidationSuite,
    listValidationSuites,
    upsertValidationSuite
} from './validation-suites.repository.js';
import type { LocalStorageScopeOptions } from './paths.js';
import { getValidationSuitesIndexPath } from './paths.js';

function resolveLocalOptions(data: RequestData): LocalStorageScopeOptions {
    const scope = data.scope === 'workspace' || data.scope === 'user' ? data.scope : undefined;
    const workspacePath = typeof data.workspacePath === 'string' && data.workspacePath.trim()
        ? data.workspacePath.trim()
        : undefined;
    return {
        scope,
        workspacePath
    };
}

function resolveConnectionKey(data: RequestData): string | undefined {
    if (typeof data.connectionId === 'string' && data.connectionId.trim()) {
        return data.connectionId.trim();
    }
    if (typeof data.clientId === 'string' && data.clientId.trim()) {
        const binding = getClientStorageBinding(data.clientId);
        if (binding?.connectionId) {
            return binding.connectionId;
        }
        if (binding?.connectionKey) {
            return binding.connectionKey;
        }
        const client = getClient(data.clientId);
        return client?.getServerVersion()?.name || 'default';
    }
    return undefined;
}

export class LocalStorageController {
    @Controller('test-cases/list')
    async listToolCases(data: RequestData, _webview: PostMessageble): Promise<RestfulResponse> {
        const options = resolveLocalOptions(data);
        const connectionKey = resolveConnectionKey(data);
        if (!connectionKey) {
            return { code: 400, msg: 'connectionId or clientId is required' };
        }
        return {
            code: 200,
            msg: 'ok',
            data: {
                connectionKey,
                storagePath: getStoredToolCasesPath(connectionKey, options),
                testCases: listStoredToolCases(connectionKey, options)
            }
        };
    }

    @Controller('test-cases/get')
    async getToolCase(data: RequestData, _webview: PostMessageble): Promise<RestfulResponse> {
        const options = resolveLocalOptions(data);
        const connectionKey = resolveConnectionKey(data);
        if (!connectionKey || typeof data.caseId !== 'string' || !data.caseId.trim()) {
            return { code: 400, msg: 'connectionId/clientId and caseId are required' };
        }
        const testCase = getStoredToolCase(connectionKey, data.caseId.trim(), options);
        if (!testCase) {
            return { code: 404, msg: 'test case not found' };
        }
        return {
            code: 200,
            msg: 'ok',
            data: testCase
        };
    }

    @Controller('test-cases/upsert')
    async upsertToolCase(data: RequestData, _webview: PostMessageble): Promise<RestfulResponse> {
        const options = resolveLocalOptions(data);
        const connectionKey = resolveConnectionKey(data);
        if (!connectionKey) {
            return { code: 400, msg: 'connectionId or clientId is required' };
        }
        const testCase = data.testCase;
        if (!testCase || typeof testCase !== 'object') {
            return { code: 400, msg: 'testCase is required' };
        }
        const saved = upsertStoredToolCase(connectionKey, testCase as any, options);
        return {
            code: 200,
            msg: 'ok',
            data: saved
        };
    }

    @Controller('test-cases/delete')
    async deleteToolCase(data: RequestData, _webview: PostMessageble): Promise<RestfulResponse> {
        const options = resolveLocalOptions(data);
        const connectionKey = resolveConnectionKey(data);
        if (!connectionKey || typeof data.caseId !== 'string' || !data.caseId.trim()) {
            return { code: 400, msg: 'connectionId/clientId and caseId are required' };
        }
        const ok = deleteStoredToolCase(connectionKey, data.caseId.trim(), options);
        return {
            code: ok ? 200 : 404,
            msg: ok ? 'ok' : 'test case not found'
        };
    }

    @Controller('validation-suites/list')
    async listSuites(data: RequestData, _webview: PostMessageble): Promise<RestfulResponse> {
        const options = resolveLocalOptions(data);
        const connectionKey = resolveConnectionKey(data);
        if (!connectionKey) {
            return { code: 400, msg: 'connectionId or clientId is required' };
        }
        return {
            code: 200,
            msg: 'ok',
            data: {
                connectionKey,
                storagePath: getValidationSuitesIndexPath(connectionKey, options),
                suites: listValidationSuites(connectionKey, options)
            }
        };
    }

    @Controller('validation-suites/get')
    async getSuite(data: RequestData, _webview: PostMessageble): Promise<RestfulResponse> {
        const options = resolveLocalOptions(data);
        const connectionKey = resolveConnectionKey(data);
        if (!connectionKey || typeof data.suiteId !== 'string' || !data.suiteId.trim()) {
            return { code: 400, msg: 'connectionId/clientId and suiteId are required' };
        }
        const suite = getValidationSuite(connectionKey, data.suiteId.trim(), options);
        if (!suite) {
            return { code: 404, msg: 'validation suite not found' };
        }
        return {
            code: 200,
            msg: 'ok',
            data: suite
        };
    }

    @Controller('validation-suites/upsert')
    async upsertSuite(data: RequestData, _webview: PostMessageble): Promise<RestfulResponse> {
        const options = resolveLocalOptions(data);
        const connectionKey = resolveConnectionKey(data);
        if (!connectionKey) {
            return { code: 400, msg: 'connectionId or clientId is required' };
        }
        const suite = data.suite;
        if (!suite || typeof suite !== 'object') {
            return { code: 400, msg: 'suite is required' };
        }
        const saved = upsertValidationSuite(connectionKey, suite as any, options);
        return {
            code: 200,
            msg: 'ok',
            data: saved
        };
    }

    @Controller('validation-suites/delete')
    async deleteSuite(data: RequestData, _webview: PostMessageble): Promise<RestfulResponse> {
        const options = resolveLocalOptions(data);
        const connectionKey = resolveConnectionKey(data);
        if (!connectionKey || typeof data.suiteId !== 'string' || !data.suiteId.trim()) {
            return { code: 400, msg: 'connectionId/clientId and suiteId are required' };
        }
        const ok = deleteValidationSuite(connectionKey, data.suiteId.trim(), options);
        return {
            code: ok ? 200 : 404,
            msg: ok ? 'ok' : 'validation suite not found'
        };
    }
}
