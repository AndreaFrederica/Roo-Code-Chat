import type { Tool } from "@roo-code/types"
import { z } from "zod"
import { parseXmlMemory } from "./xml-parser.js"
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

/**
 * 生成合适的用户消息模板
 */
function generateUserMessageTemplate(context: string): string {
	const templates = {
		semantic: [
			"我记下了这个重要的信息",
			"这个知识点我已经牢牢记住了",
			"好的，我会记住这个重要的设定",
			"谢谢你的分享，我会珍藏这份知识",
			"这个信息很有价值，我已经保存下来了",
			"我会记住这个重要的内容"
		],
		episodic: [
			"我将这段珍贵的经历保存到了我的记忆中",
			"这个美好的瞬间我会永远记住",
			"谢谢你与我分享这段经历，我会好好珍藏",
			"这段对话让我印象深刻，我会记住的",
			"这真是一个难忘的时刻，我会珍藏起来",
			"我会记住我们之间的这段美好回忆"
		],
		default: [
			"我已经记下来了",
			"我会记住的",
			"谢谢你的分享",
			"好的，我明白了",
			"这个我记住了"
		]
	}

	const category = context.toLowerCase()
	let pool = templates.default

	if (category.includes('semantic') || category.includes('语义')) {
		pool = templates.semantic
	} else if (category.includes('episodic') || category.includes('情景')) {
		pool = templates.episodic
	}

	return pool[Math.floor(Math.random() * pool.length)]
}

export const addSemanticMemoryTool: Tool = {
	name: "add_semantic_memory",
	displayName: "添加语义记忆",
	description: "添加语义记忆，记录角色应该知道的常识、规则、设定等知识性内容",
	parameters: {
		properties: {
			xml_memory: {
				type: "string",
				description: "XML格式的记忆数据，包含完整的语义记忆信息。格式：<memory><content>语义记忆内容</content><keywords>关键词1,关键词2</keywords><priority>80</priority><is_constant>false</is_constant><tags>标签1,标签2</tags><source>用户告知</source></memory>",
			},
			user_message: {
				type: "string",
				description: "AI显示给用户的友好提示语，用于告知用户记忆已保存。应该是自然的、符合角色性格的中文提示语，例如：'我记下了这个重要的信息'、'这个知识点我已经牢牢记住了'、'好的，我会记住这个重要的设定'等。避免使用技术性或调试性的语言。",
			},
		},
		required: ["xml_memory", "user_message"],
	},
	execute: async (args, _, provider) => {
		// 保持兼容性，内部调用函数式实现
		return await addSemanticMemoryFunction(provider, { args: args } as any)
	},
}

