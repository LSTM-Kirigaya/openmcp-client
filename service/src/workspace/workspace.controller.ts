import { Controller } from '../common/index.js';
import type { RequestData, RestfulResponse } from '../common/index.dto.js';
import type { PostMessageble } from '../hook/adapter.js';
import { listServers } from '../storage/servers.repository.js';
import {
    loadCurrentWorkspaceId,
    saveCurrentWorkspaceId
} from '../storage/workspace.repository.js';

export class WorkspaceController {
    @Controller('workspaces/list')
    async list(_data: RequestData, _webview: PostMessageble): Promise<RestfulResponse> {
        const servers = listServers();
        const workspaces = servers.map(record => ({
            id: record.id,
            name: record.name,
            serverConfig: {
                connectionType: record.connectionType,
                command: record.command,
                args: record.args,
                commandString: record.command
                    ? [record.command, ...(record.args || [])].join(' ')
                    : record.url,
                url: record.url,
                headers: record.headers,
                cwd: record.cwd,
                env: record.env,
                oauth: record.oauth,
                enableDatasetReflux: record.enableDatasetReflux,
                datasetName: record.datasetName,
                connectionId: (record as any).connectionId,
                storageScope: (record as any).storageScope,
                workspacePath: (record as any).workspacePath
            },
            createdAt: record.createdAt,
            updatedAt: record.updatedAt
        }));

        return {
            code: 200,
            msg: 'ok',
            data: { workspaces }
        };
    }

    @Controller('workspaces/current/get')
    async getCurrent(_data: RequestData, _webview: PostMessageble): Promise<RestfulResponse> {
        const workspaceId = loadCurrentWorkspaceId();
        return {
            code: 200,
            msg: 'ok',
            data: { workspaceId }
        };
    }

    @Controller('workspaces/current/set')
    async setCurrent(data: RequestData, _webview: PostMessageble): Promise<RestfulResponse> {
        const { workspaceId } = data as any;
        saveCurrentWorkspaceId(typeof workspaceId === 'string' ? workspaceId : null);
        return {
            code: 200,
            msg: 'ok'
        };
    }
}
