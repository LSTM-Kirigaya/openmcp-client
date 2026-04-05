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
import {
    createProject,
    deleteProject,
    getProject,
    listProjects,
    updateProject,
    type ProjectCreatePayload,
    type ProjectUpdatePayload
} from '../cloud/projects.client.js';

function cloudApiErrorMessage(error: any, fallback: string): string {
    const msg =
        error?.response?.data?.message ||
        error?.message ||
        error?.code ||
        error?.cause?.code;
    return typeof msg === 'string' && msg.trim() ? msg : fallback;
}

function mapCloudProjectToListItem(p: Record<string, any>) {
    return {
        id: p.id,
        name: p.name,
        source: 'cloud' as const,
        transport: p.transport,
        endpoint: p.endpoint,
        description: p.description,
        enabled: p.enabled,
        createdAt: p.created_at,
        updatedAt: p.updated_at
    };
}

function normalizeEnabled(raw: unknown): boolean | undefined {
    if (raw === undefined || raw === null) return undefined;
    if (typeof raw === 'boolean') return raw;
    if (raw === 'true' || raw === '1') return true;
    if (raw === 'false' || raw === '0') return false;
    return undefined;
}

/** 将 CLI/本地 MCP 配置映射为云端创建载荷 */
function entryToCloudCreatePayload(entry: Record<string, any>): ProjectCreatePayload | null {
    const name = String(entry.name || '').trim();
    if (!name) return null;

    const t = entry.transport != null ? String(entry.transport).trim() : '';
    const e = entry.endpoint != null ? String(entry.endpoint).trim() : '';
    if (t && e) {
        return {
            name,
            transport: t,
            endpoint: e,
            ...(entry.description != null && String(entry.description).trim()
                ? { description: String(entry.description).trim() }
                : {}),
            ...(normalizeEnabled(entry.enabled) !== undefined ? { enabled: normalizeEnabled(entry.enabled)! } : {})
        };
    }

    const ct = String(entry.connectionType || '')
        .toUpperCase()
        .replace(/-/g, '_');
    if (ct === 'STDIO') {
        const cmd = String(entry.command || '').trim();
        const args = Array.isArray(entry.args) ? entry.args.map(String).join(' ').trim() : '';
        const endpoint = [cmd, args].filter(Boolean).join(' ').trim();
        if (!endpoint) return null;
        return {
            name,
            transport: 'stdio',
            endpoint,
            ...(entry.description != null && String(entry.description).trim()
                ? { description: String(entry.description).trim() }
                : {}),
            ...(normalizeEnabled(entry.enabled) !== undefined ? { enabled: normalizeEnabled(entry.enabled)! } : {})
        };
    }
    if (ct === 'SSE') {
        const url = String(entry.url || '').trim();
        if (!url) return null;
        return {
            name,
            transport: 'sse',
            endpoint: url,
            ...(entry.description != null && String(entry.description).trim()
                ? { description: String(entry.description).trim() }
                : {}),
            ...(normalizeEnabled(entry.enabled) !== undefined ? { enabled: normalizeEnabled(entry.enabled)! } : {})
        };
    }
    if (ct === 'STREAMABLE_HTTP' || ct === 'STREAMABLEHTTP' || ct === 'HTTP') {
        const url = String(entry.url || '').trim();
        if (!url) return null;
        return {
            name,
            transport: 'http',
            endpoint: url,
            ...(entry.description != null && String(entry.description).trim()
                ? { description: String(entry.description).trim() }
                : {}),
            ...(normalizeEnabled(entry.enabled) !== undefined ? { enabled: normalizeEnabled(entry.enabled)! } : {})
        };
    }
    return null;
}

