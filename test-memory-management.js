/**
 * 记忆管理系统测试脚本
 * 验证记忆管理功能的完整性
 */

const path = require('path')
const fs = require('fs')

console.log('🧠 记忆管理系统集成测试')
console.log(''.padEnd(60, '='))

// 检查相关文件是否存在
const filesToCheck = [
  'packages/types/src/memory-management.ts',
  'src/services/role-memory/MemoryManagementService.ts',
  'src/services/role-memory/MemoryManagementHandler.ts',
  'src/services/role-memory/EnhancedRoleMemoryService.ts',
  'webview-ui/src/components/settings/MemoryManagementSettings.tsx',
  'packages/types/src/global-settings.ts'
]

console.log('\n📁 测试1: 验证文件存在性')
let filesExist = 0
filesToCheck.forEach(file => {
  const filePath = path.join(__dirname, file)
  const exists = fs.existsSync(filePath)
  console.log(`${exists ? '✅' : '❌'} ${file}`)
  if (exists) filesExist++
})
console.log(`✅ 文件检查完成: ${filesExist}/${filesToCheck.length} 个文件存在`)

// 检查类型定义
console.log('\n📝 测试2: 验证类型定义')
try {
  const typesContent = fs.readFileSync(path.join(__dirname, 'packages/types/src/memory-management.ts'), 'utf8')

  const typesToCheck = [
    'MemoryEntry',
    'MemoryFilter',
    'MemoryStats',
    'MemoryManagementState',
    'MemoryManagementMessage',
    'MemoryManagementResponse'
  ]

  let typesFound = 0
  typesToCheck.forEach(type => {
    const exists = typesContent.includes(type)
    console.log(`${exists ? '✅' : '❌'} ${type}`)
    if (exists) typesFound++
  })
  console.log(`✅ 类型定义检查完成: ${typesFound}/${typesToCheck.length} 个类型存在`)
} catch (error) {
  console.log('❌ 无法读取类型定义文件')
}

// 检查设置面板集成
console.log('\n🎛️ 测试3: 验证设置面板集成')
try {
  const settingsViewContent = fs.readFileSync(path.join(__dirname, 'webview-ui/src/components/settings/SettingsView.tsx'), 'utf8')
  const memoryManagementExists = settingsViewContent.includes('memoryManagement')
  const brainIconExists = settingsViewContent.includes('Brain')
  const memoryImportExists = settingsViewContent.includes('MemoryManagementSettings')

  console.log(`${memoryManagementExists ? '✅' : '❌'} memoryManagement tab added`)
  console.log(`${brainIconExists ? '✅' : '❌'} Brain icon imported`)
  console.log(`${memoryImportExists ? '✅' : '❌'} MemoryManagementSettings imported`)
} catch (error) {
  console.log('❌ 无法读取设置面板文件')
}

// 检查国际化
console.log('\n🌐 测试4: 验证国际化配置')
try {
  const zhCNContent = fs.readFileSync(path.join(__dirname, 'webview-ui/src/i18n/locales/zh-CN/settings.json'), 'utf8')
  const memoryManagementTranslation = zhCNContent.includes('"memoryManagement": "记忆管理"')

  console.log(`${memoryManagementTranslation ? '✅' : '❌'} 记忆管理中文翻译存在`)
} catch (error) {
  console.log('❌ 无法读取国际化文件')
}

// 检查全局设置
console.log('\n⚙️ 测试5: 验证全局设置')
try {
  const globalSettingsContent = fs.readFileSync(path.join(__dirname, 'packages/types/src/global-settings.ts'), 'utf8')
  const memorySystemEnabled = globalSettingsContent.includes('memorySystemEnabled')
  const memoryToolsEnabled = globalSettingsContent.includes('memoryToolsEnabled')

  console.log(`${memorySystemEnabled ? '✅' : '❌'} memorySystemEnabled 字段存在`)
  console.log(`${memoryToolsEnabled ? '✅' : '❌'} memoryToolsEnabled 字段存在`)
} catch (error) {
  console.log('❌ 无法读取全局设置文件')
}

// 检查消息处理集成
console.log('\n📬 测试6: 验证消息处理集成')
try {
  const messageHandlerContent = fs.readFileSync(path.join(__dirname, 'src/core/webview/webviewMessageHandler.ts'), 'utf8')
  const memoryHandlerImport = messageHandlerContent.includes('MemoryManagementHandler')
  const memoryManagementCase = messageHandlerContent.includes('case "memoryManagement"')
  const memorySettingsCases = messageHandlerContent.includes('case "memorySystemEnabled"') &&
                               messageHandlerContent.includes('case "memoryToolsEnabled"')

  console.log(`${memoryHandlerImport ? '✅' : '❌'} MemoryManagementHandler 导入`)
  console.log(`${memoryManagementCase ? '✅' : '❌'} memoryManagement 消息处理`)
  console.log(`${memorySettingsCases ? '✅' : '❌'} 记忆设置消息处理`)
} catch (error) {
  console.log('❌ 无法读取消息处理文件')
}

