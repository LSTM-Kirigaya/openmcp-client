import Datastore from '@seald-io/nedb';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

interface Entity {
    id: string | number;
    [key: string]: any;
}

const dbConnections: Record<string, any> = {};
const DatastoreCtor = Datastore as unknown as { new(options: any): any };

export class LocalDB<T extends Entity> {
    private db: any;

    constructor(private tableName: string) {
        this.init();
    }

    private async init() {
        const homedir = os.homedir();
        const dbPath = path.join(homedir, '.openmcp', 'nedb');

        if (!fs.existsSync(dbPath)) {
            fs.mkdirSync(dbPath, { recursive: true });
        }

        const filename = path.join(dbPath, `${this.tableName}.db`);
        
        if (!dbConnections[filename]) {
            dbConnections[filename] = new DatastoreCtor({
                filename,
                autoload: true,
                timestampData: true
            });
        }

        this.db = dbConnections[filename];
        await this.db.ensureIndex({ fieldName: 'id', unique: true });
    }

    async insert(entity: T): Promise<void> {
        await this.db.update({ id: entity.id }, entity, { upsert: true });
    }

    async findById(id: string | number): Promise<T | undefined> {
        return await this.db.findOne({ id });
    }

    async findAll(): Promise<T[]> {
        return await this.db.find({});
    }

    async delete(id: string | number): Promise<void> {
        await this.db.remove({ id });
    }

    async close(): Promise<void> {
        // NeDB 不需要显式关闭
    }
}

class DiskStorage {
    #storageHome: string;

    constructor() {
        const homedir = os.homedir();
        const imageStorageFolder = path.join(homedir, '.openmcp', 'storage');
        
        // 确保存储目录存在
        if (!fs.existsSync(imageStorageFolder)) {
            fs.mkdirSync(imageStorageFolder, { recursive: true });
        }

        this.#storageHome = imageStorageFolder;
    }

    public async get(filename: string): Promise<Buffer | null> {
        const filePath = path.join(this.#storageHome, filename);
        if (fs.existsSync(filePath)) {
            return fs.promises.readFile(filePath);
        }
        return null;
    }

    public async set(filename: string, data: string | Buffer, options?: fs.WriteFileOptions): Promise<void> {
        const filePath = path.join(this.#storageHome, filename);
        await fs.promises.writeFile(filePath, data, options);
    }

    public async delete(filename: string): Promise<void> {
        const filePath = path.join(this.#storageHome, filename);
        if (fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath);
        }
    }

    public getSync(filename: string): Buffer | null {
        const filePath = path.join(this.#storageHome, filename);
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath);
        }
        return null;
    }

    public setSync(filename: string, data: string | Buffer, options?: fs.WriteFileOptions): void {

        if (!fs.existsSync(this.#storageHome)) {
            fs.mkdirSync(this.#storageHome, { recursive: true });
        }

        const filePath = path.join(this.#storageHome, filename);
        fs.writeFileSync(filePath, data, options);
    }

    public getStoragePath(filename: string): string {
        return path.join(this.#storageHome, filename);
    }

    public deleteSync(filename: string): void {
        const filePath = path.join(this.#storageHome, filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
}

interface SettingItem extends Entity {
    MODEL_INDEX: number;
    [key: string]: any;
}

interface OcrItem extends Entity {
    filename: string;
    text?: string;
    createTime: number;
}

interface SystemPromptItem extends Entity {
    name: string;
    content: string;
}

export const diskStorage = new DiskStorage();

export const settingDB = new LocalDB<SettingItem>('setting');
export const ocrDB = new LocalDB<OcrItem>('ocr');
export const systemPromptDB = new LocalDB<SystemPromptItem>('systemPrompt');