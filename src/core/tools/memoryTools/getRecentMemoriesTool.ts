import type { Tool } from "@roo-code/types"
import { z } from "zod"
import { Task } from "../../task/Task"
import { ToolUse } from "../../../shared/tools"
import { normalizeToolArgs } from "./normalizeArgs.js"

export const getRecentMemoriesTool: Tool = {
	name: "get_recent_memories",
	displayName: "获取最近记忆",
	description: "获取最近访问的记忆，帮助快速回忆最近的对话和事件",
	parameters: {
		properties: {
			limit: {
				type: "number",
				description: "返回的记忆数量，默认为10",
				optional: true,
			},
			memory_types: {
				type: "array",
				items: {
					type: "string"
				},
				description: "要获取的记忆类型，默认包含所有类型",
				optional: true,
			},
		},
		required: [],
	},
	execute: async (args, _, provider) => {
		// 保持兼容性，内部调用函数式实现
		return await getRecentMemoriesFunction(provider, { args: args } as any)
	},
}

// 函数式实现，参考 askFollowupQuestionTool 的模式
export async function getRecentMemoriesFunction(
	cline: Task,
	block: ToolUse
): Promise<{ success: boolean; memories?: any[]; total_available?: number; message?: string; error?: string }> {

	// 直接从 block.params 获取参数，支持参数包装
	let limit: number | undefined = (block.params as any).limit
	let memory_types: string[] | undefined = (block.params as any).memory_types

	console.log(`[MemoryTool Debug] getRecentMemoriesFunction called`)
	console.log(`[MemoryTool Debug] block.params keys: ${Object.keys(block.params || {})}`)

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

	if (argsWrapper) {
		console.log(`[MemoryTool Debug] 检测到参数包装，从 block.params.args 获取`)
		if (!limit) {
			const limitFromArgs = (argsWrapper as any).limit
			const parsed = normalizeNumber(limitFromArgs)
			if (parsed !== undefined) {
				limit = parsed
			}
		}
		if (!memory_types) {
			const memoryTypesFromArgs = (argsWrapper as any).memory_types
			memory_types = normalizeMemoryTypes(memoryTypesFromArgs)
		}
	}

	if (!limit && typeof rawArgs === "string") {
		const match = rawArgs.match(/<limit[^>]*>([\s\S]*?)<\/limit>/i)
		if (match) {
			const parsed = normalizeNumber(match[1])
			if (parsed !== undefined) {
				limit = parsed
				console.log(`[MemoryTool Debug] 通过正则解析 limit:`, limit)
			}
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

	console.log(`[MemoryTool Debug] 最终 limit:`, limit)
	console.log(`[MemoryTool Debug] 最终 memory_types:`, memory_types)

	const provider = cline.providerRef?.deref()
	if (!provider?.anhChatServices?.roleMemoryTriggerService) {
		return {
			success: false,
			error: "记忆服务未初始化"
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

		const finalLimit = limit || 10

		// 获取最近记忆
		const recentMemories = await memoryService.getRecentMemories(roleUuid, finalLimit * 2) // 获取更多以便过滤

		// 调试信息
		provider.log(`[MemoryTool] Debug: roleUuid = ${roleUuid}`)
		provider.log(`[MemoryTool] Debug: recentMemories count = ${recentMemories.length}`)
		if (recentMemories.length > 0) {
			provider.log(`[MemoryTool] Debug: first memory = ${JSON.stringify(recentMemories[0], null, 2)}`)
		}

		// 按类型过滤
		let filteredMemories = recentMemories
		if (memory_types && !memory_types.includes("all")) {
			filteredMemories = recentMemories.filter((memory: any) =>
				memory_types!.includes(memory.type)
			)
			provider.log(`[MemoryTool] Debug: filtered by types ${JSON.stringify(memory_types)}, count = ${filteredMemories.length}`)
		}

		// 限制结果数量
		const limitedMemories = filteredMemories.slice(0, finalLimit)
		provider.log(`[MemoryTool] Debug: limited to ${finalLimit}, final count = ${limitedMemories.length}`)

		// 格式化结果
		const formattedMemories = limitedMemories.map((memory: any) => ({
			id: memory.id,
			type: memory.type,
			content: memory.content,
			keywords: memory.keywords,
			priority: memory.priority,
			timestamp: new Date(memory.timestamp).toLocaleString(),
			last_accessed: new Date(memory.lastAccessed).toLocaleString(),
			access_count: memory.accessCount,
			is_constant: memory.isConstant,
			related_topics: memory.relatedTopics,
			emotional_context: memory.emotionalContext
		}))

		provider.log(`[MemoryTool] Retrieved recent memories: ${formattedMemories.length}`)

		return {
			success: true,
			memories: formattedMemories,
			total_available: filteredMemories.length,
			message: `获取了 ${formattedMemories.length} 条最近记忆`
		}

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		provider.log(`[MemoryTool] Failed to get recent memories: ${errorMessage}`)
		return {
			success: false,
			error: `获取最近记忆失败: ${errorMessage}`
		}
	}
}

// 参数验证schema
export const getRecentMemoriesSchema = z.object({
	limit: z.number().min(1).max(50).optional(),
	memory_types: z.array(z.enum(["episodic", "semantic", "traits", "goals", "all"])).optional()
})
