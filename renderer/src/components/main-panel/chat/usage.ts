import { IExtraInfo } from "./chat";

export interface UsageStatistic {
    input: number;
    output: number;
    total: number;
    cacheHitRatio: number;
}

export function makeUsageStatistic(extraInfo: IExtraInfo): UsageStatistic | undefined {
    if (extraInfo.serverName === 'unknown' || extraInfo.usage === undefined || extraInfo.usage === null) {
        return undefined;
    }

    const usage = extraInfo.usage;

    switch (extraInfo.serverName) {
        case 'deepseek':
            return {
                input: usage.prompt_tokens,
                output: usage.completion_tokens,
                total: usage.prompt_tokens + usage.completion_tokens,
                cacheHitRatio: Math.ceil((usage.prompt_tokens_details?.cached_tokens || 0) / usage.prompt_tokens * 1000) / 10,
            }

        case 'openai':
            return {
                // TODO: 完成其他的数值统计
                input: usage?.prompt_tokens,
                output: usage?.completion_tokens,
                total: usage.prompt_tokens + usage.completion_tokens,
                cacheHitRatio: Math.ceil(usage.prompt_tokens_details?.cached_tokens || 0 / usage.prompt_tokens * 1000) / 10,
            }
    }
    
    return undefined;
}