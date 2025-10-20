import type { GenericProviderConfig } from "./GenericProviderTemplate"

/**
 * 预定义的 Provider 配置预设
 * 包含常见 provider 的默认配置，支持根据 provider 类型设置默认 baseUrl
 */

// OpenAI 兼容的 Provider 默认 baseUrl 映射
export const PROVIDER_DEFAULT_BASE_URLS: Record<string, string> = {
	siliconflow: "https://api.siliconflow.cn/v1",
	volcengine: "https://ark.cn-beijing.volces.com/api/v3",
	dashscope: "https://dashscope.aliyuncs.com/compatible-mode/v1",
	deepseek: "https://api.deepseek.com/v1",
	moonshot: "https://api.moonshot.cn/v1",
	doubao: "https://ark.cn-beijing.volces.com/api/v3",
	openai: "https://api.openai.com/v1",
	groq: "https://api.groq.com/openai/v1",
	cerebras: "https://api.cerebras.ai/v1",
	fireworks: "https://api.fireworks.ai/inference/v1",
	mistral: "https://api.mistral.ai/v1",
	xai: "https://api.x.ai/v1",
	sambanova: "https://api.sambanova.ai/v1",
	deepinfra: "https://api.deepinfra.com/v1/openai",
	openrouter: "https://openrouter.ai/api/v1",
	litellm: "http://localhost:4000",
	ollama: "http://localhost:11434",
	lmstudio: "http://localhost:1234/v1",
}

// 简单 Provider 配置（只需要 API Key）
export const SIMPLE_PROVIDER_CONFIGS: Record<string, GenericProviderConfig> = {
	anthropic: {
		providerName: "Anthropic",
		providerLabel: "Anthropic",
		apiKeyField: "apiKey",
		apiKeyUrl: "https://console.anthropic.com/",
		documentationUrl: "https://docs.anthropic.com/",
	},
	deepseek: {
		providerName: "DeepSeek",
		providerLabel: "DeepSeek",
		apiKeyField: "deepSeekApiKey",
		apiKeyUrl: "https://platform.deepseek.com/",
		documentationUrl: "https://platform.deepseek.com/api-docs",
	},
	groq: {
		providerName: "Groq",
		providerLabel: "Groq",
		apiKeyField: "groqApiKey",
		apiKeyUrl: "https://console.groq.com/keys",
		documentationUrl: "https://console.groq.com/docs",
	},
	xai: {
		providerName: "XAI",
		providerLabel: "xAI (Grok)",
		apiKeyField: "xaiApiKey",
		apiKeyUrl: "https://console.x.ai/",
		documentationUrl: "https://docs.x.ai/",
	},
	cerebras: {
		providerName: "Cerebras",
		providerLabel: "Cerebras",
		apiKeyField: "cerebrasApiKey",
		apiKeyUrl: "https://cloud.cerebras.ai/",
		documentationUrl: "https://inference-docs.cerebras.ai/",
	},
	sambanova: {
		providerName: "SambaNova",
		providerLabel: "SambaNova",
		apiKeyField: "sambaNovaApiKey",
		apiKeyUrl: "https://cloud.sambanova.ai/",
		documentationUrl: "https://docs.sambanova.ai/",
	},
	mistral: {
		providerName: "Mistral",
		providerLabel: "Mistral",
		apiKeyField: "mistralApiKey",
		apiKeyUrl: "https://console.mistral.ai/",
		documentationUrl: "https://docs.mistral.ai/",
	},
	fireworks: {
		providerName: "Fireworks",
		providerLabel: "Fireworks AI",
		apiKeyField: "fireworksApiKey",
		apiKeyUrl: "https://fireworks.ai/api-keys",
		documentationUrl: "https://readme.fireworks.ai/",
	},
}

