export type ResourceScope = 'user' | 'workspace';
export type LocalScope = 'user' | 'workspace';

export function parseResourceScope(raw: string | undefined): ResourceScope {
  const value = (raw || 'user').trim().toLowerCase();
  if (value === 'user' || value === 'workspace') {
    return value;
  }
  throw new Error('--scope only supports user|workspace');
}

export function toLocalScopePayload(scope: ResourceScope, workspacePath?: string): {
  scope: LocalScope;
  workspacePath?: string;
} {
  return {
    scope,
    workspacePath: scope === 'workspace' && workspacePath?.trim() ? workspacePath.trim() : undefined
  };
}

export function requireProjectId(_scope: ResourceScope, _projectId?: string): string | undefined {
  return undefined;
}
