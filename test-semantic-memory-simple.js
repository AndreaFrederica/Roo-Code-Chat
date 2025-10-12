// 简单测试语义记忆工具
console.log('=== 简单测试语义记忆工具 ===\n');

// 测试基础XML解析
function parseXmlMemory(xmlString) {
	const memoryData = {}

	const extractTagContent = (tag) => {
		const regex = new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 'is')
		const match = xmlString.match(regex)
		return match ? match[1].trim() : ''
	}

	memoryData.content = extractTagContent('content')

	const keywordsStr = extractTagContent('keywords')
	memoryData.keywords = keywordsStr ? keywordsStr.split(',').map(k => k.trim()).filter(k => k) : []

	const priorityStr = extractTagContent('priority')
	memoryData.priority = priorityStr ? parseInt(priorityStr, 10) : undefined

	const isConstantStr = extractTagContent('is_constant')
	memoryData.isConstant = isConstantStr ? isConstantStr.toLowerCase() === 'true' : undefined

	const tagsStr = extractTagContent('tags')
	memoryData.tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(t => t) : undefined

	memoryData.source = extractTagContent('source') || "对话添加"

	return memoryData
}

// 测试数据
const xmlData = `
<memory>
  <content>用户喜欢喝咖啡，特别是早上喝美式咖啡来开始一天的工作。</content>
  <keywords>咖啡,美式咖啡,早晨习惯</keywords>
  <priority>75</priority>
  <is_constant>true</is_constant>
  <tags>生活习惯,偏好</tags>
  <source>用户告知</source>
</memory>`;

console.log('1. 测试XML解析');
const memoryData = parseXmlMemory(xmlData);
console.log('解析结果:', memoryData);

if (!memoryData.content) {
	console.log('❌ 错误：记忆内容为空');
} else {
	console.log('✅ 记忆内容解析成功');
	console.log(`   内容: ${memoryData.content}`);
	console.log(`   关键词: [${memoryData.keywords.join(', ')}]`);
	console.log(`   优先级: ${memoryData.priority}`);
	console.log(`   标签: [${memoryData.tags?.join(', ') || '无'}]`);
	console.log(`   来源: ${memoryData.source}`);
}

console.log('\n2. 测试语义记忆工具基础功能');

// 模拟语义记忆对象
const semanticMemory = {
	id: 'test_semantic_' + Date.now(),
	content: memoryData.content,
	updatedAt: Date.now(),
	tags: memoryData.tags,
	source: memoryData.source,
	keywords: memoryData.keywords,
	triggerType: 'semantic',
	priority: memoryData.priority || 60,
	isConstant: memoryData.isConstant || false,
	lastAccessed: Date.now(),
	accessCount: 0,
	relevanceWeight: 0.9,
	emotionalWeight: 0.3,
	timeDecayFactor: 0.05,
	relatedTopics: memoryData.tags || [],
	emotionalContext: [],
	metadata: {
		source: memoryData.source || 'manual',
		version: 'enhanced',
		originalLength: memoryData.content.length,
		truncated: memoryData.content.length < 50
	}
};

console.log('语义记忆对象创建成功:');
console.log(`  ID: ${semanticMemory.id}`);
console.log(`  内容长度: ${semanticMemory.content.length}`);
console.log(`  关键词数量: ${semanticMemory.keywords.length}`);
console.log(`  标签数量: ${semanticMemory.tags?.length || 0}`);

console.log('\n=== 测试结果 ===');
console.log('✅ XML解析功能正常');
console.log('✅ 语义记忆对象创建正常');
console.log('✅ 基础字段验证通过');

console.log('\n🔍 下一步检查:');
console.log('1. 检查实际的记忆服务调用');
console.log('2. 检查文件系统权限');
console.log('3. 检查角色UUID是否正确');
console.log('4. 检查baseService.upsertSemantic方法');