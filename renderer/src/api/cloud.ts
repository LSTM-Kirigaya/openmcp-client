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
    tool_name?: string;
    name: string;
    input?: string;
    output?: string;
    description?: string;
    children?: CloudSpecCase[];
}

export interface CloudBatchValidationCase {
    id: string;
    project_id: string;
    name: string;
    description?: string;
    test_cases_json?: string;
    presets_json?: string;
    result_groups_json?: string;
    created_at?: string;
    updated_at?: string;
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

export interface CloudProjectMember {
    id: string;
    project_id: string;
    user_id: string;
    role: string;
    created_at?: string;
    updated_at?: string;
    user?: {
        id: string;
        username: string;
        email?: string;
        avatar_url?: string | null;
    };
}

export interface CloudProjectInvite {
    id: string;
    project_id: string;
    invite_code: string;
    creator_id: string;
    role: string;
    expires_at?: string | null;
    max_uses?: number | null;
    use_count?: number | null;
    is_revoked?: boolean | null;
    created_at?: string;
    updated_at?: string;
}

export async function cloudListProjectMembers(projectId: string) {
    return await requestCommand<CloudProjectMember[]>('projects/members/list', { projectId });
}

export async function cloudAddProjectMember(projectId: string, userId: string, role: string) {
    return await requestCommand<CloudProjectMember>('projects/members/add', { projectId, userId, role });
}

export async function cloudRemoveProjectMember(projectId: string, userId: string) {
    await requestCommand('projects/members/remove', { projectId, userId });
}

export async function cloudUpdateProjectMemberRole(projectId: string, userId: string, role: string) {
    return await requestCommand<CloudProjectMember>('projects/members/update-role', { projectId, userId, role });
}

export async function cloudListProjectInvites(projectId: string) {
    return await requestCommand<CloudProjectInvite[]>('projects/invites/list', { projectId });
}

export async function cloudCreateProjectInvite(
    projectId: string,
    input: { role: string; expiresAt?: string; maxUses?: number }
) {
    return await requestCommand<CloudProjectInvite>('projects/invites/create', {
        projectId,
        role: input.role,
        expiresAt: input.expiresAt,
        maxUses: input.maxUses
    });
}

export async function cloudDeleteProjectInvite(projectId: string, inviteId: string) {
    await requestCommand('projects/invites/delete', { projectId, inviteId });
}

export async function cloudRevokeProjectInvite(projectId: string, inviteId: string) {
    await requestCommand('projects/invites/revoke', { projectId, inviteId });
}

export async function cloudGetSpecCaseTree(projectId: string) {
    return await requestCommand<CloudSpecCase[]>('spec-cases/tree', { projectId });
}

export async function cloudCreateSpecCase(projectId: string, input: Partial<CloudSpecCase> & { node_type: 'folder' | 'case'; type: string; name: string }) {
    return await requestCommand<CloudSpecCase>('spec-cases/create', {
        projectId,
        nodeType: input.node_type,
        type: input.type,
        toolName: input.tool_name,
        name: input.name,
        parentId: input.parent_id,
        input: input.input,
        output: input.output,
        description: input.description ?? ''
    });
}

export async function cloudUpdateSpecCase(projectId: string, caseId: string, input: Partial<CloudSpecCase> & { node_type: 'folder' | 'case'; type: string; name: string }) {
    return await requestCommand<CloudSpecCase>('spec-cases/update', {
        projectId,
        caseId,
        nodeType: input.node_type,
        type: input.type,
        toolName: input.tool_name,
        name: input.name,
        parentId: input.parent_id,
        input: input.input,
        output: input.output,
        description: input.description ?? ''
    });
}

export async function cloudDeleteSpecCase(projectId: string, caseId: string) {
    await requestCommand('spec-cases/delete', { projectId, caseId });
}

export async function cloudListBatchValidationCases(projectId: string) {
    return await requestCommand<CloudBatchValidationCase[]>('batch-validation-cases/list', { projectId });
}

export async function cloudGetBatchValidationCase(projectId: string, caseId: string) {
    return await requestCommand<CloudBatchValidationCase>('batch-validation-cases/get', { projectId, caseId });
}

export async function cloudCreateBatchValidationCase(projectId: string, input: {
    name: string;
    description?: string;
    test_cases_json?: string;
    presets_json?: string;
    result_groups_json?: string;
}) {
    return await requestCommand<CloudBatchValidationCase>('batch-validation-cases/create', {
        projectId,
        name: input.name,
        description: input.description,
        testCasesJSON: input.test_cases_json,
        presetsJSON: input.presets_json,
        resultGroupsJSON: input.result_groups_json
    });
}

export async function cloudUpdateBatchValidationCase(projectId: string, caseId: string, input: {
    name: string;
    description?: string;
    test_cases_json?: string;
    presets_json?: string;
    result_groups_json?: string;
}) {
    return await requestCommand<CloudBatchValidationCase>('batch-validation-cases/update', {
        projectId,
        caseId,
        name: input.name,
        description: input.description,
        testCasesJSON: input.test_cases_json,
        presetsJSON: input.presets_json,
        resultGroupsJSON: input.result_groups_json
    });
}

export async function cloudDeleteBatchValidationCase(projectId: string, caseId: string) {
    await requestCommand('batch-validation-cases/delete', { projectId, caseId });
}
