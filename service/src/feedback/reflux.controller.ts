import { Controller } from '../common/index.js';
import { RefluxService } from './reflux.service.js';
import { RequestData } from '../common/index.dto.js';
import { PostMessageble } from '../hook/adapter.js';

const refluxService = new RefluxService();

export class RefluxController {
    @Controller('feedback/reflux')
    async saveRefluxData(data: RequestData, webview: PostMessageble) {
        const storage = data.storage;
        const name = data.name;        

        // TODO: 根据验证器选择是否保存
        await refluxService.save(name, storage);
        
        return {
            code: 200,
            msg: ''
        };
    }
    @Controller('feedback/reflux/get-count')
    async getRefluxCount(data: RequestData, webview: PostMessageble) {
        const name = data.name;
        const count = await refluxService.getCount(name);
        return {
            code: 200,
            msg: count,
        };
    }

    @Controller('feedback/reflux/get-data')
    async getRefluxData(data: RequestData, webview: PostMessageble) {
        const name = data.name;
        const page = data.page;
        const pageSize = data.pageSize;

        const result = await refluxService.findAll(name, page, pageSize);
        return {
            code: 200,
            msg: result,
        };
    }

    @Controller('feedback/reflux/findTraceByHash')
    async findTraceByHash(data: RequestData, webview: PostMessageble) {
        const name = data.name;
        const hash = data.hash;

        const result = await refluxService.findTraceByHash(name, hash);
        return {
            code: 200,
            msg: result,
        };
    }

    @Controller('feedback/reflux/findEnableToolsByHash')
    async findEnableToolsByHash(data: RequestData, webview: PostMessageble) {
        const name = data.name;
        const hash = data.hash;

        const result = await refluxService.findEnableToolsByHash(name, hash);
        return {
            code: 200,
            msg: result,
        };
    }
}