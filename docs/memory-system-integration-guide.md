# 角色记忆系统集成指南

## 📋 概述

本文档描述了角色记忆系统的完整实现，包括其架构、功能、使用方法和集成方式。

## 🏗️ 系统架构

### 核心组件

```
记忆系统架构
├── 存储层 (EnhancedRoleMemoryService)
│   ├── 角色记忆存储 (JSON文件)
│   ├── 触发字段支持
│   └── 基础CRUD操作
│
├── 触发引擎 (RoleMemoryTriggerEngine)
│   ├── 多种触发策略
│   ├── 智能匹配算法
│   └── 内容注入
│
├── 检索器 (MemoryRetriever)
│   ├── 4种检索策略
│   ├── 结果排序和过滤
│   └── 性能优化
│
├── 主服务 (RoleMemoryTriggerService)
│   ├── 统一API接口
│   ├── 配置管理
│   └── 批量操作
│
└── 工具系统 (8个记忆工具)
    ├── 写入工具 (4个)
    ├── 搜索工具 (3个)
    └── 管理工具 (1个)
```

### 数据流

```
用户消息 → 触发引擎 → 记忆检索 → 系统提示注入 → AI响应
     ↓
     ↓
记忆工具 → 存储服务 → JSON文件 (按角色拆分)
```

## 🗂️ 存储结构

### 文件组织
```
{anhChatRoot}/memory/
├── {role-uuid-1}/
│   └── memory.json
├── {role-uuid-2}/
│   └── memory.json
└── ...
```

### JSON格式
```json
{
  "characterUuid": "角色ID",
  "episodic": [
    {
      "id": "记忆ID",
      "timestamp": 1234567890,
      "content": "记忆内容",
      "keywords": ["关键词1", "关键词2"],
      "triggerType": "keyword|semantic|temporal|emotional",
      "priority": 70,
      "isConstant": false,
      "lastAccessed": 1234567890,
      "accessCount": 5,
      "relevanceWeight": 0.8,
      "emotionalWeight": 0.5,
      "timeDecayFactor": 0.1,
      "relatedTopics": ["话题1"],
      "emotionalContext": ["开心"],
      "metadata": {}
    }
  ],
  "semantic": [],
  "traits": [],
  "goals": [],
  "lastSyncedAt": 1234567890
}
```

## 🛠️ 工具系统

### 记忆写入工具

#### 1. add_episodic_memory
- **用途**: 记录事件、经历和重要信息
- **场景**: 用户分享个人信息、重要事件、观点表达
- **参数**:
  - `content` (必需): 记忆内容
  - `keywords` (可选): 触发关键词
  - `priority` (可选): 优先级 (0-100)
  - `is_constant` (可选): 是否常驻记忆
  - `emotional_context` (可选): 情感上下文

#### 2. add_semantic_memory
- **用途**: 记录常识、规则、设定等知识性内容
- **场景**: 用户偏好、规则约定、背景知识
- **参数**:
  - `content` (必需): 记忆内容
  - `keywords` (可选): 触发关键词
  - `tags` (可选): 标签
  - `source` (可选): 记忆来源

#### 3. update_traits
- **用途**: 更新角色特质记忆
- **场景**: 性格特点、行为模式、个人特质
- **参数**:
  - `traits` (必需): 特质列表
  - `name`: 特质名称
  - `value`: 特质描述
  - `confidence`: 置信度 (0-1)
  - `priority`: 优先级 (0-100)

#### 4. update_goals
- **用途**: 更新角色目标记忆
- **场景**: 目标、计划、愿望、期望
- **参数**:
  - `goals` (必需): 目标列表
  - `value`: 目标描述
  - `priority`: 优先级 (0-100)
  - `is_constant`: 是否常驻目标

### 记忆搜索工具

#### 1. search_memories
- **用途**: 搜索和回忆相关信息
- **场景**: 查找特定信息、回忆背景、搜索话题
- **参数**:
  - `search_text` (必需): 搜索文本
  - `memory_types` (可选): 记忆类型
  - `max_results` (可选): 结果数量限制

#### 2. get_memory_stats
- **用途**: 获取记忆统计信息
- **场景**: 检查系统状态、分析存储情况
- **参数**: 无

#### 3. get_recent_memories
- **用途**: 获取最近访问的记忆
- **场景**: 快速回顾、查看近期活动
- **参数**:
  - `limit` (可选): 数量限制
  - `memory_types` (可选): 记忆类型

### 记忆管理工具

#### 1. cleanup_memories
- **用途**: 清理过期记忆
- **场景**: 维护系统健康、优化存储空间
- **参数**:
  - `max_age_days` (可选): 最大保存天数
  - `dry_run` (可选): 试运行模式

## 🎯 使用场景

### 1. 自动记忆触发
AI会根据对话内容自动触发相关记忆：

```typescript
// 用户: "我叫小明，今年25岁，住在北京"
// AI自动调用:
await add_episodicMemory({
  content: "我叫小明，今年25岁，住在北京，是一名软件工程师",
  keywords: ["小明", "25岁", "北京", "软件工程师"],
  priority: 70
})
```

### 2. 智能记忆检索
AI会根据上下文自动检索相关记忆：

```typescript
// 用户: "你还记得我上次说的项目进展吗？"
// AI自动调用:
await search_memories({
  search_text: "项目进展",
  memory_types: ["episodic", "semantic"]
})
```

### 3. 主动记忆管理
AI会主动维护记忆系统：

```typescript
// 定期清理过期记忆
await cleanup_memories({
  max_age_days: 30,
  dry_run: true  // 先试运行确认
})
```

## 🔧 触发策略

