import {
	type ProviderName,
	type ProviderSettings,
	type ModelInfo,
	anthropicDefaultModelId,
	anthropicModels,
	bedrockDefaultModelId,
	bedrockModels,
	cerebrasDefaultModelId,
	cerebrasModels,
	deepSeekDefaultModelId,
	deepSeekModels,
	moonshotDefaultModelId,
	moonshotModels,
	geminiDefaultModelId,
	geminiModels,
	mistralDefaultModelId,
	mistralModels,
	openAiModelInfoSaneDefaults,
	openAiNativeDefaultModelId,
	openAiNativeModels,
	vertexDefaultModelId,
	vertexModels,
	xaiDefaultModelId,
	xaiModels,
	groqModels,
	groqDefaultModelId,
	chutesModels,
	chutesDefaultModelId,
	vscodeLlmModels,
	vscodeLlmDefaultModelId,
	openRouterDefaultModelId,
	requestyDefaultModelId,
	glamaDefaultModelId,
	unboundDefaultModelId,
	litellmDefaultModelId,
	claudeCodeDefaultModelId,
	claudeCodeModels,
	sambaNovaModels,
	sambaNovaDefaultModelId,
	doubaoModels,
	doubaoDefaultModelId,
	internationalZAiDefaultModelId,
	mainlandZAiDefaultModelId,
	internationalZAiModels,
	mainlandZAiModels,
	fireworksModels,
	fireworksDefaultModelId,
	featherlessModels,
	featherlessDefaultModelId,
	ioIntelligenceDefaultModelId,
	ioIntelligenceModels,
	rooDefaultModelId,
	rooModels,
	qwenCodeDefaultModelId,
	qwenCodeModels,
	vercelAiGatewayDefaultModelId,
	BEDROCK_1M_CONTEXT_MODEL_IDS,
	deepInfraDefaultModelId,
} from "@roo-code/types"

import type { ModelRecord, RouterModels } from "@roo/api"

import { useRouterModels } from "./useRouterModels"
import { useOpenRouterModelProviders } from "./useOpenRouterModelProviders"
import { useLmStudioModels } from "./useLmStudioModels"
import { useOllamaModels } from "./useOllamaModels"