// OpenAI 兼容的 Provider 配置
export const OPENAI_COMPATIBLE_PROVIDER_CONFIGS: Record<string, GenericProviderConfig> = {
	siliconflow: {
		providerName: "SiliconFlow",
		providerLabel: "SiliconFlow",
		apiKeyField: "siliconFlowApiKey",
		baseUrlField: "siliconFlowBaseUrl",
		modelIdField: "siliconFlowModelId",
		defaultBaseUrl: PROVIDER_DEFAULT_BASE_URLS.siliconflow,
		defaultModelId: "deepseek-chat",
		apiKeyUrl: "https://cloud.siliconflow.cn/",
		documentationUrl: "https://docs.siliconflow.cn/",
		features: {
			customBaseUrl: false,
			customHeaders: true,
			streaming: true,
			maxTokens: true,
			modelPicker: true,
		},
	},
	volcengine: {
		providerName: "VolcEngine",
		providerLabel: "VolcEngine",
		apiKeyField: "volcEngineApiKey",
		baseUrlField: "volcEngineBaseUrl",
		modelIdField: "volcEngineModelId",
		defaultBaseUrl: PROVIDER_DEFAULT_BASE_URLS.volcengine,
		defaultModelId: "doubao-pro-4k",
		apiKeyUrl: "https://console.volcengine.com/ark/",
		documentationUrl: "https://www.volcengine.com/docs/82379",
		features: {
			customBaseUrl: false,
			customHeaders: true,
			streaming: true,
			maxTokens: true,
			modelPicker: true,
		},
	},
	dashscope: {
		providerName: "DashScope",
		providerLabel: "DashScope",
		apiKeyField: "dashScopeApiKey",
		baseUrlField: "dashScopeBaseUrl",
		modelIdField: "dashScopeModelId",
		defaultBaseUrl: PROVIDER_DEFAULT_BASE_URLS.dashscope,
		defaultModelId: "qwen-plus",
		apiKeyUrl: "https://dashscope.console.aliyun.com/",
		documentationUrl: "https://help.aliyun.com/zh/dashscope/",
		features: {
			customBaseUrl: false,
			customHeaders: true,
			streaming: true,
			maxTokens: true,
			modelPicker: true,
		},
	},
	moonshot: {
		providerName: "Moonshot",
		providerLabel: "Moonshot",
		apiKeyField: "moonshotApiKey",
		baseUrlField: "moonshotBaseUrl",
		modelIdField: "apiModelId",
		defaultBaseUrl: PROVIDER_DEFAULT_BASE_URLS.moonshot,
		defaultModelId: "moonshot-v1-8k",
		apiKeyUrl: "https://platform.moonshot.cn/console/api-keys",
		documentationUrl: "https://platform.moonshot.cn/docs/",
		features: {
			customBaseUrl: true, // Moonshot 支持自定义 baseUrl
			customHeaders: true,
			streaming: true,
			maxTokens: true,
			modelPicker: true,
		},
	},
	doubao: {
		providerName: "Doubao",
		providerLabel: "Doubao",
		apiKeyField: "doubaoApiKey",
		baseUrlField: "doubaoBaseUrl",
		modelIdField: "apiModelId",
		defaultBaseUrl: PROVIDER_DEFAULT_BASE_URLS.doubao,
		defaultModelId: "doubao-pro-4k",
		apiKeyUrl: "https://console.volcengine.com/ark/",
		documentationUrl: "https://www.volcengine.com/docs/82379",
		features: {
			customBaseUrl: false,
			customHeaders: true,
			streaming: true,
			maxTokens: true,
			modelPicker: true,
		},
	},
	openrouter: {
		providerName: "OpenRouter",
		providerLabel: "OpenRouter",
		apiKeyField: "openRouterApiKey",
		baseUrlField: "openRouterBaseUrl",
		modelIdField: "openRouterModelId",
		defaultBaseUrl: PROVIDER_DEFAULT_BASE_URLS.openrouter,
		apiKeyUrl: "https://openrouter.ai/keys",
		documentationUrl: "https://openrouter.ai/docs",
		features: {
			customBaseUrl: true,
			customHeaders: true,
			streaming: true,
			maxTokens: true,
			modelPicker: true,
		},
		customFields: [
			{
				key: "openRouterSpecificProvider",
				type: "text",
				label: "Specific Provider",
				placeholder: "e.g., anthropic, openai",
				description: "Optional: specify a particular provider for routing",
			},
			{
				key: "openRouterUseMiddleOutTransform",
				type: "checkbox",
				label: "Use Middle-Out Transform",
				description: "Enable middle-out transform for better performance",
				defaultValue: false,
			},
		],
	},
	deepinfra: {
		providerName: "DeepInfra",
		providerLabel: "DeepInfra",
		apiKeyField: "deepInfraApiKey",
		baseUrlField: "deepInfraBaseUrl",
		modelIdField: "deepInfraModelId",
		defaultBaseUrl: PROVIDER_DEFAULT_BASE_URLS.deepinfra,
		apiKeyUrl: "https://deepinfra.com/dash/api_keys",
		documentationUrl: "https://deepinfra.com/docs",
		features: {
			customBaseUrl: true,
			customHeaders: true,
			streaming: true,
			maxTokens: true,
			modelPicker: true,
		},
	},
	litellm: {
		providerName: "LiteLLM",
		providerLabel: "LiteLLM",
		apiKeyField: "litellmApiKey",
		baseUrlField: "litellmBaseUrl",
		modelIdField: "litellmModelId",
		defaultBaseUrl: PROVIDER_DEFAULT_BASE_URLS.litellm,
		documentationUrl: "https://docs.litellm.ai/",
		features: {
			customBaseUrl: false,
			customHeaders: true,
			streaming: true,
			maxTokens: true,
			modelPicker: true,
		},
		customFields: [
			{
				key: "litellmUsePromptCache",
				type: "checkbox",
				label: "Use Prompt Cache",
				description: "Enable prompt caching for better performance",
				defaultValue: false,
			},
		],
	},
}

