/**
 * SillyTavern世界书触发词系统类型定义
 * 基于世界书词条的关键词触发和动态注入
 */

import { WorldEntry, WorldBookConversionResult } from './silly-tavern-worldbook.js';
import { ChatMessage } from './chat-message.js';

/** 世界书触发词配置 */
export interface WorldBookTriggerConfig {
  /** 是否启用世界书触发词系统 */
  enabled: boolean;
  /** 触发检查范围（最近N条消息） */
  checkHistoryLength: number;
  /** 匹配策略 */
  matchStrategy: 'exact' | 'contains' | 'fuzzy' | 'semantic';
  /** 大小写敏感 */
  caseSensitive: boolean;
  /** 是否支持同义词匹配 */
  enableSynonyms: boolean;
  /** 模糊匹配阈值（0-1） */
  fuzzyThreshold: number;
  /** 语义匹配阈值（0-1） */
  semanticThreshold: number;
  /** 最大注入词条数量 */
  maxInjectEntries: number;
  /** 注入策略 */
  injectionStrategy: 'replace' | 'append' | 'prepend' | 'insert';
  /** 防重复注入时间窗口（毫秒） */
  injectionCooldown: number;
  /** 调试模式 */
  debugMode: boolean;
}

/** 世界书触发条目 */
export interface WorldBookTriggerEntry {
  /** 原始世界书词条 */
  entry: WorldEntry;
  /** 触发关键词（主关键词） */
  primaryKeys: string[];
  /** 同义词关键词 */
  secondaryKeys: string[];
  /** 是否常驻（always inject） */
  isConstant: boolean;
  /** 触发优先级 */
  priority: number;
  /** 匹配权重 */
  weight: number;
  /** 选择性触发条件 */
  selectiveConditions?: SelectiveCondition[];
  /** 上下文要求 */
  contextRequirements?: ContextRequirement[];
  /** 注入模板 */
  injectionTemplate?: string;
}

/** 选择性触发条件 */
export interface SelectiveCondition {
  /** 条件类型 */
  type: 'character' | 'user' | 'scenario' | 'tag' | 'custom';
  /** 条件值 */
  value: string | string[];
  /** 操作符 */
  operator: 'equals' | 'contains' | 'matches' | 'in' | 'not_in';
  /** 是否为必需条件 */
  required: boolean;
}

/** 上下文要求 */
export interface ContextRequirement {
  /** 要求类型 */
  type: 'min_messages' | 'max_messages' | 'time_since_last' | 'user_role' | 'conversation_topic';
  /** 要求值 */
  value: number | string;
  /** 比较操作符 */
  operator: 'gte' | 'lte' | 'eq' | 'contains' | 'matches';
}

/** 触发匹配结果 */
export interface WorldbookTriggerMatch {
  /** 匹配的词条 */
  entry: WorldBookTriggerEntry;
  /** 匹配的关键词 */
  matchedKeyword: string;
  /** 匹配类型 */
  matchType: 'primary' | 'secondary' | 'fuzzy' | 'semantic';
  /** 匹配分数 */
  score: number;
  /** 匹配位置 */
  positions: number[];
  /** 匹配的消息 */
  matchedMessages: ChatMessage[];
}

/** 注入动作 */
export interface InjectionAction {
  /** 动作类型 */
  type: 'inject_entry' | 'inject_constant' | 'modify_context' | 'set_variable';
  /** 词条ID */
  entryId: string;
  /** 注入内容 */
  content: string;
  /** 注入位置 */
  position: 'system' | 'context' | 'both';
  /** 临时性 */
  temporary: boolean;
  /** 持续时间（消息数量或毫秒） */
  duration?: number;
  /** 优先级 */
  priority: number;
}

