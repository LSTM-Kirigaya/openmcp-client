import { createApiClient } from './http-client.js';
import type { BackendCommonResponse, Project } from './types.js';

/** 与后端 PUT /projects/:id 部分更新字段一致 */
export type ProjectUpdatePayload = {
  name?: string;
  transport?: string;
  endpoint?: string;
  description?: string;
  enabled?: boolean;
};

/** 与后端 POST /projects 创建字段一致（name/transport/endpoint 必填由服务端校验） */
export type ProjectCreatePayload = {
  name: string;
  transport: string;
  endpoint: string;
  description?: string;
  enabled?: boolean;
};

export async function createProject(payload: ProjectCreatePayload): Promise<BackendCommonResponse<Project>> {
  const client = createApiClient();
  return (await client.post<BackendCommonResponse<Project>>('/projects', payload)).data;
}

export async function listProjects(): Promise<BackendCommonResponse<Project[]>> {
  const client = createApiClient();
  return (await client.get<BackendCommonResponse<Project[]>>('/projects')).data;
}

export async function getProject(id: string): Promise<BackendCommonResponse<Project>> {
  const client = createApiClient();
  return (await client.get<BackendCommonResponse<Project>>(`/projects/${encodeURIComponent(id)}`)).data;
}

export async function updateProject(
  id: string,
  patch: ProjectUpdatePayload
): Promise<BackendCommonResponse<Project>> {
  const client = createApiClient();
  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.transport !== undefined) body.transport = patch.transport;
  if (patch.endpoint !== undefined) body.endpoint = patch.endpoint;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.enabled !== undefined) body.enabled = patch.enabled;
  return (await client.put<BackendCommonResponse<Project>>(`/projects/${encodeURIComponent(id)}`, body)).data;
}

export async function deleteProject(id: string): Promise<BackendCommonResponse> {
  const client = createApiClient();
  // 后端 DELETE 不要求 body
  return (await client.delete<BackendCommonResponse>(`/projects/${encodeURIComponent(id)}`)).data;
}

