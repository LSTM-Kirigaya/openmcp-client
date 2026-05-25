<template>
    <div class="workspace-container">
        <div class="workspace-header">
            <h2 class="workspace-title">{{ t('workspace-title') }}</h2>
            <span class="workspace-subtitle">{{ t('workspace-subtitle') }}</span>
        </div>

        <el-empty v-if="workspaceManager.workspaces.length === 0" :description="t('workspace-empty')" />

        <div v-else class="workspace-grid">
            <div
                v-for="workspace in workspaceManager.workspaces"
                :key="workspace.id"
                class="workspace-card"
                :class="{ active: isActive(workspace.id) }"
                @click="handleCardClick(workspace)"
            >
                <div class="workspace-card-header">
                    <span class="workspace-icon">
                        <span
                            class="iconfont"
                            :class="getConnectionTypeIcon(workspace.serverConfig.connectionType)"
                        ></span>
                    </span>
                    <div class="workspace-info">
                        <span class="workspace-name">{{ workspace.name }}</span>
                        <span class="workspace-type">{{ workspace.serverConfig.connectionType }}</span>
                    </div>
                    <el-tag
                        v-if="isActive(workspace.id) && mcpClientAdapter.connected"
                        size="small"
                        type="success"
                        class="workspace-status-tag"
                    >
                        {{ t('workspace-current') }}
                    </el-tag>
                </div>

                <div class="workspace-card-body">
                    <div class="workspace-detail" v-if="workspace.serverConfig.commandString">
                        <span class="detail-label">{{ t('workspace-command') }}:</span>
                        <span class="detail-value" :title="workspace.serverConfig.commandString">
                            {{ workspace.serverConfig.commandString }}
                        </span>
                    </div>
                    <div class="workspace-detail" v-if="workspace.serverConfig.url">
                        <span class="detail-label">URL:</span>
                        <span class="detail-value" :title="workspace.serverConfig.url">
                            {{ workspace.serverConfig.url }}
                        </span>
                    </div>
                    <div class="workspace-meta">
                        <span class="meta-item">{{ t('workspace-last-opened') }}: {{ formatDate(workspace.updatedAt) }}</span>
                    </div>
                </div>

                <div class="workspace-card-footer">
                    <el-button
                        v-if="isActive(workspace.id) && mcpClientAdapter.connected"
                        size="small"
                        type="danger"
                        plain
                        @click.stop="handleDisconnect(workspace)"
                    >
                        {{ t('workspace-disconnect') }}
                    </el-button>
                    <el-button
                        v-else
                        size="small"
                        type="primary"
                        plain
                        :loading="workspaceManager.isLoading"
                        @click.stop="handleConnect(workspace)"
                    >
                        {{ t('workspace-connect') }}
                    </el-button>
                    <el-button
                        size="small"
                        type="danger"
                        text
                        @click.stop="handleDelete(workspace)"
                    >
                        {{ t('workspace-delete') }}
                    </el-button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { defineComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { workspaceManager, type Workspace } from './core';
import { mcpClientAdapter } from '@/views/connect/core';

defineComponent({ name: 'workspace' });

const { t } = useI18n();
const router = useRouter();
const baseURL = import.meta.env.BASE_URL;

function isActive(workspaceId: string): boolean {
    return workspaceManager.currentWorkspaceId === workspaceId;
}

function getConnectionTypeIcon(type?: string): string {
    switch (type) {
        case 'STDIO': return 'icon-filepath';
        case 'SSE': return 'icon-refresh';
        case 'STREAMABLE_HTTP': return 'icon-link';
        default: return 'icon-refresh';
    }
}

function formatDate(timestamp: number): string {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

async function handleCardClick(workspace: Workspace) {
    if (isActive(workspace.id) && mcpClientAdapter.connected) {
        // 已经是当前工作区且已连接，跳转到 debug
        router.push(baseURL + 'debug');
        return;
    }
    await handleConnect(workspace);
}

async function handleConnect(workspace: Workspace) {
    const ok = await workspaceManager.switchWorkspace(workspace.id);
    if (ok) {
        router.push(baseURL + 'debug');
    }
}

async function handleDisconnect(_workspace: Workspace) {
    const masterNode = mcpClientAdapter.masterNode;
    if (masterNode && masterNode.connected) {
        await masterNode.disconnect();
    }
    mcpClientAdapter.clients.splice(0, mcpClientAdapter.clients.length);
    workspaceManager.currentWorkspaceId = null;
    await workspaceManager.saveCurrentWorkspaceId(null);
}

async function handleDelete(workspace: Workspace) {
    try {
        await ElMessageBox.confirm(
            t('workspace-delete-confirm').replace('{name}', workspace.name),
            t('workspace-delete-title'),
            { confirmButtonText: t('confirm'), cancelButtonText: t('cancel'), type: 'warning' }
        );
    } catch {
        return;
    }

    // 如果删除的是当前工作区，先断开
    if (isActive(workspace.id) && mcpClientAdapter.connected) {
        const masterNode = mcpClientAdapter.masterNode;
        if (masterNode && masterNode.connected) {
            await masterNode.disconnect();
        }
        mcpClientAdapter.clients.splice(0, mcpClientAdapter.clients.length);
        workspaceManager.currentWorkspaceId = null;
        await workspaceManager.saveCurrentWorkspaceId(null);
    }

    // 从 servers list 删除
    const bridge = (await import('@/api/message-bridge')).useMessageBridge();
    try {
        await bridge.commandRequest('servers/delete', { id: workspace.id });
        await workspaceManager.loadWorkspaces();
        ElMessage.success(t('workspace-deleted'));
    } catch (e) {
        console.error('[workspace] delete failed:', e);
        ElMessage.error(t('workspace-delete-failed'));
    }
}
</script>

<style scoped>
.workspace-container {
    height: 100%;
    padding: 24px;
    overflow-y: auto;
    box-sizing: border-box;
}

.workspace-header {
    margin-bottom: 20px;
}

.workspace-title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--foreground, var(--el-text-color-primary));
}

