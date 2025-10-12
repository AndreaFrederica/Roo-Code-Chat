import type { Tool } from "@roo-code/types"
import { z } from "zod"
import { Task } from "../../task/Task"
import { ToolUse } from "../../../shared/tools"
import { normalizeToolArgs } from "./normalizeArgs.js"

export const cleanupMemoriesTool: Tool = {
	name: "cleanup_memories",
	displayName: "清理过期记忆",
	description: "清理过期的记忆，保持记忆系统的健康和高效",
	parameters: {
		properties: {
			max_age_days: {
				type: "number",
				description: "记忆的最大保存天数，超过这个天数的非重要记忆将被清理，默认30天",
				optional: true,
			},
			dry_run: {
				type: "boolean",
				description: "是否为试运行模式，试运行模式只显示将要清理的记忆而不实际删除",
				optional: true,
			},
		},
		required: [],
	},
	execute: async (args, _, provider) => {
		// 保持兼容性，内部调用函数式实现
		return await cleanupMemoriesFunction(provider, { args: args } as any)
	},
}

// 函数式实现，参考 askFollowupQuestionTool 的模式
export async function cleanupMemoriesFunction(
	cline: Task,
	block: ToolUse
): Promise<{ success: boolean; message?: string; error?: string; dry_run?: boolean; expired_count?: number; cleaned_count?: number; sample_memories?: any[] }> {

	// 直接从 block.params 获取参数，支持参数包装
	let max_age_days: number | undefined = (block.params as any).max_age_days
	let dry_run: boolean | undefined = (block.params as any).dry_run

	console.log(`[MemoryTool Debug] cleanupMemoriesFunction called`)
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

	if (argsWrapper) {
		console.log(`[MemoryTool Debug] 检测到参数包装，从 block.params.args 获取`)
		const maxAgeFromArgs = (argsWrapper as any).max_age_days
		const dryRunFromArgs = (argsWrapper as any).dry_run

		if (!max_age_days) {
			if (typeof maxAgeFromArgs === "number") {
				max_age_days = maxAgeFromArgs
			} else if (typeof maxAgeFromArgs === "string" && maxAgeFromArgs.trim()) {
				const parsed = Number(maxAgeFromArgs)
				if (!Number.isNaN(parsed)) {
					max_age_days = parsed
				}
			}
		}

		if (dry_run === undefined) {
			if (typeof dryRunFromArgs === "boolean") {
				dry_run = dryRunFromArgs
			} else if (typeof dryRunFromArgs === "string" && dryRunFromArgs.trim()) {
				dry_run = dryRunFromArgs.trim().toLowerCase() === "true"
			}
		}
	}

	if (max_age_days === undefined && typeof rawArgs === "string") {
		const match = rawArgs.match(/<max_age_days[^>]*>([\s\S]*?)<\/max_age_days>/i)
		if (match) {
			const parsed = Number(match[1].trim())
			if (!Number.isNaN(parsed)) {
				max_age_days = parsed
				console.log(`[MemoryTool Debug] 通过正则解析 max_age_days:`, max_age_days)
			}
		}
	}

	if (dry_run === undefined && typeof rawArgs === "string") {
		const match = rawArgs.match(/<dry_run[^>]*>([\s\S]*?)<\/dry_run>/i)
		if (match) {
			const value = match[1].trim().toLowerCase()
			dry_run = value === "true"
			console.log(`[MemoryTool Debug] 通过正则解析 dry_run:`, dry_run)
		}
	}

	console.log(`[MemoryTool Debug] 最终 max_age_days:`, max_age_days)
	console.log(`[MemoryTool Debug] 最终 dry_run:`, dry_run)

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

		const maxAgeDays = max_age_days || 30
		const dryRun = dry_run !== undefined ? dry_run : true

		// 获取过期记忆列表
		const allMemories = await memoryService.searchMemories(roleUuid, "")
		const maxAge = maxAgeDays * 24 * 60 * 60 * 1000
		const cutoffTime = Date.now() - maxAge

		const expiredMemories = allMemories.filter((memory: any) => {
			// 排除常驻记忆和高优先级记忆
			if (memory.isConstant || memory.priority >= 80) {
				return false
			}

			// 排除最近访问的记忆
			if (memory.lastAccessed >= cutoffTime) {
				return false
			}

			// 检查创建时间
			return memory.timestamp < cutoffTime
		})

		if (dryRun) {
			// 试运行模式，只返回将要清理的记忆
			const formattedExpiredMemories = expiredMemories.slice(0, 10).map((memory: any) => ({
				id: memory.id,
				type: memory.type,
				content: memory.content.substring(0, 80) + (memory.content.length > 80 ? "..." : ""),
				created: new Date(memory.timestamp).toLocaleString(),
				last_accessed: new Date(memory.lastAccessed).toLocaleString(),
				priority: memory.priority
			}))

			provider.log(`[MemoryTool] Cleanup dry run: found ${expiredMemories.length} expired memories`)

			return {
				success: true,
				dry_run: true,
				expired_count: expiredMemories.length,
				sample_memories: formattedExpiredMemories,
				message: `试运行模式：发现 ${expiredMemories.length} 条过期记忆（${maxAgeDays}天前）`
			}
		} else {
			// 实际执行清理
			await memoryService.cleanupExpiredMemories(roleUuid, maxAge)

			provider.log(`[MemoryTool] Cleaned up ${expiredMemories.length} expired memories`)

			return {
				success: true,
				dry_run: false,
				cleaned_count: expiredMemories.length,
				message: `成功清理了 ${expiredMemories.length} 条过期记忆`
			}
		}

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		provider.log(`[MemoryTool] Failed to cleanup memories: ${errorMessage}`)
		return {
			success: false,
			error: `清理记忆失败: ${errorMessage}`
		}
	}
}

// 参数验证schema
export const cleanupMemoriesSchema = z.object({
	max_age_days: z.number().min(1).max(365).optional(),
	dry_run: z.boolean().optional()
})
