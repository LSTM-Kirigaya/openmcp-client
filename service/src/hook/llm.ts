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
		id: 'qwen',
		name: '通义千问 Qwen',
		baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
		models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-long', 'qwen-omni-turbo', 'qwen-omni-turbo-realtime'],
		provider: 'Alibaba',
		isOpenAICompatible: true,
		description: '阿里巴巴通义千问',
		website: 'https://help.aliyun.com/zh/model-studio/models#cfc131abafghw',
		userToken: '',
		userModel: 'qwen-plus'
	},
	{
		id: 'doubao',
		name: '豆包 Seed',
		baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
		models: ['doubao-1.5-pro-32k', 'doubao-1.5-pro-256k', 'doubao-1.5-lite', 'deepseek-v3'],
		provider: 'bytedance',
		isOpenAICompatible: true,
		description: '字节跳动豆包 Seed',
		website: 'https://help.aliyun.com/zh/model-studio/models#cfc131abafghw',
		userToken: '',
		userModel: 'doubao-1.5-pro-32k'
	},
	{
		id: 'gemini',
		name: 'Gemini',
		baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
		models: ['gemini-2.0-flash', 'gemini-2.5-flash-preview-05-20', 'gemini-2.5-pro-preview-05-06'],
		provider: 'google',
		isOpenAICompatible: true,
		description: 'Google Gemini',
		website: 'https://ai.google.dev/gemini-api/docs/models?hl=zh-cn%2F%2Fgemini-2.5-pro-preview-05-06#gemini-2.5-pro-preview-05-06',
		userToken: '',
		userModel: 'gemini-2.0-flash'
	},
	{
		id: 'grok',
		name: 'Grok',
		baseUrl: 'https://api.x.ai/v1',
		models: ['grok-3', 'grok-3-fast', 'grok-3-mini', 'grok-3-mini-fast'],
		provider: 'xai',
		isOpenAICompatible: true,
		description: 'xAI Grok',
		website: 'https://docs.x.ai/docs/models',
		userToken: '',
		userModel: 'grok-3-mini'
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
	},
	{
		id: 'openrouter',
		name: 'OpenRouter',
		baseUrl: 'https://openrouter.ai/api/v1',
		models: [], // 动态加载
		provider: 'OpenRouter',
		isOpenAICompatible: true,
		description: '400+ AI models from multiple providers in one API',
		website: 'https://openrouter.ai',
		userToken: '',
		userModel: '',
		isDynamic: true,
		modelsEndpoint: 'https://openrouter.ai/api/v1/models',
		supportsPricing: true
	}
];