function entryToCloudUpdatePatch(entry: Record<string, any>): ProjectUpdatePayload {
    const patch: ProjectUpdatePayload = {};
    if (entry.name != null && String(entry.name).trim()) patch.name = String(entry.name).trim();
    if (entry.description !== undefined) {
        patch.description =
            entry.description === null || entry.description === '' ? '' : String(entry.description);
    }
    const en = normalizeEnabled(entry.enabled);
    if (en !== undefined) patch.enabled = en;
    if (entry.transport != null && String(entry.transport).trim()) {
        patch.transport = String(entry.transport).trim();
    }
    if (entry.endpoint !== undefined && String(entry.endpoint).trim()) {
        patch.endpoint = String(entry.endpoint).trim();
    }
    const needConn = !patch.transport || !patch.endpoint;
    if (needConn && entry.connectionType) {
        const synthetic = entryToCloudCreatePayload({ ...entry, name: entry.name || '_' });
        if (synthetic) {
            if (!patch.transport) patch.transport = synthetic.transport;
            if (!patch.endpoint) patch.endpoint = synthetic.endpoint;
        }
    }
    return patch;
}

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
                cloudItems = projects.map((p: any) => mapCloudProjectToListItem(p));
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
        if (record) {
            return { code: 200, msg: 'ok', data: { ...record, source: 'local' } };
        }
        if (!isLoggedIn()) {
            return { code: 404, msg: `Server not found: ${id}` };
        }
        try {
            const resp = await getProject(String(id));
            const p = (resp as { data?: Record<string, unknown> }).data;
            if (p && typeof p === 'object' && typeof (p as any).id === 'string') {
                return { code: 200, msg: 'ok', data: mapCloudProjectToListItem(p as any) };
            }
            return { code: 404, msg: `Server not found: ${id}` };
        } catch (error: any) {
            const status = error?.response?.status;
            if (status === 404) {
                return { code: 404, msg: `Server not found: ${id}` };
            }
            return { code: status || 500, msg: cloudApiErrorMessage(error, 'Get cloud project failed') };
        }
    }

    @Controller('servers/save')
    async save(data: RequestData, _webview: PostMessageble): Promise<RestfulResponse> {
        const { _id, scope: scopeRaw, source: sourceRaw, ...input } = data as any;
        const id = typeof input.id === 'string' && input.id.trim() ? input.id.trim() : '';

        const explicitFromScope =
            scopeRaw !== undefined && scopeRaw !== null && String(scopeRaw).trim() !== ''
                ? String(scopeRaw).toLowerCase()
                : '';
        const explicitFromSource =
            sourceRaw !== undefined && sourceRaw !== null && String(sourceRaw).trim() !== ''
                ? String(sourceRaw).toLowerCase()
                : '';
        const explicit = explicitFromScope || explicitFromSource;
        const scope = explicit || 'local';

        if (scope === 'auto') {
            if (!id) {
                return { code: 400, msg: 'scope 为 auto 时必须提供 id' };
            }
            if (getServerById(id)) {
                const record = upsertServer({ ...input, id });
                return { code: 200, msg: 'ok', data: { ...record, source: 'local' } };
            }
            if (!isLoggedIn()) {
                return { code: 404, msg: `Server not found: ${id}` };
            }
            try {
                const resp = await getProject(id);
                const p = (resp as { data?: Record<string, unknown> }).data;
                if (!p || typeof p !== 'object' || typeof (p as any).id !== 'string') {
                    return { code: 404, msg: `Server not found: ${id}` };
                }
                const patch = entryToCloudUpdatePatch(input);
                if (Object.keys(patch).length === 0) {
                    return { code: 400, msg: '请提供至少一项要更新的字段' };
                }
                const resp2 = await updateProject(id, patch);
                const p2 = (resp2 as { data?: Record<string, unknown> }).data;
                if (!p2 || typeof p2 !== 'object') {
                    return { code: 500, msg: '云端更新响应无效' };
                }
                return { code: 200, msg: 'ok', data: mapCloudProjectToListItem(p2 as any) };
            } catch (error: any) {
                const status = error?.response?.status;
                if (status === 404) {
                    return { code: 404, msg: `Server not found: ${id}` };
                }
                return {
                    code: status || 500,
                    msg: cloudApiErrorMessage(error, '更新云端 MCP Server 失败')
                };
            }
        }

        if (scope === 'cloud') {
            if (!isLoggedIn()) {
                return { code: 401, msg: '请先登录云端账号后再添加或更新云端 MCP Server' };
            }
            try {
                if (id) {
                    const patch = entryToCloudUpdatePatch(input);
                    if (Object.keys(patch).length === 0) {
                        return { code: 400, msg: '更新云端 Server 时请至少提供 name、transport、endpoint、description 或 enabled 之一' };
                    }
                    const resp = await updateProject(id, patch);
                    const p = (resp as { data?: Record<string, unknown> }).data;
                    if (!p || typeof p !== 'object') {
                        return { code: 500, msg: '云端更新响应无效' };
                    }
                    return { code: 200, msg: 'ok', data: mapCloudProjectToListItem(p as any) };
                }
                const payload = entryToCloudCreatePayload(input);
                if (!payload) {
                    return {
                        code: 400,
                        msg: '无法映射为云端项目：需要 name，以及 (transport+endpoint) 或 MCP 字段（STDIO/SSE/STREAMABLE_HTTP 等）'
                    };
                }
                const resp = await createProject(payload);
                const p = (resp as { data?: Record<string, unknown> }).data;
                if (!p || typeof p !== 'object') {
                    return { code: 500, msg: '云端创建响应无效' };
                }
                return { code: 200, msg: 'ok', data: mapCloudProjectToListItem(p as any) };
            } catch (error: any) {
                return {
                    code: error?.response?.status || 500,
                    msg: cloudApiErrorMessage(error, '保存云端 MCP Server 失败')
                };
            }
        }

        if (scope !== 'local') {
            return { code: 400, msg: 'scope 仅支持 local、cloud 或 auto' };
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
        if (deleted) {
            return { code: 200, msg: 'ok' };
        }
        if (!isLoggedIn()) {
            return { code: 404, msg: `Server not found: ${id}` };
        }
        try {
            await deleteProject(String(id));
            return { code: 200, msg: 'ok' };
        } catch (error: any) {
            const status = error?.response?.status;
            if (status === 404) {
                return { code: 404, msg: `Server not found: ${id}` };
            }
            return { code: status || 500, msg: cloudApiErrorMessage(error, '删除云端 MCP Server 失败') };
        }
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
