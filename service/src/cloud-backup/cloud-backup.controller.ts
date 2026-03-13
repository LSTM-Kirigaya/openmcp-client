/**
 * 云备份 Controller
 * 处理备份、恢复、列表等请求
 */

import { Controller } from '../common/index.js';
import { PostMessageble } from '../hook/adapter.js';
import { RequestData } from '../common/index.dto.js';
import { cloudBackupService } from './cloud-backup.service.js';
import {
    CreateBackupRequest,
    RestoreBackupRequest,
    DeleteBackupRequest
} from './cloud-backup.dto.js';

export class CloudBackupController {

    /**
     * 获取云备份配置状态
     */
    @Controller('cloud-backup/status')
    async getStatus(data: RequestData, webview: PostMessageble) {
        const isConfigured = cloudBackupService.isConfigured();
        const backupStatus = cloudBackupService.getStatus();

        return {
            code: 200,
            msg: {
                isConfigured,
                status: backupStatus
            }
        };
    }

    /**
     * 创建备份
     */
    @Controller('cloud-backup/create')
    async createBackup(data: RequestData, webview: PostMessageble) {
        try {
            const request: CreateBackupRequest = data as unknown as CreateBackupRequest;
            const backup = await cloudBackupService.createBackup(request);

            return {
                code: 200,
                msg: {
                    success: true,
                    backup,
                    message: 'Backup created successfully'
                }
            };
        } catch (error) {
            return {
                code: 400,
                msg: {
                    success: false,
                    error: (error as Error).message
                }
            };
        }
    }

    /**
     * 列出所有备份
     */
    @Controller('cloud-backup/list')
    async listBackups(data: RequestData, webview: PostMessageble) {
        try {
            const response = await cloudBackupService.listBackups();

            return {
                code: 200,
                msg: {
                    success: true,
                    backups: response.backups,
                    total: response.total
                }
            };
        } catch (error) {
            return {
                code: 400,
                msg: {
                    success: false,
                    error: (error as Error).message
                }
            };
        }
    }

    /**
     * 恢复备份
     */
    @Controller('cloud-backup/restore')
    async restoreBackup(data: RequestData, webview: PostMessageble) {
        try {
            const request: RestoreBackupRequest = data as unknown as RestoreBackupRequest;
            const restoredData = await cloudBackupService.restoreBackup(request);

            return {
                code: 200,
                msg: {
                    success: true,
                    data: restoredData,
                    message: 'Backup restored successfully'
                }
            };
        } catch (error) {
            return {
                code: 400,
                msg: {
                    success: false,
                    error: (error as Error).message
                }
            };
        }
    }

    /**
     * 删除备份
     */
    @Controller('cloud-backup/delete')
    async deleteBackup(data: RequestData, webview: PostMessageble) {
        try {
            const request: DeleteBackupRequest = data as unknown as DeleteBackupRequest;
            await cloudBackupService.deleteBackup(request);

            return {
                code: 200,
                msg: {
                    success: true,
                    message: 'Backup deleted successfully'
                }
            };
        } catch (error) {
            return {
                code: 400,
                msg: {
                    success: false,
                    error: (error as Error).message
                }
            };
        }
    }

    /**
     * 获取备份详情
     */
    @Controller('cloud-backup/detail')
    async getBackupDetail(data: RequestData, webview: PostMessageble) {
        try {
            const { backupId } = data as unknown as { backupId: string };
            const backup = await cloudBackupService.getBackupDetail(backupId);

            return {
                code: 200,
                msg: {
                    success: true,
                    backup
                }
            };
        } catch (error) {
            return {
                code: 400,
                msg: {
                    success: false,
                    error: (error as Error).message
                }
            };
        }
    }
}
