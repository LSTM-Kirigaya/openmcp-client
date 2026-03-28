import { Controller } from '../../common/index.js';
import type { PostMessageble } from '../../hook/adapter.js';
import type { RequestData } from '../../common/index.dto.js';
import type { ProjectInvite } from '../types.js';
import { getUser } from '../token-store.js';
import {
  listProjectInvites,
  createProjectInvite,
  deleteProjectInvite,
  revokeProjectInvite,
  joinProjectByInvite
} from '../project-invites.client.js';

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
  if (!uid) throw new Error('operator_id not found in current token store. Please login via cloud auth.');
  return uid;
}

export class ProjectInvitesController {
  @Controller('projects/invites/list')
  async list(data: RequestData, _webview: PostMessageble) {
    const { projectId } = data;
    if (!projectId) return { code: 400, msg: 'projectId is required' };
    try {
      const resp = await listProjectInvites({ projectId: String(projectId), operatorId: requireOperatorId() });
      return { code: 200, msg: resp.data };
    } catch (error: any) {
      return { code: error?.response?.status || 500, msg: getErrorMessage(error, 'List invites failed') };
    }
  }

  @Controller('projects/invites/create')
  async create(data: RequestData, _webview: PostMessageble) {
    const { projectId, role, expiresAt, maxUses } = data;
    if (!projectId || !role) return { code: 400, msg: 'projectId/role are required' };
    try {
      const resp = await createProjectInvite({
        projectId: String(projectId),
        operatorId: requireOperatorId(),
        role: String(role),
        expiresAt: typeof expiresAt === 'string' && expiresAt.trim() ? expiresAt : undefined,
        maxUses: typeof maxUses === 'number' ? maxUses : maxUses ? Number(maxUses) : undefined
      });
      return { code: 200, msg: resp.data as ProjectInvite };
    } catch (error: any) {
      return { code: error?.response?.status || 500, msg: getErrorMessage(error, 'Create invite failed') };
    }
  }

  @Controller('projects/invites/delete')
  async delete(data: RequestData, _webview: PostMessageble) {
    const { projectId, inviteId } = data;
    if (!projectId || !inviteId) return { code: 400, msg: 'projectId/inviteId are required' };
    try {
      const resp = await deleteProjectInvite({
        projectId: String(projectId),
        operatorId: requireOperatorId(),
        inviteId: String(inviteId)
      });
      return { code: 200, msg: resp.data };
    } catch (error: any) {
      return { code: error?.response?.status || 500, msg: getErrorMessage(error, 'Delete invite failed') };
    }
  }

  @Controller('projects/invites/revoke')
  async revoke(data: RequestData, _webview: PostMessageble) {
    const { projectId, inviteId } = data;
    if (!projectId || !inviteId) return { code: 400, msg: 'projectId/inviteId are required' };
    try {
      const resp = await revokeProjectInvite({
        projectId: String(projectId),
        operatorId: requireOperatorId(),
        inviteId: String(inviteId)
      });
      return { code: 200, msg: resp.data };
    } catch (error: any) {
      return { code: error?.response?.status || 500, msg: getErrorMessage(error, 'Revoke invite failed') };
    }
  }

  @Controller('invites/join')
  async join(data: RequestData, _webview: PostMessageble) {
    const { code, userId } = data;
    if (!code || !userId) return { code: 400, msg: 'code/userId are required' };

    try {
      const resp = await joinProjectByInvite({ inviteCode: String(code), userId: String(userId) });
      return { code: 200, msg: resp.data };
    } catch (error: any) {
      return { code: error?.response?.status || 500, msg: getErrorMessage(error, 'Join project by invite failed') };
    }
  }
}

