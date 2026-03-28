import { createApiClient } from './http-client.js';
import type { BackendCommonResponse, ProjectMember } from './types.js';

export async function listProjectMembers(projectId: string): Promise<BackendCommonResponse<ProjectMember[]>> {
  const client = createApiClient();
  return (await client.get<BackendCommonResponse<ProjectMember[]>>(`/projects/${encodeURIComponent(projectId)}/members`)).data;
}

export async function addProjectMember(params: {
  projectId: string;
  operatorId: string;
  userId: string;
  role: string;
}): Promise<BackendCommonResponse<ProjectMember>> {
  const client = createApiClient();
  const { projectId, operatorId, userId, role } = params;
  return (await client.post<BackendCommonResponse<ProjectMember>>(`/projects/${encodeURIComponent(projectId)}/members`, {
    operator_id: operatorId,
    user_id: userId,
    role
  })).data;
}

export async function removeProjectMember(params: {
  projectId: string;
  operatorId: string;
  userId: string;
}): Promise<BackendCommonResponse> {
  const client = createApiClient();
  const { projectId, operatorId, userId } = params;
  return (await client.delete<BackendCommonResponse>(`/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`, {
    data: { operator_id: operatorId }
  })).data;
}

export async function updateProjectMemberRole(params: {
  projectId: string;
  operatorId: string;
  userId: string;
  role: string;
}): Promise<BackendCommonResponse<ProjectMember>> {
  const client = createApiClient();
  const { projectId, operatorId, userId, role } = params;
  return (await client.put<BackendCommonResponse<ProjectMember>>(
    `/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}/role`,
    { operator_id: operatorId, role }
  )).data;
}

