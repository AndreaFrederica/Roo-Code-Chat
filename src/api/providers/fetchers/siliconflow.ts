import axios from "axios"
import { z } from "zod"

import type { ModelInfo } from "@roo-code/types"
import type { ApiHandlerOptions } from "../../../shared/api"
import { parseApiPrice } from "../../../shared/cost"

/**
 * SiliconFlow Model Schema (OpenAI Compatible)
 */
const siliconFlowModelSchema = z.object({
	id: z.string(),
	object: z.string(),
	created: z.number().optional(),
	owned_by: z.string().optional(),
})

export type SiliconFlowModel = z.infer<typeof siliconFlowModelSchema>

const siliconFlowModelsResponseSchema = z.object({
	object: z.string(),
	data: z.array(siliconFlowModelSchema),
})

type SiliconFlowModelsResponse = z.infer<typeof siliconFlowModelsResponseSchema>

/**
 * Get SiliconFlow models via OpenAI-compatible API
 */
export async function getSiliconFlowModels(options?: ApiHandlerOptions): Promise<Record<string, ModelInfo>> {
	const models: Record<string, ModelInfo> = {}
	const baseURL = options?.siliconFlowBaseUrl || "https://api.siliconflow.cn/v1"

	try {
		const response = await axios.get<SiliconFlowModelsResponse>(`${baseURL}/models`, {
			headers: {
				"Authorization": `Bearer ${options?.siliconFlowApiKey}`,
				"Content-Type": "application/json",
			},
		})

		const result = siliconFlowModelsResponseSchema.safeParse(response.data)
		const data = result.success ? result.data.data : response.data.data

		if (!result.success) {
			console.error("SiliconFlow models response is invalid", result.error.format())
		}

		for (const model of data) {
			const { id, owned_by } = model

			// Parse model info based on known SiliconFlow model patterns
			models[id] = parseSiliconFlowModel(id, owned_by)
		}
	} catch (error) {
		console.error(
			`Error fetching SiliconFlow models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
		)
	}

	return models
}

/**
 * Parse SiliconFlow model into ModelInfo format
 */
function parseSiliconFlowModel(id: string, ownedBy?: string): ModelInfo {
	// Determine context window based on model name patterns
	let contextWindow = 4096 // default
	let maxTokens = 4096 // default
	
	// Common SiliconFlow model patterns and their context windows
	if (id.includes("32k") || id.includes("32K")) {
		contextWindow = 32768
		maxTokens = 8192
	} else if (id.includes("128k") || id.includes("128K")) {
		contextWindow = 131072
		maxTokens = 8192
	} else if (id.includes("8k") || id.includes("8K")) {
		contextWindow = 8192
		maxTokens = 4096
	} else if (id.includes("qwen")) {
		contextWindow = 32768
		maxTokens = 8192
	} else if (id.includes("llama")) {
		contextWindow = 8192
		maxTokens = 4096
	} else if (id.includes("deepseek")) {
		contextWindow = 32768
		maxTokens = 8192
	}

	// Determine if model supports vision
	const supportsImages = id.includes("vision") || id.includes("vl") || id.includes("visual")

	// Determine pricing (many models are free on SiliconFlow)
	const isFreeModel = id.includes("9b") || id.includes("7b") || id.includes("3b") || 
					   id.includes("1.5b") || id.includes("0.5b")
	
	const inputPrice = isFreeModel ? 0 : parseApiPrice("0.0001") // Default small price for paid models
	const outputPrice = isFreeModel ? 0 : parseApiPrice("0.0002")

	return {
		maxTokens,
		contextWindow,
		supportsImages,
		supportsComputerUse: false,
		inputPrice,
		outputPrice,
		supportsPromptCache: false,
		description: `SiliconFlow ${id}${ownedBy ? ` (${ownedBy})` : ""}`,
	}
}