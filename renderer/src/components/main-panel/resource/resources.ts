import { ResourcesReadResponse, ResourceTemplate, ResourceTemplatesListResponse } from '@/hook/type';
import { reactive } from 'vue';


export const resourcesManager = reactive<{
    current: ResourceTemplate | undefined
    templates: ResourceTemplate[]
}>({
    current: undefined,
    templates: []
});

export interface ResourceStorage {
    currentResourceName: string;
    lastResourceReadResponse?: ResourcesReadResponse;
    formData: Record<string, any>;
}

/**
* @description 解析资源模板字符串
* @param template 资源模板字符串，如 "greeting://{name}"
* @returns { params: 参数名数组, fill: 填充函数 }
*/
export function parseResourceTemplate(template: string): {
    params: string[],
    fill: (params: Record<string, number | boolean | string>) => string
} {
    // 1. 提取所有参数名
    const paramRegex = /\{([^}]+)\}/g;
    const params = new Set<string>();
    let match;

    while ((match = paramRegex.exec(template)) !== null) {
        params.add(match[1]);
    }

    const paramList = Array.from(params);

    // 2. 创建填充函数
    const fill = (values: Record<string, number | boolean | string>): string => {
        let result = template;

        // 验证所有必填参数
        for (const param of paramList) {
            if (values[param] === undefined) {
                throw new Error(`缺少必要参数: ${param}`);
            }
        }

        // 替换所有参数
        for (const param of paramList) {            
            result = result.replace(new RegExp(`\\{${param}\\}`, 'g'), values[param].toString());
        }

        return result;
    };

    return {
        params: paramList,
        fill
    };
}