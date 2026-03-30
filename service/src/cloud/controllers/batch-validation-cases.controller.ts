import { Controller } from '../../common/index.js';
import type { PostMessageble } from '../../hook/adapter.js';
import type { RequestData } from '../../common/index.dto.js';
import {
  createBatchValidationCase,
  listBatchValidationCases,
  getBatchValidationCase,
  updateBatchValidationCase,
  deleteBatchValidationCase
} from '../batch-validation-cases.client.js';

function getErrorMessage(error: any, fallback: string): string {
  const msg =
    error?.response?.data?.message ||
    error?.message ||
    error?.code ||
    error?.cause?.code;
  return typeof msg === 'string' && msg.trim() ? msg : fallback;
}

export class BatchValidationCasesController {
  @Controller('batch-validation-cases/create')
  async create(data: RequestData, _webview: PostMessageble) {
    const { projectId, name, description, testCasesJSON, presetsJSON, resultGroupsJSON } = data;
    if (!projectId || !name) {
      return { code: 400, msg: 'projectId/name are required' };
    }

    try {
      const resp = await createBatchValidationCase({
        projectId: String(projectId),
        name: String(name),
        description: typeof description === 'string' ? description : undefined,
        testCasesJSON: typeof testCasesJSON === 'string' ? testCasesJSON : undefined,
        presetsJSON: typeof presetsJSON === 'string' ? presetsJSON : undefined,
        resultGroupsJSON: typeof resultGroupsJSON === 'string' ? resultGroupsJSON : undefined
      });
      return { code: 200, msg: 'ok', data: resp.data };
    } catch (error: any) {
      return { code: error?.response?.status || 500, msg: getErrorMessage(error, 'Create batch-validation case failed') };
    }
  }

  @Controller('batch-validation-cases/list')
  async list(data: RequestData, _webview: PostMessageble) {
    const { projectId } = data;
    if (!projectId) {
      return { code: 400, msg: 'projectId is required' };
    }

    try {
      const resp = await listBatchValidationCases(String(projectId));
      return { code: 200, msg: 'ok', data: resp.data };
    } catch (error: any) {
      return { code: error?.response?.status || 500, msg: getErrorMessage(error, 'List batch-validation cases failed') };
    }
  }

  @Controller('batch-validation-cases/get')
  async get(data: RequestData, _webview: PostMessageble) {
    const { projectId, caseId } = data;
    if (!projectId || !caseId) {
      return { code: 400, msg: 'projectId/caseId are required' };
    }

    try {
      const resp = await getBatchValidationCase(String(projectId), String(caseId));
      return { code: 200, msg: 'ok', data: resp.data };
    } catch (error: any) {
      return { code: error?.response?.status || 500, msg: getErrorMessage(error, 'Get batch-validation case failed') };
    }
  }

  @Controller('batch-validation-cases/update')
  async update(data: RequestData, _webview: PostMessageble) {
    const { projectId, caseId, name, description, testCasesJSON, presetsJSON, resultGroupsJSON } = data;
    if (!projectId || !caseId || !name) {
      return { code: 400, msg: 'projectId/caseId/name are required' };
    }

    try {
      const resp = await updateBatchValidationCase({
        projectId: String(projectId),
        caseId: String(caseId),
        name: String(name),
        description: typeof description === 'string' ? description : undefined,
        testCasesJSON: typeof testCasesJSON === 'string' ? testCasesJSON : undefined,
        presetsJSON: typeof presetsJSON === 'string' ? presetsJSON : undefined,
        resultGroupsJSON: typeof resultGroupsJSON === 'string' ? resultGroupsJSON : undefined
      });
      return { code: 200, msg: 'ok', data: resp.data };
    } catch (error: any) {
      return { code: error?.response?.status || 500, msg: getErrorMessage(error, 'Update batch-validation case failed') };
    }
  }

  @Controller('batch-validation-cases/delete')
  async remove(data: RequestData, _webview: PostMessageble) {
    const { projectId, caseId } = data;
    if (!projectId || !caseId) {
      return { code: 400, msg: 'projectId/caseId are required' };
    }

    try {
      const resp = await deleteBatchValidationCase(String(projectId), String(caseId));
      return { code: 200, msg: 'ok', data: resp.data };
    } catch (error: any) {
      return { code: error?.response?.status || 500, msg: getErrorMessage(error, 'Delete batch-validation case failed') };
    }
  }
}
