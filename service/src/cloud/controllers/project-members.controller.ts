import { Controller } from '../../common/index.js';
import type { PostMessageble } from '../../hook/adapter.js';
import type { RequestData } from '../../common/index.dto.js';
import type { BackendCommonResponse, ProjectMember } from '../types.js';
import {
  listProjectMembers,
  addProjectMember,
  removeProjectMember,
  updateProjectMemberRole
} from '../project-members.client.js';
import { getUser } from '../token-store.js';

function getErrorMessage(error: any, fallback: string): string {
  const msg =
    error?.response?.data?.message ||
    error?.message ||
    error?.code ||
    error?.cause?.code;
  return typeof msg === 'string' && msg.trim() ? msg : fallback;
}

function requireOperatorId(): string {
  const uid = getUser()?.id;
  if (!uid) {
    throw new Error('operator_id not found in current token store. Please login via cloud auth.');
  }
  return uid;
}

export class ProjectMembersController {
  @Controller('projects/members/list')
  async list(data: RequestData, _webview: PostMessageble) {
    const { projectId } = data;
    if (!projectId) return { code: 400, msg: 'projectId is required' };

    try {
      const resp = await listProjectMembers(String(projectId));
      return { code: 200, msg: 'ok', data: resp.data };
    } catch (error: any) {
      return { code: error?.response?.status || 500, msg: getErrorMessage(error, 'List members failed') };
    }
  }

  @Controller('projects/members/add')
  async add(data: RequestData, _webview: PostMessageble) {
    const { projectId, userId, role } = data;
    if (!projectId || !userId || !role) return { code: 400, msg: 'projectId/userId/role are required' };

    try {
      const operatorId = requireOperatorId();
      const resp = await addProjectMember({
        projectId: String(projectId),
        operatorId,
        userId: String(userId),
        role: String(role)
      });
      return { code: 200, msg: 'ok', data: resp.data };
    } catch (error: any) {
      return { code: error?.response?.status || 400, msg: getErrorMessage(error, 'Add member failed') };
    }
  }

  @Controller('projects/members/remove')
  async remove(data: RequestData, _webview: PostMessageble) {
    const { projectId, userId } = data;
    if (!projectId || !userId) return { code: 400, msg: 'projectId/userId are required' };

    try {
      const operatorId = requireOperatorId();
      const resp = await removeProjectMember({
        projectId: String(projectId),
        operatorId,
        userId: String(userId)
      });
      return { code: 200, msg: 'ok', data: resp.data };
    } catch (error: any) {
      return { code: error?.response?.status || 500, msg: getErrorMessage(error, 'Remove member failed') };
    }
  }

  @Controller('projects/members/update-role')
  async updateRole(data: RequestData, _webview: PostMessageble) {
    const { projectId, userId, role } = data;
    if (!projectId || !userId || !role) return { code: 400, msg: 'projectId/userId/role are required' };

    try {
      const operatorId = requireOperatorId();
      const resp = await updateProjectMemberRole({
        projectId: String(projectId),
        operatorId,
        userId: String(userId),
        role: String(role)
      });
      return { code: 200, msg: 'ok', data: resp.data };
    } catch (error: any) {
      return { code: error?.response?.status || 500, msg: getErrorMessage(error, 'Update role failed') };
    }
  }
}

