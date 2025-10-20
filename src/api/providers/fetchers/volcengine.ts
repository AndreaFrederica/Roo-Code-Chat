import axios from "axios"
import { z } from "zod"

import type { ModelInfo } from "@roo-code/types"
import type { ApiHandlerOptions } from "../../../shared/api"
import { parseApiPrice } from "../../../shared/cost"

/**
 * VolcEngine Model Schema (OpenAI Compatible)
 */
const volcEngineModelSchema = z.object({
	id: z.string(),
	object: z.string(),
	created: z.number().optional(),
	owned_by: z.string().optional(),
})

export type VolcEngineModel = z.infer<typeof volcEngineModelSchema>

const volcEngineModelsResponseSchema = z.object({
	object: z.string(),
	data: z.array(volcEngineModelSchema),
})

type VolcEngineModelsResponse = z.infer<typeof volcEngineModelsResponseSchema>

/**
 * Get VolcEngine models via OpenAI-compatible API
 */
export async function getVolcEngineModels(options?: ApiHandlerOptions): Promise<Record<string, ModelInfo>> {
	const models: Record<string, ModelInfo> = {}
	const baseURL = options?.volcEngineBaseUrl || "https://ark.cn-beijing.volces.com/api/v3"

	try {
		const response = await axios.get<VolcEngineModelsResponse>(`${baseURL}/models`, {
			headers: {
				"Authorization": `Bearer ${options?.volcEngineApiKey}`,
				"Content-Type": "application/json",
			},
		})

		const result = volcEngineModelsResponseSchema.safeParse(response.data)
		const data = result.success ? result.data.data : response.data.data

		if (!result.success) {
			console.error("VolcEngine models response is invalid", result.error.format())
		}

		for (const model of data) {
			const { id, owned_by } = model

			// Parse model info based on known VolcEngine model patterns
			models[id] = parseVolcEngineModel(id, owned_by)
		}
	} catch (error) {
		console.error(
			`Error fetching VolcEngine models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
		)
	}

	return models
}

/**
 * Parse VolcEngine model into ModelInfo format
 */
function parseVolcEngineModel(id: string, ownedBy?: string): ModelInfo {
	// Determine context window based on model name patterns
	let contextWindow = 4096 // default
	let maxTokens = 4096 // default
	
	// Common VolcEngine/Doubao model patterns and their context windows
	if (id.includes("32k") || id.includes("32K")) {
		contextWindow = 32768
		maxTokens = 8192
	} else if (id.includes("128k") || id.includes("128K")) {
		contextWindow = 131072
		maxTokens = 8192
	} else if (id.includes("8k") || id.includes("8K")) {
		contextWindow = 8192
		maxTokens = 4096
	} else if (id.includes("doubao") || id.includes("豆包")) {
		// Doubao models typically have larger context windows
		contextWindow = 32768
		maxTokens = 8192
	} else if (id.includes("pro")) {
		contextWindow = 32768
		maxTokens = 8192
	} else if (id.includes("lite")) {
		contextWindow = 8192
		maxTokens = 4096
	}

	// Determine if model supports vision
	const supportsImages = id.includes("vision") || id.includes("vl") || id.includes("visual") || 
						   id.includes("multimodal")

	// Determine if it's a code model
	const isCodeModel = id.includes("coder") || id.includes("code")

	// VolcEngine pricing is generally competitive
	const inputPrice = parseApiPrice("0.0008") // Approximate pricing
	const outputPrice = parseApiPrice("0.002")

	return {
		maxTokens,
		contextWindow,
		supportsImages,
		supportsComputerUse: false,
		inputPrice,
		outputPrice,
		supportsPromptCache: false,
		description: `VolcEngine ${id}${ownedBy ? ` (${ownedBy})` : ""}${isCodeModel ? " - Code Model" : ""}`,
	}
}