// 本地 Provider 配置
export const LOCAL_PROVIDER_CONFIGS: Record<string, GenericProviderConfig> = {
	ollama: {
		providerName: "Ollama",
		providerLabel: "Ollama",
		apiKeyField: "ollamaApiKey", // Ollama 通常不需要 API Key，但保留字段
		baseUrlField: "ollamaBaseUrl",
		modelIdField: "ollamaModelId",
		defaultBaseUrl: PROVIDER_DEFAULT_BASE_URLS.ollama,
		documentationUrl: "https://ollama.ai/",
		features: {
			customBaseUrl: false,
			streaming: true,
			maxTokens: true,
			modelPicker: true,
		},
		customFields: [
			{
				key: "ollamaNumCtx",
				type: "number",
				label: "Context Window",
				placeholder: "2048",
				description: "Number of context tokens (minimum 128)",
			},
		],
	},
	lmstudio: {
		providerName: "LMStudio",
		providerLabel: "LM Studio",
		apiKeyField: "lmStudioApiKey", // LM Studio 通常不需要 API Key
		baseUrlField: "lmStudioBaseUrl",
		modelIdField: "lmStudioModelId",
		defaultBaseUrl: PROVIDER_DEFAULT_BASE_URLS.lmstudio,
		documentationUrl: "https://lmstudio.ai/docs",
		features: {
			customBaseUrl: false,
			streaming: true,
			maxTokens: true,
			modelPicker: true,
		},
		customFields: [
			{
				key: "lmStudioDraftModelId",
				type: "text",
				label: "Draft Model",
				placeholder: "Select draft model",
				description: "Optional draft model for speculative decoding",
			},
			{
				key: "lmStudioSpeculativeDecodingEnabled",
				type: "checkbox",
				label: "Enable Speculative Decoding",
				description: "Use draft model for faster inference",
				defaultValue: false,
			},
		],
	},
}

/**
 * 获取 Provider 配置的辅助函数
 */
export const getProviderConfig = (providerName: string): GenericProviderConfig | null => {
	return (
		SIMPLE_PROVIDER_CONFIGS[providerName] ||
		OPENAI_COMPATIBLE_PROVIDER_CONFIGS[providerName] ||
		LOCAL_PROVIDER_CONFIGS[providerName] ||
		null
	)
}

/**
 * 获取 Provider 的默认 baseUrl
 */
export const getProviderDefaultBaseUrl = (providerName: string): string | undefined => {
	return PROVIDER_DEFAULT_BASE_URLS[providerName]
}

/**
 * 检查 Provider 是否支持某个功能
 */
export const providerSupportsFeature = (providerName: string, feature: string): boolean => {
	const config = getProviderConfig(providerName)
	if (!config?.features) return false
	return !!(config.features as any)[feature]
}

export default {
	SIMPLE_PROVIDER_CONFIGS,
	OPENAI_COMPATIBLE_PROVIDER_CONFIGS,
	LOCAL_PROVIDER_CONFIGS,
	PROVIDER_DEFAULT_BASE_URLS,
	getProviderConfig,
	getProviderDefaultBaseUrl,
	providerSupportsFeature,
}