export const useSelectedModel = (apiConfiguration?: ProviderSettings) => {
	// 检查apiConfiguration是否为字符串
	let parsedConfig: ProviderSettings | undefined
	if (typeof apiConfiguration === 'string') {
		console.log('[useSelectedModel] apiConfiguration is string, parsing...')
		try {
			parsedConfig = JSON.parse(apiConfiguration)
		} catch (error) {
			console.error('[useSelectedModel] Failed to parse apiConfiguration:', error)
			parsedConfig = undefined
		}
	} else if (apiConfiguration && typeof apiConfiguration === 'object' && !Array.isArray(apiConfiguration)) {
		// 检查是否真的是对象，而不是看起来像对象的字符串
		// 如果apiConfiguration有apiProvider属性，那么它是对象
		if (apiConfiguration.hasOwnProperty('apiProvider')) {
			parsedConfig = apiConfiguration
		} else {
			// 如果没有apiProvider属性，可能它是被错误地当作对象的字符串
			console.log('[useSelectedModel] apiConfiguration is object but missing apiProvider, trying to parse as string...')
			try {
				const stringVersion = JSON.stringify(apiConfiguration)
				parsedConfig = JSON.parse(stringVersion)
			} catch (error) {
				console.error('[useSelectedModel] Failed to parse object as JSON string:', error)
				parsedConfig = apiConfiguration
			}
		}
	} else {
		parsedConfig = apiConfiguration
	}

	const provider = parsedConfig?.apiProvider || "anthropic"
	const openRouterModelId = provider === "openrouter" ? parsedConfig?.openRouterModelId : undefined
	const lmStudioModelId = provider === "lmstudio" ? parsedConfig?.lmStudioModelId : undefined
	const ollamaModelId = provider === "ollama" ? parsedConfig?.ollamaModelId : undefined

	console.log('[useSelectedModel] Debug:', {
		originalType: typeof apiConfiguration,
		parsedType: typeof parsedConfig,
		provider,
		apiConfiguration: JSON.stringify(parsedConfig),
		hasOpenAiModelId: 'openAiModelId' in (parsedConfig || {}),
		openAiModelId: parsedConfig?.openAiModelId,
		openRouterModelId,
		lmStudioModelId,
		ollamaModelId,
		keys: parsedConfig ? Object.keys(parsedConfig) : []
	})

	const routerModels = useRouterModels()
	const openRouterModelProviders = useOpenRouterModelProviders(openRouterModelId)
	const lmStudioModels = useLmStudioModels(lmStudioModelId)
	const ollamaModels = useOllamaModels(ollamaModelId)

	// 检查条件 - 对于OpenAI兼容模式，不需要routerModels
	const shouldUseGetSelectedModel = parsedConfig &&
		(typeof lmStudioModelId === "undefined" || typeof lmStudioModels.data !== "undefined") &&
		(typeof ollamaModelId === "undefined" || typeof ollamaModels.data !== "undefined") &&
		// 对于以下provider，需要routerModels数据
		(provider === "openrouter" || provider === "requesty" || provider === "glama" ||
		 provider === "unbound" || provider === "litellm" || provider === "deepinfra" ||
		 provider === "io-intelligence" || provider === "vercel-ai-gateway"
		 ? typeof routerModels.data !== "undefined" : true) &&
		// 对于以下provider，需要openRouterModelProviders数据
		(provider === "openrouter" ? typeof openRouterModelProviders.data !== "undefined" : true)

	console.log('[useSelectedModel] Conditions check:', {
		provider,
		hasParsedConfig: !!parsedConfig,
		lmStudioCondition: (typeof lmStudioModelId === "undefined" || typeof lmStudioModels.data !== "undefined"),
		ollamaCondition: (typeof ollamaModelId === "undefined" || typeof ollamaModels.data !== "undefined"),
		routerModelsCondition: (provider === "openrouter" || provider === "requesty" || provider === "glama" || provider === "unbound" || provider === "litellm" || provider === "deepinfra" || provider === "io-intelligence" || provider === "vercel-ai-gateway") ? typeof routerModels.data !== "undefined" : true,
		openRouterProvidersCondition: provider === "openrouter" ? typeof openRouterModelProviders.data !== "undefined" : true,
		shouldUseGetSelectedModel,
		routerModelsData: !!routerModels.data,
		openRouterProvidersData: !!openRouterModelProviders.data
	})

	const { id, info } = shouldUseGetSelectedModel
		? getSelectedModel({
				provider,
				apiConfiguration: parsedConfig!,
				routerModels: routerModels.data!,
				openRouterModelProviders: openRouterModelProviders.data!,
				lmStudioModels: lmStudioModels.data,
				ollamaModels: ollamaModels.data,
			})
		: { id: anthropicDefaultModelId, info: undefined }

	return {
		provider,
		id,
		info,
		isLoading:
			routerModels.isLoading ||
			openRouterModelProviders.isLoading ||
			(apiConfiguration?.lmStudioModelId && lmStudioModels!.isLoading),
		isError:
			routerModels.isError ||
			openRouterModelProviders.isError ||
			(apiConfiguration?.lmStudioModelId && lmStudioModels!.isError),
	}
}

