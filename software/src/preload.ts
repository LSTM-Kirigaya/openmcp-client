import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronApi', {
    onReply: (callback: (event: MessageEvent<any>) => void) => {
        ipcRenderer.on('message', (event, data) => {
            callback({ data } as MessageEvent<any>);
        });
    },
    sendToMain: (message: any) => {
        ipcRenderer.send('message', message);
    }
});