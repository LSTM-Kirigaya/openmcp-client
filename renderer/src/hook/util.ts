import { useMessageBridge } from "@/api/message-bridge";

export function getCurrentTime() {
    // 创建一个Date对象
    const date = new Date();
    // 获取年份
    const year: string | number = date.getFullYear();
    // 获取月份（0-11）
    let month: string | number = date.getMonth() + 1;
    // 获取日期（1-31）
    let day: string | number = date.getDate();
    // 获取小时（0-23）
    let hour: string | number = date.getHours();
    // 获取分钟（0-59）
    let minute: string | number = date.getMinutes();
    // 如果月份、日期、小时、分钟或秒钟小于10，则在前面补0
    month = month < 10 ? "0" + month : month;
    day = day < 10 ? "0" + day : day;
    hour = hour < 10 ? "0" + hour : hour;
    minute = minute < 10 ? "0" + minute : minute;
    // 拼接成字符串
    const timeStr = year + "年" + month + "月" + day + "日" + " " + hour + ":" + minute;
    return timeStr;
}

const blobUrlCache = new Map<string, string>();

export async function getBlobUrlByFilename(filename: string) {
    // 检查缓存中是否存在该文件
    if (blobUrlCache.has(filename)) {
        return blobUrlCache.get(filename);
    }

    const bridge = useMessageBridge();
    const res = await bridge.commandRequest('ocr/get-ocr-image', { filename });
    if (res?.code !== 200) {
        return '';
    }

    const base64String = res?.msg?.base64String;

    if (!base64String) {
        return '';
    }

    // 根据文件后缀获取 mimeType
    const extension = filename.split('.').pop()?.toLowerCase();
    let mimeType = 'image/png'; // 默认值
    switch (extension) {
        case 'jpg':
        case 'jpeg':
            mimeType = 'image/jpeg';
            break;
        case 'gif':
            mimeType = 'image/gif';
            break;
        case 'webp':
            mimeType = 'image/webp';
            break;
        case 'bmp':
            mimeType = 'image/bmp';
            break;
        case 'svg':
            mimeType = 'image/svg+xml';
            break;
    }
    const byteCharacters = atob(base64String);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);
    // 将结果存入缓存
    blobUrlCache.set(filename, blobUrl);
    return blobUrl;
}