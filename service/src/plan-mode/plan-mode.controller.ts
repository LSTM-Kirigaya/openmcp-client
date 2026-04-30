import { Controller } from "../common/index.js";
import { RequestData } from "../common/index.dto.js";
import { PostMessageble } from "../hook/adapter.js";
import { getPlanFilePath, readPlan, writePlan } from "./plan-mode.service.js";

export class PlanModeController {

    @Controller('plan-mode/get-file-path')
    async getPlanFilePathController(data: RequestData, webview: PostMessageble) {
        const sessionId = data?.sessionId as string;
        if (!sessionId) {
            return { code: 400, msg: 'Missing sessionId' };
        }
        const filePath = await getPlanFilePath(sessionId);
        return { code: 200, msg: { filePath } };
    }

    @Controller('plan-mode/read')
    async readPlanController(data: RequestData, webview: PostMessageble) {
        const sessionId = data?.sessionId as string;
        if (!sessionId) {
            return { code: 400, msg: 'Missing sessionId' };
        }
        const content = await readPlan(sessionId);
        return { code: 200, msg: { content } };
    }

    @Controller('plan-mode/write')
    async writePlanController(data: RequestData, webview: PostMessageble) {
        const sessionId = data?.sessionId as string;
        const content = data?.content as string;
        if (!sessionId || content === undefined) {
            return { code: 400, msg: 'Missing sessionId or content' };
        }
        await writePlan(sessionId, content);
        return { code: 200, msg: { success: true } };
    }
}
