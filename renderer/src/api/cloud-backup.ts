/**
 * 云备份相关 API
 */

import { sendRequest } from './message-bridge.js';

export interface BackupMetadata {
    id: string;
    name: string;
    description?: string;
    file_size: number;
    created_at: string;
    updated_at: string;
    device_info?: string;
    version: string;
}

export interface CreateBackupRequest {
    name: string;
    description?: string;
    encryptionPassword: string;
    data: Record<string, any>;
}

export interface RestoreBackupRequest {
    backupId: string;
    encryptionPassword: string;
}

export interface DeleteBackupRequest {
    backupId: string;
}

export interface ListBackupsResponse {
    backups: BackupMetadata[];
    total: number;
}

export interface BackupStatus {
    isConfigured: boolean;
    status: {
        isBackingUp: boolean;
        isRestoring: boolean;
        lastBackupTime?: string;
        lastRestoreTime?: string;
        lastError?: string;
    };
}

/**
 * 获取云备份状态
 */
export async function getCloudBackupStatus(): Promise<BackupStatus> {
    const response = await sendRequest<BackupStatus>('cloud-backup/status', {});
    return response.msg;
}

/**
 * 创建备份
 */
export async function createBackup(request: CreateBackupRequest): Promise<{ success: boolean; backup?: BackupMetadata; error?: string }> {
    const response = await sendRequest<{ success: boolean; backup: BackupMetadata; error?: string }>('cloud-backup/create', request);
    return response.msg;
}

/**
 * 列出所有备份
 */
export async function listBackups(): Promise<{ success: boolean; backups?: BackupMetadata[]; total?: number; error?: string }> {
    const response = await sendRequest<{ success: boolean; backups: BackupMetadata[]; total: number; error?: string }>('cloud-backup/list', {});
    return response.msg;
}

/**
 * 恢复备份
 */
export async function restoreBackup(request: RestoreBackupRequest): Promise<{ success: boolean; data?: Record<string, any>; error?: string }> {
    const response = await sendRequest<{ success: boolean; data: Record<string, any>; error?: string }>('cloud-backup/restore', request);
    return response.msg;
}

/**
 * 删除备份
 */
export async function deleteBackup(request: DeleteBackupRequest): Promise<{ success: boolean; error?: string }> {
    const response = await sendRequest<{ success: boolean; error?: string }>('cloud-backup/delete', request);
    return response.msg;
}

/**
 * 获取备份详情
 */
export async function getBackupDetail(backupId: string): Promise<{ success: boolean; backup?: BackupMetadata; error?: string }> {
    const response = await sendRequest<{ success: boolean; backup: BackupMetadata; error?: string }>('cloud-backup/detail', { backupId });
    return response.msg;
}
