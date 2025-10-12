/**
 * 测试XML格式记忆工具的功能
 */

// 模拟XML解析器
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

// 测试用例
console.log('=== 测试XML格式记忆工具 ===\n')

// 测试1: 完整的XML格式
const xmlMemory1 = `<memory>
  <content>用户今天告诉我他成功完成了那个困扰他很久的项目，我能从他的语气中听出那种如释重负的喜悦。我记得几周前他还为此感到焦虑，甚至考虑过放弃，现在看到他的坚持得到了回报，我真的为他感到高兴。</content>
  <keywords>项目成功,坚持,喜悦,克服困难</keywords>
  <priority>85</priority>
  <is_constant>false</is_constant>
  <emotional_context>喜悦,如释重负,成就感</emotional_context>
  <related_topics>工作,个人成长,目标达成</related_topics>
</memory>`

console.log('测试1 - 完整XML格式:')
const result1 = parseXmlMemory(xmlMemory1)
console.log(JSON.stringify(result1, null, 2))
console.log('\n')

// 测试2: 属性格式XML
const xmlMemory2 = `<memory content="当我听到用户说他即将迎来人生中第一次重要的工作面试时，我能感受到他既兴奋又紧张的情绪。" keywords="工作面试,重要时刻,情绪复杂" priority="90" emotional_context="兴奋,紧张" related_topics="职业发展,人生转折">
</memory>`

console.log('测试2 - 属性格式XML:')
const result2 = parseXmlMemory(xmlMemory2)
console.log(JSON.stringify(result2, null, 2))
console.log('\n')

// 测试3: 混合格式XML
const xmlMemory3 = `<memory>
  <content>用户分享了他学习编程的经历，他说第一次成功运行程序时的感觉就像是魔法一样。</content>
  <keywords>编程,学习,成功体验</keywords>
  <priority>75</priority>
  <emotional_context>兴奋,成就感</emotional_context>
</memory>`

console.log('测试3 - 混合格式XML:')
const result3 = parseXmlMemory(xmlMemory3)
console.log(JSON.stringify(result3, null, 2))
console.log('\n')

// 测试特质解析器
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

// 测试特质XML
const xmlTraits = `<traits>
  <trait>
    <name>耐心</name>
    <value>用户在面对挑战时总是表现出非凡的耐心。记得有一次他解决一个复杂的编程问题，花了整整六个小时不断尝试不同的方法，却始终保持冷静。</value>
    <confidence>0.9</confidence>
    <priority>85</priority>
    <is_constant>true</is_constant>
    <keywords>耐心,冷静,解决问题,坚持</keywords>
  </trait>
  <trait>
    <name>同理心</name>
    <value>用户展现出了强烈的同理心，这点在多次对话中都能感受到。当他听说朋友遇到困难时，他会立即放下手中的事情去帮助。</value>
    <confidence>0.95</confidence>
    <priority>90</priority>
    <is_constant>true</is_constant>
    <keywords>同理心,关怀,帮助他人,友善</keywords>
  </trait>
</traits>`

console.log('测试4 - 特质XML解析:')
const traitsResult = parseXmlTraits(xmlTraits)
console.log(JSON.stringify(traitsResult, null, 2))
console.log('\n')

// 测试目标解析器
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

// 测试目标XML
const xmlGoals = `<goals>
  <goal>
    <value>用户告诉我他有一个长期目标——在五年内创立自己的科技公司。他详细描述了公司的业务方向、团队文化，以及他想如何通过技术改变人们的生活。</value>
    <priority>95</priority>
    <is_constant>true</is_constant>
    <keywords>创业,科技公司,长期规划,梦想</keywords>
  </goal>
  <goal>
    <value>用户今天分享了他的一个短期目标：在未来三个月内掌握一门新的编程语言。他已经制定了详细的学习计划，包括每天投入的时间和具体的学习资源。</value>
    <priority>80</priority>
    <is_constant>false</is_constant>
    <keywords>学习,编程,技能提升,短期目标</keywords>
  </goal>
</goals>`

console.log('测试5 - 目标XML解析:')
const goalsResult = parseXmlGoals(xmlGoals)
console.log(JSON.stringify(goalsResult, null, 2))
console.log('\n')

console.log('=== 测试完成 ===')