.workspace-subtitle {
    font-size: 13px;
    color: var(--foreground-muted, var(--el-text-color-secondary));
    margin-top: 4px;
    display: block;
}

.workspace-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 16px;
}

.workspace-card {
    background-color: var(--el-bg-color);
    border: 1px solid var(--el-border-color-light);
    border-radius: 12px;
    padding: 16px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.workspace-card:hover {
    border-color: var(--main-light-color-40, var(--el-color-primary-light-5));
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.workspace-card.active {
    border-color: var(--main-color, var(--el-color-primary));
    background-color: var(--main-light-color-10, var(--el-color-primary-light-9));
}

.workspace-card-header {
    display: flex;
    align-items: center;
    gap: 12px;
}

.workspace-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background-color: var(--main-light-color-20, var(--el-color-primary-light-8));
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.workspace-icon .iconfont {
    font-size: 20px;
    color: var(--main-color, var(--el-color-primary));
}

.workspace-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.workspace-name {
    font-size: 15px;
    font-weight: 600;
    color: var(--foreground, var(--el-text-color-primary));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.workspace-type {
    font-size: 12px;
    color: var(--foreground-muted, var(--el-text-color-secondary));
}

.workspace-status-tag {
    flex-shrink: 0;
}

.workspace-card-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.workspace-detail {
    display: flex;
    gap: 6px;
    font-size: 12px;
}

.detail-label {
    color: var(--foreground-muted, var(--el-text-color-secondary));
    flex-shrink: 0;
}

.detail-value {
    color: var(--foreground, var(--el-text-color-primary));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.workspace-meta {
    margin-top: 4px;
    font-size: 11px;
    color: var(--el-text-color-placeholder);
}

.workspace-card-footer {
    display: flex;
    gap: 8px;
    margin-top: auto;
    padding-top: 8px;
    border-top: 1px solid var(--el-border-color-lighter);
}
</style>