// 函数式实现，参考 askFollowupQuestionTool 的模式
export async function addSemanticMemoryFunction(
	cline: Task,
	block: ToolUse
): Promise<{ success: boolean; message?: string; error?: string; memoryId?: string }> {

	// 优先从 args 中获取参数（新的格式）
	let xml_memory: string | undefined
	let user_message: string | undefined

	console.log(`[MemoryTool Debug] addSemanticMemoryFunction called`)
	console.log(`[MemoryTool Debug] block.params keys: ${Object.keys(block.params || {})}`)

	// 首先尝试从 args 获取参数
	const rawArgs = (block.params as any).args
	console.log(`[MemoryTool Debug] block.params.args 类型:`, typeof rawArgs)
	
	if (rawArgs) {
		console.log(`[MemoryTool Debug] 尝试从 args 解析参数`)
		const argsWrapper = normalizeToolArgs(rawArgs)
		
		if (argsWrapper) {
			// 处理xml_memory参数 - 可能是对象或字符串
			const rawXmlMemory = (argsWrapper as any).xml_memory
			if (rawXmlMemory) {
				if (typeof rawXmlMemory === 'string') {
					xml_memory = rawXmlMemory
				} else if (typeof rawXmlMemory === 'object' && rawXmlMemory !== null) {
					// 如果是对象，尝试提取文本内容或序列化为字符串
					if ('#text' in rawXmlMemory) {
						xml_memory = rawXmlMemory['#text']
					} else {
						// 将对象转换回XML字符串
						xml_memory = objectToXmlString(rawXmlMemory)
					}
				}
			}

			// 处理user_message参数 - 可能是对象或字符串
			const rawUserMessage = (argsWrapper as any).user_message
			if (rawUserMessage) {
				if (typeof rawUserMessage === 'string') {
					user_message = rawUserMessage
				} else if (typeof rawUserMessage === 'object' && rawUserMessage !== null) {
					// 如果是对象，尝试提取文本内容
					if ('#text' in rawUserMessage) {
						user_message = rawUserMessage['#text']
					} else {
						// 将对象转换为字符串
						user_message = JSON.stringify(rawUserMessage)
					}
				}
			}

			console.log(`[MemoryTool Debug] 从 args 解析结果 - xml_memory:`, xml_memory ? "✅ 存在" : "❌ 不存在")
			console.log(`[MemoryTool Debug] 从 args 解析结果 - user_message:`, user_message ? "✅ 存在" : "❌ 不存在")
			console.log(`[MemoryTool Debug] xml_memory 类型:`, typeof xml_memory)
			console.log(`[MemoryTool Debug] user_message 类型:`, typeof user_message)
		}
	}

	// 如果 args 解析失败，尝试直接获取（向后兼容）
	if (!xml_memory || !user_message) {
		console.log(`[MemoryTool Debug] args 解析失败，尝试直接获取参数`)
		xml_memory = xml_memory || (block.params as any).xml_memory
		user_message = user_message || (block.params as any).user_message
		console.log(`[MemoryTool Debug] 直接获取结果 - xml_memory:`, xml_memory ? "✅ 存在" : "❌ 不存在")
		console.log(`[MemoryTool Debug] 直接获取结果 - user_message:`, user_message ? "✅ 存在" : "❌ 不存在")
	}

	// 最后尝试正则解析（兜底）
	if (!xml_memory && typeof rawArgs === "string") {
		const match = rawArgs.match(/<xml_memory[^>]*>([\s\S]*?)<\/xml_memory>/i)
		if (match) {
			xml_memory = match[1].trim()
			console.log(`[MemoryTool Debug] 通过正则解析 xml_memory:`, xml_memory ? "✅ 成功" : "❌ 失败")
		}
	}

	if (!user_message && typeof rawArgs === "string") {
		const match = rawArgs.match(/<user_message[^>]*>([\s\S]*?)<\/user_message>/i)
		if (match) {
			user_message = match[1].trim()
			console.log(`[MemoryTool Debug] 通过正则解析 user_message:`, user_message ? "✅ 成功" : "❌ 失败")
		}
	}

	console.log(`[MemoryTool Debug] 最终 xml_memory:`, xml_memory ? xml_memory.substring(0, 100) + "..." : "undefined")
	console.log(`[MemoryTool Debug] 最终 user_message:`, user_message)

	const provider = cline.providerRef?.deref()
	if (!provider?.anhChatServices?.roleMemoryTriggerService) {
		return {
			success: false,
			error: "记忆服务未初始化"
		}
	}

	// 参数验证
	if (!xml_memory) {
		provider.log(`[MemoryTool] 错误：xml_memory参数为undefined`)
		return {
			success: false,
			error: "xml_memory参数缺失，请确保正确传递XML数据"
		}
	}

	if (typeof xml_memory !== 'string') {
		provider.log(`[MemoryTool] 错误：xml_memory参数类型错误，期望string，实际${typeof xml_memory}`)
		return {
			success: false,
			error: `xml_memory参数类型错误，期望string，实际${typeof xml_memory}`
		}
	}

	if (xml_memory.trim().length === 0) {
		provider.log(`[MemoryTool] 错误：xml_memory参数为空字符串`)
		return {
			success: false,
			error: "xml_memory参数不能为空"
		}
	}

	// 验证 user_message 参数
	if (!user_message) {
		provider.log(`[MemoryTool] 错误：user_message参数为undefined`)
		return {
			success: false,
			error: "user_message参数缺失，请提供要显示给用户的友好提示语"
		}
	}

	if (typeof user_message !== 'string') {
		provider.log(`[MemoryTool] 错误：user_message参数类型错误，期望string，实际${typeof user_message}`)
		return {
			success: false,
			error: `user_message参数类型错误，期望string，实际${typeof user_message}`
		}
	}

	// 验证 user_message 是否为合适的内容
	const trimmedUserMessage = user_message.trim()
	if (trimmedUserMessage.length === 0) {
		return {
			success: false,
			error: "user_message参数不能为空"
		}
	}

	// 检查是否为技术性或调试性语言
	const invalidPatterns = [
		/修好了?/i,
		/测试/i,
		/debug/i,
		/error/i,
		/undefined/i,
		/null/i,
		/\.js$/i,
		/function/i,
		/console\./i,
		/\[.*debug.*\]/i
	]

	for (const pattern of invalidPatterns) {
		if (pattern.test(trimmedUserMessage)) {
			provider.log(`[MemoryTool] 警告：user_message包含技术性语言: "${trimmedUserMessage}"`)
			// 提供更友好的默认消息
			user_message = generateUserMessageTemplate("semantic")
			break
		}
	}

	// 检查长度是否合理（避免过长或过短）
	if (trimmedUserMessage.length < 2) {
		user_message = generateUserMessageTemplate("semantic")
	} else if (trimmedUserMessage.length > 200) {
		user_message = trimmedUserMessage.substring(0, 197) + "..."
		provider.log(`[MemoryTool] 警告：user_message过长，已截断`)
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

		const memoryData = parseXmlMemory(xml_memory)
		console.log(`[MemoryTool Debug] 解析结果:`, JSON.stringify(memoryData, null, 2))

		// 对于语义记忆，需要额外处理tags和source字段
		const extractTagContent = (tag: string): string => {
			const regex = new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 'is')
			const match = xml_memory.match(regex)
			return match ? match[1].trim() : ''
		}

		const tagsStr = extractTagContent('tags')
		memoryData.tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(t => t) : undefined

		memoryData.source = extractTagContent('source') || "对话添加"

		// 验证必需参数
		if (!memoryData.content) {
			return {
				success: false,
				error: "记忆内容不能为空"
			}
		}

		// 调试信息：检查内容是否被截断
		const contentLength = memoryData.content.length
		const isPotentiallyTruncated = contentLength < 50 && /[，。！？]$/u.test(memoryData.content) // 短内容且以标点结尾可能被截断

		if (isPotentiallyTruncated) {
			provider.log(`[MemoryTool] 警告：内容可能被截断 - 长度: ${contentLength}, 内容: "${memoryData.content}"`)
		}

		provider.log(`[MemoryTool] 接收到语义记忆内容 - 长度: ${contentLength}, 内容预览: "${memoryData.content.substring(0, 100)}${contentLength > 100 ? "..." : ""}"`)

		// 添加语义记忆，包含新的增强字段
		const memoryId = await memoryService.addSemanticMemory(
			roleUuid,
			memoryData.content,
			memoryData.keywords,
			{
				priority: memoryData.priority,
				isConstant: memoryData.isConstant,
				tags: memoryData.tags,
				source: memoryData.source
			},
			{
				// 传递新增的增强字段
				perspective: memoryData.perspective,
				contextType: memoryData.contextType,
				uaInfo: memoryData.uaInfo,
				gameState: memoryData.gameState,
				memoryTone: memoryData.memoryTone
			}
		)

		provider.log(`[MemoryTool] Added semantic memory: ${memoryId.substring(0, 8)}... (原长度: ${contentLength})`)

		return {
			success: true,
			memoryId,
			message: `语义记忆添加成功 (长度: ${contentLength})`
		}

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		provider.log(`[MemoryTool] Failed to add semantic memory: ${errorMessage}`)
		return {
			success: false,
			error: `添加语义记忆失败: ${errorMessage}`
		}
	}
}

// 参数验证schema
export const addSemanticMemorySchema = z.object({
	content: z.string().min(1, "记忆内容不能为空"),
	keywords: z.array(z.string()).optional(),
	priority: z.number().min(0).max(100).optional(),
	is_constant: z.boolean().optional(),
	tags: z.array(z.string()).optional(),
	source: z.string().optional()
})
