/**
 * 用户认证 Controller
 * 处理登录、注册、登出等请求
 */

import { Controller } from '../common/index.js';
import { PostMessageble } from '../hook/adapter.js';
import { RequestData } from '../common/index.dto.js';
import { authService } from './auth.service.js';
import { LoginRequest, RegisterRequest, UpdateProfileRequest } from './auth.dto.js';

export class AuthController {

    /**
     * 检查认证配置状态
     */
    @Controller('auth/status')
    async getStatus(data: RequestData, webview: PostMessageble) {
        const state = authService.getState();
        const isConfigured = authService.isConfigured();

        return {
            code: 200,
            msg: {
                isConfigured,
                isLoggedIn: state.isLoggedIn,
                user: state.user
            }
        };
    }

    /**
     * 用户注册
     */
    @Controller('auth/register')
    async register(data: RequestData, webview: PostMessageble) {
        try {
            const request: RegisterRequest = data as unknown as RegisterRequest;
            const response = await authService.register(request);

            return {
                code: 200,
                msg: {
                    success: true,
                    user: response.user,
                    message: 'Registration successful'
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
     * 用户登录
     */
    @Controller('auth/login')
    async login(data: RequestData, webview: PostMessageble) {
        try {
            const request: LoginRequest = data as unknown as LoginRequest;
            const response = await authService.login(request);

            return {
                code: 200,
                msg: {
                    success: true,
                    user: response.user,
                    message: 'Login successful'
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
     * 用户登出
     */
    @Controller('auth/logout')
    async logout(data: RequestData, webview: PostMessageble) {
        try {
            await authService.logout();

            return {
                code: 200,
                msg: {
                    success: true,
                    message: 'Logout successful'
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
     * 获取当前用户信息
     */
    @Controller('auth/me')
    async getCurrentUser(data: RequestData, webview: PostMessageble) {
        try {
            const user = await authService.getCurrentUser();
            const state = authService.getState();

            return {
                code: 200,
                msg: {
                    isLoggedIn: state.isLoggedIn,
                    user
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
     * 更新用户资料
     */
    @Controller('auth/update-profile')
    async updateProfile(data: RequestData, webview: PostMessageble) {
        try {
            const request: UpdateProfileRequest = data as unknown as UpdateProfileRequest;
            const user = await authService.updateProfile(request);

            return {
                code: 200,
                msg: {
                    success: true,
                    user,
                    message: 'Profile updated successfully'
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
     * 刷新 Session
     */
    @Controller('auth/refresh')
    async refreshSession(data: RequestData, webview: PostMessageble) {
        try {
            const response = await authService.refreshSession();

            return {
                code: 200,
                msg: {
                    success: true,
                    user: response.user
                }
            };
        } catch (error) {
            return {
                code: 401,
                msg: {
                    success: false,
                    error: (error as Error).message
                }
            };
        }
    }
}
