/**
 * XML解析工具集 - 用于解析记忆工具的XML格式参数
 * 使用 fast-xml-parser 替代正则表达式，提供更健壮的XML解析
 */

import { XMLParser } from 'fast-xml-parser'

// 创建共享的XML解析器实例
const xmlParser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: "@_",
	textNodeName: "#text",
	parseAttributeValue: true,
	parseTagValue: true,
	trimValues: true,
	// 不停止任何节点，让解析器处理所有内容
})

/**
 * 解析XML格式的记忆数据
 */
export function parseXmlMemory(xmlString: string) {
	const memoryData: any = {}

	try {
		const parsed = xmlParser.parse(xmlString)
		
		// 处理不同的XML结构
		let memoryContent: any = null
		
		if (parsed.memory) {
			// 直接的memory标签
			memoryContent = parsed.memory
		} else if (parsed.xml_memory && parsed.xml_memory.memory) {
			// xml_memory包装的memory标签
			memoryContent = parsed.xml_memory.memory
		} else if (parsed.args && parsed.args.xml_memory && parsed.args.xml_memory.memory) {
			// args包装的xml_memory包装的memory标签
			memoryContent = parsed.args.xml_memory.memory
		}

		if (memoryContent) {
			// 解析各个字段
			memoryData.content = extractValue(memoryContent.content)
			memoryData.keywords = parseCommaSeparatedList(extractValue(memoryContent.keywords))
			memoryData.priority = extractValue(memoryContent.priority) ? parseInt(extractValue(memoryContent.priority), 10) : undefined
			memoryData.isConstant = extractValue(memoryContent.is_constant) ? extractValue(memoryContent.is_constant).toLowerCase() === 'true' : undefined
			memoryData.emotionalContext = parseCommaSeparatedList(extractValue(memoryContent.emotional_context))
			memoryData.relatedTopics = parseCommaSeparatedList(extractValue(memoryContent.related_topics))
			
			// 新增字段 - 支持角色扮演和游戏推演
			memoryData.perspective = extractValue(memoryContent.perspective)
			memoryData.contextType = extractValue(memoryContent.context_type)
			memoryData.uaInfo = parseCommaSeparatedList(extractValue(memoryContent.ua_info))
			memoryData.gameState = extractValue(memoryContent.game_state)
			memoryData.memoryTone = extractValue(memoryContent.memory_tone)
			memoryData.tags = parseCommaSeparatedList(extractValue(memoryContent.tags))
			memoryData.source = extractValue(memoryContent.source)
		}

		// 如果没有找到memory标签，尝试直接解析顶级字段
		if (!memoryContent && parsed) {
			memoryData.content = extractValue(parsed.content)
			memoryData.keywords = parseCommaSeparatedList(extractValue(parsed.keywords))
			memoryData.priority = extractValue(parsed.priority) ? parseInt(extractValue(parsed.priority), 10) : undefined
			memoryData.isConstant = extractValue(parsed.is_constant) ? extractValue(parsed.is_constant).toLowerCase() === 'true' : undefined
			memoryData.emotionalContext = parseCommaSeparatedList(extractValue(parsed.emotional_context))
			memoryData.relatedTopics = parseCommaSeparatedList(extractValue(parsed.related_topics))
			
			// 新增字段
			memoryData.perspective = extractValue(parsed.perspective)
			memoryData.contextType = extractValue(parsed.context_type)
			memoryData.uaInfo = parseCommaSeparatedList(extractValue(parsed.ua_info))
			memoryData.gameState = extractValue(parsed.game_state)
			memoryData.memoryTone = extractValue(parsed.memory_tone)
			memoryData.tags = parseCommaSeparatedList(extractValue(parsed.tags))
			memoryData.source = extractValue(parsed.source)
		}

	} catch (error) {
		console.warn('[parseXmlMemory] XML解析失败，回退到正则表达式:', error)
		// 回退到正则表达式解析（作为兜底方案）
		return parseXmlMemoryWithRegex(xmlString)
	}

	return memoryData
}

/**
 * 解析XML格式的特质数据
 */
