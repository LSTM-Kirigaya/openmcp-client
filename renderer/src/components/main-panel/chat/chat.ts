export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface ChatSetting {
    modelIndex: number
    systemPrompt: string
    enableTools: boolean
    temperature: number
    enableWebSearch: boolean
    contextLength: number
}

export interface ChatStorage {
	messages: ChatMessage[]
    settings: ChatSetting
}