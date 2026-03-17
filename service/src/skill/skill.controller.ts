import { Controller } from "../common/index.js";
import { RequestData } from "../common/index.dto.js";
import { PostMessageble } from "../hook/adapter.js";
import { loadSkillContent, listSkills, readSkillFile } from "./skill.service.js";

export class SkillController {

    @Controller('skills/list')
    async listSkillsController(data: RequestData, webview: PostMessageble) {
        const skills = listSkills();
        return {
            code: 200,
            msg: { skills }
        };
    }

    @Controller('skills/load')
    async loadSkill(data: RequestData, webview: PostMessageble) {
        const skillName = data?.skillName as string | undefined;
        const skill = loadSkillContent(skillName);
        if (!skill) {
            return {
                code: 200,
                msg: null
            };
        }
        return {
            code: 200,
            msg: skill
        };
    }

    @Controller('skills/read-file')
    async readSkillFileController(data: RequestData, webview: PostMessageble) {
        const { skill_name, file_path } = data;
        if (!skill_name || !file_path) {
            return {
                code: 400,
                msg: { isError: true, content: [{ type: 'error', text: 'Missing skill_name or file_path' }] }
            };
        }

        const result = readSkillFile(skill_name, file_path);
        if ('error' in result) {
            return {
                code: 200,
                msg: {
                    isError: true,
                    content: [{ type: 'error', text: result.error }]
                }
            };
        }

        return {
            code: 200,
            msg: {
                isError: false,
                content: [{ type: 'text', text: result.content }]
            }
        };
    }
}
