export type OpenMcpSupportPlatform = 'web' | 'vscode' | 'electron';

export const acquireVsCodeApi = (window as any)['acquireVsCodeApi'];

export const electronApi = (window as any)['electronApi'];

export function getPlatform(): OpenMcpSupportPlatform {
    if (typeof acquireVsCodeApi !== 'undefined') {
        return 'vscode';
    } else if (typeof electronApi !== 'undefined') {
        return 'electron';
    } else {
        return 'web';
    }
}