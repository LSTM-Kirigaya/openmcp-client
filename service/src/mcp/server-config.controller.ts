import { Controller } from '../common/index.js';
import type { RequestData, RestfulResponse } from '../common/index.dto.js';
import type { PostMessageble } from '../hook/adapter.js';
import {
    deleteServer,
    getServerById,
    getServersStoragePath,
    listServers,
    replaceAllServers,
    upsertServer
} from '../storage/servers.repository.js';

export class ServerConfigController {
    @Controller('servers/list')
    async list(_data: RequestData, _webview: PostMessageble): Promise<RestfulResponse> {
        return {
            code: 200,
            msg: 'ok',
            data: {
                servers: listServers().map(record => ({ ...record, source: 'local' })),
                storagePath: getServersStoragePath()
            }
        };
    }

    @Controller('servers/get')
    async get(data: RequestData, _webview: PostMessageble): Promise<RestfulResponse> {
        const { id } = data;
        if (!id) {
            return { code: 400, msg: 'id is required' };
        }
        const record = getServerById(String(id));
        if (!record) {
            return { code: 404, msg: `Server not found: ${id}` };
        }
        return { code: 200, msg: 'ok', data: { ...record, source: 'local' } };
    }

    @Controller('servers/save')
    async save(data: RequestData, _webview: PostMessageble): Promise<RestfulResponse> {
        const { _id, scope: scopeRaw, source: sourceRaw, ...input } = data as any;
        const explicit =
            scopeRaw !== undefined && scopeRaw !== null && String(scopeRaw).trim() !== ''
                ? String(scopeRaw).toLowerCase()
                : sourceRaw !== undefined && sourceRaw !== null && String(sourceRaw).trim() !== ''
                    ? String(sourceRaw).toLowerCase()
                    : 'local';

        if (explicit !== 'local' && explicit !== 'auto') {
            return { code: 400, msg: 'scope only supports local' };
        }

        const record = upsertServer(input);
        return { code: 200, msg: 'ok', data: { ...record, source: 'local' } };
    }

    @Controller('servers/delete')
    async remove(data: RequestData, _webview: PostMessageble): Promise<RestfulResponse> {
        const { id } = data;
        if (!id) {
            return { code: 400, msg: 'id is required' };
        }
        const deleted = deleteServer(String(id));
        return deleted
            ? { code: 200, msg: 'ok' }
            : { code: 404, msg: `Server not found: ${id}` };
    }

    @Controller('servers/replace-all')
    async replaceAll(data: RequestData, _webview: PostMessageble): Promise<RestfulResponse> {
        const { _id, items } = data as any;
        if (!Array.isArray(items)) {
            return { code: 400, msg: 'items array is required' };
        }
        return { code: 200, msg: 'ok', data: replaceAllServers(items) };
    }
}
