import { Controller } from "../../common/index.js";
import { PostMessageble } from "../../hook/adapter.js";
import { RequestData, type RestfulResponse } from "../../common/index.dto.js";
import {
    register as apiRegister,
    login as apiLogin,
    getOAuthAuthorizeUrl as apiGetOAuthAuthorizeUrl,
    logout as apiLogout,
    logoutAll as apiLogoutAll,
    checkAuthStatus as apiCheckAuthStatus,
    refreshToken as apiRefreshToken,
    getToken,
    setToken,
    clearToken,
    isLoggedIn,
    setTokenPairFromExternal,
    oauthFinalizeByNonce,
    startDeviceAuth as apiStartDeviceAuth,
    pollDeviceToken as apiPollDeviceToken
} from "../auth.js";

function extractErrorMessage(error: any, fallback: string): string {
    const message =
        error?.response?.data?.message ||
        error?.message ||
        error?.code ||
        error?.cause?.code;
    if (typeof message === 'string' && message.trim()) {
        return message;
    }
    return fallback;
}

function buildOAuthFriendlyError(error: any): string {
    const method = String(error?.config?.method || 'GET').toUpperCase();
    const baseURL = String(error?.config?.baseURL || '').replace(/\/+$/, '');
    const path = String(error?.config?.url || '');
    const requestUrl = baseURL ? `${baseURL}${path}` : path;
    const code = error?.code || error?.cause?.code || '';
    const message = extractErrorMessage(error, 'OAuth authorize URL fetch failed');

    if (requestUrl) {
        return `请求 ${method} ${requestUrl} 失败（${code || message}），请检查后端服务是否启动、网络连通性，以及 OPENMCP_API_BASE_URL 配置是否正确。`;
    }
    return `${message}，请检查后端服务是否启动、网络连通性，以及 OPENMCP_API_BASE_URL 配置是否正确。`;
}

export class AuthController {
    @Controller('auth/register')
    async register(data: RequestData, webview: PostMessageble) {
        const { email, username, password } = data;
        if (!email || !username || !password) {
            return {
                code: 400,
                msg: 'Email, username and password are required'
            };
        }

        try {
            const result = await apiRegister(String(email), String(username), String(password));
            return {
                code: 200,
                msg: 'ok',
                data: {
                    token: result.token,
                    user: result.user,
                    expiresAt: result.expiresAt
                }
            };
        } catch (error: any) {
            return {
                code: error.response?.status || 500,
                msg: error.response?.data?.message || error.message || 'Register failed'
            };
        }
    }

    @Controller('auth/login')
    async login(data: RequestData, webview: PostMessageble) {
        const { username, password } = data;
        
        if (!username || !password) {
            return {
                code: 400,
                msg: 'Username and password are required'
            };
        }

        try {
            const result = await apiLogin(username, password);
            return {
                code: 200,
                msg: 'ok',
                data: {
                    token: result.token,
                    user: result.user,
                    expiresAt: result.expiresAt
                }
            };
        } catch (error: any) {
            return {
                code: error.response?.status || 500,
                msg: error.response?.data?.message || error.message || 'Login failed'
            };
        }
    }

    @Controller('auth/oauth')
    async oauth(data: RequestData, webview: PostMessageble) {
        const { channel, redirectUri } = data;
        if (!channel) {
            return {
                code: 400,
                msg: 'OAuth channel is required'
            };
        }
        try {
            const result = await apiGetOAuthAuthorizeUrl(channel, redirectUri);
            return {
                code: 200,
                msg: 'ok',
                data: result
            };
        } catch (error: any) {
            return {
                code: error.response?.status || 500,
                msg: buildOAuthFriendlyError(error)
            };
        }
    }

    @Controller('auth/logout')
    async logout(data: RequestData, webview: PostMessageble) {
        try {
            await apiLogout();
            return {
                code: 200,
                msg: 'Logged out successfully'
            };
        } catch (error: any) {
            // 即使 API 调用失败，也清理本地 token
            clearToken();
            return {
                code: 200,
                msg: 'Logged out (local)'
            };
        }
    }

    @Controller('auth/logout-all')
    async logoutAll(data: RequestData, webview: PostMessageble) {
        try {
            await apiLogoutAll();
            return {
                code: 200,
                msg: 'Logged out all sessions successfully'
            };
        } catch (error: any) {
            clearToken();
            return {
                code: 200,
                msg: 'Logged out all sessions (local)'
            };
        }
    }

