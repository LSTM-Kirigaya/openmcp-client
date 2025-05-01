import { Controller, RequestClientType } from "../common";
import { PostMessageble } from "../hook/adapter";
import { diskStorage } from "../hook/db";

export class OcrController {
    @Controller('ocr/get-ocr-image')
    async getOcrImage(client: RequestClientType, data: any, webview: PostMessageble) {
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
}