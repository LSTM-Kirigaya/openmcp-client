import { Controller } from "../common/index.js";
import { RequestData } from "../common/index.dto.js";
import { PostMessageble } from "../hook/adapter.js";
import { runBatchValidation } from "./batch-validation.service.js";

export class BatchValidationController {
    @Controller('batch-validation/run')
    async runValidation(data: RequestData, webview: PostMessageble) {
        const {
            messages,
            testCases,
            evaluationMode,
            customPrompt,
            llmConfig
        } = data;

        console.log('[BatchValidationController] runValidation called, testCases=', testCases?.length, 'evaluationMode=', evaluationMode);

        if (!messages || !Array.isArray(messages)) {
            console.warn('[BatchValidationController] invalid messages');
            return {
                code: 400,
                msg: 'messages is required and must be an array'
            };
        }

        if (!testCases || !Array.isArray(testCases) || testCases.length === 0) {
            console.warn('[BatchValidationController] invalid testCases');
            return {
                code: 400,
                msg: 'testCases is required and must be a non-empty array'
            };
        }

        if (!llmConfig?.baseURL || !llmConfig?.apiKey || !llmConfig?.model) {
            console.warn('[BatchValidationController] invalid llmConfig');
            return {
                code: 400,
                msg: 'llmConfig must include baseURL, apiKey, and model'
            };
        }

        const mode = evaluationMode === 'score' ? 'score' : 'pass-fail';
        console.log('[BatchValidationController] calling runBatchValidation, model=', llmConfig.model, 'mode=', mode);

        try {
            const results = await runBatchValidation({
                messages,
                testCases,
                evaluationMode: mode,
                customPrompt,
                llmConfig
            });
            console.log('[BatchValidationController] runBatchValidation done, results=', results.length);

            return {
                code: 200,
                msg: { results }
            };
        } catch (error) {
            console.error('[BatchValidationController] runBatchValidation error:', error);
            return {
                code: 500,
                msg: error instanceof Error ? error.message : String(error)
            };
        }
    }
}
