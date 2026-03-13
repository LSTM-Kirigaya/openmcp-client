/**
 * 云备份相关的 DTO 类型定义
 */

export interface BackupData {
    id: string;
    user_id: string;
    name: string;
    description?: string;
    encrypted_data: string;  // 加密后的数据
    iv: string;              // 初始化向量
    salt: string;            // 密钥派生盐值
    data_hash: string;       // 数据完整性校验
    file_size: number;
    created_at: string;
    updated_at: string;
    device_info?: string;    // 设备标识
    version: string;         // 备份格式版本
}

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
    encryptionPassword: string;  // 用户提供的加密密码
    data: Record<string, any>;   // 要备份的数据
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
    isBackingUp: boolean;
    isRestoring: boolean;
    lastBackupTime?: string;
    lastRestoreTime?: string;
    lastError?: string;
}

export interface EncryptionConfig {
    algorithm: 'aes-256-gcm';
    keyDerivation: 'pbkdf2';
    iterations: number;
    saltLength: number;
    ivLength: number;
}

export const DEFAULT_ENCRYPTION_CONFIG: EncryptionConfig = {
    algorithm: 'aes-256-gcm',
    keyDerivation: 'pbkdf2',
    iterations: 100000,  // PBKDF2 迭代次数
    saltLength: 32,      // 盐值长度 (bytes)
    ivLength: 16         // IV 长度 (bytes)
};
