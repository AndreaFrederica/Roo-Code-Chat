import type { ClineMessage } from "@roo-code/types"

export interface ExtractedMessages {
	anhFirstMessage?: string
	anhLastMessage?: string
}

/**
 * 从消息历史中提取最后一句话
 * @param messages 消息历史数组
 * @returns 提取的最后一句话
 */
export function extractLastMessage(messages: ClineMessage[]): ExtractedMessages {
	if (!messages || messages.length === 0) {
		return {}
	}

	// 过滤出有效的消息
	// - ask === 'followup' 是用户的后续问题
	// - say === 'text' 是助手的文本回复
	// - say === 'user_feedback' 是用户的反馈/消息
	const validMessages = messages.filter(msg => {
		const hasText = msg.text?.trim()
		// console.log('[ANH-Chat] Checking message:', msg, 'Has text:', !!hasText)
		if (!hasText) return false
		// 用户消息: ask === 'followup' 或 say === 'user_feedback'（但排除空的 completion_result）
		if ((msg.ask === 'followup' || msg.say === 'user_feedback') && msg.ask !== 'completion_result') {
			return true
		}
		// 助手文本消息: say === 'text' 或 say === 'completion_result'
		if (msg.say === 'text' || msg.say === 'completion_result') {
			return true
		}

		return false
	})

	if (validMessages.length === 0) {
		return {}
	}

	// 提取最后一条消息
	const lastMessage = validMessages[validMessages.length - 1]
	const lastMessageText = lastMessage.text?.trim() || ''

	return {
		anhLastMessage: extractLastSentence(lastMessageText)
	}
}

/**
 * 从文本中提取第一句话
 * @param text 输入文本
 * @returns 第一句话
 */
export function extractFirstSentence(text: string): string {
	if (!text || text.trim().length === 0) {
		return ''
	}

	// 尝试解析JSON格式的ask消息
	try {
		// 先检查是否以{开头，以}结尾，可能是JSON格式
		const trimmedText = text.trim()
		if (trimmedText.startsWith('{') && trimmedText.endsWith('}')) {
			// 尝试修复常见的JSON格式问题（如中文引号）
			const fixedJson = trimmedText
				.replace(/["""]/g, '"')  // 替换各种中文引号
				.replace(/['''']/g, "'")  // 替换各种中文单引号

			const parsed = JSON.parse(fixedJson)
			if (parsed.question && typeof parsed.question === 'string') {
				// 如果是JSON格式的ask消息，提取question字段并直接返回原文（不分割）
				return parsed.question.trim()
			}
		}
		// 如果JSON解析成功但没有question字段，继续按普通文本处理
	} catch {
		// 如果JSON解析失败，尝试用正则表达式提取question字段
		try {
			const questionMatch = text.match(/"question":\s*"([^"]+)"/)
			if (questionMatch && questionMatch[1]) {
				// 提取question字段的内容，处理转义字符后直接返回原文（不分割）
				let questionContent = questionMatch[1]
					.replace(/\\n/g, '\n')
					.replace(/\\"/g, '"')
					.replace(/\\\\/g, '\\')
				return questionContent.trim()
			}
		} catch {
			// 如果正则提取也失败，继续按普通文本处理
		}
	}

	// 尝试按句号、问号、感叹号分割
	const sentences = text
		.split(/[。！？.!?]+/)
		.map(s => s.trim())
		.filter(s => s.length > 2)  // 过滤太短的句子

	if (sentences.length === 0) {
		// 如果没有找到句子，返回前30个字符
		return text.length > 30 ? text.substring(0, 30) + '...' : text
	}

	// 清理第一句话，移除对话前缀
	const firstSentence = sentences[0]
		.replace(/^(你说|好的|嗯|啊|呃|那个|这个)[，,]?\s*/, '')
		.replace(/^[，,\s]+/, '')
		.trim()

	return firstSentence || sentences[0]
}

/**
 * 从文本中提取最后一句话
 * @param text 输入文本
 * @returns 最后一句话
 */
export function extractLastSentence(text: string): string {
	if (!text || text.trim().length === 0) {
		return ''
	}

	// 尝试解析JSON格式的ask消息
	try {
		const trimmed = text.trim()
		if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
			// 尝试修复常见的JSON格式问题（如中文引号）
			const fixedJson = trimmed
				.replace(/["""]/g, '"')  // 替换各种中文引号
				.replace(/['''']/g, "'")  // 替换各种中文单引号

			const parsed = JSON.parse(fixedJson)
			if (parsed.question && typeof parsed.question === 'string') {
				return parsed.question.trim()
			}
		}
	} catch {
		// 如果JSON解析失败，尝试用正则表达式提取question字段
		try {
			const questionMatch = text.match(/"question":\s*"([^"]+)"/)
			if (questionMatch && questionMatch[1]) {
				let questionContent = questionMatch[1]
					.replace(/\\n/g, '\n')
					.replace(/\\"/g, '"')
					.replace(/\\\\/g, '\\')
				return questionContent.trim()
			}
		} catch {
			// 如果正则提取也失败，继续按普通文本处理
		}
	}

	// 不按标点分割：如果文本包含多个段落，返回最后一个段落的原文（去首尾空白）；否则返回整段文本的原文（去首尾空白）
	const paragraphs = text
		.split(/\n\s*\n/)
		.map(p => p.trim())
		.filter(p => p.length > 0)

	if (paragraphs.length === 0) {
		return text.trim()
	}

	// 返回最后一个段落的原文（不再按句号/问号等分割）
	const lastParagraph = paragraphs[paragraphs.length - 1]
	return lastParagraph.trim()
}

/**
 * 从单个文本块中提取最后一句话
 * @param text 输入文本
 * @returns 最后一句话
 */
export function extractLastSentenceFromText(text: string): string {
	// 尝试解析JSON格式的ask消息
	try {
		// 先检查是否以{开头，以}结尾，可能是JSON格式
		const trimmedText = text.trim()
		if (trimmedText.startsWith('{') && trimmedText.endsWith('}')) {
			// 尝试修复常见的JSON格式问题（如中文引号）
			const fixedJson = trimmedText
				.replace(/["""]/g, '"')  // 替换各种中文引号
				.replace(/['''']/g, "'")  // 替换各种中文单引号

			const parsed = JSON.parse(fixedJson)
			if (parsed.question && typeof parsed.question === 'string') {
				// 如果是JSON格式的ask消息，提取question字段并直接返回原文（不分割）
				return parsed.question.trim()
			}
		}
		// 如果JSON解析成功但没有question字段，继续按普通文本处理
	} catch {
		// 如果JSON解析失败，尝试用正则表达式提取question字段
		try {
			const questionMatch = text.match(/"question":\s*"([^"]+)"/)
			if (questionMatch && questionMatch[1]) {
				// 提取question字段的内容，处理转义字符后直接返回原文（不分割）
				let questionContent = questionMatch[1]
					.replace(/\\n/g, '\n')
					.replace(/\\"/g, '"')
					.replace(/\\\\/g, '\\')
				return questionContent.trim()
			}
		} catch {
			// 如果正则提取也失败，继续按普通文本处理
		}
	}

	// 不按标点分割：按用户要求直接返回原文（去首尾空白）
	return text.trim()
}