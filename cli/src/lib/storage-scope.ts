export type ResourceScope = 'user' | 'workspace' | 'cloud';
export type LocalScope = 'user' | 'workspace';

export function parseResourceScope(raw: string | undefined, allowCloud = true): ResourceScope {
  const value = (raw || 'user').trim().toLowerCase();
  if (value === 'user' || value === 'workspace') {
    return value;
  }
  if (allowCloud && value === 'cloud') {
    return 'cloud';
  }
  throw new Error(allowCloud ? '--scope 仅支持 user|workspace|cloud' : '--scope 仅支持 user|workspace');
}

export function toLocalScopePayload(scope: ResourceScope, workspacePath?: string): {
  scope: LocalScope;
  workspacePath?: string;
} {
  if (scope === 'cloud') {
    throw new Error('cloud scope 不能映射到本地存储');
  }
  return {
    scope,
    workspacePath: scope === 'workspace' && workspacePath?.trim() ? workspacePath.trim() : undefined
  };
}

export function requireProjectId(scope: ResourceScope, projectId?: string): string | undefined {
  if (scope !== 'cloud') {
    return undefined;
  }
  if (!projectId || !projectId.trim()) {
    throw new Error('--scope cloud 时必须传 --project-id');
  }
  return projectId.trim();
}
