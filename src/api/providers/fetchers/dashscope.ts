import axios from "axios"
import { z } from "zod"

import type { ModelInfo } from "@roo-code/types"
import type { ApiHandlerOptions } from "../../../shared/api"
import { parseApiPrice } from "../../../shared/cost"

/**
 * DashScope Model Schema (OpenAI Compatible)
 */
const dashScopeModelSchema = z.object({
	id: z.string(),
	object: z.string(),
	created: z.number().optional(),
	owned_by: z.string().optional(),
})

export type DashScopeModel = z.infer<typeof dashScopeModelSchema>

const dashScopeModelsResponseSchema = z.object({
	object: z.string(),
	data: z.array(dashScopeModelSchema),
})

type DashScopeModelsResponse = z.infer<typeof dashScopeModelsResponseSchema>

/**
 * Get DashScope models via OpenAI-compatible API
 */
export async function getDashScopeModels(options?: ApiHandlerOptions): Promise<Record<string, ModelInfo>> {
	const models: Record<string, ModelInfo> = {}
	const baseURL = options?.dashScopeBaseUrl || "https://dashscope.aliyuncs.com/compatible-mode/v1"

	try {
		const response = await axios.get<DashScopeModelsResponse>(`${baseURL}/models`, {
			headers: {
				"Authorization": `Bearer ${options?.dashScopeApiKey}`,
				"Content-Type": "application/json",
			},
		})

		const result = dashScopeModelsResponseSchema.safeParse(response.data)
		const data = result.success ? result.data.data : response.data.data

		if (!result.success) {
			console.error("DashScope models response is invalid", result.error.format())
		}

		for (const model of data) {
			const { id, owned_by } = model

			// Parse model info based on known DashScope model patterns
			models[id] = parseDashScopeModel(id, owned_by)
		}
	} catch (error) {
		console.error(
			`Error fetching DashScope models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
		)
	}

	return models
}

/**
 * Parse DashScope model into ModelInfo format
 */
function parseDashScopeModel(id: string, ownedBy?: string): ModelInfo {
	// Determine context window based on model name patterns
	let contextWindow = 8192 // default for Qwen models
	let maxTokens = 2048 // default
	let inputPrice = parseApiPrice("0.0005") // default
	let outputPrice = parseApiPrice("0.002") // default
	
	// Common DashScope/Qwen model patterns and their specifications
	if (id.includes("qwen-turbo")) {
		contextWindow = 8192
		maxTokens = 1500
		inputPrice = parseApiPrice("0.002") // 2元/1M tokens
		outputPrice = parseApiPrice("0.006") // 6元/1M tokens
	} else if (id.includes("qwen-plus")) {
		contextWindow = 32768
		maxTokens = 2000
		inputPrice = parseApiPrice("0.004") // 4元/1M tokens
		outputPrice = parseApiPrice("0.012") // 12元/1M tokens
	} else if (id.includes("qwen-max")) {
		contextWindow = 8192
		maxTokens = 2000
		inputPrice = parseApiPrice("0.02") // 20元/1M tokens
		outputPrice = parseApiPrice("0.06") // 60元/1M tokens
	} else if (id.includes("qwen-long")) {
		contextWindow = 1000000 // 1M context
		maxTokens = 2000
		inputPrice = parseApiPrice("0.0005") // 0.5元/1M tokens
		outputPrice = parseApiPrice("0.002") // 2元/1M tokens
	} else if (id.includes("qwen2.5")) {
		contextWindow = 32768
		maxTokens = 8192
		inputPrice = parseApiPrice("0.001")
		outputPrice = parseApiPrice("0.002")
	} else if (id.includes("qwen2")) {
		contextWindow = 32768
		maxTokens = 2048
		inputPrice = parseApiPrice("0.0007")
		outputPrice = parseApiPrice("0.002")
	}

	// Determine if model supports vision
	const supportsImages = id.includes("vl") || id.includes("vision") || id.includes("visual") || 
						   id.includes("multimodal")

	// Determine if it's a code model
	const isCodeModel = id.includes("coder") || id.includes("code")

	return {
		maxTokens,
		contextWindow,
		supportsImages,
		supportsComputerUse: false,
		inputPrice,
		outputPrice,
		supportsPromptCache: false,
		description: `DashScope ${id}${ownedBy ? ` (${ownedBy})` : ""}${isCodeModel ? " - Code Model" : ""}`,
	}
}