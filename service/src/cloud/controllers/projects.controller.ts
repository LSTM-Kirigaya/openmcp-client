import { Controller } from '../../common/index.js';
import type { PostMessageble } from '../../hook/adapter.js';
import type { RequestData } from '../../common/index.dto.js';
import type { BackendCommonResponse, Project } from '../types.js';
import { createProject, listProjects, getProject, updateProject, deleteProject } from '../projects.client.js';

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
    const { name } = data;
    if (!name) {
      return { code: 400, msg: 'Project name is required' };
    }

    try {
      const resp = await createProject(String(name));
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
    const { projectId, name } = data;
    if (!projectId || !name) {
      return { code: 400, msg: 'projectId and name are required' };
    }

    try {
      const resp = await updateProject(String(projectId), String(name));
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

