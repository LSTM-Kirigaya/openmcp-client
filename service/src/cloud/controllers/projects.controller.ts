import { Controller } from '../../common/index.js';
import type { PostMessageble } from '../../hook/adapter.js';
import type { RequestData } from '../../common/index.dto.js';
import type { BackendCommonResponse, Project } from '../types.js';
import {
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
  type ProjectUpdatePayload
} from '../projects.client.js';

function getErrorMessage(error: any, fallback: string): string {
  const msg =
    error?.response?.data?.message ||
    error?.message ||
    error?.code ||
    error?.cause?.code;
  return typeof msg === 'string' && msg.trim() ? msg : fallback;
}

export class ProjectsController {
  @Controller('projects/create')
  async create(data: RequestData, _webview: PostMessageble) {
    const { name, transport, endpoint, description, enabled } = data;
    if (!name) {
      return { code: 400, msg: 'Project name is required' };
    }
    // 后端 Create 要求 transport/endpoint 非空；CLI 可给默认，这里同样兜底
    const transportStr =
      transport !== undefined && transport !== null && String(transport).trim() !== ''
        ? String(transport)
        : 'http';
    const endpointStr =
      endpoint !== undefined && endpoint !== null && String(endpoint).trim() !== ''
        ? String(endpoint)
        : 'http://127.0.0.1:0';

    let enabledBool: boolean | undefined;
    if (enabled !== undefined && enabled !== null) {
      if (typeof enabled === 'boolean') enabledBool = enabled;
      else if (enabled === 'true' || enabled === '1') enabledBool = true;
      else if (enabled === 'false' || enabled === '0') enabledBool = false;
    }

    try {
      const resp = await createProject({
        name: String(name),
        transport: transportStr,
        endpoint: endpointStr,
        ...(description !== undefined && description !== null ? { description: String(description) } : {}),
        ...(enabledBool !== undefined ? { enabled: enabledBool } : {})
      });
      return { code: 200, msg: 'ok', data: resp.data };
    } catch (error: any) {
      return { code: error?.response?.status || 500, msg: getErrorMessage(error, 'Create project failed') };
    }
  }

  @Controller('projects/list')
  async list(_data: RequestData, _webview: PostMessageble) {
    try {
      const resp = await listProjects();
      return { code: 200, msg: 'ok', data: resp.data };
    } catch (error: any) {
      return { code: error?.response?.status || 500, msg: getErrorMessage(error, 'List projects failed') };
    }
  }

  @Controller('projects/get')
  async get(data: RequestData, _webview: PostMessageble) {
    const { projectId } = data;
    if (!projectId) {
      return { code: 400, msg: 'projectId is required' };
    }

    try {
      const resp = await getProject(String(projectId));
      return { code: 200, msg: 'ok', data: resp.data };
    } catch (error: any) {
      return { code: error?.response?.status || 500, msg: getErrorMessage(error, 'Get project failed') };
    }
  }

  @Controller('projects/update')
  async update(data: RequestData, _webview: PostMessageble) {
    const { projectId, name, transport, endpoint, description, enabled } = data;
    if (!projectId) {
      return { code: 400, msg: 'projectId is required' };
    }

    const patch: ProjectUpdatePayload = {};
    if (name !== undefined && name !== null && String(name).trim() !== '') {
      patch.name = String(name);
    }
    if (transport !== undefined && transport !== null && String(transport).trim() !== '') {
      patch.transport = String(transport);
    }
    if (endpoint !== undefined && endpoint !== null) {
      patch.endpoint = String(endpoint);
    }
    if (description !== undefined && description !== null) {
      patch.description = String(description);
    }
    if (enabled !== undefined && enabled !== null) {
      if (typeof enabled === 'boolean') patch.enabled = enabled;
      else if (enabled === 'true' || enabled === '1') patch.enabled = true;
      else if (enabled === 'false' || enabled === '0') patch.enabled = false;
    }

    try {
      const resp = await updateProject(String(projectId), patch);
      return { code: 200, msg: 'ok', data: resp.data };
    } catch (error: any) {
      return { code: error?.response?.status || 500, msg: getErrorMessage(error, 'Update project failed') };
    }
  }

  @Controller('projects/delete')
  async remove(data: RequestData, _webview: PostMessageble) {
    const { projectId } = data;
    if (!projectId) {
      return { code: 400, msg: 'projectId is required' };
    }

    try {
      const resp = await deleteProject(String(projectId));
      return { code: 200, msg: 'ok', data: resp.data };
    } catch (error: any) {
      return { code: error?.response?.status || 500, msg: getErrorMessage(error, 'Delete project failed') };
    }
  }
}