export function parseXmlTraits(xmlString: string) {
	const traits: any[] = []

	try {
		const parsed = xmlParser.parse(xmlString)
		
		let traitsData: any[] = []
		
		// 处理不同的XML结构
		if (parsed.traits && Array.isArray(parsed.traits.trait)) {
			traitsData = parsed.traits.trait
		} else if (parsed.traits && parsed.traits.trait) {
			traitsData = [parsed.traits.trait]
		} else if (parsed.xml_traits && parsed.xml_traits.traits) {
			if (Array.isArray(parsed.xml_traits.traits.trait)) {
				traitsData = parsed.xml_traits.traits.trait
			} else if (parsed.xml_traits.traits.trait) {
				traitsData = [parsed.xml_traits.traits.trait]
			}
		} else if (parsed.args && parsed.args.xml_traits && parsed.args.xml_traits.traits) {
			if (Array.isArray(parsed.args.xml_traits.traits.trait)) {
				traitsData = parsed.args.xml_traits.traits.trait
			} else if (parsed.args.xml_traits.traits.trait) {
				traitsData = [parsed.args.xml_traits.traits.trait]
			}
		} else if (parsed.trait) {
			// 直接的trait标签
			if (Array.isArray(parsed.trait)) {
				traitsData = parsed.trait
			} else {
				traitsData = [parsed.trait]
			}
		}

		// 解析每个特质
		for (const traitData of traitsData) {
			const trait: any = {}
			
			trait.name = extractValue(traitData.name) || extractValue(traitData['@_name'])
			trait.value = extractValue(traitData.value) || extractValue(traitData['@_value'])
			trait.confidence = extractValue(traitData.confidence) ? parseFloat(extractValue(traitData.confidence)) : undefined
			trait.priority = extractValue(traitData.priority) ? parseInt(extractValue(traitData.priority), 10) : 70
			trait.is_constant = extractValue(traitData.is_constant) ? extractValue(traitData.is_constant).toLowerCase() === 'true' : true
			trait.keywords = parseCommaSeparatedList(extractValue(traitData.keywords))

			if (trait.name && trait.value) {
				traits.push(trait)
			}
		}

	} catch (error) {
		console.warn('[parseXmlTraits] XML解析失败，回退到正则表达式:', error)
		// 回退到正则表达式解析
		return parseXmlTraitsWithRegex(xmlString)
	}

	return traits
}

/**
 * 解析XML格式的目标数据
 */
export function parseXmlGoals(xmlString: string) {
	const goals: any[] = []

	try {
		const parsed = xmlParser.parse(xmlString)
		
		let goalsData: any[] = []
		
		// 处理不同的XML结构
		if (parsed.goals && Array.isArray(parsed.goals.goal)) {
			goalsData = parsed.goals.goal
		} else if (parsed.goals && parsed.goals.goal) {
			goalsData = [parsed.goals.goal]
		} else if (parsed.xml_goals && parsed.xml_goals.goals) {
			if (Array.isArray(parsed.xml_goals.goals.goal)) {
				goalsData = parsed.xml_goals.goals.goal
			} else if (parsed.xml_goals.goals.goal) {
				goalsData = [parsed.xml_goals.goals.goal]
			}
		} else if (parsed.args && parsed.args.xml_goals && parsed.args.xml_goals.goals) {
			if (Array.isArray(parsed.args.xml_goals.goals.goal)) {
				goalsData = parsed.args.xml_goals.goals.goal
			} else if (parsed.args.xml_goals.goals.goal) {
				goalsData = [parsed.args.xml_goals.goals.goal]
			}
		} else if (parsed.goal) {
			// 直接的goal标签
			if (Array.isArray(parsed.goal)) {
				goalsData = parsed.goal
			} else {
				goalsData = [parsed.goal]
			}
		}

		// 解析每个目标
		for (const goalData of goalsData) {
			const goal: any = {}
			
			goal.value = extractValue(goalData.value) || extractValue(goalData['@_value'])
			goal.priority = extractValue(goalData.priority) ? parseInt(extractValue(goalData.priority), 10) : 70
			goal.is_constant = extractValue(goalData.is_constant) ? extractValue(goalData.is_constant).toLowerCase() === 'true' : false
			goal.keywords = parseCommaSeparatedList(extractValue(goalData.keywords))

			if (goal.value) {
				goals.push(goal)
			}
		}

	} catch (error) {
		console.warn('[parseXmlGoals] XML解析失败，回退到正则表达式:', error)
		// 回退到正则表达式解析
		return parseXmlGoalsWithRegex(xmlString)
	}

	return goals
}

/**
 * 通用XML标签内容提取器 - 使用XML解析器
 */
