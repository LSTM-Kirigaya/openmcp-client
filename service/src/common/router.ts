import { requestHandlerStorage } from "./index.js";
import type { PostMessageble } from "../hook/adapter.js";
import { LlmController } from "../llm/llm.controller.js";
import { ClientController } from "../mcp/client.controller.js";
import { ConnectController } from "../mcp/connect.controller.js";
import { OcrController } from "../mcp/ocr.controller.js";
import { PanelController } from "../panel/panel.controller.js";
import { SettingController } from "../setting/setting.controller.js";
import { RefluxController } from "../feedback/reflux.controller.js";
import { SkillController } from "../skill/skill.controller.js";
import { BatchValidationController } from "../batch-validation/batch-validation.controller.js";
import { DebuggerMcpController } from "../debugger-mcp/debugger-mcp.controller.js";
import { AuthController } from "../cloud/controllers/auth.controller.js";
import { ProjectsController } from "../cloud/controllers/projects.controller.js";
import { ProjectMembersController } from "../cloud/controllers/project-members.controller.js";
import { ProjectInvitesController } from "../cloud/controllers/project-invites.controller.js";
import { SpecCasesController } from "../cloud/controllers/spec-cases.controller.js";
import { BatchValidationCasesController } from "../cloud/controllers/batch-validation-cases.controller.js";
import { LocalStorageController } from "../storage/storage.controller.js";
export { disconnectService } from "../mcp/connect.service.js";

export const ModuleControllers = [
    ConnectController,
    ClientController,
    LlmController,
    PanelController,
    SettingController,
    OcrController,
    RefluxController,
    SkillController,
    BatchValidationController,
    DebuggerMcpController,
    AuthController,
    ProjectsController,
    ProjectMembersController,
    ProjectInvitesController,
    SpecCasesController,
    BatchValidationCasesController,
    LocalStorageController
];

export async function routeMessage(command: string, data: any, webview: PostMessageble) {
    const handlerStore = requestHandlerStorage.get(command);
    if (handlerStore) {
        const { handler, option = {} } = handlerStore;

        try {
            const res = await handler(data, webview);

            // res.code = -1 代表当前请求不需要返回发送
            if (res.code >= 0) {
                const payload = {
                    _id: data._id,
                    ...res
                }
                webview.postMessage({
                    command, data: payload
                });
                return payload;
            }
        } catch (error) {
            // console.error(error);
            const payload = {
                _id: data._id,
                code: 500,
                msg: (error as any).toString()
            }
            webview.postMessage({
                command, data: payload
            });

            return payload;
        }
    }
    // 未注册命令也返回明确错误，避免客户端一直等待直到超时
    const payload = {
        _id: data?._id,
        code: 404,
        msg: `Command not found: ${command}`
    };
    webview.postMessage({
        command, data: payload
    });
    return payload;
}