### 1. 关键词匹配
- **触发**: 用户消息中包含记忆关键词
- **权重**: 优先级 × 关键词匹配度
- **适用**: 明确的术语、名称、专有名词

### 2. 时间邻近性
- **触发**: 根据时间距离计算相关性
- **权重**: 指数衰减函数
- **适用**: 最近的事件、时间相关内容

### 3. 情感相关性
- **触发**: 情感状态匹配
- **权重**: 情感权重 × 相关性
- **适用**: 情感相关的内容和对话

### 4. 语义相似度
- **触发**: 语义内容相似
- **权重**: 语义相似度算法
- **适用**: 话题相关、概念相近

## ⚙️ 配置选项

### 触发策略配置
```typescript
const triggerStrategies = {
  keywordMatching: true,        // 启用关键词匹配
  semanticSimilarity: false,      // 启用语义相似度
  temporalProximity: true,        // 启用时间邻近性
  emotionalRelevance: true        // 启用情感相关性
}
```

### 检索配置
```typescript
const retrievalConfig = {
  maxMemoriesPerType: {
    episodic: 3,    // 情景记忆数量
    semantic: 2,    // 语义记忆数量
    traits: 5,       // 特质记忆数量
    goals: 3         // 目标记忆数量
  },
  relevanceThreshold: 0.3,        // 相关性阈值
  timeDecayEnabled: true,          // 启用时间衰减
  emotionalBoostEnabled: true      // 启用情感增强
}
```

### 注入配置
```typescript
const injectionConfig = {
  maxTotalLength: 2000,            // 最大内容长度
  injectPosition: 'system',          // 注入位置
  template: `## 角色记忆\n...`,  // 注入模板
  separateByType: true,              // 按类型分组
  showTimestamps: false,            // 显示时间戳
  showSource: false                  // 显示来源
}
```

## 🚀 集成方式

### 1. 系统提示集成
记忆内容会自动注入到AI的系统提示中：

```
## 角色记忆

### 常驻记忆
- 角色基本信息
- 长期特质和偏好

### 相关记忆
- 最近对话中的关键信息
- 用户当前相关的话题
- 情感状态和背景
```

### 2. 消息处理集成
每次用户消息都会触发记忆处理：

```typescript
async processMessageWithMemory(roleUuid, message, history) {
  // 1. 提取情感状态和话题
  const emotionalState = extractEmotionalState(message)
  const currentTopic = extractCurrentTopic(message, history)

  // 2. 检索相关记忆
  const memories = await memoryService.searchMemories({
    roleUuid,
    keywords: extractKeywords(message),
    emotionalState,
    currentTopic
  })

  // 3. 注入到系统提示
  return injectMemoriesIntoPrompt(memories)
}
```

### 3. 工具集成
所有记忆工具都集成到AI的工具系统中：

```typescript
// 自动添加到所有模式的工具列表
if (settings?.memoryToolsEnabled !== false) {
  memoryToolGroup.tools.forEach(tool => tools.add(tool))
}
```

## 📊 性能优化

### 1. 缓存机制
- **内存缓存**: 最近访问的记忆
- **访问统计**: 跟踪使用频率
- **时间衰减**: 自动降低旧记忆权重

### 2. 异步处理
- **非阻塞**: 记忆操作不阻塞主流程
- **批量处理**: 优化多次操作
- **错误隔离**: 单个错误不影响整体

### 3. 资源管理
- **定期清理**: 自动清理过期记忆
- **容量限制**: 控制记忆总量
- **优先级管理**: 重要记忆优先保留

## 🔍 调试和监控

### 1. 日志输出
```typescript
console.log(`[MemoryTool] Added episodic memory: ${memoryId}`)
console.log(`[MemoryTrigger] Injected ${result.injectedCount} memories`)
```

### 2. 统计信息
```typescript
const stats = await memoryService.getMemoryStats(roleUuid)
console.log(`Total memories: ${stats.total}`)
console.log(`By type:`, stats.byType)
```

### 3. 性能监控
```typescript
const duration = Date.now() - startTime
console.log(`Memory processing took ${duration}ms`)
```

## 🎯 最佳实践

### 1. AI使用建议
- **主动记录**: 重要信息立即保存
- **定期回顾**: 适当时搜索相关记忆
- **质量优先**: 只记录有意义的信息
- **分类管理**: 使用合适的记忆类型

### 2. 数据管理
- **定期清理**: 清理过期和无关记忆
- **备份重要**: 重要常驻记忆的备份
- **分类标记**: 使用关键词和标签
- **时间戳**: 保持时间信息的准确性

### 3. 性能考虑
- **限制数量**: 每种类型的记忆数量控制
- **优化查询**: 使用合适的搜索策略
- **缓存热点**: 频繁访问的记忆缓存
- **异步处理**: 避免阻塞用户交互

## 🎉 总结

角色记忆系统为AI提供了强大的记忆和上下文保持能力：

✅ **完整的记忆工具集** - 8个工具涵盖所有记忆操作
✅ **智能触发机制** - 4种触发策略自动激活相关记忆
✅ **角色化存储** - 每个角色独立的记忆空间
✅ **无缝集成** - 自动集成到对话流程中
✅ **灵活配置** - 支持多种配置选项和策略
✅ **性能优化** - 缓存、异步处理、资源管理

通过这个系统，AI能够：
- 📝 主动学习和记住用户的偏好和背景
- 🔍 智能回忆相关信息，提供连贯的对话
- 🧠 在对话中持续学习和改进
- 🎯 提供个性化和上下文感知的响应
- 📊 维护健康的记忆系统状态

这显著提升了AI角色的智能水平和用户体验！