export function extractXmlContent(xmlString: string, tag: string): string {
	try {
		const parsed = xmlParser.parse(xmlString)
		
		// 递归查找标签
		function findTag(obj: any, tagName: string): any {
			if (!obj || typeof obj !== 'object') return null
			
			if (obj[tagName]) {
				return obj[tagName]
			}
			
			for (const [key, value] of Object.entries(obj)) {
				if (typeof value === 'object') {
					const result = findTag(value, tagName)
					if (result) return result
				}
			}
			
			return null
		}
		
		const tagContent = findTag(parsed, tag)
		return extractValue(tagContent)
	} catch (error) {
		console.warn(`[extractXmlContent] 解析标签 ${tag} 失败，回退到正则表达式:`, error)
		// 回退到正则表达式
		const regex = new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 'is')
		const match = xmlString.match(regex)
		return match ? match[1].trim() : ''
	}
}

/**
 * 通用XML属性提取器 - 使用XML解析器
 */
export function extractXmlAttribute(xmlString: string, tag: string, attribute: string): string {
	try {
		const parsed = xmlParser.parse(xmlString)
		
		// 递归查找标签和属性
		function findAttribute(obj: any, tagName: string, attrName: string): string {
			if (!obj || typeof obj !== 'object') return ''
			
			if (obj[tagName]) {
				const attrKey = `@_${attrName}`
				if (obj[tagName][attrKey]) {
					return obj[tagName][attrKey]
				}
			}
			
			// 检查当前对象是否就是目标标签
			if (obj[`@_${attribute}`]) {
				return obj[`@_${attribute}`]
			}
			
			for (const [key, value] of Object.entries(obj)) {
				if (typeof value === 'object') {
					const result = findAttribute(value, tagName, attrName)
					if (result) return result
				}
			}
			
			return ''
		}
		
		return findAttribute(parsed, tag, attribute)
	} catch (error) {
		console.warn(`[extractXmlAttribute] 解析属性 ${tag}.${attribute} 失败，回退到正则表达式:`, error)
		// 回退到正则表达式
		const regex = new RegExp(`<${tag}[^>]*${attribute}=["']([^"']*)["'][^>]*>`, 'i')
		const match = xmlString.match(regex)
		return match ? match[1] : ''
	}
}

/**
 * 解析逗号分隔的列表字段
 */
export function parseCommaSeparatedList(listStr: string): string[] {
	return listStr ? listStr.split(',').map(item => item.trim()).filter(item => item) : []
}

// ========== 辅助函数 ==========

/**
 * 从解析结果中提取值
 */
function extractValue(value: any): string {
	if (value === null || value === undefined) return ''
	if (typeof value === 'string') return value.trim()
	if (typeof value === 'object' && value['#text']) return value['#text'].trim()
	if (typeof value === 'object' && value.toString() !== '[object Object]') return String(value).trim()
	return String(value).trim()
}

// ========== 兜底的正则表达式解析方法 ==========

/**
 * 使用正则表达式解析记忆数据（兜底方案）
 */
function parseXmlMemoryWithRegex(xmlString: string) {
	const memoryData: any = {}

	const extractTagContent = (tag: string): string => {
		const regex = new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 'is')
		const match = xmlString.match(regex)
		return match ? match[1].trim() : ''
	}

	const extractAttribute = (tag: string, attr: string): string => {
		const regex = new RegExp(`<${tag}[^>]*${attr}=["']([^"']*)["'][^>]*>`, 'i')
		const match = xmlString.match(regex)
		return match ? match[1] : ''
	}

	memoryData.content = extractTagContent('content') || extractAttribute('memory', 'content')
	
	const keywordsStr = extractTagContent('keywords') || extractAttribute('memory', 'keywords')
	memoryData.keywords = keywordsStr ? keywordsStr.split(',').map(k => k.trim()).filter(k => k) : []
	
	const priorityStr = extractTagContent('priority') || extractAttribute('memory', 'priority')
	memoryData.priority = priorityStr ? parseInt(priorityStr, 10) : undefined
	
	const isConstantStr = extractTagContent('is_constant') || extractAttribute('memory', 'is_constant')
	memoryData.isConstant = isConstantStr ? isConstantStr.toLowerCase() === 'true' : undefined
	
	const emotionalStr = extractTagContent('emotional_context') || extractAttribute('memory', 'emotional_context')
	memoryData.emotionalContext = emotionalStr ? emotionalStr.split(',').map(e => e.trim()).filter(e => e) : undefined
	
	const topicsStr = extractTagContent('related_topics') || extractAttribute('memory', 'related_topics')
	memoryData.relatedTopics = topicsStr ? topicsStr.split(',').map(t => t.trim()).filter(t => t) : undefined

	// 新增字段
	memoryData.perspective = extractTagContent('perspective') || extractAttribute('memory', 'perspective')
	memoryData.contextType = extractTagContent('context_type') || extractAttribute('memory', 'context_type')
	memoryData.uaInfo = parseCommaSeparatedList(extractTagContent('ua_info') || extractAttribute('memory', 'ua_info'))
	memoryData.gameState = extractTagContent('game_state') || extractAttribute('memory', 'game_state')
	memoryData.memoryTone = extractTagContent('memory_tone') || extractAttribute('memory', 'memory_tone')
	memoryData.tags = parseCommaSeparatedList(extractTagContent('tags') || extractAttribute('memory', 'tags'))
	memoryData.source = extractTagContent('source') || extractAttribute('memory', 'source')

	return memoryData
}

