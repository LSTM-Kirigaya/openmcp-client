import { app, BrowserWindow, ipcMain } from 'electron';
import * as OpenMCPService from '../openmcp-sdk/service';
import * as path from 'path';
import { ElectronIPCLike, getInitConnectionOption, ILaunchSigature, updateConnectionOption } from './util';

let mainWindow: BrowserWindow

function createWindow(): void {
	mainWindow = new BrowserWindow({
		height: 800,
		useContentSize: true,
		width: 1200,
		webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
		},
		autoHideMenuBar: true,
        icon: path.join(__dirname, '..', 'icons', 'icon.png')
	});

    const webview = new ElectronIPCLike(mainWindow.webContents);

    // 先发送成功建立的消息
    webview.postMessage({
        command: 'hello',
        data: {
            version: '0.0.1',
            name: '消息桥连接完成'
        }
    });

    const option = getInitConnectionOption();

    // 注册消息接受的管线
    webview.onDidReceiveMessage((message: any) => {
        console.info(`command: [${message.command || 'No Command'}]`);

        const { command, data } = message;

        switch (command) {
            case 'electron/launch-signature':
                const launchResultMessage: ILaunchSigature = option.type === 'stdio' ?
                    {
                        type: 'stdio',
                        commandString: option.command + ' ' + option.args.join(' '),
                        cwd: option.cwd || ''
                    } :
                    {
                        type: 'sse',
                        url: option.url,
                        oauth: option.oauth || ''
                    };

                const launchResult = {
                    code: 200,
                    msg: launchResultMessage
                };

                webview.postMessage({
                    command: 'electron/launch-signature',
                    data: launchResult
                });

                break;

            case 'electron/update-connection-sigature':
                updateConnectionOption(data);
                break;

            default:
                OpenMCPService.routeMessage(command, data, webview);
                break;
        }
    });


    const indexPath = path.join(__dirname, '..', 'openmcp-sdk/renderer/index.html');
	mainWindow.loadFile(indexPath);

    setTimeout(() => {
        mainWindow.webContents.openDevTools();
    }, 1000);
}

app.whenReady().then(() => {

	createWindow();

	app.on('activate', function () {
		if (BrowserWindow.getAllWindows().length === 0) createWindow()
	})
})

app.on('window-all-closed', function () {
	if (process.platform !== 'darwin') app.quit()
})
