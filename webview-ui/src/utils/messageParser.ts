/**
 * 消息解析工具
 * 用于从任务内容中提取第一句话和最后一句话，支持聊天模式显示
 */

export interface ParsedMessage {
	firstMessage: string
	lastMessage: string
	taskTitle: string // 原始任务标题
}

/**
 * 从任务内容中解析出第一句话和最后一句话
 * @param taskContent 任务内容
 * @returns 解析后的消息对象
 */
export function parseTaskContent(taskContent: string): ParsedMessage {
	if (!taskContent || taskContent.trim().length === 0) {
		return {
			firstMessage: '',
			lastMessage: '',
			taskTitle: taskContent
		}
	}

	// 首先尝试按各种标点符号分割句子
	let sentences: string[] = []

	// 尝试多种分割模式
	const patterns = [
		/[。！？.!?]\s*/,  // 中文和英文句号、问号、感叹号
		/[。！？.!?]\s*[，,]*\s*/,  // 包含逗号的情况
		/\n\s*\n/,  // 段落分割
		/\n/,  // 换行分割
	]

	for (const pattern of patterns) {
		const testSentences = taskContent
			.split(pattern)
			.map(s => s.trim())
			.filter(s => s.length > 2)  // 过滤掉太短的片段

		if (testSentences.length > 1) {
			sentences = testSentences
			break
		}
	}

	// 如果还是没有合适的分割，使用原始内容
	if (sentences.length <= 1) {
		const trimmedContent = taskContent.trim()
		if (trimmedContent.length > 50) {
			// 如果内容很长，尝试按长度分割
			const midPoint = Math.floor(trimmedContent.length / 2)
			sentences = [
				trimmedContent.substring(0, midPoint).trim(),
				trimmedContent.substring(midPoint).trim()
			]
		} else {
			sentences = [trimmedContent]
		}
	}

	// 清理句子：移除常见的对话前缀
	const cleanSentences = sentences.map(s => {
		return s
			.replace(/^(你说|好的|嗯|啊|呃|那个|这个)[，,]?\s*/, '')  // 移除对话开头
			.replace(/^[，,\s]+/, '')  // 移除开头的标点和空格
			.trim()
	}).filter(s => s.length > 2)  // 再次过滤短句子

	if (cleanSentences.length === 0) {
		return {
			firstMessage: taskContent.substring(0, 20),
			lastMessage: taskContent.substring(0, 20),
			taskTitle: taskContent
		}
	}

	if (cleanSentences.length === 1) {
		const singleSentence = cleanSentences[0]
		return {
			firstMessage: singleSentence,
			lastMessage: singleSentence,
			taskTitle: taskContent
		}
	}

	// 取第一个句子作为第一句话，最后一个句子作为最后一句话
	const firstMessage = cleanSentences[0]
	const lastMessage = cleanSentences[cleanSentences.length - 1]

	return {
		firstMessage,
		lastMessage,
		taskTitle: taskContent
	}
}

/**
 * 从HistoryItem中解析第一句话和最后一句话
 * 优先使用预计算的字段，如果没有则解析task内容
 * @param item 历史记录项
 * @returns 解析后的消息对象
 */
export function parseHistoryItemContent(item: any): ParsedMessage {
	// 如果有预计算的firstMessage和lastMessage，直接使用
	if (item.anhFirstMessage || item.anhLastMessage) {
		return {
			firstMessage: item.anhFirstMessage || '',
			lastMessage: item.anhLastMessage || '',
			taskTitle: item.task || ''
		}
	}

	// 尝试从task中提取question字段（处理JSON格式的ask消息）
	const taskText = item.task || ''
	let extractedText = taskText

	try {
		const trimmed = taskText.trim()
		if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
			// 修复中文引号
			const fixedJson = trimmed
				.replace(/"/g, '"')
				.replace(/"/g, '"')
			
			const parsed = JSON.parse(fixedJson)
			if (parsed.question && typeof parsed.question === 'string') {
				extractedText = parsed.question.trim()
			}
		}
	} catch {
		// JSON解析失败，尝试正则提取
		try {
			const questionMatch = taskText.match(/"question":\s*"([^"]+)"/)
			if (questionMatch && questionMatch[1]) {
				extractedText = questionMatch[1]
					.replace(/\\n/g, '\n')
					.replace(/\\"/g, '"')
					.replace(/\\\\/g, '\\')
					.trim()
			}
		} catch {
			// 正则提取失败，使用原文
		}
	}

	// 解析提取后的文本
	return parseTaskContent(extractedText)
}

/**
 * 获取适合聊天模式显示的任务标题（最后一句话）
 * @param taskContent 任务内容
 * @param maxLength 最大长度限制
 * @returns 格式化后的标题
 */
export function getChatModeTitle(taskContent: string, maxLength: number = 50): string {
	const { lastMessage } = parseTaskContent(taskContent)

	if (!lastMessage) {
		return taskContent.length > maxLength
			? taskContent.substring(0, maxLength) + '...'
			: taskContent
	}

	return lastMessage.length > maxLength
		? lastMessage.substring(0, maxLength) + '...'
		: lastMessage
}

/**
 * 获取适合聊天模式显示的预览文本（第一句话）
 * @param taskContent 任务内容
 * @param maxLength 最大长度限制
 * @returns 格式化后的预览文本
 */
export function getChatModePreview(taskContent: string, maxLength: number = 30): string {
	const { firstMessage } = parseTaskContent(taskContent)

	if (!firstMessage) {
		return ''
	}

	return firstMessage.length > maxLength
		? firstMessage.substring(0, maxLength) + '...'
		: firstMessage
}

/**
 * 从HistoryItem获取聊天模式标题（最后一句话）
 * @param item 历史记录项
 * @param maxLength 最大长度限制
 * @returns 格式化后的标题
 */
export function getChatModeTitleFromHistoryItem(item: any, maxLength: number = 50): string {
	const { lastMessage, taskTitle } = parseHistoryItemContent(item)

	if (!lastMessage) {
		return taskTitle.length > maxLength
			? taskTitle.substring(0, maxLength) + '...'
			: taskTitle
	}

	return lastMessage.length > maxLength
		? lastMessage.substring(0, maxLength) + '...'
		: lastMessage
}

/**
 * 从HistoryItem获取聊天模式预览（第一句话）
 * @param item 历史记录项
 * @param maxLength 最大长度限制
 * @returns 格式化后的预览文本
 */
export function getChatModePreviewFromHistoryItem(item: any, maxLength: number = 30): string {
	const { firstMessage } = parseHistoryItemContent(item)

	if (!firstMessage) {
		return ''
	}

	return firstMessage.length > maxLength
		? firstMessage.substring(0, maxLength) + '...'
		: firstMessage
}

/**
 * 获取适合编码模式显示的任务标题（原始任务内容）
 * @param taskContent 任务内容
 * @param maxLength 最大长度限制
 * @returns 格式化后的标题
 */
export function getCodingModeTitle(taskContent: string, maxLength: number = 50): string {
	return taskContent.length > maxLength
		? taskContent.substring(0, maxLength) + '...'
		: taskContent
}

/**
 * 获取适合编码模式显示的预览文本（第一句话）
 * @param taskContent 任务内容
 * @param maxLength 最大长度限制
 * @returns 格式化后的预览文本
 */
export function getCodingModePreview(taskContent: string, maxLength: number = 30): string {
	return getChatModePreview(taskContent, maxLength)
}