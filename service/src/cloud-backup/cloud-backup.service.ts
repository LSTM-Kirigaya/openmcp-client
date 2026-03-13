/**
 * 云备份服务
 * 处理数据备份、恢复、列表等操作
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as os from 'os';
import { authService } from '../auth/auth.service.js';
import { cryptoService, EncryptedData } from './crypto.service.js';
import {
    BackupData,
    BackupMetadata,
    CreateBackupRequest,
    RestoreBackupRequest,
    DeleteBackupRequest,
    ListBackupsResponse,
    BackupStatus
} from './cloud-backup.dto.js';

// Supabase 配置
const SUPABASE_URL = process.env['SUPABASE_URL'] || '';
const SUPABASE_ANON_KEY = process.env['SUPABASE_ANON_KEY'] || '';

// 数据库表名
const BACKUPS_TABLE = 'user_backups';

class CloudBackupService {
    private supabase: SupabaseClient | null = null;
    private status: BackupStatus = {
        isBackingUp: false,
        isRestoring: false
    };

    constructor() {
        this.initSupabase();
    }

    private initSupabase() {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            console.warn('[CloudBackupService] Supabase credentials not configured');
            return;
        }

        try {
            this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            });
            console.log('[CloudBackupService] Supabase client initialized');
        } catch (error) {
            console.error('[CloudBackupService] Failed to initialize Supabase:', error);
        }
    }

    /**
     * 检查是否已配置
     */
    isConfigured(): boolean {
        return this.supabase !== null;
    }

    /**
     * 获取当前备份状态
     */
    getStatus(): BackupStatus {
        return { ...this.status };
    }

    /**
     * 获取设备信息
     */
    private getDeviceInfo(): string {
        const hostname = os.hostname();
        const platform = os.platform();
        const arch = os.arch();
        return `${hostname} (${platform}-${arch})`;
    }

    /**
     * 设置认证 Token
     */
    private setAuthToken(): boolean {
        if (!this.supabase) {
            return false;
        }

        const token = authService.getAccessToken();
        if (!token) {
            return false;
        }

        // 设置 session
        this.supabase.auth.setSession({
            access_token: token,
            refresh_token: authService.getState().refreshToken || ''
        });

        return true;
    }

    /**
     * 创建备份
     */
    async createBackup(request: CreateBackupRequest): Promise<BackupMetadata> {
        if (!this.isConfigured()) {
            throw new Error('Cloud backup not configured');
        }

        if (!this.setAuthToken()) {
            throw new Error('Not authenticated');
        }

        const authState = authService.getState();
        if (!authState.user) {
            throw new Error('User not found');
        }

        this.status.isBackingUp = true;
        this.status.lastError = undefined;

        try {
            // 1. 加密数据
            const encrypted = cryptoService.encrypt(request.data, request.encryptionPassword);

            // 2. 构造备份数据
            const now = new Date().toISOString();
            const backupData: Omit<BackupData, 'id'> = {
                user_id: authState.user.id,
                name: request.name,
                description: request.description,
                encrypted_data: encrypted.encrypted,
                iv: encrypted.iv,
                salt: encrypted.salt,
                data_hash: encrypted.hash,
                file_size: Buffer.byteLength(encrypted.encrypted, 'base64'),
                created_at: now,
                updated_at: now,
                device_info: this.getDeviceInfo(),
                version: '1.0'
            };

            // 3. 上传到 Supabase
            const { data, error } = await this.supabase!
                .from(BACKUPS_TABLE)
                .insert(backupData)
                .select()
                .single();

            if (error) {
                throw new Error(`Failed to create backup: ${error.message}`);
            }

            this.status.lastBackupTime = now;

            // 返回元数据（不包含加密数据）
            return {
                id: data.id,
                name: data.name,
                description: data.description,
                file_size: data.file_size,
                created_at: data.created_at,
                updated_at: data.updated_at,
                device_info: data.device_info,
                version: data.version
            };
        } catch (error) {
            this.status.lastError = (error as Error).message;
            throw error;
        } finally {
            this.status.isBackingUp = false;
        }
    }

    /**
     * 列出用户的所有备份
     */
    async listBackups(): Promise<ListBackupsResponse> {
        if (!this.isConfigured()) {
            throw new Error('Cloud backup not configured');
        }

        if (!this.setAuthToken()) {
            throw new Error('Not authenticated');
        }

        const authState = authService.getState();
        if (!authState.user) {
            throw new Error('User not found');
        }

        const { data, error, count } = await this.supabase!
            .from(BACKUPS_TABLE)
            .select('id, name, description, file_size, created_at, updated_at, device_info, version', { count: 'exact' })
            .eq('user_id', authState.user.id)
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error(`Failed to list backups: ${error.message}`);
        }

        return {
            backups: data || [],
            total: count || 0
        };
    }

    /**
     * 恢复备份
     */
    async restoreBackup(request: RestoreBackupRequest): Promise<Record<string, any>> {
        if (!this.isConfigured()) {
            throw new Error('Cloud backup not configured');
        }

        if (!this.setAuthToken()) {
            throw new Error('Not authenticated');
        }

        const authState = authService.getState();
        if (!authState.user) {
            throw new Error('User not found');
        }

        this.status.isRestoring = true;
        this.status.lastError = undefined;

        try {
            // 1. 获取备份数据
            const { data, error } = await this.supabase!
                .from(BACKUPS_TABLE)
                .select('*')
                .eq('id', request.backupId)
                .eq('user_id', authState.user.id)
                .single();

            if (error) {
                throw new Error(`Failed to fetch backup: ${error.message}`);
            }

            if (!data) {
                throw new Error('Backup not found');
            }

            // 2. 解密数据
            const encryptedData: EncryptedData = {
                encrypted: data.encrypted_data,
                iv: data.iv,
                salt: data.salt,
                authTag: '', // 在 storage 中，authTag 已包含在 encrypted_data 中
                hash: data.data_hash
            };

            const decrypted = cryptoService.decrypt(encryptedData, request.encryptionPassword);

            this.status.lastRestoreTime = new Date().toISOString();

            return decrypted;
        } catch (error) {
            this.status.lastError = (error as Error).message;
            throw error;
        } finally {
            this.status.isRestoring = false;
        }
    }

    /**
     * 删除备份
     */
    async deleteBackup(request: DeleteBackupRequest): Promise<void> {
        if (!this.isConfigured()) {
            throw new Error('Cloud backup not configured');
        }

        if (!this.setAuthToken()) {
            throw new Error('Not authenticated');
        }

        const authState = authService.getState();
        if (!authState.user) {
            throw new Error('User not found');
        }

        const { error } = await this.supabase!
            .from(BACKUPS_TABLE)
            .delete()
            .eq('id', request.backupId)
            .eq('user_id', authState.user.id);

        if (error) {
            throw new Error(`Failed to delete backup: ${error.message}`);
        }
    }

    /**
     * 获取备份详情
     */
    async getBackupDetail(backupId: string): Promise<BackupMetadata> {
        if (!this.isConfigured()) {
            throw new Error('Cloud backup not configured');
        }

        if (!this.setAuthToken()) {
            throw new Error('Not authenticated');
        }

        const authState = authService.getState();
        if (!authState.user) {
            throw new Error('User not found');
        }

        const { data, error } = await this.supabase!
            .from(BACKUPS_TABLE)
            .select('id, name, description, file_size, created_at, updated_at, device_info, version')
            .eq('id', backupId)
            .eq('user_id', authState.user.id)
            .single();

        if (error) {
            throw new Error(`Failed to fetch backup: ${error.message}`);
        }

        if (!data) {
            throw new Error('Backup not found');
        }

        return data;
    }
}

// 导出单例实例
export const cloudBackupService = new CloudBackupService();
