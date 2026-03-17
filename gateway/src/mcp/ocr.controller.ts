import { RequestClientType } from "../common/index.dto.js";
import { Controller } from "../common/index.js";
import { PostMessageble } from "../hook/adapter.js";
import { diskStorage } from "../hook/db.js";
import { createOcrWorker, saveBase64ImageData } from "./ocr.service.js";

export class OcrController {
    @Controller('ocr/get-ocr-image')
    async getOcrImage(data: any, webview: PostMessageble) {
        const { filename } = data;
        const buffer = diskStorage.getSync(filename);
        const base64String = buffer ? buffer.toString('base64'): undefined;
        return {
            code: 200,
            msg: {
                base64String
            }
        }
    }

    @Controller('ocr/start-ocr')
    async startOcr(data: any, webview: PostMessageble) {
        const { base64String, mimeType } = data;

        const filename = saveBase64ImageData(base64String, mimeType);
        const worker = createOcrWorker(filename, webview);

        return {
            code: 200,
            msg: {
                filename,
                workerId: worker.id
            }
        }   
    }

}