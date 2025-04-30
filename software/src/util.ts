
import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export class ElectronIPCLike {
    private webContents: Electron.WebContents;

    constructor(webContents: Electron.WebContents) {
        this.webContents = webContents;
    }

    postMessage(message: { command: string; data: any }): void {
        this.webContents.send('message', message);
    }

    onDidReceiveMessage(callback: (message: { command: string; data: any }) => void): void {
        ipcMain.on('message', (event, message) => {
            callback(message);
        });
    }
}


interface IStdioLaunchSignature {
    type: 'stdio';
    commandString: string;
    cwd: string;
}

interface ISSELaunchSignature {
    type:'sse';
    url: string;
    oauth: string;
}

export type ILaunchSigature = IStdioLaunchSignature | ISSELaunchSignature;

export function refreshConnectionOption(envPath: string) {
    const defaultOption = {
        type:'stdio',
        command: 'mcp',
        args: ['run', 'main.py'],
        cwd: '../server'
    };

    fs.writeFileSync(envPath, JSON.stringify(defaultOption, null, 4));   

    return defaultOption;
}

export function getInitConnectionOption() {
    const envPath = path.join(__dirname, '..', '.env');

    if (!fs.existsSync(envPath)) {
        return refreshConnectionOption(envPath);
    }

    try {
        const option = JSON.parse(fs.readFileSync(envPath, 'utf-8'));
        return option;

    } catch (error) {
        return refreshConnectionOption(envPath);
    }
}

export function updateConnectionOption(data: any) {
    const envPath = path.join(__dirname, '..', '.env');
    
    if (data.connectionType === 'STDIO') {
        const connectionItem = {
            type: 'stdio',
            command: data.command,
            args: data.args,
            cwd: data.cwd.replace(/\\/g, '/')
        };

        fs.writeFileSync(envPath, JSON.stringify(connectionItem, null, 4));
    } else {
        const connectionItem = {
            type: 'sse',
            url: data.url,
            oauth: data.oauth
        };

        fs.writeFileSync(envPath, JSON.stringify(connectionItem, null, 4));
    }
}