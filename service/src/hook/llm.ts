export const llms = [
	{
		id: 'deepseek',
		name: 'DeepSeek',
		baseUrl: 'https://api.deepseek.com/v1',
		models: ['deepseek-chat', 'deepseek-reasoner'],
		provider: 'DeepSeek',
		isOpenAICompatible: true,
		description: '深度求索推出的大模型，擅长中文和代码',
		website: 'https://www.deepseek.com',
		userToken: '',
		userModel: 'deepseek-chat'
	},
	{
		id: 'openai',
		name: 'OpenAI',
		baseUrl: 'https://api.openai.com/v1',
		models: ['gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
		provider: 'OpenAI',
		isOpenAICompatible: true,
		description: 'OpenAI官方API',
		website: 'https://openai.com',
		userToken: '',
		userModel: 'gpt-4-turbo'
	},
	{
		id: 'mistral',
		name: 'Mistral',
		baseUrl: 'https://api.mistral.ai/v1',
		models: ['mistral-tiny', 'mistral-small', 'mistral-medium'],
		provider: 'Mistral AI',
		isOpenAICompatible: true,
		description: '欧洲开源大模型代表',
		website: 'https://mistral.ai',
		userToken: '',
		userModel: 'mistral-tiny'
	},
	{
		id: 'ollama',
		name: 'Ollama (Local)',
		baseUrl: 'http://localhost:11434/v1',
		models: ['llama2', 'mistral', 'codellama'],
		provider: 'Ollama',
		isOpenAICompatible: true,
		description: '本地运行的大模型',
		website: 'https://ollama.com',
		userToken: '',
		userModel: 'llama2'
	},
	{
		id: 'groq',
		name: 'Groq',
		baseUrl: 'https://api.groq.com/openai/v1',
		models: ['mixtral-8x7b-32768', 'llama2-70b-4096'],
		provider: 'Groq',
		isOpenAICompatible: true,
		description: '超高速推理API',
		website: 'https://groq.com',
		userToken: '',
		userModel: 'mixtral-8x7b-32768'
	},
	{
		id: 'perplexity',
		name: 'Perplexity',
		baseUrl: 'https://api.perplexity.ai/v1',
		models: ['pplx-7b-online', 'pplx-70b-online'],
		provider: 'Perplexity AI',
		isOpenAICompatible: true,
		description: '联网搜索增强的大模型',
		website: 'https://www.perplexity.ai',
		userToken: '',
		userModel: 'pplx-7b-online'
	},
	{
		id: 'kimi',
		name: 'Kimi Chat',
		baseUrl: 'https://api.moonshot.cn/v1',
		models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
		provider: '月之暗面 (Moonshot AI)',
		isOpenAICompatible: true,
		description: '支持超长上下文的中文大模型，上下文窗口高达128K',
		website: 'https://kimi.moonshot.cn',
		userToken: '',
		userModel: 'moonshot-v1-8k'
	}
];
