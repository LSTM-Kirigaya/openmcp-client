/**
 * 加密服务
 * 提供数据加密/解密功能，使用 AES-256-GCM
 */

import { createCipheriv, createDecipheriv, createHash, pbkdf2Sync, randomBytes, createHmac } from 'crypto';
import { DEFAULT_ENCRYPTION_CONFIG, EncryptionConfig } from './cloud-backup.dto.js';

export interface EncryptedData {
    encrypted: string;     // Base64 编码的加密数据
    iv: string;           // Base64 编码的初始化向量
    salt: string;         // Base64 编码的盐值
    authTag: string;      // Base64 编码的认证标签 (GCM 模式)
    hash: string;         // 数据完整性校验
}

class CryptoService {
    private config: EncryptionConfig;

    constructor(config: EncryptionConfig = DEFAULT_ENCRYPTION_CONFIG) {
        this.config = config;
    }

    /**
     * 从密码派生密钥
     */
    private deriveKey(password: string, salt: Buffer): Buffer {
        return pbkdf2Sync(
            password,
            salt,
            this.config.iterations,
            32,  // 256 bits
            'sha256'
        );
    }

    /**
     * 计算数据哈希（用于完整性校验）
     */
    computeHash(data: string): string {
        return createHash('sha256').update(data).digest('hex');
    }

    /**
     * 验证数据哈希
     */
    verifyHash(data: string, hash: string): boolean {
        const computed = this.computeHash(data);
        return computed === hash;
    }

    /**
     * 加密数据
     * @param data 要加密的 JSON 对象
     * @param password 加密密码
     */
    encrypt(data: Record<string, any>, password: string): EncryptedData {
        // 生成随机盐值和 IV
        const salt = randomBytes(this.config.saltLength);
        const iv = randomBytes(this.config.ivLength);

        // 派生密钥
        const key = this.deriveKey(password, salt);

        // 序列化数据
        const dataString = JSON.stringify(data);

        // 计算原始数据哈希
        const hash = this.computeHash(dataString);

        // 创建加密器
        const cipher = createCipheriv('aes-256-gcm', key, iv);

        // 加密数据
        let encrypted = cipher.update(dataString, 'utf8', 'base64');
        encrypted += cipher.final('base64');

        // 获取认证标签
        const authTag = cipher.getAuthTag();

        return {
            encrypted,
            iv: iv.toString('base64'),
            salt: salt.toString('base64'),
            authTag: authTag.toString('base64'),
            hash
        };
    }

    /**
     * 解密数据
     * @param encryptedData 加密后的数据结构
     * @param password 解密密码
     * @returns 解密后的 JSON 对象
     */
    decrypt(encryptedData: EncryptedData, password: string): Record<string, any> {
        try {
            // 解码 Base64
            const salt = Buffer.from(encryptedData.salt, 'base64');
            const iv = Buffer.from(encryptedData.iv, 'base64');
            const authTag = Buffer.from(encryptedData.authTag, 'base64');

            // 派生密钥
            const key = this.deriveKey(password, salt);

            // 创建解密器
            const decipher = createDecipheriv('aes-256-gcm', key, iv);
            decipher.setAuthTag(authTag);

            // 解密数据
            let decrypted = decipher.update(encryptedData.encrypted, 'base64', 'utf8');
            decrypted += decipher.final('utf8');

            // 验证数据完整性
            if (!this.verifyHash(decrypted, encryptedData.hash)) {
                throw new Error('Data integrity check failed - the backup may be corrupted');
            }

            // 解析 JSON
            return JSON.parse(decrypted);
        } catch (error) {
            if ((error as Error).message.includes('integrity check failed')) {
                throw error;
            }
            throw new Error('Decryption failed - invalid password or corrupted data');
        }
    }

    /**
     * 生成随机加密密码
     * 用于自动生成的强密码
     */
    generateRandomPassword(length: number = 32): string {
        return randomBytes(length).toString('base64').slice(0, length);
    }
}

// 导出单例实例
export const cryptoService = new CryptoService();
