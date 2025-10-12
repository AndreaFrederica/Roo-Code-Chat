# 任务1: 类型定义扩展

## 📋 任务概述

**任务编号**: 01
**任务名称**: 类型定义扩展
**优先级**: 🔴 高
**预估时间**: 0.5天
**依赖**: 无
**负责人**: 开发者

为记忆服务添加完整的TypeScript类型定义，确保类型安全和开发体验。

## 🎯 具体内容

### 1.1 核心触发类型定义

创建 `packages/types/src/role-memory-trigger.ts` 文件：

```typescript
/**
 * 触发类型枚举
 */
export enum TriggerType {
  KEYWORD = 'keyword',           // 关键词触发
  SEMANTIC = 'semantic',         // 语义触发
  TEMPORAL = 'temporal',         // 时间触发
  EMOTIONAL = 'emotional'        // 情感触发
}

/**
 * 记忆触发条目
 * 扩展原有记忆类型，添加触发相关字段
 */
export interface MemoryTriggerEntry {
  /** 唯一标识符 */
  id: string;

  /** 记忆类型 */
  type: MemoryType;

  /** 记忆内容 */
  content: string;

  /** 触发关键词 */
  keywords: string[];

  /** 触发类型 */
  triggerType: TriggerType;

  /** 优先级 (0-100) */
  priority: number;

  /** 是否为常驻记忆 */
  isConstant: boolean;

  /** 所属角色UUID */
  roleUuid: string;

  /** 创建时间戳 */
  timestamp: number;

  /** 最后访问时间 */
  lastAccessed: number;

  /** 访问次数 */
  accessCount: number;

  /** 相关性权重 */
  relevanceWeight: number;

  /** 情感权重 */
  emotionalWeight: number;

  /** 时间衰减因子 */
  timeDecayFactor: number;

  /** 相关话题 */
  relatedTopics: string[];

  /** 情感上下文 */
  emotionalContext: string[];

  /** 扩展元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 记忆类型枚举
 */
export enum MemoryType {
  EPISODIC = 'episodic',      // 情景记忆
  SEMANTIC = 'semantic',      // 语义记忆
  TRAIT = 'trait',           // 特质记忆
  GOAL = 'goal'              // 目标记忆
}

/**
 * 触发匹配结果
 */
export interface TriggerMatch {
  /** 匹配的记忆条目 */
  entry: MemoryTriggerEntry;

  /** 匹配得分 */
  score: number;

  /** 匹配类型 */
  matchType: TriggerType;

  /** 匹配详情 */
  details: {
    keywordMatches?: string[];
    semanticSimilarity?: number;
    temporalScore?: number;
    emotionalScore?: number;
  };
}
```

### 1.2 配置类型定义

```typescript
/**
 * 触发策略配置
 */
export interface TriggerStrategies {
  /** 启用关键词匹配 */
  keywordMatching: boolean;

  /** 启用语义相似度匹配 */
  semanticSimilarity: boolean;

  /** 启用时间邻近性匹配 */
  temporalProximity: boolean;

  /** 启用情感相关性匹配 */
  emotionalRelevance: boolean;
}

/**
 * 记忆检索配置
 */
export interface MemoryRetrievalConfig {
  /** 每种类型的最大记忆数量 */
  maxMemoriesPerType: {
    episodic: number;
    semantic: number;
    traits: number;
    goals: number;
  };

  /** 相关性阈值 */
  relevanceThreshold: number;

  /** 启用时间衰减 */
  timeDecayEnabled: boolean;

  /** 启用情感增强 */
  emotionalBoostEnabled: boolean;

  /** 最大检索时间 (毫秒) */
  maxRetrievalTime: number;
}

/**
 * 记忆注入配置
 */
export interface MemoryInjectionConfig {
  /** 最大注入内容长度 */
  maxTotalLength: number;

  /** 注入位置 */
  injectPosition: 'system' | 'user' | 'assistant';

  /** 注入模板 */
  template: string;

  /** 按类型分组显示 */
  separateByType: boolean;

  /** 显示记忆时间戳 */
  showTimestamps: boolean;

  /** 显示记忆来源 */
  showSource: boolean;
}

/**
 * 记忆触发配置
 */
export interface MemoryTriggerConfig {
  /** 是否启用触发系统 */
  enabled: boolean;

  /** 触发策略 */
  triggerStrategies: TriggerStrategies;

  /** 检索配置 */
  retrievalConfig: MemoryRetrievalConfig;

  /** 注入配置 */
  injectionConfig: MemoryInjectionConfig;

  /** 调试模式 */
  debugMode: boolean;
}
```

