import Tesseract from 'tesseract.js';
import { PostMessageble } from '../hook/adapter';
import { v4 as uuidv4 } from 'uuid';
import { OcrWorker } from './ocr.dto';
import { diskStorage, ocrDB } from '../hook/db';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export const ocrWorkerStorage = new Map<string, OcrWorker>();

export function saveBase64ImageData(
    base64String: string,
    mimeType: string
): string {

    // 从 base64 字符串中提取数据部分
    const base64Data = base64String.replace(/^data:.+;base64,/, '');

    // 生成唯一文件名
    const fileName = `${uuidv4()}.${mimeType.split('/')[1]}`;

    diskStorage.setSync(fileName, base64Data, { encoding: 'base64' });

    return fileName;
}

export function loadBase64ImageData(fileName: string): string {
    const homedir = os.homedir();
    const imageStorageFolder = path.join(homedir, '.openmcp','storage');
    const filePath = path.join(imageStorageFolder, fileName);
    // 读取文件内容
    if (!fs.existsSync(filePath)) {
        return '';
    }

    const fileContent = fs.readFileSync(filePath, { encoding: 'base64' });
    // 构建 base64 字符串
    const base64String = `data:image/png;base64,${fileContent}`;
    return base64String;
}


export async function tesseractOCR(
    imagePath: string,
    logger: (message: Tesseract.LoggerMessage) => void,
    lang: string = 'eng+chi_sim'
) {
    try {
        const { data: { text } } = await Tesseract.recognize(
            imagePath,
            lang,
            {
                logger
            }
        );

        return text;
    } catch (error) {
        console.error('OCR error:', error);
    }
    return '无法识别图片';
}


export function createOcrWorker(filename: string, webview: PostMessageble): OcrWorker {
    const workerId = uuidv4();

    const logger = (message: Tesseract.LoggerMessage) => {
        webview.postMessage({
            command: 'ocr/worker/log',
            data: {
                id: workerId,
                ...message
            }
        });
    };

    const imagePath = diskStorage.getStoragePath(filename);
    console.log(imagePath);
    
    const fut = tesseractOCR(imagePath, logger);

    fut.then((text) => {
        webview.postMessage({
            command: 'ocr/worker/done',
            data: {
                id: workerId,
                text
            }
        });
        
        ocrDB.insert({
            id: filename,
            filename,
            text,
            createTime: Date.now()
        });

        ocrWorkerStorage.delete(workerId);
    });

    const worker = {
        id: workerId,
        name: 'ocr-' + filename,
        filename,
        createTime: Date.now(),
        fut
    };

    ocrWorkerStorage.set(workerId, worker);

    return worker;
}