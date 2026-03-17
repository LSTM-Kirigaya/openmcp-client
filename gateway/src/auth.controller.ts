import { Controller } from "../common/index.js";
import { PostMessageble } from "../hook/adapter.js";
import { RequestData } from "../common/index.dto.js";
import {
    login as apiLogin,
    logout as apiLogout,
    checkAuthStatus as apiCheckAuthStatus,
    refreshToken as apiRefreshToken,
    getToken,
    setToken,
    clearToken,
    isLoggedIn
} from "../web/auth.js";

export class AuthController {

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
                msg: {
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

    @Controller('auth/status')
    async status(data: RequestData, webview: PostMessageble) {
        try {
            const result = await apiCheckAuthStatus();
            return {
                code: 200,
                msg: result
            };
        } catch (error: any) {
            // 如果请求失败，检查本地是否有 token
            if (isLoggedIn()) {
                return {
                    code: 200,
                    msg: {
                        loggedIn: true,
                        note: 'Local token exists, but API unreachable'
                    }
                };
            }
            return {
                code: 200,
                msg: {
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
                msg: {
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
    async getTokenController(data: RequestData, webview: PostMessageble) {
        const token = getToken();
        return {
            code: 200,
            msg: {
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