/**
 * 使用正则表达式解析特质数据（兜底方案）
 */
function parseXmlTraitsWithRegex(xmlString: string) {
	const traits: any[] = []

	const extractTrait = (traitXml: string): any => {
		const trait: any = {}

		const extractTagContent = (tag: string): string => {
			const regex = new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 'is')
			const match = traitXml.match(regex)
			return match ? match[1].trim() : ''
		}

		const extractAttribute = (tag: string, attr: string): string => {
			const regex = new RegExp(`<${tag}[^>]*${attr}=["']([^"']*)["'][^>]*>`, 'i')
			const match = traitXml.match(regex)
			return match ? match[1] : ''
		}

		trait.name = extractTagContent('name') || extractAttribute('trait', 'name')
		trait.value = extractTagContent('value') || extractAttribute('trait', 'value')

		const confidenceStr = extractTagContent('confidence') || extractAttribute('trait', 'confidence')
		trait.confidence = confidenceStr ? parseFloat(confidenceStr) : undefined

		const priorityStr = extractTagContent('priority') || extractAttribute('trait', 'priority')
		trait.priority = priorityStr ? parseInt(priorityStr, 10) : 70

		const isConstantStr = extractTagContent('is_constant') || extractAttribute('trait', 'is_constant')
		trait.is_constant = isConstantStr ? isConstantStr.toLowerCase() === 'true' : true

		const keywordsStr = extractTagContent('keywords') || extractAttribute('trait', 'keywords')
		trait.keywords = keywordsStr ? keywordsStr.split(',').map(k => k.trim()).filter(k => k) : []

		return trait
	}

	const traitRegex = /<trait[^>]*>.*?<\/trait>/gis
	const traitMatches = xmlString.match(traitRegex)

	if (traitMatches) {
		for (const traitMatch of traitMatches) {
			const trait = extractTrait(traitMatch)
			if (trait.name && trait.value) {
				traits.push(trait)
			}
		}
	}

	return traits
}

/**
 * 使用正则表达式解析目标数据（兜底方案）
 */
function parseXmlGoalsWithRegex(xmlString: string) {
	const goals: any[] = []

	const extractGoal = (goalXml: string): any => {
		const goal: any = {}

		const extractTagContent = (tag: string): string => {
			const regex = new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 'is')
			const match = goalXml.match(regex)
			return match ? match[1].trim() : ''
		}

		const extractAttribute = (tag: string, attr: string): string => {
			const regex = new RegExp(`<${tag}[^>]*${attr}=["']([^"']*)["'][^>]*>`, 'i')
			const match = goalXml.match(regex)
			return match ? match[1] : ''
		}

		goal.value = extractTagContent('value') || extractAttribute('goal', 'value')

		const priorityStr = extractTagContent('priority') || extractAttribute('goal', 'priority')
		goal.priority = priorityStr ? parseInt(priorityStr, 10) : 70

		const isConstantStr = extractTagContent('is_constant') || extractAttribute('goal', 'is_constant')
		goal.is_constant = isConstantStr ? isConstantStr.toLowerCase() === 'true' : false

		const keywordsStr = extractTagContent('keywords') || extractAttribute('goal', 'keywords')
		goal.keywords = keywordsStr ? keywordsStr.split(',').map(k => k.trim()).filter(k => k) : []

		return goal
	}

	const goalRegex = /<goal[^>]*>.*?<\/goal>/gis
	const goalMatches = xmlString.match(goalRegex)

	if (goalMatches) {
		for (const goalMatch of goalMatches) {
			const goal = extractGoal(goalMatch)
			if (goal.value) {
				goals.push(goal)
			}
		}
	}

	return goals
}
