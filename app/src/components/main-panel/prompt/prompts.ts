import { PromptsGetResponse, PromptTemplate } from '@/hook/type';
import { reactive } from 'vue';

export const promptsManager = reactive<{
    current: PromptTemplate | undefined
    templates: PromptTemplate[]
}>({
    current: undefined,
    templates: []
});

export interface PromptStorage {
    currentPromptName: string;
    lastPromptGetResponse?: PromptsGetResponse;
}

export function parsePromptTemplate(template: string): {
    params: string[],
    fill: (params: Record<string, string>) => string
} {
    const paramRegex = /\{([^}]+)\}/g;
    const params = new Set<string>();
    let match;

    while ((match = paramRegex.exec(template)) !== null) {
        params.add(match[1]);
    }

    const paramList = Array.from(params);

    const fill = (values: Record<string, string>): string => {
        let result = template;

        for (const param of paramList) {
            if (values[param] === undefined) {
                throw new Error(`缺少必要参数: ${param}`);
            }
        }

        for (const param of paramList) {            
            result = result.replace(new RegExp(`\\{${param}\\}`, 'g'), values[param]);
        }

        return result;
    };

    return {
        params: paramList,
        fill
    };
}