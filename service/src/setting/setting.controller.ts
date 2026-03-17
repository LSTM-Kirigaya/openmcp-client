import { Controller } from "../common/index.js";
import { PostMessageble } from "../hook/adapter.js";
import { RequestData } from "../common/index.dto.js";
import { getClient } from "../mcp/connect.service.js";
import { getTour, loadSetting, saveSetting, setTour } from "./setting.service.js";

export class SettingController {

    @Controller('setting/save')
    async saveSetting(data: RequestData, webview: PostMessageble) {
        saveSetting(data);
        console.log('Settings saved successfully');
        
        return {
            code: 200,
            msg: 'Settings saved successfully'
        };
    }

    @Controller('setting/load')
    async loadSetting(data: RequestData, webview: PostMessageble) {
        const config = loadSetting();
        return {
            code: 200,
            msg: config
        }
    }

    @Controller('setting/set-tour')
    async setTourController(data: any, webview: PostMessageble) {
        const { userHasReadGuide } = data;
        setTour(userHasReadGuide);

        return {
            code: 200,
            msg: 'setTour success'
        }
    }

    @Controller('setting/get-tour')
    async getTourController(data: any, webview: PostMessageble) {
        
        const { userHasReadGuide } = getTour();

        return {
            code: 200,
            msg:{
                userHasReadGuide
            }
        }
    }
}