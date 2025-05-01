import { Controller, RequestClientType } from '../common';
import { PostMessageble } from '../hook/adapter';
import { connectService } from './connect.service';

export class ConnectController {

	@Controller('connect')
    async connect(client: RequestClientType, data: any, webview: PostMessageble) {
        const res = await connectService(client, data);
        return res;
    }

    @Controller('lookup-env-var')
    async lookupEnvVar(client: RequestClientType, data: any, webview: PostMessageble) {
        const { keys } = data;
        const values = keys.map((key: string) => process.env[key] || '');

        return {
            code: 200,
            msg: values
        }
    }

    @Controller('ping')
    async ping(client: RequestClientType, data: any, webview: PostMessageble) {
        if (!client) {
            const connectResult = {
                code: 501,
                msg:'mcp client 尚未连接'
            };
            return connectResult;
        }

        return {
            code: 200,
            msg: {}
        }
    }
}