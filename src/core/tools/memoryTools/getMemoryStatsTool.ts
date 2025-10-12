import type { Tool } from "@roo-code/types"
import { z } from "zod"
import { Task } from "../../task/Task"
import { ToolUse } from "../../../shared/tools"

export const getMemoryStatsTool: Tool = {
	name: "get_memory_stats",
	displayName: "获取记忆统计",
	description: "获取角色记忆的统计信息，了解记忆的数量和分布情况",
	parameters: {
		properties: {},
		required: [],
	},
	execute: async (args, _, provider) => {
		// 保持兼容性，内部调用函数式实现
		return await getMemoryStatsFunction(provider, { args: args } as any)
	},
}

// 函数式实现，参考 askFollowupQuestionTool 的模式
export async function getMemoryStatsFunction(
	cline: Task,
	block: ToolUse
): Promise<{ success: boolean; stats?: any; message?: string; error?: string }> {

	console.log(`[MemoryTool Debug] getMemoryStatsFunction called`)
	console.log(`[MemoryTool Debug] block.params keys: ${Object.keys(block.params || {})}`)

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

		// 获取记忆统计
		const stats = await memoryService.getMemoryStats(roleUuid)

		// 获取常驻记忆数量
		const constantMemories = await memoryService.getConstantMemories(roleUuid)

		// 获取最近记忆
		const recentMemories = await memoryService.getRecentMemories(roleUuid, 5)

		// 获取高优先级记忆
		const highPriorityMemories = await memoryService.getHighPriorityMemories(roleUuid, 80)

		const formattedStats = {
			total: stats.total,
			byType: {
				episodic: stats.byType.episodic || 0,
				semantic: stats.byType.semantic || 0,
				traits: stats.byType.traits || 0,
				goals: stats.byType.goals || 0
			},
			constant_count: constantMemories.length,
			recent_access_24h: stats.recentAccess,
			average_access_count: Math.round(stats.averageAccessCount * 100) / 100,
			high_priority_count: highPriorityMemories.length,
			recent_memories: recentMemories.slice(0, 3).map((memory: any) => ({
				id: memory.id,
				type: memory.type,
				content: memory.content.substring(0, 100) + (memory.content.length > 100 ? "..." : ""),
				last_accessed: new Date(memory.lastAccessed).toLocaleString()
			}))
		}

		provider.log(`[MemoryTool] Retrieved memory stats: total ${stats.total}`)

		return {
			success: true,
			stats: formattedStats,
			message: "记忆统计信息获取成功"
		}

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		provider.log(`[MemoryTool] Failed to get memory stats: ${errorMessage}`)
		return {
			success: false,
			error: `获取记忆统计失败: ${errorMessage}`
		}
	}
}

// 参数验证schema
export const getMemoryStatsSchema = z.object({})