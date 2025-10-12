/**
 * 角色记忆触发类型定义
 * 基于世界书触发机制的角色记忆系统
 */

import { z } from "zod"
import type { ChatMessage } from "./chat-message.js"

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
 * 记忆类型枚举
 */
export enum MemoryType {
  EPISODIC = 'episodic',      // 情景记忆
  SEMANTIC = 'semantic',      // 语义记忆
  TRAIT = 'trait',           // 特质记忆
  GOAL = 'goal'              // 目标记忆
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

// ==================== Zod Schema 验证 ====================

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
 * 记忆类型枚举 schema
 */
export const memoryTypeSchema = z.enum([
  MemoryType.EPISODIC,
  MemoryType.SEMANTIC,
  MemoryType.TRAIT,
  MemoryType.GOAL
]);

/**
 * 记忆触发条目 schema
 */
export const memoryTriggerEntrySchema = z.object({
  id: z.string(),
  type: memoryTypeSchema,
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

// ==================== 默认配置 ====================

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