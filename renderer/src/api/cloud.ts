import { cloudRequest } from './cloud-http';

export interface CloudUser {
    id: string;
    email: string;
    username: string;
}

export interface CloudTokenPair {
    access_token: string;
    refresh_token: string;
}

export interface CloudProject {
    id: string;
    name: string;
    transport: 'stdio' | 'sse' | 'http';
    endpoint: string;
    description?: string;
    enabled: boolean;
    creator_id: string;
    created_at: string;
    updated_at: string;
}

export interface CloudSpecCase {
    id: string;
    project_id: string;
    parent_id?: string;
    node_type: 'folder' | 'case';
    level: number;
    type: string;
    name: string;
    input?: string;
    output?: string;
    children?: CloudSpecCase[];
}

export async function cloudLogin(identifier: string, password: string) {
    const result = await cloudRequest<{ user: CloudUser; tokens: CloudTokenPair }>(
        '/auth/login',
        {
            method: 'POST',
            body: JSON.stringify({ identifier, password })
        },
        { auth: false }
    );
    return result.data;
}

export async function cloudRegister(email: string, username: string, password: string) {
    const result = await cloudRequest<{ user: CloudUser; tokens: CloudTokenPair }>(
        '/auth/register',
        {
            method: 'POST',
            body: JSON.stringify({ email, username, password })
        },
        { auth: false }
    );
    return result.data;
}

export async function cloudRefresh(refreshToken: string) {
    const result = await cloudRequest<{ tokens: CloudTokenPair }>(
        '/auth/refresh',
        {
            method: 'POST',
            body: JSON.stringify({ refresh_token: refreshToken })
        },
        { auth: false }
    );
    return result.data.tokens;
}

export async function cloudLogout(refreshToken: string) {
    await cloudRequest<null>(
        '/auth/logout',
        {
            method: 'POST',
            body: JSON.stringify({ refresh_token: refreshToken })
        },
        { auth: false }
    );
}

export async function cloudGetOAuthUrl(provider: string, redirectUri: string, state?: string) {
    const params = new URLSearchParams();
    params.set('redirect_uri', redirectUri);
    if (state) {
        params.set('state', state);
    }
    const result = await cloudRequest<{ url: string }>(
        `/auth/oauth/${encodeURIComponent(provider)}?${params.toString()}`,
        { method: 'GET' },
        { auth: false }
    );
    return result.data.url;
}

export async function cloudExchangeOAuthNonce(nonce: string) {
    const result = await cloudRequest<{ user: CloudUser; tokens: CloudTokenPair }>(
        `/auth/oauth/tokens?nonce=${encodeURIComponent(nonce)}`,
        { method: 'GET' },
        { auth: false }
    );
    return result.data;
}

export async function cloudListProjects() {
    const result = await cloudRequest<CloudProject[]>('/projects', { method: 'GET' });
    return result.data ?? [];
}

export async function cloudCreateProject(input: Partial<CloudProject> & { name: string; transport: 'stdio' | 'sse' | 'http'; endpoint: string }) {
    const result = await cloudRequest<CloudProject>('/projects', {
        method: 'POST',
        body: JSON.stringify(input)
    });
    return result.data;
}

export async function cloudUpdateProject(id: string, input: Partial<CloudProject> & { name: string; transport: 'stdio' | 'sse' | 'http'; endpoint: string }) {
    const result = await cloudRequest<CloudProject>(`/projects/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input)
    });
    return result.data;
}

export async function cloudDeleteProject(id: string) {
    await cloudRequest<null>(`/projects/${id}`, { method: 'DELETE' });
}

export async function cloudGetSpecCaseTree(projectId: string) {
    const result = await cloudRequest<CloudSpecCase[]>(`/projects/${projectId}/spec-cases`, { method: 'GET' });
    return result.data ?? [];
}

export async function cloudCreateSpecCase(projectId: string, input: Partial<CloudSpecCase> & { node_type: 'folder' | 'case'; type: string; name: string }) {
    const result = await cloudRequest<CloudSpecCase>(`/projects/${projectId}/spec-cases`, {
        method: 'POST',
        body: JSON.stringify(input)
    });
    return result.data;
}

export async function cloudUpdateSpecCase(projectId: string, caseId: string, input: Partial<CloudSpecCase> & { node_type: 'folder' | 'case'; type: string; name: string }) {
    const result = await cloudRequest<CloudSpecCase>(`/projects/${projectId}/spec-cases/${caseId}`, {
        method: 'PUT',
        body: JSON.stringify(input)
    });
    return result.data;
}

export async function cloudDeleteSpecCase(projectId: string, caseId: string) {
    await cloudRequest<null>(`/projects/${projectId}/spec-cases/${caseId}`, { method: 'DELETE' });
}
