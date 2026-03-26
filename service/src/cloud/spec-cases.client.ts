import { createApiClient } from './http-client.js';
import type { BackendCommonResponse, SpecCase } from './types.js';

export async function createSpecCase(params: {
  projectId: string;
  parentId?: string;
  nodeType: string;
  type: string;
  name: string;
  input?: string;
  output?: string;
}): Promise<BackendCommonResponse<SpecCase>> {
  const client = createApiClient();
  const { projectId, parentId, nodeType, type, name, input, output } = params;

  const body: any = {
    node_type: nodeType,
    type,
    name
  };
  if (parentId !== undefined) body.parent_id = parentId;
  if (input !== undefined) body.input = input;
  if (output !== undefined) body.output = output;

  return (await client.post<BackendCommonResponse<SpecCase>>(
    `/projects/${encodeURIComponent(projectId)}/spec-cases`,
    body
  )).data;
}

export async function getSpecCaseTree(params: {
  projectId: string;
}): Promise<BackendCommonResponse<SpecCase[]>> {
  const client = createApiClient();
  const { projectId } = params;
  return (await client.get<BackendCommonResponse<SpecCase[]>>(
    `/projects/${encodeURIComponent(projectId)}/spec-cases`
  )).data;
}

export async function getSpecCase(params: {
  projectId: string;
  caseId: string;
}): Promise<BackendCommonResponse<SpecCase>> {
  const client = createApiClient();
  const { projectId, caseId } = params;
  return (await client.get<BackendCommonResponse<SpecCase>>(
    `/projects/${encodeURIComponent(projectId)}/spec-cases/${encodeURIComponent(caseId)}`
  )).data;
}

export async function updateSpecCase(params: {
  projectId: string;
  caseId: string;
  parentId?: string;
  nodeType: string;
  type: string;
  name: string;
  input?: string;
  output?: string;
}): Promise<BackendCommonResponse<SpecCase>> {
  const client = createApiClient();
  const { projectId, caseId, parentId, nodeType, type, name, input, output } = params;

  const body: any = {
    node_type: nodeType,
    type,
    name
  };
  if (parentId !== undefined) body.parent_id = parentId;
  if (input !== undefined) body.input = input;
  if (output !== undefined) body.output = output;

  return (await client.put<BackendCommonResponse<SpecCase>>(
    `/projects/${encodeURIComponent(projectId)}/spec-cases/${encodeURIComponent(caseId)}`,
    body
  )).data;
}

export async function deleteSpecCase(params: {
  projectId: string;
  caseId: string;
}): Promise<BackendCommonResponse> {
  const client = createApiClient();
  const { projectId, caseId } = params;
  return (await client.delete<BackendCommonResponse>(
    `/projects/${encodeURIComponent(projectId)}/spec-cases/${encodeURIComponent(caseId)}`
  )).data;
}

