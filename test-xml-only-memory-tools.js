/**
 * 测试XML格式记忆工具的功能（移除JSON支持后）
 */

// 模拟XML解析器（从xml-parser.ts导入的核心功能）
const parseXmlMemory = (xmlString) => {
	const memoryData = {}

	const extractTagContent = (tag) => {
		const regex = new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 'is')
		const match = xmlString.match(regex)
		return match ? match[1].trim() : ''
	}

	const extractAttribute = (tag, attr) => {
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

	return memoryData
}

const parseXmlTraits = (xmlString) => {
	const traits = []

	const extractTrait = (traitXml) => {
		const trait = {}

		const extractTagContent = (tag) => {
			const regex = new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 'is')
			const match = traitXml.match(regex)
			return match ? match[1].trim() : ''
		}

		const extractAttribute = (tag, attr) => {
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

const parseXmlGoals = (xmlString) => {
	const goals = []

	const extractGoal = (goalXml) => {
		const goal = {}

		const extractTagContent = (tag) => {
			const regex = new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 'is')
			const match = goalXml.match(regex)
			return match ? match[1].trim() : ''
		}

		const extractAttribute = (tag, attr) => {
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

// 模拟工具调用（简化版本）
const addEpisodicMemory = (xml_memory) => {
	if (!xml_memory) {
		return { success: false, error: "xml_memory参数是必需的" }
	}

	try {
		const memoryData = parseXmlMemory(xml_memory)
		if (!memoryData.content) {
			return { success: false, error: "记忆内容不能为空" }
		}

		return {
			success: true,
			memoryId: `mem_${Date.now()}`,
			message: "情景记忆添加成功",
			data: memoryData
		}
	} catch (error) {
		return { success: false, error: `解析XML失败: ${error.message}` }
	}
}

const addSemanticMemory = (xml_memory) => {
	if (!xml_memory) {
		return { success: false, error: "xml_memory参数是必需的" }
	}

	try {
		const memoryData = parseXmlMemory(xml_memory)

		// 额外处理语义记忆特有的字段
		const extractTagContent = (tag) => {
			const regex = new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 'is')
			const match = xml_memory.match(regex)
			return match ? match[1].trim() : ''
		}

		const tagsStr = extractTagContent('tags')
		memoryData.tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(t => t) : undefined

		memoryData.source = extractTagContent('source') || "对话添加"

		if (!memoryData.content) {
			return { success: false, error: "记忆内容不能为空" }
		}

		return {
			success: true,
			memoryId: `sem_${Date.now()}`,
			message: "语义记忆添加成功",
			data: memoryData
		}
	} catch (error) {
		return { success: false, error: `解析XML失败: ${error.message}` }
	}
}

const updateTraits = (xml_traits) => {
	if (!xml_traits) {
		return { success: false, error: "xml_traits参数是必需的" }
	}

	try {
		const traits = parseXmlTraits(xml_traits)
		if (traits.length === 0) {
			return { success: false, error: "至少需要提供一个有效的特质" }
		}

		return {
			success: true,
			updatedCount: traits.length,
			message: `成功更新了 ${traits.length} 个角色特质`,
			data: traits
		}
	} catch (error) {
		return { success: false, error: `解析XML失败: ${error.message}` }
	}
}

const updateGoals = (xml_goals) => {
	if (!xml_goals) {
		return { success: false, error: "xml_goals参数是必需的" }
	}

	try {
		const goals = parseXmlGoals(xml_goals)
		if (goals.length === 0) {
			return { success: false, error: "至少需要提供一个有效的目标" }
		}

		return {
			success: true,
			updatedCount: goals.length,
			message: `成功更新了 ${goals.length} 个角色目标`,
			data: goals
		}
	} catch (error) {
		return { success: false, error: `解析XML失败: ${error.message}` }
	}
}

console.log('=== 测试XML格式记忆工具（仅支持XML）===\n')

// 测试1: add_episodic_memory
console.log('测试1 - add_episodic_memory:')
const xmlMemory1 = `<memory>
  <content>用户今天告诉我他成功完成了那个困扰他很久的项目，我能从他的语气中听出那种如释重负的喜悦。</content>
  <keywords>项目成功,坚持,喜悦</keywords>
  <priority>85</priority>
  <is_constant>false</is_constant>
  <emotional_context>喜悦,如释重负</emotional_context>
  <related_topics>工作,个人成长</related_topics>
</memory>`

const result1 = addEpisodicMemory(xmlMemory1)
console.log(JSON.stringify(result1, null, 2))
console.log('\n')

// 测试2: add_semantic_memory
console.log('测试2 - add_semantic_memory:')
const xmlMemory2 = `<memory>
  <content>用户喜欢喝咖啡，特别是早上喝美式咖啡来开始一天的工作。这个习惯已经保持了很多年。</content>
  <keywords>咖啡,美式咖啡,早晨习惯</keywords>
  <priority>75</priority>
  <is_constant>true</is_constant>
  <tags>生活习惯,偏好</tags>
  <source>用户告知</source>
</memory>`

const result2 = addSemanticMemory(xmlMemory2)
console.log(JSON.stringify(result2, null, 2))
console.log('\n')

// 测试3: update_traits
console.log('测试3 - update_traits:')
const xmlTraits = `<traits>
  <trait>
    <name>耐心</name>
    <value>用户在面对挑战时总是表现出非凡的耐心，能够保持冷静并持续尝试不同的解决方法。</value>
    <confidence>0.9</confidence>
    <priority>85</priority>
    <is_constant>true</is_constant>
    <keywords>耐心,冷静,解决问题</keywords>
  </trait>
</traits>`

const result3 = updateTraits(xmlTraits)
console.log(JSON.stringify(result3, null, 2))
console.log('\n')

// 测试4: update_goals
console.log('测试4 - update_goals:')
const xmlGoals = `<goals>
  <goal>
    <value>用户有一个长期目标——在五年内创立自己的科技公司，专注于通过技术改变人们的生活。</value>
    <priority>95</priority>
    <is_constant>true</is_constant>
    <keywords>创业,科技公司,长期规划</keywords>
  </goal>
</goals>`

const result4 = updateGoals(xmlGoals)
console.log(JSON.stringify(result4, null, 2))
console.log('\n')

// 测试5: 属性格式
console.log('测试5 - 属性格式XML:')
const xmlMemory5 = `<memory content="用户分享了他学习编程的经历，第一次成功运行程序时感觉很神奇。" keywords="编程,学习,成功体验" priority="75" emotional_context="兴奋,成就感">
</memory>`

const result5 = addEpisodicMemory(xmlMemory5)
console.log(JSON.stringify(result5, null, 2))
console.log('\n')

// 测试6: 错误情况 - 缺少必需参数
console.log('测试6 - 错误情况 - 缺少必需参数:')
const result6 = addEpisodicMemory(null)
console.log(JSON.stringify(result6, null, 2))
console.log('\n')

// 测试7: 错误情况 - 内容为空
console.log('测试7 - 错误情况 - 内容为空:')
const xmlMemory7 = `<memory>
  <content></content>
  <keywords>测试</keywords>
</memory>`

const result7 = addEpisodicMemory(xmlMemory7)
console.log(JSON.stringify(result7, null, 2))
console.log('\n')

console.log('=== 测试完成 ===')