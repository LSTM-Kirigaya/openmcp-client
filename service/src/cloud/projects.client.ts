import { createApiClient } from './http-client.js';
import type { BackendCommonResponse, Project } from './types.js';

export async function createProject(name: string): Promise<BackendCommonResponse<Project>> {
  const client = createApiClient();
  return (await client.post<BackendCommonResponse<Project>>('/projects', { name })).data;
}

export async function listProjects(): Promise<BackendCommonResponse<Project[]>> {
  const client = createApiClient();
  return (await client.get<BackendCommonResponse<Project[]>>('/projects')).data;
}

export async function getProject(id: string): Promise<BackendCommonResponse<Project>> {
  const client = createApiClient();
  return (await client.get<BackendCommonResponse<Project>>(`/projects/${encodeURIComponent(id)}`)).data;
}

export async function updateProject(id: string, name: string): Promise<BackendCommonResponse<Project>> {
  const client = createApiClient();
  return (await client.put<BackendCommonResponse<Project>>(`/projects/${encodeURIComponent(id)}`, { name })).data;
}

export async function deleteProject(id: string): Promise<BackendCommonResponse> {
  const client = createApiClient();
  // 后端 DELETE 不要求 body
  return (await client.delete<BackendCommonResponse>(`/projects/${encodeURIComponent(id)}`)).data;
}

