import type { LocalStorageScope, LocalStorageScopeOptions } from './paths.js';

export interface ClientStorageBinding {
    clientId: string;
    connectionKey: string;
    connectionId?: string;
    scope?: LocalStorageScope;
    workspacePath?: string;
    serverName?: string;
}

const bindingMap = new Map<string, ClientStorageBinding>();

export function rememberClientStorageBinding(binding: ClientStorageBinding): void {
    bindingMap.set(binding.clientId, binding);
}

export function getClientStorageBinding(clientId: string): ClientStorageBinding | undefined {
    return bindingMap.get(clientId);
}

export function releaseClientStorageBinding(clientId: string): void {
    bindingMap.delete(clientId);
}

export function resolveClientStorageOptions(binding?: ClientStorageBinding): LocalStorageScopeOptions {
    if (!binding) {
        return {};
    }
    return {
        scope: binding.scope,
        workspacePath: binding.workspacePath
    };
}
