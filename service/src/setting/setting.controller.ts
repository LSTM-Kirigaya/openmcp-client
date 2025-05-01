import { Controller, RequestClientType } from "../common";
import { PostMessageble } from "../hook/adapter";
import { loadSetting, saveSetting } from "./setting.service";

export class SettingController {

    @Controller('setting/save')
    async saveSetting(client: RequestClientType, data: any, webview: PostMessageble) {
        saveSetting(data);
        console.log('Settings saved successfully');
        
        return {
            code: 200,
            msg: 'Settings saved successfully'
        };
    }

    @Controller('setting/load')
    async loadSetting(client: RequestClientType, data: any, webview: PostMessageble) {
        const config = loadSetting();
        return {
            code: 200,
            msg: config
        }
    }

}