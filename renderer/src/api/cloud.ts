import { useMessageBridge } from './message-bridge';

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

async function requestCommand<T>(command: string, payload: Record<string, unknown>): Promise<T> {
    const bridge = useMessageBridge();
    const res = await bridge.commandRequest<T>(command, payload);
    if (res.code !== 200) {
        throw new Error(typeof res.msg === 'string' ? res.msg : 'Request failed');
    }
    return ((res.data ?? res.msg) as T);
}

export async function cloudLogin(identifier: string, password: string) {
    const result = await requestCommand<{
        token: string;
        user: CloudUser;
        expiresAt?: string;
    }>('auth/login', {
        username: identifier,
        password
    });
    return {
        user: result.user
    };
}

export async function cloudRegister(email: string, username: string, password: string) {
    const result = await requestCommand<{
        token: string;
        user: CloudUser;
        expiresAt?: string;
    }>('auth/register', {
        email,
        username,
        password
    });
    return {
        user: result.user
    };
}

export async function cloudRefresh() {
    await requestCommand('auth/refresh', {});
}

export async function cloudLogout() {
    await requestCommand('auth/logout', {});
}

export async function cloudGetOAuthUrl(provider: string, redirectUri: string, _state?: string) {
    const result = await requestCommand<{ channel?: string; authUrl?: string; url?: string }>('auth/oauth', {
        channel: provider,
        redirectUri
    });
    return result.authUrl || result.url || '';
}

export async function cloudExchangeOAuthNonce(nonce: string) {
    const result = await requestCommand<{
        token: string;
        user: CloudUser;
        expiresAt?: string;
    }>('auth/oauth/finalize', { nonce });
    return {
        user: result.user
    };
}

export async function cloudAuthStatus() {
    return await requestCommand<{
        loggedIn: boolean;
        user?: CloudUser;
        username?: string;
        subscriptionTier?: string;
    }>('auth/status', {});
}

export async function cloudListProjects() {
    return await requestCommand<CloudProject[]>('projects/list', {});
}

export async function cloudCreateProject(input: Partial<CloudProject> & { name: string; transport: 'stdio' | 'sse' | 'http'; endpoint: string }) {
    return await requestCommand<CloudProject>('projects/create', {
        name: input.name,
        transport: input.transport,
        endpoint: input.endpoint,
        description: input.description,
        enabled: input.enabled
    });
}

export async function cloudUpdateProject(id: string, input: Partial<CloudProject> & { name: string; transport: 'stdio' | 'sse' | 'http'; endpoint: string }) {
    return await requestCommand<CloudProject>('projects/update', {
        projectId: id,
        name: input.name,
        transport: input.transport,
        endpoint: input.endpoint,
        description: input.description,
        enabled: input.enabled
    });
}

export async function cloudDeleteProject(id: string) {
    await requestCommand('projects/delete', { projectId: id });
}

export async function cloudGetSpecCaseTree(projectId: string) {
    return await requestCommand<CloudSpecCase[]>('spec-cases/tree', { projectId });
}

export async function cloudCreateSpecCase(projectId: string, input: Partial<CloudSpecCase> & { node_type: 'folder' | 'case'; type: string; name: string }) {
    return await requestCommand<CloudSpecCase>('spec-cases/create', {
        projectId,
        nodeType: input.node_type,
        type: input.type,
        name: input.name,
        parentId: input.parent_id,
        input: input.input,
        output: input.output
    });
}

export async function cloudUpdateSpecCase(projectId: string, caseId: string, input: Partial<CloudSpecCase> & { node_type: 'folder' | 'case'; type: string; name: string }) {
    return await requestCommand<CloudSpecCase>('spec-cases/update', {
        projectId,
        caseId,
        nodeType: input.node_type,
        type: input.type,
        name: input.name,
        parentId: input.parent_id,
        input: input.input,
        output: input.output
    });
}

export async function cloudDeleteSpecCase(projectId: string, caseId: string) {
    await requestCommand('spec-cases/delete', { projectId, caseId });
}