/** 注入结果 */
export interface InjectionResult {
  /** 注入的动作列表 */
  actions: InjectionAction[];
  /** 常驻内容（始终注入） */
  constantContent: string;
  /** 触发内容（条件注入） */
  triggeredContent: string;
  /** 注入的词条数量 */
  injectedCount: number;
  /** 跳过的词条数量 */
  skippedCount: number;
  /** 处理耗时 */
  duration: number;
  /** 调试信息 */
  debugInfo?: TriggerDebugInfo;
}

/** 调试信息 */
export interface TriggerDebugInfo {
  /** 检查的消息数量 */
  messagesChecked: number;
  /** 候选词条数量 */
  candidatesCount: number;
  /** 匹配的触发词 */
  matchedTriggers: WorldbookTriggerMatch[];
  /** 跳过的原因 */
  skippedEntries: Array<{
    entryId: string;
    reason: string;
  }>;
  /** 性能统计 */
  performance: {
    parseTime: number;
    matchTime: number;
    filterTime: number;
    injectionTime: number;
  };
}

/** 世界书触发器状态 */
export interface WorldBookTriggerState {
  /** 已加载的世界书词条 */
  loadedEntries: WorldBookTriggerEntry[];
  /** 当前活跃的触发词条 */
  activeTriggers: string[];
  /** 注入历史（防重复） */
  injectionHistory: InjectionHistory[];
  /** 触发统计 */
  triggerStats: TriggerStats;
  /** 最后更新时间 */
  lastUpdated: number;
}

/** 注入历史记录 */
export interface InjectionHistory {
  /** 词条ID */
  entryId: string;
  /** 注入时间 */
  timestamp: number;
  /** 触发关键词 */
  triggerKeyword: string;
  /** 注入类型 */
  injectionType: 'constant' | 'triggered';
  /** 过期时间 */
  expireAt: number;
}

/** 触发统计 */
export interface TriggerStats {
  /** 总触发次数 */
  totalTriggers: number;
  /** 今日触发次数 */
  todayTriggers: number;
  /** 最热门词条 */
  popularEntries: Array<{
    entryId: string;
    title: string;
    triggerCount: number;
  }>;
  /** 平均响应时间 */
  avgResponseTime: number;
}

/** 智能匹配选项 */
export interface SmartMatchingOptions {
  /** 是否启用语义搜索 */
  enableSemantic: boolean;
  /** 语义模型配置 */
  semanticModel?: {
    provider: 'openai' | 'local' | 'custom';
    model: string;
    apiKey?: string;
    endpoint?: string;
  };
  /** 自定义同义词词典 */
  customSynonyms?: Record<string, string[]>;
  /** 模糊匹配配置 */
  fuzzyConfig?: {
    algorithm: 'levenshtein' | 'jaro-winkler' | 'cosine';
    maxDistance: number;
    caseSensitive: boolean;
  };
}

/** 语义搜索结果 */
export interface SemanticSearchResult {
  /** 词条ID */
  entryId: string;
  /** 语义相似度分数 */
  similarityScore: number;
  /** 匹配的关键概念 */
  matchedConcepts: string[];
  /** 置信度 */
  confidence: number;
}

/** 世界书触发器 */
export interface WorldBookTrigger {
  /** 触发器ID */
  id: string;
  /** 世界书文件路径 */
  worldBookPath: string;
  /** 触发配置 */
  config: WorldBookTriggerConfig;
  /** 智能匹配选项 */
  smartMatching?: SmartMatchingOptions;
  /** 是否启用 */
  enabled: boolean;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}

/** 批量处理选项 */
export interface BatchProcessingOptions {
  /** 并发处理数量 */
  concurrency: number;
  /** 批量大小 */
  batchSize: number;
  /** 超时时间（毫秒） */
  timeout: number;
  /** 失败重试次数 */
  retryAttempts: number;
}

/** 实时触发选项 */
export interface RealTimeTriggerOptions {
  /** 是否启用实时触发 */
  enabled: boolean;
  /** 触发延迟（毫秒） */
  debounceDelay: number;
  /** 最小触发间隔 */
  minTriggerInterval: number;
  /** 是否支持并发触发 */
  allowConcurrent: boolean;
}