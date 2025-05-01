import { requestHandlerStorage } from ".";
import { PostMessageble } from "../hook/adapter";
import { LlmController } from "../llm/llm.controller";
import { ClientController } from "../mcp/client.controller";
import { ConnectController } from "../mcp/connect.controller";
import { client } from "../mcp/connect.service";
import { OcrController } from "../mcp/ocr.controller";
import { PanelController } from "../panel/panel.controller";
import { SettingController } from "../setting/setting.controller";

export const ModuleControllers = [
    ConnectController,
    ClientController,
    LlmController,
    PanelController,
    SettingController,
    OcrController
];

export async function routeMessage(command: string, data: any, webview: PostMessageble) {
    const handlerStore = requestHandlerStorage.get(command);
    if (handlerStore) {
        const { handler, option = {} } = handlerStore;

        try {
            // TODO: select client based on something
            const res = await handler(client, data, webview);
            
            // res.code = -1 代表当前请求不需要返回发送
            if (res.code >= 0) {
                webview.postMessage({ command, data: res });
            }
        } catch (error) {
            webview.postMessage({
                command, data: {
                    code: 500,
                    msg: (error as any).toString()
                }
            });
        }
    }
    return
}