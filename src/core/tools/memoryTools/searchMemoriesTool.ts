import type { Tool } from "@roo-code/types"
import { z } from "zod"
import { Task } from "../../task/Task"
import { ToolUse } from "../../../shared/tools"
import { normalizeToolArgs } from "./normalizeArgs.js"

export const searchMemoriesTool: Tool = {
	name: "search_memories",
	displayName: "搜索记忆",
	description: "根据关键词搜索角色的记忆，帮助回忆相关信息",
	parameters: {
		properties: {
			search_text: {
				type: "string",
				description: "要搜索的文本内容",
			},
			memory_types: {
				type: "array",
				items: {
					type: "string"
				},
				description: "要搜索的记忆类型，默认搜索所有类型",
				optional: true,
			},
			max_results: {
				type: "number",
				description: "返回的最大结果数量，默认为10",
				optional: true,
			},
			user_message: {
				type: "string",
				description: "AI告诉用户的提示词，用于提升用户体验。例如：'让我在记忆中搜索一下相关信息...'",
				optional: true,
			},
		},
		required: ["search_text"],
	},
	execute: async (args, _, provider) => {
		// 保持兼容性，内部调用函数式实现
		return await searchMemoriesFunction(provider, { args: args } as any)
	},
}

// 函数式实现，参考 askFollowupQuestionTool 的模式
export async function searchMemoriesFunction(
	cline: Task,
	block: ToolUse
): Promise<{ success: boolean; results?: any[]; total_found?: number; message?: string; error?: string }> {

	// 直接从 block.params 获取参数，支持参数包装
	let search_text: string | undefined = (block.params as any).search_text
	let memory_types: string[] | undefined = (block.params as any).memory_types
	let max_results: number | undefined = (block.params as any).max_results
	let user_message: string | undefined = (block.params as any).user_message

	console.log(`[MemoryTool Debug] searchMemoriesFunction called`)
	console.log(`[MemoryTool Debug] block.params keys: ${Object.keys(block.params || {})}`)
	console.log(`[MemoryTool Debug] 直接访问 search_text:`, search_text ? "✅ 存在" : "❌ 不存在")

	// 如果直接访问失败，检查是否有参数包装
	const rawArgs = (block.params as any).args
	console.log(`[MemoryTool Debug] block.params.args 类型:`, typeof rawArgs)
	if (typeof rawArgs === "string") {
		console.log(`[MemoryTool Debug] block.params.args 长度:`, rawArgs.length)
	} else {
		console.log(`[MemoryTool Debug] block.params.args 内容:`, rawArgs)
	}

	const argsWrapper = normalizeToolArgs(rawArgs)

	const normalizeMemoryTypes = (value: unknown): string[] | undefined => {
		if (!value) {
			return undefined
		}
		if (Array.isArray(value)) {
			return value.map((item) => String(item).trim()).filter(Boolean)
		}
		if (typeof value === "string") {
			const trimmed = value.trim()
			if (!trimmed) {
				return undefined
			}
			try {
				const parsed = JSON.parse(trimmed)
				if (Array.isArray(parsed)) {
					return parsed.map((item) => String(item).trim()).filter(Boolean)
				}
			} catch {
				// ignore
			}
			return trimmed.split(/[,，]/).map((item) => item.trim()).filter(Boolean)
		}
		return undefined
	}

	const normalizeNumber = (value: unknown): number | undefined => {
		if (typeof value === "number") {
			return value
		}
		if (typeof value === "string" && value.trim()) {
			const parsed = Number(value.trim())
			return Number.isNaN(parsed) ? undefined : parsed
		}
		return undefined
	}

	if (!search_text && argsWrapper) {
		console.log(`[MemoryTool Debug] 检测到参数包装，从 block.params.args 获取`)
		const searchFromArgs = (argsWrapper as any).search_text
		const memoryTypesFromArgs = (argsWrapper as any).memory_types
		const maxResultsFromArgs = (argsWrapper as any).max_results
		const userMessageFromArgs = (argsWrapper as any).user_message

		if (typeof searchFromArgs === "string") {
			search_text = searchFromArgs
		}

		if (!memory_types) {
			memory_types = normalizeMemoryTypes(memoryTypesFromArgs)
		}

		if (max_results === undefined) {
			const parsed = normalizeNumber(maxResultsFromArgs)
			if (parsed !== undefined) {
				max_results = parsed
			}
		}

		if (!user_message && typeof userMessageFromArgs === "string") {
			user_message = userMessageFromArgs
		}

		console.log(`[MemoryTool Debug] 包装后 search_text:`, search_text ? "✅ 存在" : "❌ 不存在")
		console.log(`[MemoryTool Debug] 包装后 memory_types:`, memory_types ? JSON.stringify(memory_types) : "❌ 不存在")
		console.log(`[MemoryTool Debug] 包装后 max_results:`, max_results !== undefined ? max_results : "❌ 不存在")
		console.log(`[MemoryTool Debug] 包装后 user_message:`, user_message ? "✅ 存在" : "❌ 不存在")
	}

	if (!search_text && typeof rawArgs === "string") {
		const match = rawArgs.match(/<search_text[^>]*>([\s\S]*?)<\/search_text>/i)
		if (match) {
			search_text = match[1].trim()
			console.log(`[MemoryTool Debug] 通过正则解析 search_text:`, search_text ? "✅ 成功" : "❌ 失败")
		}
	}

	if (!memory_types && typeof rawArgs === "string") {
		const match = rawArgs.match(/<memory_types[^>]*>([\s\S]*?)<\/memory_types>/i)
		if (match) {
			const parsed = normalizeMemoryTypes(match[1])
			if (parsed) {
				memory_types = parsed
				console.log(`[MemoryTool Debug] 通过正则解析 memory_types:`, JSON.stringify(memory_types))
			}
		}
	}

	if (max_results === undefined && typeof rawArgs === "string") {
		const match = rawArgs.match(/<max_results[^>]*>([\s\S]*?)<\/max_results>/i)
		if (match) {
			const parsed = normalizeNumber(match[1])
			if (parsed !== undefined) {
				max_results = parsed
				console.log(`[MemoryTool Debug] 通过正则解析 max_results:`, max_results)
			}
		}
	}

	if (!user_message && typeof rawArgs === "string") {
		const match = rawArgs.match(/<user_message[^>]*>([\s\S]*?)<\/user_message>/i)
		if (match) {
			user_message = match[1].trim()
			console.log(`[MemoryTool Debug] 通过正则解析 user_message:`, user_message ? "✅ 成功" : "❌ 失败")
		}
	}

	console.log(`[MemoryTool Debug] 最终 search_text:`, search_text)
	console.log(`[MemoryTool Debug] 最终 memory_types:`, memory_types)
	console.log(`[MemoryTool Debug] 最终 max_results:`, max_results)
	console.log(`[MemoryTool Debug] 最终 user_message:`, user_message)

	const provider = cline.providerRef?.deref()
	if (!provider?.anhChatServices?.roleMemoryTriggerService) {
		return {
			success: false,
			error: "记忆服务未初始化"
		}
	}

	// 参数验证
	if (!search_text) {
		provider.log(`[MemoryTool] 错误：search_text参数为undefined`)
		return {
			success: false,
			error: "search_text参数缺失，请提供搜索关键词"
		}
	}

	try {
		const currentTask = provider.getCurrentTask()
		if (!currentTask) {
			return {
				success: false,
				error: "没有活跃的任务"
			}
		}

		const rolePromptData = await provider.getRolePromptData()
		if (!rolePromptData?.role?.uuid) {
			return {
				success: false,
				error: "无法获取角色信息"
			}
		}

		const memoryService = provider.anhChatServices.roleMemoryTriggerService
		const roleUuid = rolePromptData.role.uuid

		// 搜索记忆
		const memories = await memoryService.searchMemories(roleUuid, search_text)

		// 按类型过滤
		let filteredMemories = memories
		if (memory_types && !memory_types.includes("all")) {
			filteredMemories = memories.filter((memory: any) =>
				memory_types!.includes(memory.type)
			)
		}

		// 限制结果数量
		const maxResults = max_results || 10
		const limitedMemories = filteredMemories.slice(0, maxResults)

		// 格式化结果
		const formattedResults = limitedMemories.map((memory: any) => ({
			id: memory.id,
			type: memory.type,
			content: memory.content,
			keywords: memory.keywords,
			priority: memory.priority,
			timestamp: new Date(memory.timestamp).toLocaleString(),
			is_constant: memory.isConstant,
			related_topics: memory.relatedTopics,
			emotional_context: memory.emotionalContext
		}))

		provider.log(`[MemoryTool] Searched memories: found ${filteredMemories.length}, returned ${formattedResults.length}`)

		return {
			success: true,
			results: formattedResults,
			total_found: filteredMemories.length,
			message: `找到 ${filteredMemories.length} 条相关记忆，返回前 ${formattedResults.length} 条`
		}

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		provider.log(`[MemoryTool] Failed to search memories: ${errorMessage}`)
		return {
			success: false,
			error: `搜索记忆失败: ${errorMessage}`
		}
	}
}

// 参数验证schema
export const searchMemoriesSchema = z.object({
	search_text: z.string().min(1, "搜索文本不能为空"),
	memory_types: z.array(z.enum(["episodic", "semantic", "traits", "goals", "all"])).optional(),
	max_results: z.number().min(1).max(50).optional()
})
