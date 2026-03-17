export interface OpenRouterModel {
    id: string;
    name: string;
    description?: string;
    context_length: number;
    pricing: {
        prompt: string;
        completion: string;
    };
    architecture?: {
        input_modalities?: string[];
        output_modalities?: string[];
        tokenizer?: string;
    };
    supported_parameters?: string[];
}

export interface OpenRouterModelsResponse {
    data: OpenRouterModel[];
}

// 模型缓存，避免频繁API调用
let modelsCache: { models: OpenRouterModel[]; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

export async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
    const now = Date.now();
    
    // 检查缓存
    if (modelsCache && (now - modelsCache.timestamp) < CACHE_DURATION) {
        return modelsCache.models;
    }
    
    try {
        const response = await fetch('https://openrouter.ai/api/v1/models');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data: OpenRouterModelsResponse = await response.json();
        
        const models = data.data.map(model => ({
            id: model.id,
            name: model.name,
            description: model.description,
            context_length: model.context_length,
            pricing: model.pricing,
            architecture: model.architecture,
            supported_parameters: model.supported_parameters
        }));
        
        // 更新缓存
        modelsCache = {
            models,
            timestamp: now
        };
        
        console.log(`Fetched ${models.length} OpenRouter models`);
        return models;
    } catch (error) {
        console.error('Failed to fetch OpenRouter models:', error);
        // 返回缓存的模型（如果有）或空数组
        return modelsCache?.models || [];
    }
}

export async function getOpenRouterModelsByCategory(category?: string): Promise<OpenRouterModel[]> {
    try {
        const url = category 
            ? `https://openrouter.ai/api/v1/models?category=${encodeURIComponent(category)}`
            : 'https://openrouter.ai/api/v1/models';
            
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data: OpenRouterModelsResponse = await response.json();
        return data.data;
    } catch (error) {
        console.error(`Failed to fetch OpenRouter models for category ${category}:`, error);
        return [];
    }
}

// 清除缓存的函数
export function clearOpenRouterCache(): void {
    modelsCache = null;
}

// 获取模型的简化信息，用于下拉框显示
export function getSimplifiedModels(models: OpenRouterModel[]): { id: string; name: string; pricing?: string }[] {
    return models.map(model => ({
        id: model.id,
        name: model.name,
        pricing: model.pricing ? `$${model.pricing.prompt}/1K` : undefined
    }));
}