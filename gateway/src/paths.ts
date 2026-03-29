import { homedir } from 'os';
import { join } from 'path';

/**
 * 用户目录下 Gateway 日志根路径（与 gateway.env 同属 .openmcp）。
 * Windows: %USERPROFILE%\.openmcp\logs\gateway
 */
export function gatewayUserLogDir(): string {
    return join(homedir(), '.openmcp', 'logs', 'gateway');
}