function getSelectedModel({
	provider,
	apiConfiguration,
	routerModels,
	openRouterModelProviders,
	lmStudioModels,
	ollamaModels,
}: {
	provider: ProviderName
	apiConfiguration: ProviderSettings
	routerModels: RouterModels
	openRouterModelProviders: Record<string, ModelInfo>
	lmStudioModels: ModelRecord | undefined
	ollamaModels: ModelRecord | undefined
}): { id: string; info: ModelInfo | undefined } {
	// the `undefined` case are used to show the invalid selection to prevent
	// users from seeing the default model if their selection is invalid
	// this gives a better UX than showing the default model
	switch (provider) {
		case "openrouter": {
			const id = apiConfiguration.openRouterModelId ?? openRouterDefaultModelId
			let info = routerModels.openrouter[id]
			const specificProvider = apiConfiguration.openRouterSpecificProvider

			if (specificProvider && openRouterModelProviders[specificProvider]) {
				// Overwrite the info with the specific provider info. Some
				// fields are missing the model info for `openRouterModelProviders`
				// so we need to merge the two.
				info = info
					? { ...info, ...openRouterModelProviders[specificProvider] }
					: openRouterModelProviders[specificProvider]
			}

			return { id, info }
		}
		case "requesty": {
			const id = apiConfiguration.requestyModelId ?? requestyDefaultModelId
			const info = routerModels.requesty[id]
			return { id, info }
		}
		case "glama": {
			const id = apiConfiguration.glamaModelId ?? glamaDefaultModelId
			const info = routerModels.glama[id]
			return { id, info }
		}
		case "unbound": {
			const id = apiConfiguration.unboundModelId ?? unboundDefaultModelId
			const info = routerModels.unbound[id]
			console.log('[useSelectedModel] Unbound case:', {
				id,
				unboundModelId: apiConfiguration.unboundModelId,
				defaultId: unboundDefaultModelId,
				hasInfo: !!info,
				routerModelsKeys: Object.keys(routerModels.unbound || {})
			})
			return { id, info }
		}
		case "litellm": {
			const id = apiConfiguration.litellmModelId ?? litellmDefaultModelId
			const info = routerModels.litellm[id]
			return { id, info }
		}
		case "xai": {
			const id = apiConfiguration.apiModelId ?? xaiDefaultModelId
			const info = xaiModels[id as keyof typeof xaiModels]
			return info ? { id, info } : { id, info: undefined }
		}
		case "groq": {
			const id = apiConfiguration.apiModelId ?? groqDefaultModelId
			const info = groqModels[id as keyof typeof groqModels]
			return { id, info }
		}
		case "huggingface": {
			const id = apiConfiguration.huggingFaceModelId ?? "meta-llama/Llama-3.3-70B-Instruct"
			const info = {
				maxTokens: 8192,
				contextWindow: 131072,
				supportsImages: false,
				supportsPromptCache: false,
			}
			return { id, info }
		}
		case "chutes": {
			const id = apiConfiguration.apiModelId ?? chutesDefaultModelId
			const info = chutesModels[id as keyof typeof chutesModels]
			return { id, info }
		}
		case "bedrock": {
			const id = apiConfiguration.apiModelId ?? bedrockDefaultModelId
			const baseInfo = bedrockModels[id as keyof typeof bedrockModels]

			// Special case for custom ARN.
			if (id === "custom-arn") {
				return {
					id,
					info: { maxTokens: 5000, contextWindow: 128_000, supportsPromptCache: false, supportsImages: true },
				}
			}

			// Apply 1M context for Claude Sonnet 4 / 4.5 when enabled
			if (BEDROCK_1M_CONTEXT_MODEL_IDS.includes(id as any) && apiConfiguration.awsBedrock1MContext && baseInfo) {
				// Create a new ModelInfo object with updated context window
				const info: ModelInfo = {
					...baseInfo,
					contextWindow: 1_000_000,
				}
				return { id, info }
			}

			return { id, info: baseInfo }
		}
		case "vertex": {
			const id = apiConfiguration.apiModelId ?? vertexDefaultModelId
			const info = vertexModels[id as keyof typeof vertexModels]
			return { id, info }
		}
		case "gemini": {
			const id = apiConfiguration.apiModelId ?? geminiDefaultModelId
			const info = geminiModels[id as keyof typeof geminiModels]
			return { id, info }
		}
		case "deepseek": {
			const id = apiConfiguration.apiModelId ?? deepSeekDefaultModelId
			const info = deepSeekModels[id as keyof typeof deepSeekModels]
			return { id, info }
		}
		case "doubao": {
			const id = apiConfiguration.apiModelId ?? doubaoDefaultModelId
			const info = doubaoModels[id as keyof typeof doubaoModels]
			return { id, info }
		}
		case "moonshot": {
			const id = apiConfiguration.apiModelId ?? moonshotDefaultModelId
			const info = moonshotModels[id as keyof typeof moonshotModels]
			return { id, info }
		}
		case "zai": {
			const isChina = apiConfiguration.zaiApiLine === "china_coding"
			const models = isChina ? mainlandZAiModels : internationalZAiModels
			const defaultModelId = isChina ? mainlandZAiDefaultModelId : internationalZAiDefaultModelId
			const id = apiConfiguration.apiModelId ?? defaultModelId
			const info = models[id as keyof typeof models]
			return { id, info }
		}
		case "openai-native": {
			const id = apiConfiguration.apiModelId ?? openAiNativeDefaultModelId
			const info = openAiNativeModels[id as keyof typeof openAiNativeModels]
			return { id, info }
		}
		case "mistral": {
			const id = apiConfiguration.apiModelId ?? mistralDefaultModelId
			const info = mistralModels[id as keyof typeof mistralModels]
			return { id, info }
		}
		case "openai": {
			const id = apiConfiguration.openAiModelId ?? ""
			const info = apiConfiguration?.openAiCustomModelInfo ?? openAiModelInfoSaneDefaults
			return { id, info }
		}
		case "ollama": {
			const id = apiConfiguration.ollamaModelId ?? ""
			const info = ollamaModels && ollamaModels[apiConfiguration.ollamaModelId!]

			const adjustedInfo =
				info?.contextWindow &&
				apiConfiguration?.ollamaNumCtx &&
				apiConfiguration.ollamaNumCtx < info.contextWindow
					? { ...info, contextWindow: apiConfiguration.ollamaNumCtx }
					: info

			return {
				id,
				info: adjustedInfo || undefined,
			}
		}
		case "lmstudio": {
			const id = apiConfiguration.lmStudioModelId ?? ""
			const info = lmStudioModels && lmStudioModels[apiConfiguration.lmStudioModelId!]
			return {
				id,
				info: info || undefined,
			}
		}
		case "deepinfra": {
			const id = apiConfiguration.deepInfraModelId ?? deepInfraDefaultModelId
			const info = routerModels.deepinfra?.[id]
			return { id, info }
		}
		case "vscode-lm": {
			const id = apiConfiguration?.vsCodeLmModelSelector
				? `${apiConfiguration.vsCodeLmModelSelector.vendor}/${apiConfiguration.vsCodeLmModelSelector.family}`
				: vscodeLlmDefaultModelId
			const modelFamily = apiConfiguration?.vsCodeLmModelSelector?.family ?? vscodeLlmDefaultModelId
			const info = vscodeLlmModels[modelFamily as keyof typeof vscodeLlmModels]
			return { id, info: { ...openAiModelInfoSaneDefaults, ...info, supportsImages: false } } // VSCode LM API currently doesn't support images.
		}
		case "claude-code": {
			// Claude Code models extend anthropic models but with images and prompt caching disabled
			const id = apiConfiguration.apiModelId ?? claudeCodeDefaultModelId
			const info = claudeCodeModels[id as keyof typeof claudeCodeModels]
			return { id, info: { ...openAiModelInfoSaneDefaults, ...info } }
		}
		case "cerebras": {
			const id = apiConfiguration.apiModelId ?? cerebrasDefaultModelId
			const info = cerebrasModels[id as keyof typeof cerebrasModels]
			return { id, info }
		}
		case "sambanova": {
			const id = apiConfiguration.apiModelId ?? sambaNovaDefaultModelId
			const info = sambaNovaModels[id as keyof typeof sambaNovaModels]
			return { id, info }
		}
		case "fireworks": {
			const id = apiConfiguration.apiModelId ?? fireworksDefaultModelId
			const info = fireworksModels[id as keyof typeof fireworksModels]
			return { id, info }
		}
		case "featherless": {
			const id = apiConfiguration.apiModelId ?? featherlessDefaultModelId
			const info = featherlessModels[id as keyof typeof featherlessModels]
			return { id, info }
		}
		case "io-intelligence": {
			const id = apiConfiguration.ioIntelligenceModelId ?? ioIntelligenceDefaultModelId
			const info =
				routerModels["io-intelligence"]?.[id] ?? ioIntelligenceModels[id as keyof typeof ioIntelligenceModels]
			return { id, info }
		}
		case "roo": {
			const requestedId = apiConfiguration.apiModelId

			// Check if the requested model exists in rooModels
			if (requestedId && rooModels[requestedId as keyof typeof rooModels]) {
				return {
					id: requestedId,
					info: rooModels[requestedId as keyof typeof rooModels],
				}
			}

			// Fallback to default model if requested model doesn't exist or is not specified
			return {
				id: rooDefaultModelId,
				info: rooModels[rooDefaultModelId as keyof typeof rooModels],
			}
		}
		case "qwen-code": {
			const id = apiConfiguration.apiModelId ?? qwenCodeDefaultModelId
			const info = qwenCodeModels[id as keyof typeof qwenCodeModels]
			return { id, info }
		}
		case "vercel-ai-gateway": {
			const id = apiConfiguration.vercelAiGatewayModelId ?? vercelAiGatewayDefaultModelId
			const info = routerModels["vercel-ai-gateway"]?.[id]
			return { id, info }
		}
		// case "anthropic":
		// case "human-relay":
		// case "fake-ai":
		default: {
			provider satisfies "anthropic" | "gemini-cli" | "qwen-code" | "human-relay" | "fake-ai" | "siliconflow" | "volcengine" | "dashscope"

			// 为不同供应商使用正确的模型ID字段
			let id: string
			switch (provider) {
				case "siliconflow":
					id = (apiConfiguration as any).siliconFlowModelId ?? anthropicDefaultModelId
					console.log('[useSelectedModel] SiliconFlow case:', {
						siliconFlowModelId: (apiConfiguration as any).siliconFlowModelId,
						selectedId: id,
						defaultId: anthropicDefaultModelId
					})
					break
				case "volcengine":
					id = (apiConfiguration as any).volcEngineModelId ?? anthropicDefaultModelId
					break
				case "dashscope":
					id = (apiConfiguration as any).dashScopeModelId ?? anthropicDefaultModelId
					break
				default:
					id = apiConfiguration.apiModelId ?? anthropicDefaultModelId
					break
			}

			const baseInfo = anthropicModels[id as keyof typeof anthropicModels]

			// Apply 1M context beta tier pricing for Claude Sonnet 4
			if (
				provider === "anthropic" &&
				(id === "claude-sonnet-4-20250514" || id === "claude-sonnet-4-5") &&
				apiConfiguration.anthropicBeta1MContext &&
				baseInfo
			) {
				// Type assertion since we know claude-sonnet-4-20250514 and claude-sonnet-4-5 have tiers
				const modelWithTiers = baseInfo as typeof baseInfo & {
					tiers?: Array<{
						contextWindow: number
						inputPrice?: number
						outputPrice?: number
						cacheWritesPrice?: number
						cacheReadsPrice?: number
					}>
				}
				const tier = modelWithTiers.tiers?.[0]
				if (tier) {
					// Create a new ModelInfo object with updated values
					const info: ModelInfo = {
						...baseInfo,
						contextWindow: tier.contextWindow,
						inputPrice: tier.inputPrice ?? baseInfo.inputPrice,
						outputPrice: tier.outputPrice ?? baseInfo.outputPrice,
						cacheWritesPrice: tier.cacheWritesPrice ?? baseInfo.cacheWritesPrice,
						cacheReadsPrice: tier.cacheReadsPrice ?? baseInfo.cacheReadsPrice,
					}
					return { id, info }
				}
			}

			return { id, info: baseInfo }
		}
	}
}
