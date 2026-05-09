import * as vscode from 'vscode';
import { setRunningCWD, setVscodeWorkspace, setDefaultLang } from '@openmcp/service';
import { launch } from './common/entry.js';
import { initialiseI18n, getAvailableKeys, getDefaultLanguage } from './i18n/index.js';
import { checkNews } from './webview/webview.service.js';

export function activate(context: vscode.ExtensionContext) {
    console.log('activate openmcp');

    // 初始化 OpenMCPService
    // 获取当前打开的项目的路径
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const workspace = workspaceFolder?.uri.fsPath || '';
    setVscodeWorkspace(workspace);
    setRunningCWD(context.extensionPath);
    const lang = getDefaultLanguage();
    setDefaultLang(lang);
    
    initialiseI18n(context);
    
    // 添加i18n调试信息
    console.log('Current language:', vscode.env.language);
    console.log('Available i18n keys:', getAvailableKeys().length);
    
    launch(context);
    checkNews(context);
}


export function deactivate() {

}
