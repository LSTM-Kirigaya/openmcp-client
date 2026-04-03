import { Controller } from '../common/index.js';
import type { PostMessageble } from '../hook/adapter.js';
import type { RequestData, RestfulResponse } from '../common/index.dto.js';
import {
    listServers,
    getServerById,
    upsertServer,
    deleteServer,
    replaceAllServers,
    getServersStoragePath
} from '../storage/servers.repository.js';
import { isLoggedIn } from '../cloud/auth.js';
import { listProjects } from '../cloud/projects.client.js';

export class ServerConfigController {
    @Controller('servers/list')
    async list(data: RequestData, _webview: PostMessageble): Promise<RestfulResponse> {
        const localRecords = listServers();
        const localItems = localRecords.map(r => ({ ...r, source: 'local' }));

        let cloudItems: any[] = [];
        try {
            if (isLoggedIn()) {
                const resp = await listProjects();
                const projects = Array.isArray(resp.data) ? resp.data : [];
                cloudItems = projects.map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    source: 'cloud',
                    transport: p.transport,
                    endpoint: p.endpoint,
                    description: p.description,
                    enabled: p.enabled,
                    createdAt: p.created_at,
                    updatedAt: p.updated_at
                }));
            }
        } catch {
            // cloud unavailable, continue with local only
        }

        return {
            code: 200,
            msg: 'ok',
            data: {
                servers: [...localItems, ...cloudItems],
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
        const { _id, ...input } = data as any;
        const record = upsertServer(input);
        return { code: 200, msg: 'ok', data: record };
    }

    @Controller('servers/delete')
    async remove(data: RequestData, _webview: PostMessageble): Promise<RestfulResponse> {
        const { id } = data;
        if (!id) {
            return { code: 400, msg: 'id is required' };
        }
        const deleted = deleteServer(String(id));
        if (!deleted) {
            return { code: 404, msg: `Server not found: ${id}` };
        }
        return { code: 200, msg: 'ok' };
    }

    @Controller('servers/replace-all')
    async replaceAll(data: RequestData, _webview: PostMessageble): Promise<RestfulResponse> {
        const { _id, items } = data as any;
        if (!Array.isArray(items)) {
            return { code: 400, msg: 'items array is required' };
        }
        const records = replaceAllServers(items);
        return { code: 200, msg: 'ok', data: records };
    }
}
