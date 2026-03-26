import { createApiClient } from './http-client.js';
import type { BackendCommonResponse, ProjectInvite } from './types.js';

export async function listProjectInvites(params: {
  projectId: string;
  operatorId: string;
}): Promise<BackendCommonResponse<ProjectInvite[]>> {
  const client = createApiClient();
  const { projectId, operatorId } = params;
  return (await client.get<BackendCommonResponse<ProjectInvite[]>>(
    `/projects/${encodeURIComponent(projectId)}/invites`,
    { params: { operator_id: operatorId } }
  )).data;
}

export async function createProjectInvite(params: {
  projectId: string;
  operatorId: string;
  role: string;
  expiresAt?: string;
  maxUses?: number;
}): Promise<BackendCommonResponse<ProjectInvite>> {
  const client = createApiClient();
  const { projectId, operatorId, role, expiresAt, maxUses } = params;

  const body: any = {
    operator_id: operatorId,
    role
  };
  if (expiresAt) body.expires_at = expiresAt;
  if (typeof maxUses === 'number') body.max_uses = maxUses;

  return (await client.post<BackendCommonResponse<ProjectInvite>>(
    `/projects/${encodeURIComponent(projectId)}/invites`,
    body
  )).data;
}

export async function deleteProjectInvite(params: {
  projectId: string;
  operatorId: string;
  inviteId: string;
}): Promise<BackendCommonResponse> {
  const client = createApiClient();
  const { projectId, operatorId, inviteId } = params;

  return (await client.delete<BackendCommonResponse>(
    `/projects/${encodeURIComponent(projectId)}/invites/${encodeURIComponent(inviteId)}`,
    { data: { operator_id: operatorId } }
  )).data;
}

export async function revokeProjectInvite(params: {
  projectId: string;
  operatorId: string;
  inviteId: string;
}): Promise<BackendCommonResponse> {
  const client = createApiClient();
  const { projectId, operatorId, inviteId } = params;

  return (await client.post<BackendCommonResponse>(
    `/projects/${encodeURIComponent(projectId)}/invites/revoke/${encodeURIComponent(inviteId)}`,
    { operator_id: operatorId }
  )).data;
}

export async function joinProjectByInvite(params: {
  inviteCode: string;
  userId: string;
}): Promise<BackendCommonResponse<ProjectMemberLike>> {
  const client = createApiClient();
  const { inviteCode, userId } = params;

  return (await client.post<BackendCommonResponse<ProjectMemberLike>>(
    `/invites/join`,
    { user_id: userId },
    { params: { code: inviteCode } }
  )).data;
}

// 为了减少额外类型文件：这里只描述 join 返回的数据结构（member 基本字段）
export type ProjectMemberLike = {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  created_at?: string;
  updated_at?: string;
};

