// 增强记忆工具测试 - 包含角色扮演和游戏推演场景

// 简化的XML解析函数（复制xml-parser.ts中的逻辑）
function parseXmlMemory(xmlString) {
	const memoryData = {}

	// 简单的XML解析 - 提取各个字段的内容
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

	// 解析content字段
	memoryData.content = extractTagContent('content') || extractAttribute('memory', 'content')

	// 解析keywords字段（逗号分隔）
	const keywordsStr = extractTagContent('keywords') || extractAttribute('memory', 'keywords')
	memoryData.keywords = keywordsStr ? keywordsStr.split(',').map(k => k.trim()).filter(k => k) : []

	// 解析priority字段
	const priorityStr = extractTagContent('priority') || extractAttribute('memory', 'priority')
	memoryData.priority = priorityStr ? parseInt(priorityStr, 10) : undefined

	// 解析is_constant字段
	const isConstantStr = extractTagContent('is_constant') || extractAttribute('memory', 'is_constant')
	memoryData.isConstant = isConstantStr ? isConstantStr.toLowerCase() === 'true' : undefined

	// 解析emotional_context字段（逗号分隔）
	const emotionalStr = extractTagContent('emotional_context') || extractAttribute('memory', 'emotional_context')
	memoryData.emotionalContext = emotionalStr ? emotionalStr.split(',').map(e => e.trim()).filter(e => e) : undefined

	// 解析related_topics字段（逗号分隔）
	const topicsStr = extractTagContent('related_topics') || extractAttribute('memory', 'related_topics')
	memoryData.relatedTopics = topicsStr ? topicsStr.split(',').map(t => t.trim()).filter(t => t) : undefined

	// 解析新增字段 - 支持角色扮演和游戏推演
	const perspectiveStr = extractTagContent('perspective') || extractAttribute('memory', 'perspective')
	memoryData.perspective = perspectiveStr || undefined

	const contextTypeStr = extractTagContent('context_type') || extractAttribute('memory', 'context_type')
	memoryData.contextType = contextTypeStr || undefined

	const uaInfoStr = extractTagContent('ua_info') || extractAttribute('memory', 'ua_info')
	memoryData.uaInfo = uaInfoStr ? uaInfoStr.split(',').map(u => u.trim()).filter(u => u) : undefined

	const gameStateStr = extractTagContent('game_state') || extractAttribute('memory', 'game_state')
	memoryData.gameState = gameStateStr || undefined

	const memoryToneStr = extractTagContent('memory_tone') || extractAttribute('memory', 'memory_tone')
	memoryData.memoryTone = memoryToneStr || undefined

	return memoryData
}

console.log('=== 增强记忆工具测试（支持角色扮演和游戏推演）===\n');

// 测试1: 角色扮演记忆
console.log('测试1 - 角色扮演记忆:');
const roleplayMemory = `
<memory>
  <content>在这次角色扮演中，用户扮演的是一位经验丰富的星际外交官，正在与外星文明进行首次接触。他展现了出色的跨文化沟通能力，通过尊重对方的文化习俗和表达真诚的和平意愿，成功建立了信任关系。</content>
  <keywords>星际外交,外星文明,跨文化沟通,和平谈判</keywords>
  <priority>90</priority>
  <is_constant>false</is_constant>
  <perspective>third_person_observer</perspective>
  <context_type>role_playing</context_type>
  <memory_tone>objective_appreciative</memory_tone>
  <emotional_context>紧张,希望,成就感</emotional_context>
  <related_topics>科幻,外交,跨文化交流</related_topics>
</memory>`;

console.log(parseXmlMemory(roleplayMemory));
console.log();

// 测试2: 游戏推演记忆
console.log('测试2 - 游戏推演记忆:');
const gameSimulationMemory = `
<memory>
  <content>用户在策略推演中扮演中世纪城邦的统治者，面临邻国入侵威胁。他采取了多重策略：加强城防、寻求盟友支持、同时开启外交谈判。最终通过军事威慑和外交手腕的结合，成功避免了战争。</content>
  <keywords>策略推演,军事外交,危机处理,政治智慧</keywords>
  <priority>85</priority>
  <is_constant>false</is_constant>
  <perspective>third_person_observer</perspective>
  <context_type>game_simulation</context_type>
  <game_state>medieval_strategy</game_state>
  <memory_tone>analytical_strategic</memory_tone>
  <emotional_context>紧张,谨慎,满足</emotional_context>
  <related_topics>历史策略,政治,军事</related_topics>
</memory>`;