    @Controller('auth/status')
    async status(data: RequestData, webview: PostMessageble): Promise<RestfulResponse> {
        try {
            const result = await apiCheckAuthStatus();
            return {
                code: 200,
                msg: 'ok',
                data: result
            };
        } catch (error: any) {
            // 如果请求失败，检查本地是否有 token
            if (isLoggedIn()) {
                return {
                    code: 200,
                    msg: 'ok',
                    data: {
                        loggedIn: true,
                        note: 'Local token exists, but API unreachable'
                    }
                };
            }
            return {
                code: 200,
                msg: 'ok',
                data: {
                    loggedIn: false
                }
            };
        }
    }

    @Controller('auth/refresh')
    async refresh(data: RequestData, webview: PostMessageble) {
        try {
            const result = await apiRefreshToken();
            return {
                code: 200,
                msg: 'ok',
                data: {
                    token: result.token,
                    user: result.user,
                    expiresAt: result.expiresAt
                }
            };
        } catch (error: any) {
            return {
                code: error.response?.status || 500,
                msg: error.response?.data?.message || error.message || 'Token refresh failed'
            };
        }
    }

    @Controller('auth/oauth/finalize')
    async oauthFinalize(data: RequestData, webview: PostMessageble) {
        const { nonce } = data;
        if (!nonce) {
            return {
                code: 400,
                msg: 'nonce is required'
            };
        }
        try {
            const result = await oauthFinalizeByNonce(String(nonce));
            return {
                code: 200,
                msg: 'ok',
                data: result
            };
        } catch (error: any) {
            return {
                code: error.response?.status || 500,
                msg: error.response?.data?.message || error.message || 'OAuth finalize failed'
            };
        }
    }

    @Controller('auth/set-token-pair')
    async setTokenPairController(data: RequestData, webview: PostMessageble) {
        const { accessToken, refreshToken, user } = data;
        if (!accessToken || !refreshToken) {
            return {
                code: 400,
                msg: 'accessToken and refreshToken are required'
            };
        }
        try {
            setTokenPairFromExternal({
                accessToken: String(accessToken),
                refreshToken: String(refreshToken),
                user: user ?? null
            });
            return {
                code: 200,
                msg: 'Token pair set successfully'
            };
        } catch (error: any) {
            return {
                code: 500,
                msg: error?.message || 'Set token pair failed'
            };
        }
    }

    @Controller('auth/device/start')
    async deviceStart(data: RequestData, webview: PostMessageble) {
        const { channel } = data;
        if (!channel) {
            return {
                code: 400,
                msg: 'channel is required'
            };
        }

        try {
            const result = await apiStartDeviceAuth(String(channel));
            return {
                code: 200,
                msg: 'ok',
                data: result
            };
        } catch (error: any) {
            return {
                code: error.response?.status || 500,
                msg: error.response?.data?.message || error.message || 'Device start failed'
            };
        }
    }

    @Controller('auth/device/token')
    async deviceToken(data: RequestData, webview: PostMessageble) {
        const { deviceCode } = data;
        if (!deviceCode) {
            return {
                code: 400,
                msg: 'deviceCode is required'
            };
        }

        try {
            const result = await apiPollDeviceToken(String(deviceCode));
            return {
                code: 200,
                msg: 'ok',
                data: {
                    token: result.token,
                    user: result.user,
                    expiresAt: result.expiresAt
                }
            };
        } catch (error: any) {
            // pending: 后端返回 202 + message；axios 会走这里
            return {
                code: error.response?.status || 500,
                msg: error.response?.data?.message || error.message || 'Device token poll failed'
            };
        }
    }

    @Controller('auth/set-token')
    async setToken(data: RequestData, webview: PostMessageble) {
        const { token } = data;
        
        if (!token) {
            return {
                code: 400,
                msg: 'Token is required'
            };
        }

        setToken(token);
        return {
            code: 200,
            msg: 'Token set successfully'
        };
    }

    @Controller('auth/get-token')
    async getTokenController(data: RequestData, webview: PostMessageble): Promise<RestfulResponse> {
        const token = getToken();
        return {
            code: 200,
            msg: 'ok',
            data: {
                hasToken: !!token,
                token: token ? token.substring(0, 20) + '...' : null
            }
        };
    }

    @Controller('auth/clear-token')
    async clearTokenController(data: RequestData, webview: PostMessageble) {
        clearToken();
        return {
            code: 200,
            msg: 'Token cleared successfully'
        };
    }
}