### 1.3 结果类型定义

```typescript
/**
 * 记忆触发结果
 */
export interface MemoryTriggerResult {
  /** 触发的记忆条目 */
  triggeredMemories: MemoryTriggerEntry[];

  /** 常驻内容 (始终注入) */
  constantContent: string;

  /** 触发内容 (条件注入) */
  triggeredContent: string;

  /** 完整内容 */
  fullContent: string;

  /** 注入的词条数量 */
  injectedCount: number;

  /** 处理耗时 (毫秒) */
  duration: number;

  /** 触发统计 */
  stats: {
    keywordMatches: number;
    semanticMatches: number;
    temporalMatches: number;
    emotionalMatches: number;
  };
}

/**
 * 记忆查询参数
 */
export interface MemoryQuery {
  /** 角色UUID */
  roleUuid: string;

  /** 记忆类型过滤 */
  types?: MemoryType[];

  /** 关键词过滤 */
  keywords?: string[];

  /** 时间范围 */
  timeRange?: {
    start: number;
    end: number;
  };

  /** 最小相关性阈值 */
  minRelevance?: number;

  /** 最大结果数量 */
  limit?: number;
}

/**
 * 对话上下文
 */
export interface ConversationContext {
  /** 角色UUID */
  roleUuid: string;

  /** 当前消息 */
  currentMessage: ChatMessage;

  /** 对话历史 */
  conversationHistory: ChatMessage[];

  /** 上下文关键词 */
  contextKeywords: string[];

  /** 情感状态 */
  emotionalState?: string;

  /** 当前话题 */
  currentTopic?: string;
}
```

### 1.4 Zod Schema 验证

```typescript
import { z } from "zod";

/**
 * 触发类型枚举 schema
 */
export const triggerTypeSchema = z.enum([
  TriggerType.KEYWORD,
  TriggerType.SEMANTIC,
  TriggerType.TEMPORAL,
  TriggerType.EMOTIONAL
]);

/**
 * 记忆触发条目 schema
 */
export const memoryTriggerEntrySchema = z.object({
  id: z.string(),
  type: z.nativeEnum(MemoryType),
  content: z.string().min(1),
  keywords: z.array(z.string()),
  triggerType: triggerTypeSchema,
  priority: z.number().min(0).max(100),
  isConstant: z.boolean(),
  roleUuid: z.string().uuid(),
  timestamp: z.number(),
  lastAccessed: z.number(),
  accessCount: z.number().min(0),
  relevanceWeight: z.number().min(0).max(1),
  emotionalWeight: z.number().min(0).max(1),
  timeDecayFactor: z.number().min(0).max(1),
  relatedTopics: z.array(z.string()),
  emotionalContext: z.array(z.string()),
  metadata: z.record(z.unknown()).optional()
});

/**
 * 触发策略配置 schema
 */
export const triggerStrategiesSchema = z.object({
  keywordMatching: z.boolean(),
  semanticSimilarity: z.boolean(),
  temporalProximity: z.boolean(),
  emotionalRelevance: z.boolean()
});

/**
 * 记忆检索配置 schema
 */
export const memoryRetrievalConfigSchema = z.object({
  maxMemoriesPerType: z.object({
    episodic: z.number().min(0),
    semantic: z.number().min(0),
    traits: z.number().min(0),
    goals: z.number().min(0)
  }),
  relevanceThreshold: z.number().min(0).max(1),
  timeDecayEnabled: z.boolean(),
  emotionalBoostEnabled: z.boolean(),
  maxRetrievalTime: z.number().min(100)
});

/**
 * 记忆注入配置 schema
 */
export const memoryInjectionConfigSchema = z.object({
  maxTotalLength: z.number().min(100),
  injectPosition: z.enum(['system', 'user', 'assistant']),
  template: z.string(),
  separateByType: z.boolean(),
  showTimestamps: z.boolean(),
  showSource: z.boolean()
});

/**
 * 记忆触发配置 schema
 */
export const memoryTriggerConfigSchema = z.object({
  enabled: z.boolean(),
  triggerStrategies: triggerStrategiesSchema,
  retrievalConfig: memoryRetrievalConfigSchema,
  injectionConfig: memoryInjectionConfigSchema,
  debugMode: z.boolean()
});
```

