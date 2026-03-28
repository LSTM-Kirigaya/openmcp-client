export interface CloudApiResponse<T> {
    code: number;
    message: string;
    data: T;
}

type AccessTokenGetter = () => string | undefined;

let accessTokenGetter: AccessTokenGetter = () => undefined;

export function registerCloudAccessTokenGetter(getter: AccessTokenGetter) {
    accessTokenGetter = getter;
}

function getCloudApiBase(): string {
    const envBase = import.meta.env.VITE_CLOUD_API_BASE;
    if (typeof envBase === 'string' && envBase.trim()) {
        return envBase.trim().replace(/\/+$/, '');
    }
    return 'http://localhost:8000/api/v1';
}

function normalizeMessage(payload: any): string {
    if (typeof payload?.message === 'string' && payload.message.trim()) {
        return payload.message;
    }
    if (typeof payload?.msg === 'string' && payload.msg.trim()) {
        return payload.msg;
    }
    return 'Request failed';
}

export async function cloudRequest<T>(
    path: string,
    init: RequestInit = {},
    options?: { auth?: boolean }
): Promise<CloudApiResponse<T>> {
    const authRequired = options?.auth !== false;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(init.headers as Record<string, string> | undefined)
    };

    if (authRequired) {
        const token = accessTokenGetter();
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }
    }

    const response = await fetch(`${getCloudApiBase()}${path}`, {
        ...init,
        headers
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || typeof payload.code !== 'number') {
        throw new Error(normalizeMessage(payload) || `HTTP ${response.status}`);
    }
    if (payload.code !== 0) {
        throw new Error(normalizeMessage(payload));
    }

    return payload as CloudApiResponse<T>;
}
