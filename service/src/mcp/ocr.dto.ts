export interface OcrWorker {
    id: string;
    name: string;
    filename: string;
    createTime: number;
    fut: Promise<string>
}