### 1.5 默认配置

```typescript
/**
 * 默认触发策略配置
 */
export const DEFAULT_TRIGGER_STRATEGIES: TriggerStrategies = {
  keywordMatching: true,
  semanticSimilarity: false,  // 需要语义搜索API
  temporalProximity: true,
  emotionalRelevance: true
};

/**
 * 默认检索配置
 */
export const DEFAULT_RETRIEVAL_CONFIG: MemoryRetrievalConfig = {
  maxMemoriesPerType: {
    episodic: 3,
    semantic: 2,
    traits: 5,
    goals: 3
  },
  relevanceThreshold: 0.3,
  timeDecayEnabled: true,
  emotionalBoostEnabled: true,
  maxRetrievalTime: 500
};

/**
 * 默认注入配置
 */
export const DEFAULT_INJECTION_CONFIG: MemoryInjectionConfig = {
  maxTotalLength: 2000,
  injectPosition: 'system',
  template: `## 角色记忆

{{#if constantContent}}
### 常驻记忆
{{constantContent}}
{{/if}}

{{#if triggeredContent}}
### 相关记忆
{{triggeredContent}}
{{/if}}`,
  separateByType: true,
  showTimestamps: false,
  showSource: false
};

/**
 * 默认记忆触发配置
 */
export const DEFAULT_MEMORY_TRIGGER_CONFIG: MemoryTriggerConfig = {
  enabled: true,
  triggerStrategies: DEFAULT_TRIGGER_STRATEGIES,
  retrievalConfig: DEFAULT_RETRIEVAL_CONFIG,
  injectionConfig: DEFAULT_INJECTION_CONFIG,
  debugMode: false
};
```

## ✅ 验收标准

- [ ] 所有类型定义完整且类型安全
- [ ] 与现有类型系统兼容
- [ ] 包含完整的JSDoc注释
- [ ] Zod schema验证正确
- [ ] 默认配置合理可用

## 📁 文件清单

### 新建文件
- `packages/types/src/role-memory-trigger.ts` - 核心类型定义

### 修改文件
- `packages/types/src/index.ts` - 添加新类型导出

## 🔗 依赖关系

这个任务没有前置依赖，但会被以下任务依赖：
- 任务2: 存储层增强
- 任务3: 基础触发引擎实现
- 任务7: 主服务类实现

## 📝 注意事项

1. **向后兼容**: 确保新类型不破坏现有代码
2. **扩展性**: 设计要考虑未来功能扩展
3. **文档完整性**: 所有接口都要有详细的JSDoc注释
4. **类型安全**: 使用TypeScript严格模式，确保类型安全
5. **验证完整性**: Zod schema要覆盖所有可配置字段

## 🧪 测试建议

```typescript
// 类型验证测试示例
describe('Memory Trigger Types', () => {
  it('should validate MemoryTriggerEntry schema', () => {
    const entry = {
      id: 'test-id',
      type: MemoryType.EPISODIC,
      content: 'Test content',
      keywords: ['test'],
      triggerType: TriggerType.KEYWORD,
      priority: 50,
      isConstant: false,
      roleUuid: '550e8400-e29b-41d4-a716-446655440000',
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 1,
      relevanceWeight: 0.8,
      emotionalWeight: 0.5,
      timeDecayFactor: 0.1,
      relatedTopics: [],
      emotionalContext: []
    };

    expect(() => memoryTriggerEntrySchema.parse(entry)).not.toThrow();
  });
});
```

---

*创建时间: 2025-10-12*
*所属阶段: 阶段一 - 基础架构搭建*
*下一任务: 任务2 - 存储层增强*