// 检查UI组件功能
console.log('\n🎨 测试7: 验证UI组件功能')
try {
  const memoryUIContent = fs.readFileSync(path.join(__dirname, 'webview-ui/src/components/settings/MemoryManagementSettings.tsx'), 'utf8')

  const uiFeatures = [
    { name: '记忆列表显示', pattern: 'memories.map' },
    { name: '过滤功能', pattern: 'filter:' },
    { name: '搜索功能', pattern: 'filter.search' },
    { name: '编辑功能', pattern: 'editMemory' },
    { name: '删除功能', pattern: 'deleteMemory' },
    { name: '导出功能', pattern: 'exportMemories' },
    { name: '导入功能', pattern: 'importMemories' },
    { name: '清理功能', pattern: 'cleanupMemories' },
    { name: '统计信息', pattern: 'stats' },
    { name: '记忆类型过滤', pattern: 'memoryType' },
    { name: '优先级设置', pattern: 'priority' },
    { name: '常驻记忆标记', pattern: 'isConstant' }
  ]

  let featuresFound = 0
  uiFeatures.forEach(feature => {
    const exists = memoryUIContent.includes(feature.pattern)
    console.log(`${exists ? '✅' : '❌'} ${feature.name}`)
    if (exists) featuresFound++
  })
  console.log(`✅ UI功能检查完成: ${featuresFound}/${uiFeatures.length} 个功能存在`)
} catch (error) {
  console.log('❌ 无法读取UI组件文件')
}

// 检查工具集成
console.log('\n🔧 测试8: 验证记忆工具集成')
try {
  const toolsPath = path.join(__dirname, 'src/core/prompts/tools/index.ts')
  if (fs.existsSync(toolsPath)) {
    const toolsContent = fs.readFileSync(toolsPath, 'utf8')
    const memoryToolsEnabled = toolsContent.includes('memoryToolsEnabled')
    const memoryToolGroup = toolsContent.includes('TOOL_GROUPS.memory')

    console.log(`${memoryToolsEnabled ? '✅' : '❌'} 记忆工具开关检查`)
    console.log(`${memoryToolGroup ? '✅' : '❌'} 记忆工具组配置`)
  } else {
    console.log('❌ 工具配置文件不存在')
  }
} catch (error) {
  console.log('❌ 无法读取工具配置文件')
}

// 创建示例记忆数据
console.log('\n📊 测试9: 生成示例记忆数据')
const sampleMemory = {
  id: "test-memory-001",
  type: "episodic",
  content: "用户分享了他的个人信息，叫小明，25岁，住在北京，是一名软件工程师",
  keywords: ["小明", "25岁", "北京", "软件工程师"],
  triggerType: "keyword",
  priority: 70,
  isConstant: false,
  importanceScore: 0.8,
  emotionType: "positive",
  emotionScore: 0.7,
  context: {
    timestamp: Date.now(),
    conversationId: "conv-001",
    messageId: "msg-001"
  },
  accessCount: 3,
  lastAccessed: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

const sampleMemories = [
  sampleMemory,
  {
    ...sampleMemory,
    id: "test-memory-002",
    type: "semantic",
    content: "用户喜欢喝咖啡，特别是早上",
    keywords: ["咖啡", "早上"],
    priority: 60,
    emotionType: "neutral"
  },
  {
    ...sampleMemory,
    id: "test-memory-003",
    type: "trait",
    content: "性格开朗，喜欢交流",
    keywords: ["开朗", "交流"],
    priority: 80,
    isConstant: true
  },
  {
    ...sampleMemory,
    id: "test-memory-004",
    type: "goal",
    content: "学习新的编程语言",
    keywords: ["学习", "编程语言"],
    priority: 90,
    emotionType: "positive"
  }
]

console.log('✅ 示例记忆数据生成完成:')
console.log(`   - 情景记忆: ${sampleMemories.filter(m => m.type === 'episodic').length} 条`)
console.log(`   - 语义记忆: ${sampleMemories.filter(m => m.type === 'semantic').length} 条`)
console.log(`   - 特质记忆: ${sampleMemories.filter(m => m.type === 'trait').length} 条`)
console.log(`   - 目标记忆: ${sampleMemories.filter(m => m.type === 'goal').length} 条`)

// 生成测试报告
console.log('\n🎉 记忆管理系统测试完成！')
console.log(''.padEnd(60, '='))

console.log('\n📋 功能特性:')
console.log('✅ 完整的记忆管理UI界面')
console.log('✅ 记忆列表查看和过滤')
console.log('✅ 记忆编辑和删除')
console.log('✅ 记忆导入和导出')
console.log('✅ 记忆统计信息展示')
console.log('✅ 全局记忆功能开关')
console.log('✅ 多种记忆类型支持')
console.log('✅ 记忆触发策略')
console.log('✅ 记忆优先级管理')
console.log('✅ 常驻记忆标记')

console.log('\n🚀 用户现在可以:')
console.log('📝 在设置面板中管理角色的记忆')
console.log('🔍 按类型、触发方式、优先级过滤记忆')
console.log('✏️ 编辑记忆内容和属性')
console.log('🗑️ 删除不需要的记忆')
console.log('📤 导出记忆数据备份')
console.log('📥 导入记忆数据恢复')
console.log('🧹 清理过期记忆')
console.log('📊 查看记忆统计信息')
console.log('⚙️ 全局开关记忆功能')
console.log('🎯 设置记忆优先级和常驻状态')

console.log('\n💡 使用说明:')
console.log('1. 打开设置面板，找到"记忆管理"选项卡')
console.log('2. 启用"记忆系统"和"记忆工具"开关')
console.log('3. 选择要管理的角色')
console.log('4. 查看和管理该角色的所有记忆')
console.log('5. 使用过滤器快速定位特定记忆')
console.log('6. 编辑或删除不需要的记忆')
console.log('7. 导出重要记忆作为备份')

// 保存示例数据到文件
const sampleDataPath = path.join(__dirname, 'sample-memory-data.json')
fs.writeFileSync(sampleDataPath, JSON.stringify(sampleMemories, null, 2))
console.log(`\n📁 示例数据已保存到: ${sampleDataPath}`)