import * as vscode from 'vscode';
import { registerCommands, registerTreeDataProviders } from '.';
import { HelpProvider } from '../sidebar/help.controller';
import { McpWorkspaceConnectProvider } from '../sidebar/workspace.controller';
import { McpInstalledConnectProvider } from '../sidebar/installed.controller';
import { WebviewController } from '../webview/webview.controller';

export const InstallModules = [
    McpWorkspaceConnectProvider,
    McpInstalledConnectProvider,
    HelpProvider,
    WebviewController
];

const registerSingles = new Map<string, any>();

export function launch(context: vscode.ExtensionContext) {

    for (const [providerId, value] of registerTreeDataProviders) {
        const provider = new value.providerConstructor(context);
        
        registerSingles.set(providerId, provider);
        
        context.subscriptions.push(
            vscode.window.registerTreeDataProvider(providerId, provider)
        );
    }

    
    for (const [command, value] of registerCommands) {
        const namespace = value.target.__openmcp_namespace;
        const targetCommand = namespace ? `${namespace}.${command}` : command;

        const target = registerSingles.has(namespace) ? registerSingles.get(namespace) : value.target;
        
        context.subscriptions.push(vscode.commands.registerCommand(targetCommand, (...args: any[]) => {
            target[value.propertyKey](context,...args);
        }));
    }

}