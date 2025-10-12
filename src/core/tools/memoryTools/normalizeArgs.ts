import { XMLParser } from 'fast-xml-parser'

export type NormalizedArgs = Record<string, unknown>

function flattenObject(obj: any, prefix: string = ""): NormalizedArgs {
	const result: NormalizedArgs = {}
	
	for (const [key, value] of Object.entries(obj)) {
		// 特殊处理：如果是 xml_memory 或 user_message，不要添加前缀
		const newKey = (prefix && key !== 'xml_memory' && key !== 'user_message') ? `${prefix}_${key}` : key
		
		if (typeof value === "object" && value !== null && !Array.isArray(value)) {
			if ("#text" in value) {
				// 如果有文本内容，直接使用
				result[newKey] = tryParsePrimitive((value as any)["#text"])
			} else {
				// 对于 xml_memory 和 user_message，保持原始结构不展平
				if (key === 'xml_memory' || key === 'user_message') {
					result[newKey] = value
				} else {
					// 递归展平其他对象
					const flattened = flattenObject(value, newKey)
					Object.assign(result, flattened)
				}
			}
		} else {
			// 基本类型或数组
			result[newKey] = tryParsePrimitive(String(value))
		}
	}
	
	return result
}

function tryParseJson(value: string): unknown {
	try {
		return JSON.parse(value)
	} catch {
		return undefined
	}
}

function tryParsePrimitive(value: string): unknown {
	const trimmed = value.trim()

	if (trimmed === "") {
		return ""
	}

	if (trimmed === "true") {
		return true
	}

	if (trimmed === "false") {
		return false
	}

	const numberValue = Number(trimmed)
	if (!Number.isNaN(numberValue) && numberValue.toString() === trimmed) {
		return numberValue
	}

	if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
		const parsed = tryParseJson(trimmed)
		if (parsed !== undefined) {
			return parsed
		}
	}

	return value
}

export function normalizeToolArgs(rawArgs: unknown): NormalizedArgs | undefined {
	if (rawArgs === undefined || rawArgs === null) {
		return undefined
	}

	if (typeof rawArgs === "object") {
		return rawArgs as NormalizedArgs
	}

	if (typeof rawArgs !== "string") {
		return undefined
	}

	const trimmed = rawArgs.trim()
	if (!trimmed) {
		return undefined
	}

	// 尝试解析 JSON
	if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
		const parsed = tryParseJson(trimmed)
		if (parsed && typeof parsed === "object") {
			return parsed as NormalizedArgs
		}
	}

	// 使用 fast-xml-parser 解析 XML
	try {
		const parser = new XMLParser({
			ignoreAttributes: false,
			attributeNamePrefix: "@_",
			textNodeName: "#text",
			parseAttributeValue: true,
			parseTagValue: true,
			trimValues: true,
			// 只解析简单的标签结构，不处理复杂的嵌套
			stopNodes: ["*.memory", "*.traits", "*.goals"]
		})

		const parsed = parser.parse(trimmed)
		
		// 如果解析结果是对象，直接返回
		if (parsed && typeof parsed === "object") {
			// 提取顶级标签作为参数
			let result: NormalizedArgs = {}
			
			for (const [key, value] of Object.entries(parsed)) {
				if (key === "?xml") {
					// 跳过 XML 声明
					continue
				}
				
				if (key === "args" && typeof value === "object" && value !== null) {
					// 如果是 args 包装器，提取其内部内容
					result = { ...result, ...flattenObject(value) }
				} else if (typeof value === "object" && value !== null) {
					// 如果是对象，尝试提取文本内容
					if ("#text" in value) {
						result[key] = tryParsePrimitive((value as any)["#text"])
					} else {
						// 否则保持原样
						result[key] = value
					}
				} else {
					// 基本类型直接赋值
					result[key] = tryParsePrimitive(String(value))
				}
			}
			
			if (Object.keys(result).length > 0) {
				return result
			}
		}
	} catch (error) {
		// XML 解析失败，回退到正则表达式解析
		console.warn(`[normalizeToolArgs] XML解析失败，回退到正则解析:`, error)
	}

	// 回退到正则表达式解析（作为最后的兜底方案）
	const result: NormalizedArgs = {}
	const tagRegex = /<([a-zA-Z0-9_\-:]+)[^>]*>([\s\S]*?)<\/\1>/gi
	let match: RegExpExecArray | null

	// 重置正则表达式的lastIndex以确保从头开始匹配
	tagRegex.lastIndex = 0

	while ((match = tagRegex.exec(trimmed)) !== null) {
		const [, tagName, rawValue] = match
		result[tagName] = tryParsePrimitive(rawValue)
	}

	if (Object.keys(result).length > 0) {
		return result
	}

	return undefined
}
