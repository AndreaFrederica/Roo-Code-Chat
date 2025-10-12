import type { Tool } from "@roo-code/types"
import { z } from "zod"
import { parseXmlTraits } from "./xml-parser.js"
import { Task } from "../../task/Task"
import { ToolUse } from "../../../shared/tools"
import { normalizeToolArgs } from "./normalizeArgs.js"

/**
 * 将对象转换回XML字符串
 */
function objectToXmlString(obj: any): string {
	if (typeof obj !== 'object' || obj === null) {
		return String(obj)
	}

	let xml = ''
	for (const [key, value] of Object.entries(obj)) {
		if (key === '#text') {
			xml += value
		} else if (typeof value === 'object' && value !== null) {
			if ('#text' in value) {
				xml += `<${key}>${value['#text']}</${key}>`
			} else {
				xml += `<${key}>${objectToXmlString(value)}</${key}>`
			}
		} else {
			xml += `<${key}>${value}</${key}>`
		}
	}
	return xml
}

export const updateTraitsTool: Tool = {
	name: "update_traits",
	displayName: "更新角色特质",
	description: "更新或添加角色的特质记忆，如性格特点、习惯、偏好等",
	parameters: {
		properties: {
			xml_traits: {
				type: "string",
				description: "XML格式的特质数据，包含完整的特质信息。格式：<traits><trait><name>友善</name><value>对陌生人很友好</value><confidence>0.8</confidence><priority>70</priority><is_constant>true</is_constant><keywords>社交,友好</keywords></trait></traits>",
			},
			user_message: {
				type: "string",
				description: "AI告诉用户的提示词，用于提升用户体验。例如：'我对你的理解又加深了一些'",
			},
		},
		required: ["xml_traits", "user_message"],
	},
	execute: async (args, _, provider) => {
		// 保持兼容性，内部调用函数式实现
		return await updateTraitsFunction(provider, { args: args } as any)
	},
}

// 函数式实现，参考 askFollowupQuestionTool 的模式
export async function updateTraitsFunction(
	cline: Task,
	block: ToolUse
): Promise<{ success: boolean; message?: string; error?: string; updatedCount?: number }> {

	// 直接从 block.params 获取参数，支持参数包装
	let xml_traits: string | undefined = (block.params as any).xml_traits
	let user_message: string | undefined = (block.params as any).user_message

	console.log(`[MemoryTool Debug] updateTraitsFunction called`)
	console.log(`[MemoryTool Debug] block.params keys: ${Object.keys(block.params || {})}`)
	console.log(`[MemoryTool Debug] 直接访问 xml_traits:`, xml_traits ? "✅ 存在" : "❌ 不存在")
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

	if (!xml_traits && argsWrapper) {
		console.log(`[MemoryTool Debug] 检测到参数包装，从 block.params.args 获取`)

		// 处理xml_traits参数 - 可能是对象或字符串
		const traitsFromArgs = (argsWrapper as any).xml_traits
		if (traitsFromArgs) {
			if (typeof traitsFromArgs === 'string') {
				xml_traits = traitsFromArgs
			} else if (typeof traitsFromArgs === 'object' && traitsFromArgs !== null) {
				// 如果是对象，尝试提取文本内容或序列化为字符串
				if ('#text' in traitsFromArgs) {
					xml_traits = traitsFromArgs['#text']
				} else {
					// 将对象转换回XML字符串
					xml_traits = objectToXmlString(traitsFromArgs)
				}
			}
		}

		// 处理user_message参数 - 可能是对象或字符串
		const userMessageFromArgs = (argsWrapper as any).user_message
		if (userMessageFromArgs) {
			if (typeof userMessageFromArgs === 'string') {
				user_message = userMessageFromArgs
			} else if (typeof userMessageFromArgs === 'object' && userMessageFromArgs !== null) {
				// 如果是对象，尝试提取文本内容
				if ('#text' in userMessageFromArgs) {
					user_message = userMessageFromArgs['#text']
				} else {
					// 将对象转换为字符串
					user_message = JSON.stringify(userMessageFromArgs)
				}
			}
		}

		console.log(`[MemoryTool Debug] 包装后 xml_traits:`, xml_traits ? "✅ 存在" : "❌ 不存在")
		console.log(`[MemoryTool Debug] 包装后 user_message:`, user_message ? "✅ 存在" : "❌ 不存在")
		console.log(`[MemoryTool Debug] xml_traits 类型:`, typeof xml_traits)
		console.log(`[MemoryTool Debug] user_message 类型:`, typeof user_message)
	}

	if (!xml_traits && typeof rawArgs === "string") {
		const match = rawArgs.match(/<xml_traits[^>]*>([\s\S]*?)<\/xml_traits>/i)
		if (match) {
			xml_traits = match[1].trim()
			console.log(`[MemoryTool Debug] 通过正则解析 xml_traits:`, xml_traits ? "✅ 成功" : "❌ 失败")
		}
	}

	if (!user_message && typeof rawArgs === "string") {
		const match = rawArgs.match(/<user_message[^>]*>([\s\S]*?)<\/user_message>/i)
		if (match) {
			user_message = match[1].trim()
			console.log(`[MemoryTool Debug] 通过正则解析 user_message:`, user_message ? "✅ 成功" : "❌ 失败")
		}
	}

	console.log(`[MemoryTool Debug] 最终 xml_traits:`, xml_traits ? xml_traits.substring(0, 100) + "..." : "undefined")
	console.log(`[MemoryTool Debug] 最终 user_message:`, user_message)

	const provider = cline.providerRef?.deref()
	if (!provider?.anhChatServices?.roleMemoryTriggerService) {
		return {
			success: false,
			error: "记忆服务未初始化"
		}
	}

	// 参数验证
	if (!xml_traits) {
		provider.log(`[MemoryTool] 错误：xml_traits参数为undefined`)
		return {
			success: false,
			error: "xml_traits参数缺失，请确保正确传递XML数据"
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

		const traits = parseXmlTraits(xml_traits)
		console.log(`[MemoryTool Debug] updateTraits 解析结果:`, JSON.stringify(traits, null, 2))

		if (traits.length === 0) {
			return {
				success: false,
				error: "至少需要提供一个有效的特质"
			}
		}

		// 更新特质记忆
		await memoryService.updateTraits(roleUuid, traits)

		provider.log(`[MemoryTool] Updated ${traits.length} traits`)

		return {
			success: true,
			updatedCount: traits.length,
			message: `成功更新了 ${traits.length} 个角色特质`
		}

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		provider.log(`[MemoryTool] Failed to update traits: ${errorMessage}`)
		return {
			success: false,
			error: `更新角色特质失败: ${errorMessage}`
		}
	}
}

// 参数验证schema
export const updateTraitsSchema = z.object({
	traits: z.array(z.string()).min(1, "至少需要一个特质")
})
