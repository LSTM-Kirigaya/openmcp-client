import * as vscode from 'vscode';
import * as OpenMCPService from '../resources/service';
import { launch } from './common/entry';

export function activate(context: vscode.ExtensionContext) {
    console.log('activate openmcp');

    // 初始化 OpenMCPService
    // 获取当前打开的项目的路径
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const workspace = workspaceFolder?.uri.fsPath || '';
    OpenMCPService.setVscodeWorkspace(workspace);

    launch(context);
}


export function deactivate() {

}