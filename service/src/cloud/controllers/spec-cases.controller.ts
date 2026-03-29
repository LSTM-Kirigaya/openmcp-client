import { Controller } from '../../common/index.js';
import type { PostMessageble } from '../../hook/adapter.js';
import type { RequestData } from '../../common/index.dto.js';
import type { SpecCase } from '../types.js';
import { createSpecCase, getSpecCaseTree, getSpecCase, updateSpecCase, deleteSpecCase } from '../spec-cases.client.js';

function getErrorMessage(error: any, fallback: string): string {
  const msg =
    error?.response?.data?.message ||
    error?.message ||
    error?.code ||
    error?.cause?.code;
  return typeof msg === 'string' && msg.trim() ? msg : fallback;
}

export class SpecCasesController {
  @Controller('spec-cases/create')
  async create(data: RequestData, _webview: PostMessageble) {
    const { projectId, nodeType, type, name, parentId, input, output, description } = data;
    if (!projectId || !nodeType || !type || !name) {
      return { code: 400, msg: 'projectId/nodeType/type/name are required' };
    }

    try {
      const resp = await createSpecCase({
        projectId: String(projectId),
        nodeType: String(nodeType),
        type: String(type),
        name: String(name),
        parentId: parentId === undefined ? undefined : String(parentId),
        input: typeof input === 'string' ? input : undefined,
        output: typeof output === 'string' ? output : undefined,
        description: typeof description === 'string' ? description : undefined
      });
      return { code: 200, msg: 'ok', data: resp.data as SpecCase };
    } catch (error: any) {
      return { code: error?.response?.status || 500, msg: getErrorMessage(error, 'Create spec-cases failed') };
    }
  }

  @Controller('spec-cases/tree')
  async tree(data: RequestData, _webview: PostMessageble) {
    const { projectId } = data;
    if (!projectId) return { code: 400, msg: 'projectId is required' };
    try {
      const resp = await getSpecCaseTree({ projectId: String(projectId) });
      return { code: 200, msg: 'ok', data: resp.data };
    } catch (error: any) {
      return { code: error?.response?.status || 500, msg: getErrorMessage(error, 'Get spec-cases tree failed') };
    }
  }

  @Controller('spec-cases/get')
  async get(data: RequestData, _webview: PostMessageble) {
    const { projectId, caseId } = data;
    if (!projectId || !caseId) return { code: 400, msg: 'projectId/caseId are required' };
    try {
      const resp = await getSpecCase({ projectId: String(projectId), caseId: String(caseId) });
      return { code: 200, msg: 'ok', data: resp.data };
    } catch (error: any) {
      return { code: error?.response?.status || 500, msg: getErrorMessage(error, 'Get spec-case failed') };
    }
  }

  @Controller('spec-cases/update')
  async update(data: RequestData, _webview: PostMessageble) {
    const { projectId, caseId, parentId, nodeType, type, name, input, output, description } = data;
    if (!projectId || !caseId || !nodeType || !type || !name) {
      return { code: 400, msg: 'projectId/caseId/nodeType/type/name are required' };
    }

    try {
      const resp = await updateSpecCase({
        projectId: String(projectId),
        caseId: String(caseId),
        parentId: parentId === undefined ? undefined : String(parentId),
        nodeType: String(nodeType),
        type: String(type),
        name: String(name),
        input: typeof input === 'string' ? input : undefined,
        output: typeof output === 'string' ? output : undefined,
        description: typeof description === 'string' ? description : undefined
      });
      return { code: 200, msg: 'ok', data: resp.data };
    } catch (error: any) {
      return { code: error?.response?.status || 500, msg: getErrorMessage(error, 'Update spec-case failed') };
    }
  }

  @Controller('spec-cases/delete')
  async delete(data: RequestData, _webview: PostMessageble) {
    const { projectId, caseId } = data;
    if (!projectId || !caseId) return { code: 400, msg: 'projectId/caseId are required' };
    try {
      const resp = await deleteSpecCase({ projectId: String(projectId), caseId: String(caseId) });
      return { code: 200, msg: 'ok', data: resp.data };
    } catch (error: any) {
      return { code: error?.response?.status || 500, msg: getErrorMessage(error, 'Delete spec-case failed') };
    }
  }
}