console.log(parseXmlMemory(gameSimulationMemory));
console.log();

// 测试3: UA信息记忆
console.log('测试3 - UA信息记忆:');
const uaInfoMemory = `
<memory>
  <content>用户通过UA展示了真实身份信息：他是一位在科技公司工作的AI研究员，专门研究自然语言处理和机器学习。他分享了自己在AI伦理方面的观点，认为技术发展应该以服务人类福祉为目标。</content>
  <keywords>AI研究员,真实身份,NLP,机器学习,AI伦理</keywords>
  <priority>95</priority>
  <is_constant>true</is_constant>
  <perspective>first_person_direct</perspective>
  <context_type>ua_information</context_type>
  <ua_info>真实身份,专业背景,价值观</ua_info>
  <memory_tone>professional_respectful</memory_tone>
  <emotional_context>信任,尊重,好奇</emotional_context>
  <related_topics>科技,AI研究,职业发展</related_topics>
</memory>`;

console.log(parseXmlMemory(uaInfoMemory));
console.log();

// 测试4: 技术信息记忆（冷冰冰的风格）
console.log('测试4 - 技术信息记忆（冷冰冰风格）:');
const technicalMemory = `
<memory>
  <content>用户提供了系统配置信息：Ubuntu 22.04 LTS，CPU Intel i7-12700K，内存32GB DDR4，显卡NVIDIA RTX 4080。Python版本3.10.12，PyTorch 2.0.1，CUDA 11.8。用于深度学习模型训练。</content>
  <keywords>系统配置,Ubuntu,深度学习,PyTorch,CUDA</keywords>
  <priority>70</priority>
  <is_constant>false</is_constant>
  <perspective>objective_record</perspective>
  <context_type>technical_information</context_type>
  <memory_tone>neutral_technical</memory_tone>
  <emotional_context>neutral</emotional_context>
  <related_topics>技术,系统配置,深度学习</related_topics>
</memory>`;

console.log(parseXmlMemory(technicalMemory));
console.log();

// 测试5: 情感化第一人称记忆
console.log('测试5 - 情感化第一人称记忆:');
const emotionalMemory = `
<memory>
  <content>今天用户跟我分享了他祖母去世的消息，我能感受到他话语中的那种深深的悲伤和不舍。他回忆起祖母总是为他烤最爱吃的苹果派，那种温暖的味道现在成了他最珍贵的记忆。我静静地听着，希望能给他一些安慰。</content>
  <keywords>祖母去世,悲伤,珍贵回忆,情感支持</keywords>
  <priority>88</priority>
  <is_constant>false</is_constant>
  <perspective>first_person_emotional</perspective>
  <context_type>personal_sharing</context_type>
  <memory_tone>empathetic_caring</memory_tone>
  <emotional_context>悲伤,同情,关怀</emotional_context>
  <related_topics>家庭,情感,生死</related_topics>
</memory>`;

console.log(parseXmlMemory(emotionalMemory));
console.log();

// 测试6: 多人称对比记忆
console.log('测试6 - 多人称对比记忆:');
const multiPerspectiveMemory = `
<memory>
  <content>用户分享了他创业失败的经历。第二人称：'你告诉我那是你人生中最艰难的时刻，但也让你学会了什么是真正的坚持。'第一人称：'我记得你描述那种感觉时，眼中闪烁着复杂的情绪——既有失败的痛苦，也有成长的庆幸。'客观记录：'用户在2021年创立了一家科技公司，2023年因资金链断裂而关闭，历时2年。'</content>
  <keywords>创业失败,坚持,成长,多视角</keywords>
  <priority>80</priority>
  <is_constant>false</is_constant>
  <perspective>mixed_perspectives</perspective>
  <context_type>life_experience</context_type>
  <memory_tone>reflective_supportive</memory_tone>
  <emotional_context>复杂,坚韧,反思</emotional_context>
  <related_topics>创业,成长,人生经历</related_topics>
</memory>`;

console.log(parseXmlMemory(multiPerspectiveMemory));
console.log('=== 测试完成 ===');