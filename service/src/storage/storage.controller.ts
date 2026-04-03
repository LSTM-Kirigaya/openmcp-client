import { Controller } from '../common/index.js';
import type { RequestData, RestfulResponse } from '../common/index.dto.js';
import type { PostMessageble } from '../hook/adapter.js';
import { connectService, getClient } from '../mcp/connect.service.js';
import {
    deleteLocalConnectionRecord,
    getLocalConnectionRecordById,
    getLocalConnectionRecordByName,
    getLocalConnectionsStoragePath,
    listLocalConnectionRecords,
    type LocalConnectionEntry,
    upsertLocalConnectionRecord
} from './connections.repository.js';
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

function cloneEntry<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

export class LocalStorageController {
    @Controller('connections/list')
    async listConnections(data: RequestData, _webview: PostMessageble): Promise<RestfulResponse> {
        const options = resolveLocalOptions(data);
        return {
            code: 200,
            msg: 'ok',
            data: {
                scope: options.scope || 'auto',
                storagePath: getLocalConnectionsStoragePath(options),
                records: listLocalConnectionRecords(options)
            }
        };
    }

    @Controller('connections/get')
    async getConnection(data: RequestData, _webview: PostMessageble): Promise<RestfulResponse> {
        const options = resolveLocalOptions(data);
        const record = typeof data.id === 'string' && data.id.trim()
            ? getLocalConnectionRecordById(data.id.trim(), options)
            : typeof data.name === 'string' && data.name.trim()
                ? getLocalConnectionRecordByName(data.name.trim(), options)
                : undefined;
        if (!record) {
            return { code: 404, msg: 'connection not found' };
        }
        return {
            code: 200,
            msg: 'ok',
            data: record
        };
    }

    @Controller('connections/save')
    async saveConnection(data: RequestData, _webview: PostMessageble): Promise<RestfulResponse> {
        const options = resolveLocalOptions(data);
        const item = (data.item ?? data.items) as LocalConnectionEntry | undefined;
        if (!item) {
            return { code: 400, msg: 'item is required' };
        }
        const record = upsertLocalConnectionRecord(item, {
            ...options,
            id: typeof data.id === 'string' ? data.id : undefined,
            name: typeof data.name === 'string' ? data.name : undefined
        });
        return {
            code: 200,
            msg: 'ok',
            data: record
        };
    }

    @Controller('connections/delete')
    async deleteConnection(data: RequestData, _webview: PostMessageble): Promise<RestfulResponse> {
        const options = resolveLocalOptions(data);
        if (typeof data.id !== 'string' || !data.id.trim()) {
            return { code: 400, msg: 'id is required' };
        }
        const ok = deleteLocalConnectionRecord(data.id.trim(), options);
        return {
            code: ok ? 200 : 404,
            msg: ok ? 'ok' : 'connection not found'
        };
    }

    @Controller('connections/connect')
    async connectStoredConnection(data: RequestData, webview: PostMessageble): Promise<RestfulResponse> {
        const options = resolveLocalOptions(data);
        if (typeof data.id !== 'string' || !data.id.trim()) {
            return { code: 400, msg: 'id is required' };
        }
        const record = getLocalConnectionRecordById(data.id.trim(), options);
        if (!record) {
            return { code: 404, msg: 'connection not found' };
        }
        const entries = Array.isArray(record.item) ? record.item : [record.item];
        const results = [];
        let allOk = true;
        for (const entry of entries) {
            const payload = cloneEntry(entry);
            payload.connectionId = record.id;
            payload.storageScope = options.scope;
            payload.workspacePath = options.workspacePath;
            const res = await connectService(payload as any, webview);
            results.push(res);
            allOk &&= res.code === 200;
        }
        return {
            code: allOk ? 200 : 207,
            msg: allOk ? 'ok' : 'partial failure',
            data: {
                connection: record,
                results
            }
        };
    }

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
