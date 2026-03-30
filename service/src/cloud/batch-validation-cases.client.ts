import { createApiClient } from './http-client.js';
import type { BackendCommonResponse, BatchValidationCase } from './types.js';

export type BatchValidationCaseCreatePayload = {
  projectId: string;
  name: string;
  description?: string;
  testCasesJSON?: string;
  presetsJSON?: string;
  resultGroupsJSON?: string;
};

export type BatchValidationCaseUpdatePayload = {
  projectId: string;
  caseId: string;
  name: string;
  description?: string;
  testCasesJSON?: string;
  presetsJSON?: string;
  resultGroupsJSON?: string;
};

export async function createBatchValidationCase(
  payload: BatchValidationCaseCreatePayload
): Promise<BackendCommonResponse<BatchValidationCase>> {
  const client = createApiClient();
  const body: Record<string, unknown> = {
    name: payload.name
  };
  if (payload.description !== undefined) body.description = payload.description;
  if (payload.testCasesJSON !== undefined) body.test_cases_json = payload.testCasesJSON;
  if (payload.presetsJSON !== undefined) body.presets_json = payload.presetsJSON;
  if (payload.resultGroupsJSON !== undefined) body.result_groups_json = payload.resultGroupsJSON;

  return (await client.post<BackendCommonResponse<BatchValidationCase>>(
    `/projects/${encodeURIComponent(payload.projectId)}/batch-validation-cases`,
    body
  )).data;
}

export async function listBatchValidationCases(projectId: string): Promise<BackendCommonResponse<BatchValidationCase[]>> {
  const client = createApiClient();
  return (await client.get<BackendCommonResponse<BatchValidationCase[]>>(
    `/projects/${encodeURIComponent(projectId)}/batch-validation-cases`
  )).data;
}

export async function getBatchValidationCase(projectId: string, caseId: string): Promise<BackendCommonResponse<BatchValidationCase>> {
  const client = createApiClient();
  return (await client.get<BackendCommonResponse<BatchValidationCase>>(
    `/projects/${encodeURIComponent(projectId)}/batch-validation-cases/${encodeURIComponent(caseId)}`
  )).data;
}

export async function updateBatchValidationCase(
  payload: BatchValidationCaseUpdatePayload
): Promise<BackendCommonResponse<BatchValidationCase>> {
  const client = createApiClient();
  const body: Record<string, unknown> = {
    name: payload.name
  };
  if (payload.description !== undefined) body.description = payload.description;
  if (payload.testCasesJSON !== undefined) body.test_cases_json = payload.testCasesJSON;
  if (payload.presetsJSON !== undefined) body.presets_json = payload.presetsJSON;
  if (payload.resultGroupsJSON !== undefined) body.result_groups_json = payload.resultGroupsJSON;

  return (await client.put<BackendCommonResponse<BatchValidationCase>>(
    `/projects/${encodeURIComponent(payload.projectId)}/batch-validation-cases/${encodeURIComponent(payload.caseId)}`,
    body
  )).data;
}

export async function deleteBatchValidationCase(projectId: string, caseId: string): Promise<BackendCommonResponse> {
  const client = createApiClient();
  return (await client.delete<BackendCommonResponse>(
    `/projects/${encodeURIComponent(projectId)}/batch-validation-cases/${encodeURIComponent(caseId)}`
  )).data;
}
