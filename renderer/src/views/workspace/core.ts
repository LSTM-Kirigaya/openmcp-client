import { reactive } from 'vue';
import { useMessageBridge } from '@/api/message-bridge';
import { mcpClientAdapter } from '@/views/connect/core';
import { loadPanels, savePanels } from '@/hook/panel';
import { tabs } from '@/components/main-panel/panel';
import type { IConnectionArgs } from '@/views/connect/type';
import { ElMessage } from 'element-plus';
import I18n from '@/i18n';

const { t } = I18n.global;

export interface Workspace {
    id: string;
    name: string;
    serverConfig: IConnectionArgs;
    createdAt: number;
    updatedAt: number;
}

export interface WorkspaceListResponse {
    workspaces: Workspace[];
}

export const workspaceManager = reactive({
    workspaces: [] as Workspace[],
    currentWorkspaceId: null as string | null,
    isLoading: false,

    get currentWorkspace(): Workspace | undefined {
        if (!this.currentWorkspaceId) return undefined;
        return this.workspaces.find(w => w.id === this.currentWorkspaceId);
    },

    async loadWorkspaces(): Promise<void> {
        const bridge = useMessageBridge();
        try {
            const res = await bridge.commandRequest<WorkspaceListResponse>('workspaces/list', {});
            const payload = (res.data as any) || res.msg;
            if (res.code === 200 && payload?.workspaces) {
                this.workspaces = payload.workspaces;
            }
        } catch (e) {
            console.error('[workspace] loadWorkspaces failed:', e);
        }
    },

    async loadCurrentWorkspaceId(): Promise<string | null> {
        const bridge = useMessageBridge();
        try {
            const res = await bridge.commandRequest<{ workspaceId: string | null }>('workspaces/current/get', {});
            const payload = (res.data as any) || res.msg;
            if (res.code === 200 && payload?.workspaceId) {
                return payload.workspaceId;
            }
        } catch (e) {
            console.error('[workspace] loadCurrentWorkspaceId failed:', e);
        }
        return null;
    },

    async saveCurrentWorkspaceId(id: string | null): Promise<void> {
        const bridge = useMessageBridge();
        try {
            await bridge.commandRequest('workspaces/current/set', { workspaceId: id });
        } catch (e) {
            console.error('[workspace] saveCurrentWorkspaceId failed:', e);
        }
    },

    async switchWorkspace(workspaceId: string): Promise<boolean> {
        const workspace = this.workspaces.find(w => w.id === workspaceId);
        if (!workspace) {
            ElMessage.error(t('workspace-not-found'));
            return false;
        }

        // 如果已经是当前工作区，直接返回
        if (this.currentWorkspaceId === workspaceId && mcpClientAdapter.connected) {
            return true;
        }

        this.isLoading = true;

        try {
            // 1. 保存当前面板状态
            if (mcpClientAdapter.connected && mcpClientAdapter.masterNode.clientId) {
                savePanels();
            }

            // 2. 断开当前所有连接
            await disconnectAllClients();

            // 3. 清空 clients 和 tabs
            mcpClientAdapter.clients.splice(0, mcpClientAdapter.clients.length);
            tabs.content.splice(0, tabs.content.length);
            tabs.activeIndex = 0;

            // 4. 连接新工作区的服务器
            const ok = await mcpClientAdapter.connectServer(workspace.serverConfig);

            if (ok) {
                // 5. 加载该工作区的面板状态
                await mcpClientAdapter.loadPanels();

                // 6. 更新当前工作区
                this.currentWorkspaceId = workspaceId;
                await this.saveCurrentWorkspaceId(workspaceId);

                ElMessage.success(t('workspace-switched').replace('{name}', workspace.name));
            } else {
                ElMessage.error(t('workspace-connect-failed').replace('{name}', workspace.name));
            }

            return ok;
        } catch (e) {
            console.error('[workspace] switchWorkspace failed:', e);
            ElMessage.error(t('workspace-switch-failed'));
            return false;
        } finally {
            this.isLoading = false;
        }
    },

    async autoConnectLastWorkspace(): Promise<boolean> {
        await this.loadWorkspaces();

        const lastWorkspaceId = await this.loadCurrentWorkspaceId();
        if (!lastWorkspaceId) {
            return false;
        }

        const workspace = this.workspaces.find(w => w.id === lastWorkspaceId);
        if (!workspace) {
            console.log('[workspace] last workspace not found in list:', lastWorkspaceId);
            return false;
        }

        this.isLoading = true;
        try {
            const ok = await mcpClientAdapter.connectServer(workspace.serverConfig);
            if (ok) {
                this.currentWorkspaceId = lastWorkspaceId;
                await mcpClientAdapter.loadPanels();
                console.log('[workspace] auto-connected to:', workspace.name);
                return true;
            }
        } catch (e) {
            console.error('[workspace] autoConnectLastWorkspace failed:', e);
        } finally {
            this.isLoading = false;
        }

        return false;
    },

    async markWorkspaceOpened(workspaceId: string): Promise<void> {
        this.currentWorkspaceId = workspaceId;
        await this.saveCurrentWorkspaceId(workspaceId);
    }
});

async function disconnectAllClients(): Promise<void> {
    const clients = [...mcpClientAdapter.clients];
    for (const client of clients) {
        try {
            if (client.connected && client.clientId) {
                await client.disconnect();
            }
        } catch (e) {
            console.error('[workspace] disconnect client failed:', e);
        }
    }
}
