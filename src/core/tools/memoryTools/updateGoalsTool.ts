import type { Tool } from "@roo-code/types"
import { z } from "zod"
import { parseXmlGoals } from "./xml-parser.js"
import { Task } from "../../task/Task"
import { ToolUse } from "../../../shared/tools"
import { normalizeToolArgs } from "./normalizeArgs.js"

export const updateGoalsTool: Tool = {
	name: "update_goals",
	displayName: "更新角色目标",
	description: "更新或添加角色的目标记忆，如短期目标、长期目标、愿望等",
	parameters: {
		properties: {
			xml_goals: {
				type: "string",
				description: "XML格式的目标数据，包含完整的目标信息。格式：<goals><goal><value>目标描述</value><priority>80</priority><is_constant>false</is_constant><keywords>关键词1,关键词2</keywords></goal></goals>",
			},
			user_message: {
				type: "string",
				description: "AI告诉用户的提示词，用于提升用户体验。例如：'我记下了你的目标，会支持你实现它们'",
			},
		},
		required: ["xml_goals", "user_message"],
	},
	execute: async (args, _, provider) => {
		// 保持兼容性，内部调用函数式实现
		return await updateGoalsFunction(provider, { args: args } as any)
	},
}

// 函数式实现，参考 askFollowupQuestionTool 的模式
export async function updateGoalsFunction(
	cline: Task,
	block: ToolUse
): Promise<{ success: boolean; message?: string; error?: string; updatedCount?: number }> {

	// 直接从 block.params 获取参数，支持参数包装
	let xml_goals: string | undefined = (block.params as any).xml_goals
	let user_message: string | undefined = (block.params as any).user_message

	console.log(`[MemoryTool Debug] updateGoalsFunction called`)
	console.log(`[MemoryTool Debug] block.params keys: ${Object.keys(block.params || {})}`)
	console.log(`[MemoryTool Debug] 直接访问 xml_goals:`, xml_goals ? "✅ 存在" : "❌ 不存在")
	console.log(`[MemoryTool Debug] 直接访问 user_message:`, user_message ? "✅ 存在" : "❌ 不存在")

	// 如果直接访问失败，检查是否有参数包装
	const rawArgs = (block.params as any).args
	console.log(`[MemoryTool Debug] block.params.args 类型:`, typeof rawArgs)
	if (typeof rawArgs === "string") {
		console.log(`[MemoryTool Debug] block.params.args 长度:`, rawArgs.length)
	} else {
		console.log(`[MemoryTool Debug] block.params.args 内容:`, rawArgs)
	}

	const argsWrapper = normalizeToolArgs(rawArgs)

	if (!xml_goals && argsWrapper) {
		console.log(`[MemoryTool Debug] 检测到参数包装，从 block.params.args 获取`)
		const goalsFromArgs = (argsWrapper as any).xml_goals
		const userMessageFromArgs = (argsWrapper as any).user_message
		if (typeof goalsFromArgs === "string") {
			xml_goals = goalsFromArgs
		}
		if (typeof userMessageFromArgs === "string") {
			user_message = userMessageFromArgs
		}
		console.log(`[MemoryTool Debug] 包装后 xml_goals:`, xml_goals ? "✅ 存在" : "❌ 不存在")
		console.log(`[MemoryTool Debug] 包装后 user_message:`, user_message ? "✅ 存在" : "❌ 不存在")
	}

	if (!xml_goals && typeof rawArgs === "string") {
		const match = rawArgs.match(/<xml_goals[^>]*>([\s\S]*?)<\/xml_goals>/i)
		if (match) {
			xml_goals = match[1].trim()
			console.log(`[MemoryTool Debug] 通过正则解析 xml_goals:`, xml_goals ? "✅ 成功" : "❌ 失败")
		}
	}

	if (!user_message && typeof rawArgs === "string") {
		const match = rawArgs.match(/<user_message[^>]*>([\s\S]*?)<\/user_message>/i)
		if (match) {
			user_message = match[1].trim()
			console.log(`[MemoryTool Debug] 通过正则解析 user_message:`, user_message ? "✅ 成功" : "❌ 失败")
		}
	}

	console.log(`[MemoryTool Debug] 最终 xml_goals:`, xml_goals ? xml_goals.substring(0, 100) + "..." : "undefined")
	console.log(`[MemoryTool Debug] 最终 user_message:`, user_message)

	const provider = cline.providerRef?.deref()
	if (!provider?.anhChatServices?.roleMemoryTriggerService) {
		return {
			success: false,
			error: "记忆服务未初始化"
		}
	}

	// 参数验证
	if (!xml_goals) {
		provider.log(`[MemoryTool] 错误：xml_goals参数为undefined`)
		return {
			success: false,
			error: "xml_goals参数缺失，请确保正确传递XML数据"
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

		const goals = parseXmlGoals(xml_goals)
		console.log(`[MemoryTool Debug] updateGoals 解析结果:`, JSON.stringify(goals, null, 2))

		if (goals.length === 0) {
			return {
				success: false,
				error: "至少需要提供一个有效的目标"
			}
		}

		// 更新目标记忆
		await memoryService.updateGoals(roleUuid, goals)

		provider.log(`[MemoryTool] Updated ${goals.length} goals`)

		return {
			success: true,
			updatedCount: goals.length,
			message: `成功更新了 ${goals.length} 个角色目标`
		}

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		provider.log(`[MemoryTool] Failed to update goals: ${errorMessage}`)
		return {
			success: false,
			error: `更新角色目标失败: ${errorMessage}`
		}
	}
}

// 参数验证schema
export const updateGoalsSchema = z.object({
	goals: z.array(z.string()).min(1, "至少需要一个目标")
})
