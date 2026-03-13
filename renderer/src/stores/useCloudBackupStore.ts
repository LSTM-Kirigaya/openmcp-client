/**
 * 云备份状态管理
 */

import { ref, computed } from 'vue';
import * as cloudBackupApi from '../api/cloud-backup.js';

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

// 状态
const isInitialized = ref(false);
const isConfigured = ref(false);
const backups = ref<BackupMetadata[]>([]);
const totalBackups = ref(0);
const isBackingUp = ref(false);
const isRestoring = ref(false);
const lastBackupTime = ref<string | undefined>(undefined);
const lastRestoreTime = ref<string | undefined>(undefined);
const lastError = ref<string | undefined>(undefined);
const isLoading = ref(false);
const error = ref<string | null>(null);

export const useCloudBackupStore = () => {
    const hasBackups = computed(() => backups.value.length > 0);

    /**
     * 初始化云备份状态
     */
    async function initialize() {
        if (isInitialized.value) return;

        isLoading.value = true;
        error.value = null;

        try {
            const status = await cloudBackupApi.getCloudBackupStatus();
            isConfigured.value = status.isConfigured;
            isBackingUp.value = status.status.isBackingUp;
            isRestoring.value = status.status.isRestoring;
            lastBackupTime.value = status.status.lastBackupTime;
            lastRestoreTime.value = status.status.lastRestoreTime;
            lastError.value = status.status.lastError;

            if (isConfigured.value) {
                await fetchBackups();
            }

            isInitialized.value = true;
        } catch (err) {
            error.value = (err as Error).message;
            console.error('[CloudBackupStore] Initialize failed:', err);
        } finally {
            isLoading.value = false;
        }
    }

    /**
     * 获取备份列表
     */
    async function fetchBackups(): Promise<void> {
        isLoading.value = true;
        error.value = null;

        try {
            const result = await cloudBackupApi.listBackups();
            if (result.success) {
                backups.value = result.backups || [];
                totalBackups.value = result.total || 0;
            } else {
                error.value = result.error || 'Failed to fetch backups';
            }
        } catch (err) {
            error.value = (err as Error).message;
            console.error('[CloudBackupStore] Fetch backups failed:', err);
        } finally {
            isLoading.value = false;
        }
    }

    /**
     * 创建备份
     */
    async function createBackup(
        name: string,
        encryptionPassword: string,
        data: Record<string, any>,
        description?: string
    ): Promise<boolean> {
        isBackingUp.value = true;
        error.value = null;

        try {
            const result = await cloudBackupApi.createBackup({
                name,
                description,
                encryptionPassword,
                data
            });

            if (result.success && result.backup) {
                backups.value.unshift(result.backup);
                totalBackups.value++;
                lastBackupTime.value = new Date().toISOString();
                return true;
            } else {
                error.value = result.error || 'Backup failed';
                lastError.value = error.value;
                return false;
            }
        } catch (err) {
            error.value = (err as Error).message;
            lastError.value = error.value;
            return false;
        } finally {
            isBackingUp.value = false;
        }
    }

    /**
     * 恢复备份
     */
    async function restoreBackup(backupId: string, encryptionPassword: string): Promise<Record<string, any> | null> {
        isRestoring.value = true;
        error.value = null;

        try {
            const result = await cloudBackupApi.restoreBackup({
                backupId,
                encryptionPassword
            });

            if (result.success && result.data) {
                lastRestoreTime.value = new Date().toISOString();
                return result.data;
            } else {
                error.value = result.error || 'Restore failed';
                return null;
            }
        } catch (err) {
            error.value = (err as Error).message;
            return null;
        } finally {
            isRestoring.value = false;
        }
    }

    /**
     * 删除备份
     */
    async function deleteBackup(backupId: string): Promise<boolean> {
        isLoading.value = true;
        error.value = null;

        try {
            const result = await cloudBackupApi.deleteBackup({ backupId });

            if (result.success) {
                backups.value = backups.value.filter(b => b.id !== backupId);
                totalBackups.value--;
                return true;
            } else {
                error.value = result.error || 'Delete failed';
                return false;
            }
        } catch (err) {
            error.value = (err as Error).message;
            return false;
        } finally {
            isLoading.value = false;
        }
    }

    /**
     * 格式化文件大小
     */
    function formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 格式化日期
     */
    function formatDate(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * 清除错误
     */
    function clearError() {
        error.value = null;
    }

    return {
        // 状态
        isInitialized,
        isConfigured,
        backups,
        totalBackups,
        isBackingUp,
        isRestoring,
        lastBackupTime,
        lastRestoreTime,
        lastError,
        isLoading,
        error,
        // 计算属性
        hasBackups,
        // 方法
        initialize,
        fetchBackups,
        createBackup,
        restoreBackup,
        deleteBackup,
        formatFileSize,
        formatDate,
        clearError
    };
};

// 导出单例状态
export const cloudBackupStore = useCloudBackupStore();
