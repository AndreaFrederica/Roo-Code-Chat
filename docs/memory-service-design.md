# 基于世界书触发机制的记忆服务设计方案

## 📋 概述

基于现有的世界书触发机制，设计一个智能的角色记忆服务系统。该系统将根据对话内容自动触发相关记忆，为AI角色提供持续的上下文信息，增强对话的一致性和连贯性。

## 🎯 设计目标

### 核心需求
- **长期记忆存储** - 保存对话历史、角色设定、场景信息
- **智能触发机制** - 基于对话内容自动检索相关记忆
- **记忆分类管理** - 支持不同类型的记忆（角色记忆、情节记忆、情感记忆等）
- **上下文注入** - 将相关记忆无缝集成到AI回复中
- **记忆演化** - 随着对话发展不断更新和优化记忆

### 设计原则
- **高性能** - 快速检索相关记忆，不影响对话流畅性
- **智能化** - 基于语义相关性而不仅仅是关键词匹配
- **可扩展** - 支持多种记忆类型和存储策略
- **轻量级** - 不显著增加系统负担

## 🏗️ 架构设计

### 现有架构分析

```
现有记忆服务架构:
RoleMemoryService (src/services/anh-chat/RoleMemoryService.ts)
├── episodic: EpisodicMemory[]    // 情景记忆
├── semantic: SemanticMemory[]    // 语义记忆
├── traits: TraitMemory[]         // 特质记忆
└── goals: GoalMemory[]          // 目标记忆

存储结构: {memoryDir}/{roleUuid}/memory.json
```

### 扩展架构设计

```
记忆触发服务架构:
RoleMemoryTriggerService (新建)
├── MemoryTriggerEngine (复用WorldBookTriggerEngine)
├── MemoryRetriever (记忆检索器)
├── MemoryInjector (记忆注入器)
└── MemoryStorage (存储层，复用RoleMemoryService)

触发流程:
用户消息 → 触发引擎 → 记忆检索 → 内容注入 → AI回复
```

### 核心组件

1. **RoleMemoryTriggerService** - 主服务类，协调各组件
2. **MemoryTriggerEngine** - 触发引擎，复用世界书触发逻辑
3. **Enhanced Memory Types** - 增强的记忆类型定义
4. **Memory Injection System** - 记忆注入系统
5. **Configuration Management** - 配置管理

## 📊 类型定义

### 增强的记忆条目

```typescript
interface MemoryTriggerEntry {
  id: string;
  type: MemoryType;
  content: string;
  keywords: string[];
  triggerType: 'keyword' | 'semantic' | 'temporal' | 'emotional';
  priority: number;
  isConstant: boolean;
  roleUuid: string;
  timestamp: number;
  relevanceWeight: number;
  emotionalWeight: number;
  timeDecayFactor: number;
  relatedTopics: string[];
  emotionalContext: string[];
}

enum MemoryType {
  EPISODIC = 'episodic',          // 情景记忆
  SEMANTIC = 'semantic',          // 语义记忆
  TRAIT = 'trait',               // 特质记忆
  GOAL = 'goal'                  // 目标记忆
}
```

### 触发配置

```typescript
interface MemoryTriggerConfig {
  enabled: boolean;
  triggerStrategies: {
    keywordMatching: boolean;
    semanticSimilarity: boolean;
    temporalProximity: boolean;
    emotionalRelevance: boolean;
  };
  retrievalConfig: {
    maxMemoriesPerType: {
      episodic: number;
      semantic: number;
      traits: number;
      goals: number;
    };
    relevanceThreshold: number;
    timeDecayEnabled: boolean;
    emotionalBoostEnabled: boolean;
  };
  injectionConfig: {
    maxTotalLength: number;
    injectPosition: 'system' | 'user' | 'assistant';
    template: string;
    separateByType: boolean;
  };
}
```

## 🔧 实现步骤概览

### 阶段一：基础架构 (1-2天)
1. **类型定义扩展** - 创建记忆触发相关类型
2. **存储层增强** - 扩展现有存储支持触发字段
3. **基础引擎实现** - 实现核心触发逻辑

### 阶段二：触发机制 (2-3天)
4. **记忆检索器** - 实现多种检索策略
5. **触发引擎完善** - 复用世界书触发逻辑
6. **记忆注入器** - 实现智能内容注入

### 阶段三：系统集成 (1-2天)
7. **服务集成** - 集成到ClineProvider
8. **配置管理** - 添加配置选项
9. **测试验证** - 功能测试和性能验证

### 阶段四：界面和优化 (1-2天)
10. **设置界面** - 创建用户配置界面
11. **性能优化** - 缓存和异步处理优化
12. **文档完善** - 用户文档和开发文档

## 🎯 关键特性

### 1. 基于角色的记忆隔离
- 每个角色UUID拥有独立的记忆空间
- 记忆不会跨角色混淆
- 支持角色间的记忆关联

### 2. 多维度触发策略
- **关键词匹配** - 基于用户输入的关键词
- **语义相似度** - 基于文本语义相关性
- **时间邻近性** - 基于记忆的时间衰减
- **情感相关性** - 基于情感上下文匹配

### 3. 智能记忆排序
- 综合考虑相关性、时间、情感等因素
- 动态调整记忆权重
- 避免重复和过时记忆

### 4. 灵活的注入机制
- 支持多种注入位置（系统/用户/助手）
- 模板化的注入格式
- 可配置的注入长度限制

## 📈 性能考虑

### 缓存策略
- 记忆检索结果缓存
- 触发引擎状态缓存
- 角色记忆预加载

### 异步处理
- 记忆检索异步执行
- 非阻塞的触发处理
- 后台记忆更新

### 内存管理
- 记忆条目数量限制
- 自动清理过期记忆
- 智能记忆压缩

## 🔗 集成点

### ClineProvider集成
```typescript
// 在 buildPromptForTask 中添加记忆触发
const memoryTriggerResult = await this.anhChatServices.roleMemoryTriggerService
  .processMessageWithMemory(roleUuid, lastMessage, conversationHistory);

if (memoryTriggerResult?.fullContent) {
  systemPrompt += `\n\n## 角色记忆\n${memoryTriggerResult.fullContent}`;
}
```

### 设置界面集成
- 在全局设置中添加记忆触发配置
- 支持实时配置更新
- 提供记忆统计信息

## 📋 验收标准

### 功能性要求
- ✅ 支持四种记忆类型的触发
- ✅ 实现多种触发策略
- ✅ 记忆内容正确注入到AI提示
- ✅ 角色记忆完全隔离
- ✅ 配置界面完整可用

### 性能要求
- ✅ 记忆检索延迟 < 100ms
- ✅ 不影响对话响应时间
- ✅ 内存占用增长 < 10%

### 用户体验要求
- ✅ 配置简单直观
- ✅ 记忆效果明显改善
- ✅ 无感知的后台运行

## 🚀 未来扩展

### 高级功能
- 语义搜索API集成
- 记忆聚类和关联分析
- 记忆可视化界面
- 记忆导出和备份

### 智能化增强
- 记忆重要性自动评估
- 记忆冲突检测和解决
- 个性化记忆推荐
- 记忆演化预测

---

*创建时间: 2025-10-12*
*最后更新: 2025-10-12*
*版本: v1.0*