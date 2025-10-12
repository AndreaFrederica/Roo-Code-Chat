import * as path from "path"
import * as fs from "fs/promises"
import { v4 as uuidv4 } from "uuid"

import type {
  MemoryEpisodicRecord,
  MemoryGoal,
  MemoryTrait,
  EnhancedMemoryEpisodicRecord,
  EnhancedMemoryGoal,
  EnhancedMemoryTrait
} from "@roo-code/types"
import {
  MemoryType,
  TriggerType
} from "@roo-code/types"
import type { MemoryTriggerEntry, MemoryQuery } from "@roo-code/types"
import { fileExistsAtPath } from "../../utils/fs"
import { safeWriteJson } from "../../utils/safeWriteJson"
import { RoleMemoryService } from "../anh-chat/RoleMemoryService"
import { ensureAnhChatRoot } from "../anh-chat/pathUtils"

interface RoleMemory extends Record<string, unknown> {
  characterUuid: string
  episodic: EpisodicMemory[]
  semantic: SemanticMemory[]
  traits: TraitMemory[]
  goals: GoalMemory[]
  lastSyncedAt?: number
}

type EpisodicMemory = MemoryEpisodicRecord & {
  id?: string
  metadata?: Record<string, unknown>
}

type SemanticMemory = {
  id: string
  content: string
  updatedAt: number
  tags?: string[]
  source?: string
  metadata?: Record<string, unknown>
  keywords?: string[]
  triggerType?: string
  priority?: number
  isConstant?: boolean
  relevanceWeight?: number
  accessCount?: number
  lastAccessed?: number
}

type TraitMemory = MemoryTrait & {
  id?: string
}

type GoalMemory = MemoryGoal & {
  id?: string
}

/**
 * 增强的角色记忆服务
 * 扩展原有记忆服务，添加触发相关功能
 */
export class EnhancedRoleMemoryService {
  private readonly memoryDir: string
  private readonly baseService: RoleMemoryService

  private constructor(private readonly rootDir: string, baseService: RoleMemoryService) {
    this.memoryDir = path.join(rootDir, "memory")
    this.baseService = baseService
  }

  /**
   * 创建增强的角色记忆服务实例
   */
  static async create(basePath: string): Promise<EnhancedRoleMemoryService> {
    const rootDir = await ensureAnhChatRoot(basePath)
    // 使用已经处理过的 rootDir，避免重复添加路径
    const baseService = await RoleMemoryService.create(rootDir)
    const service = new EnhancedRoleMemoryService(rootDir, baseService)
    await fs.mkdir(service.memoryDir, { recursive: true })
    return service
  }

  /**
   * 添加情景记忆并自动生成触发信息（带去重和验证）
   */
  async addEpisodicMemoryWithTrigger(
    roleUuid: string,
    content: string,
    keywords: string[] = [],
    options: {
      priority?: number;
      isConstant?: boolean;
      emotionalContext?: string[];
      relatedTopics?: string[];
    } = {},
    enhancedOptions?: {
      perspective?: string;
      contextType?: string;
      uaInfo?: string[];
      gameState?: string;
      memoryTone?: string;
    }
  ): Promise<string> {
    // 验证内容长度
    if (!content || content.trim().length < 1) {
      throw new Error("记忆内容太短，至少需要1个字符")
    }

    if (content.length > 4000) {
      console.warn(`[EnhancedRoleMemoryService] 情景记忆内容过长 (${content.length} 字符)，可能被截断`)
    }

    const memory = await this.baseService.loadMemory(roleUuid)
    const now = Date.now()

    // 检查是否存在高度相似的情景记忆（避免重复记录相同事件）
    const existingSimilar = memory.episodic.find((record: any) => {
      const existingContent = record.content.toLowerCase().trim()
      const newContent = content.toLowerCase().trim()

      // 检查完全相同
      if (existingContent === newContent) return true

      // 检查高度相似（85%以上相似度，情景记忆允许更多相似性）
      const similarity = this.calculateSimilarity(existingContent, newContent)
      return similarity > 0.85
    })

    if (existingSimilar) {
      console.log(`[EnhancedRoleMemoryService] 发现相似的情景记忆，跳过添加: ${content.substring(0, 30)}...`)
      return existingSimilar.id!
    }

    const id = uuidv4()

    const enhancedRecord: EnhancedMemoryEpisodicRecord = {
      id,
      timestamp: now,
      content,
      keywords: keywords.length > 0 ? keywords : this.extractKeywords(content),
      triggerType: this.inferTriggerType(content, keywords),
      priority: options.priority || 50,
      isConstant: options.isConstant || false,
      lastAccessed: now,
      accessCount: 0,
      relevanceWeight: 0.8,
      emotionalWeight: this.calculateEmotionalWeight(content, options.emotionalContext),
      timeDecayFactor: 0.1,
      relatedTopics: options.relatedTopics || [],
      emotionalContext: options.emotionalContext || [],
      metadata: {
        source: 'manual',
        version: 'enhanced',
        originalLength: content.length,
        truncated: content.length < 50, // 标记可能被截断的内容
        // 存储增强字段
        perspective: enhancedOptions?.perspective,
        contextType: enhancedOptions?.contextType,
        uaInfo: enhancedOptions?.uaInfo,
        gameState: enhancedOptions?.gameState,
        memoryTone: enhancedOptions?.memoryTone
      }
    }

    await this.baseService.appendEpisodic(roleUuid, enhancedRecord as any)

    // 记录统计信息
    console.log(`[EnhancedRoleMemoryService] 添加情景记忆: ${content.substring(0, 50)}... (长度: ${content.length})`)

    return id
  }

  /**
   * 添加语义记忆（带去重和内容验证）
   */
  async addSemanticMemory(
    roleUuid: string,
    content: string,
    keywords: string[] = [],
    options: {
      priority?: number;
      isConstant?: boolean;
      tags?: string[];
      source?: string;
    } = {},
    enhancedOptions?: {
      perspective?: string;
      contextType?: string;
      uaInfo?: string[];
      gameState?: string;
      memoryTone?: string;
    }
  ): Promise<string> {
    // 验证内容长度
    if (!content || content.trim().length < 1) {
      throw new Error("记忆内容太短，至少需要1个字符")
    }

    if (content.length > 4000) {
      console.warn(`[EnhancedRoleMemoryService] 记忆内容过长 (${content.length} 字符)，可能被截断`)
    }

    const memory = await this.baseService.loadMemory(roleUuid)
    const now = Date.now()

    // 检查是否已存在相似的记忆（去重逻辑）
    const existingSimilar = memory.semantic.find((record: any) => {
      const existingContent = record.content.toLowerCase().trim()
      const newContent = content.toLowerCase().trim()

      // 检查完全相同
      if (existingContent === newContent) return true

      // 检查高度相似（90%以上相似度）
      const similarity = this.calculateSimilarity(existingContent, newContent)
      return similarity > 0.9
    })

    if (existingSimilar) {
      // 更新现有记忆而不是添加重复的
      const existingIndex = memory.semantic.findIndex((record: any) => record.id === existingSimilar.id)
      if (existingIndex >= 0) {
        const currentRecord = memory.semantic[existingIndex] as any
        memory.semantic[existingIndex] = {
          ...currentRecord,
          content: content.length > currentRecord.content.length ? content : currentRecord.content, // 保留更长的内容
          updatedAt: now,
          keywords: keywords.length > 0 ? keywords : currentRecord.keywords || this.extractKeywords(content),
          lastAccessed: now,
          accessCount: (currentRecord.accessCount || 0) + 1,
        } as any
        await this.baseService.upsertSemantic(roleUuid, memory.semantic[existingIndex] as any)
        return existingSimilar.id!
      }
    }

    const id = uuidv4()

    const semanticMemory = {
      id,
      content,
      updatedAt: now,
      tags: options.tags,
      source: options.source,
      keywords: keywords.length > 0 ? keywords : this.extractKeywords(content),
      triggerType: this.inferTriggerType(content, keywords) as any,
      priority: options.priority || 60,
      isConstant: options.isConstant || false,
      lastAccessed: now,
      accessCount: 0,
      relevanceWeight: 0.9,
      emotionalWeight: 0.3,
      timeDecayFactor: 0.05,
      relatedTopics: options.tags || [],
      emotionalContext: [],
      metadata: {
        source: options.source || 'manual',
        version: 'enhanced',
        originalLength: content.length,
        truncated: content.length < 50, // 标记可能被截断的内容
        // 存储增强字段
        perspective: enhancedOptions?.perspective,
        contextType: enhancedOptions?.contextType,
        uaInfo: enhancedOptions?.uaInfo,
        gameState: enhancedOptions?.gameState,
        memoryTone: enhancedOptions?.memoryTone
      }
    }

    await this.baseService.upsertSemantic(roleUuid, semanticMemory as any)

    // 记录统计信息
    console.log(`[EnhancedRoleMemoryService] 添加语义记忆: ${content.substring(0, 50)}... (长度: ${content.length})`)

    return id
  }

  /**
   * 更新特质记忆
   */
  async updateTraitsWithTrigger(
    roleUuid: string,
    traits: EnhancedMemoryTrait[]
  ): Promise<void> {
    const enhancedTraits = traits.map(trait => ({
      ...trait,
      id: trait.id || uuidv4(),
      keywords: trait.keywords || this.extractKeywords(trait.value),
      triggerType: trait.triggerType || TriggerType.KEYWORD,
      priority: trait.priority || 70,
      isConstant: trait.isConstant !== undefined ? trait.isConstant : true, // 特质通常为常驻
      lastAccessed: Date.now(),
      accessCount: 0,
      relevanceWeight: trait.relevanceWeight || 1.0,
      emotionalWeight: trait.emotionalWeight || 0.5,
      timeDecayFactor: trait.timeDecayFactor || 0.01, // 特质衰减很慢
      relatedTopics: trait.relatedTopics || [],
      emotionalContext: trait.emotionalContext || [],
      metadata: {
        ...trait.metadata,
        version: 'enhanced'
      }
    }))

    await this.baseService.updateTraits(roleUuid, enhancedTraits as any)
  }

  /**
   * 更新目标记忆
   */
  async updateGoalsWithTrigger(
    roleUuid: string,
    goals: EnhancedMemoryGoal[]
  ): Promise<void> {
    const enhancedGoals = goals.map(goal => ({
      ...goal,
      id: goal.id || uuidv4(),
      keywords: goal.keywords || this.extractKeywords(goal.value),
      triggerType: goal.triggerType || TriggerType.EMOTIONAL,
      priority: goal.priority || 60,
      isConstant: goal.isConstant || false,
      lastAccessed: Date.now(),
      accessCount: 0,
      relevanceWeight: 0.8,
      emotionalWeight: 0.7,
      timeDecayFactor: 0.02,
      relatedTopics: [],
      emotionalContext: [],
      metadata: {
        ...goal.metadata,
        version: 'enhanced'
      }
    }))

    await this.baseService.updateGoals(roleUuid, enhancedGoals as any)
  }

  /**
   * 查询记忆条目（支持触发相关查询）
   */
  async queryMemories(query: MemoryQuery): Promise<MemoryTriggerEntry[]> {
    const memory = await this.baseService.loadMemory(query.roleUuid)
    const results: MemoryTriggerEntry[] = []

    // 查询情景记忆
    if (!query.types || query.types.includes(MemoryType.EPISODIC)) {
      for (const record of memory.episodic) {
        const enhanced = record as any
        if (this.matchesQuery(enhanced, query, MemoryType.EPISODIC)) {
          results.push(this.convertToTriggerEntry(enhanced, MemoryType.EPISODIC, query.roleUuid))
        }
      }
    }

    // 查询语义记忆
    if (!query.types || query.types.includes(MemoryType.SEMANTIC)) {
      for (const record of memory.semantic) {
        const enhanced = record as any
        if (this.matchesQuery(enhanced, query, MemoryType.SEMANTIC)) {
          results.push(this.convertToTriggerEntry(enhanced, MemoryType.SEMANTIC, query.roleUuid))
        }
      }
    }

    // 查询特质记忆
    if (!query.types || query.types.includes(MemoryType.TRAIT)) {
      for (const record of memory.traits) {
        const enhanced = record as any
        if (this.matchesQuery(enhanced, query, MemoryType.TRAIT)) {
          results.push(this.convertToTriggerEntry(enhanced, MemoryType.TRAIT, query.roleUuid))
        }
      }
    }

    // 查询目标记忆
    if (!query.types || query.types.includes(MemoryType.GOAL)) {
      for (const record of memory.goals) {
        const enhanced = record as any
        if (this.matchesQuery(enhanced, query, MemoryType.GOAL)) {
          results.push(this.convertToTriggerEntry(enhanced, MemoryType.GOAL, query.roleUuid))
        }
      }
    }

    // 按相关性排序和限制数量
    return results
      .sort((a, b) => {
        // 先按优先级排序
        const priorityDiff = b.priority - a.priority
        if (priorityDiff !== 0) return priorityDiff

        // 再按相关性权重排序
        return b.relevanceWeight - a.relevanceWeight
      })
      .slice(0, query.limit || 50)
  }

  /**
   * 更新记忆访问统计
   */
  async updateAccessStats(roleUuid: string, memoryId: string): Promise<void> {
    const memory = await this.baseService.loadMemory(roleUuid)
    const now = Date.now()

    // 在各种记忆类型中查找并更新访问统计
    const updateStats = (records: any[]) => {
      const record = records.find(r => r.id === memoryId)
      if (record) {
        record.lastAccessed = now
        record.accessCount = (record.accessCount || 0) + 1
      }
    }

    updateStats(memory.episodic)
    updateStats(memory.semantic)
    updateStats(memory.traits)
    updateStats(memory.goals)

    await this.saveMemory(roleUuid, memory)
  }

  /**
   * 清理过期记忆
   */
  async cleanupExpiredMemories(roleUuid: string, maxAgeMs: number = 30 * 24 * 60 * 60 * 1000): Promise<void> {
    const memory = await this.baseService.loadMemory(roleUuid)
    const now = Date.now()
    const cutoffTime = now - maxAgeMs

    const cleanupRecords = (records: any[]): any[] => {
      return records.filter(record => {
        // 保留常驻记忆
        if (record.isConstant) return true

        // 保留最近访问的记忆
        if (record.lastAccessed && record.lastAccessed > cutoffTime) return true

        // 保留高优先级记忆
        if (record.priority && record.priority > 80) return true

        // 其他情况根据时间衰减因子决定
        const age = now - (record.timestamp || 0)
        const decayFactor = record.timeDecayFactor || 0.1
        const adjustedMaxAge = maxAgeMs * (1 + decayFactor * 10) // 衰减因子越小，保留时间越长

        return age < adjustedMaxAge
      })
    }

    memory.episodic = cleanupRecords(memory.episodic)
    memory.semantic = cleanupRecords(memory.semantic)
    memory.traits = cleanupRecords(memory.traits) // 特质通常不清理
    memory.goals = cleanupRecords(memory.goals)

    await this.saveMemory(roleUuid, memory)
  }

  /**
   * 获取记忆统计信息
   */
  async getMemoryStats(roleUuid: string): Promise<{
    total: number;
    byType: Record<MemoryType, number>;
    recentAccess: number;
    averageAccessCount: number;
  }> {
    const memory = await this.baseService.loadMemory(roleUuid)
    const now = Date.now()
    const oneDayAgo = now - 24 * 60 * 60 * 1000

    const stats = {
      total: 0,
      byType: {
        [MemoryType.EPISODIC]: memory.episodic.length,
        [MemoryType.SEMANTIC]: memory.semantic.length,
        [MemoryType.TRAIT]: memory.traits.length,
        [MemoryType.GOAL]: memory.goals.length
      },
      recentAccess: 0,
      averageAccessCount: 0
    }

    stats.total = Object.values(stats.byType).reduce((sum, count) => sum + count, 0)

    // 计算最近访问的记忆数量
    const allRecords = [
      ...memory.episodic,
      ...memory.semantic.map(record => record as SemanticMemory & { lastAccessed?: number; accessCount?: number }),
      ...memory.traits,
      ...memory.goals
    ]

    stats.recentAccess = allRecords.filter(record =>
      (record as any).lastAccessed && (record as any).lastAccessed > oneDayAgo
    ).length

    // 计算平均访问次数
    const totalAccess = allRecords.reduce((sum, record) =>
      sum + ((record as any).accessCount || 0), 0
    )
    stats.averageAccessCount = stats.total > 0 ? totalAccess / stats.total : 0

    return stats
  }

  /* ------------------ 私有方法 ------------------ */

  /**
   * 计算两个字符串的相似度（使用简单的编辑距离算法）
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const len1 = str1.length
    const len2 = str2.length

    if (len1 === 0) return len2 === 0 ? 1 : 0
    if (len2 === 0) return 0

    const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(null))

    for (let i = 0; i <= len1; i++) matrix[i][0] = i
    for (let j = 0; j <= len2; j++) matrix[0][j] = j

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        )
      }
    }

    const maxLen = Math.max(len1, len2)
    return (maxLen - matrix[len1][len2]) / maxLen
  }

  private extractKeywords(content: string): string[] {
    // 简单的关键词提取逻辑
    const words = content
      .toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1)

    // 移除常见停用词
    const stopWords = ['的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being']

    return words.filter(word => !stopWords.includes(word)).slice(0, 10)
  }

  private inferTriggerType(content: string, keywords: string[]): TriggerType {
    // 简单的触发类型推断逻辑
    const emotionalWords = ['开心', '高兴', '难过', '生气', '害怕', '紧张', '兴奋', 'happy', 'sad', 'angry', 'scared', 'excited']
    const temporalWords = ['昨天', '今天', '明天', '以前', '后来', 'yesterday', 'today', 'tomorrow', 'before', 'after']

    const hasEmotional = emotionalWords.some(word => content.includes(word))
    const hasTemporal = temporalWords.some(word => content.includes(word))

    if (hasEmotional) return TriggerType.EMOTIONAL
    if (hasTemporal) return TriggerType.TEMPORAL
    if (keywords.length > 0) return TriggerType.KEYWORD

    return TriggerType.SEMANTIC
  }

  private calculateEmotionalWeight(content: string, emotionalContext?: string[]): number {
    // 简单的情感权重计算
    const positiveWords = ['开心', '高兴', '喜欢', '爱', '好', '棒', 'happy', 'love', 'good', 'great', 'wonderful']
    const negativeWords = ['难过', '生气', '害怕', '讨厌', '坏', '糟', 'sad', 'angry', 'scared', 'hate', 'bad', 'terrible']

    let score = 0.5 // 中性

    positiveWords.forEach(word => {
      if (content.includes(word)) score += 0.1
    })

    negativeWords.forEach(word => {
      if (content.includes(word)) score -= 0.1
    })

    if (emotionalContext && emotionalContext.length > 0) {
      score += 0.2 // 有明确情感上下文的加分
    }

    return Math.max(0, Math.min(1, score))
  }

  private matchesQuery(record: any, query: MemoryQuery, type: MemoryType): boolean {
    // 检查关键词匹配
    if (query.keywords && query.keywords.length > 0) {
      const hasKeyword = query.keywords.some(keyword =>
        record.content?.toLowerCase().includes(keyword.toLowerCase()) ||
        record.keywords?.some((rk: string) => rk.toLowerCase().includes(keyword.toLowerCase()))
      )
      if (!hasKeyword) return false
    }

    // 检查时间范围
    if (query.timeRange) {
      const recordTime = record.timestamp || record.updatedAt || 0
      if (recordTime < query.timeRange.start || recordTime > query.timeRange.end) {
        return false
      }
    }

    // 检查相关性阈值
    if (query.minRelevance && record.relevanceWeight < query.minRelevance) {
      return false
    }

    return true
  }

  private convertToTriggerEntry(record: any, type: MemoryType, roleUuid: string): MemoryTriggerEntry {
    return {
      id: record.id || uuidv4(),
      type,
      content: record.content || record.value || '',
      keywords: record.keywords || [],
      triggerType: record.triggerType || TriggerType.KEYWORD,
      priority: record.priority || 50,
      isConstant: record.isConstant || false,
      roleUuid,
      timestamp: record.timestamp || record.updatedAt || Date.now(),
      lastAccessed: record.lastAccessed || record.timestamp || Date.now(),
      accessCount: record.accessCount || 0,
      relevanceWeight: record.relevanceWeight || 0.5,
      emotionalWeight: record.emotionalWeight || 0.5,
      timeDecayFactor: record.timeDecayFactor || 0.1,
      relatedTopics: record.relatedTopics || record.tags || [],
      emotionalContext: record.emotionalContext || [],
      metadata: record.metadata
    }
  }

  private async saveMemory(roleUuid: string, memory: any): Promise<void> {
    const filePath = this.getMemoryPath(roleUuid)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await safeWriteJson(filePath, memory)
  }

  private getMemoryPath(roleUuid: string): string {
    return path.join(this.memoryDir, `${roleUuid}`, "memory.json")
  }

  /* ------------------ 记忆管理方法 ------------------ */

  /**
   * 获取所有记忆（用于管理界面）
   */
  async getAllMemories(roleUuid: string): Promise<any[]> {
    const memory = await this.baseService.loadMemory(roleUuid)
    const allMemories: any[] = []

    // 转换情景记忆
    memory.episodic.forEach(record => {
      allMemories.push({
        id: record.id || uuidv4(),
        type: "episodic",
        content: record.content,
        keywords: record.keywords || [],
        triggerType: record.triggerType || TriggerType.KEYWORD,
        priority: record.priority || 50,
        isConstant: record.isConstant || false,
        importanceScore: record.relevanceWeight || 0.5,
        emotionType: this.inferEmotionType(record.content),
        emotionScore: record.emotionalWeight || 0.5,
        context: {
          timestamp: record.timestamp || Date.now(),
          conversationId: record.metadata?.conversationId,
          messageId: record.metadata?.messageId,
        },
        accessCount: record.accessCount || 0,
        lastAccessed: record.lastAccessed || record.timestamp,
        createdAt: new Date(record.timestamp || Date.now()).toISOString(),
        updatedAt: new Date(record.timestamp || Date.now()).toISOString(),
      })
    })

    // 转换语义记忆
    memory.semantic.forEach((record: SemanticMemory & { lastAccessed?: number; accessCount?: number; relevanceWeight?: number; keywords?: string[]; triggerType?: string; priority?: number; isConstant?: boolean }) => {
      allMemories.push({
        id: record.id || uuidv4(),
        type: "semantic",
        content: record.content,
        keywords: record.keywords || [],
        triggerType: record.triggerType || TriggerType.SEMANTIC,
        priority: record.priority || 60,
        isConstant: record.isConstant || false,
        importanceScore: record.relevanceWeight || 0.7,
        emotionType: "neutral",
        emotionScore: 0.5,
        context: {
          timestamp: record.updatedAt || Date.now(),
        },
        accessCount: record.accessCount || 0,
        lastAccessed: record.lastAccessed || record.updatedAt,
        createdAt: new Date(record.updatedAt || Date.now()).toISOString(),
        updatedAt: new Date(record.updatedAt || Date.now()).toISOString(),
      })
    })

    // 转换特质记忆
    memory.traits.forEach(record => {
      allMemories.push({
        id: record.id || uuidv4(),
        type: "trait",
        content: record.value,
        keywords: record.keywords || [],
        triggerType: record.triggerType || TriggerType.KEYWORD,
        priority: record.priority || 70,
        isConstant: record.isConstant !== false, // 特质默认为常驻
        importanceScore: record.relevanceWeight || 1.0,
        emotionType: this.inferEmotionType(record.value),
        emotionScore: record.emotionalWeight || 0.5,
        context: {
          timestamp: Date.now(),
        },
        accessCount: record.accessCount || 0,
        lastAccessed: record.lastAccessed || Date.now(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    })

    // 转换目标记忆
    memory.goals.forEach(record => {
      allMemories.push({
        id: record.id || uuidv4(),
        type: "goal",
        content: record.value,
        keywords: record.keywords || [],
        triggerType: record.triggerType || TriggerType.EMOTIONAL,
        priority: record.priority || 60,
        isConstant: record.isConstant || false,
        importanceScore: record.relevanceWeight || 0.8,
        emotionType: "neutral",
        emotionScore: record.emotionalWeight || 0.7,
        context: {
          timestamp: Date.now(),
        },
        accessCount: record.accessCount || 0,
        lastAccessed: record.lastAccessed || Date.now(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    })

    return allMemories
  }

  /**
   * 根据ID获取记忆
   */
  async getMemoryById(roleUuid: string, memoryId: string): Promise<any | null> {
    const allMemories = await this.getAllMemories(roleUuid)
    return allMemories.find(memory => memory.id === memoryId) || null
  }

  /**
   * 更新记忆
   */
  async updateMemory(roleUuid: string, memoryId: string, updatedMemory: any): Promise<void> {
    const memory = await this.baseService.loadMemory(roleUuid)
    const now = Date.now()

    // 根据记忆类型更新对应的记忆
    switch (updatedMemory.type) {
      case "episodic": {
        const episodicIndex = memory.episodic.findIndex(record =>
          record.id === memoryId || (record.content === updatedMemory.content && record.timestamp === new Date(updatedMemory.createdAt).getTime())
        )
        if (episodicIndex >= 0) {
          memory.episodic[episodicIndex] = {
            ...memory.episodic[episodicIndex],
            content: updatedMemory.content,
            keywords: updatedMemory.keywords,
            priority: updatedMemory.priority,
            isConstant: updatedMemory.isConstant,
            triggerType: updatedMemory.triggerType,
            relevanceWeight: updatedMemory.importanceScore,
            emotionalWeight: updatedMemory.emotionScore,
            metadata: {
              ...memory.episodic[episodicIndex].metadata,
              updatedAt: now,
              updatedBy: 'manual'
            }
          }
        }
        break
      }

      case "semantic": {
        const semanticIndex = memory.semantic.findIndex((record: SemanticMemory & { id?: string }) =>
          record.id === memoryId || record.content === updatedMemory.content
        )
        if (semanticIndex >= 0) {
          const currentRecord = memory.semantic[semanticIndex] as any
          memory.semantic[semanticIndex] = {
            ...currentRecord,
            content: updatedMemory.content,
            keywords: updatedMemory.keywords,
            priority: updatedMemory.priority,
            isConstant: updatedMemory.isConstant,
            triggerType: updatedMemory.triggerType,
            relevanceWeight: updatedMemory.importanceScore,
            updatedAt: now
          } as any
        }
        break
      }

      case "trait": {
        const traitIndex = memory.traits.findIndex(record =>
          record.id === memoryId || record.value === updatedMemory.content
        )
        if (traitIndex >= 0) {
          memory.traits[traitIndex] = {
            ...memory.traits[traitIndex],
            value: updatedMemory.content,
            keywords: updatedMemory.keywords,
            priority: updatedMemory.priority,
            isConstant: updatedMemory.isConstant,
            triggerType: updatedMemory.triggerType,
            relevanceWeight: updatedMemory.importanceScore,
            emotionalWeight: updatedMemory.emotionScore
          }
        }
        break
      }

      case "goal": {
        const goalIndex = memory.goals.findIndex(record =>
          record.id === memoryId || record.value === updatedMemory.content
        )
        if (goalIndex >= 0) {
          memory.goals[goalIndex] = {
            ...memory.goals[goalIndex],
            value: updatedMemory.content,
            keywords: updatedMemory.keywords,
            priority: updatedMemory.priority,
            isConstant: updatedMemory.isConstant,
            triggerType: updatedMemory.triggerType,
            relevanceWeight: updatedMemory.importanceScore,
            emotionalWeight: updatedMemory.emotionScore
          }
        }
        break
      }
    }

    await this.saveMemory(roleUuid, memory)
  }

  /**
   * 删除记忆
   */
  async deleteMemory(roleUuid: string, memoryId: string): Promise<void> {
    const memory = await this.baseService.loadMemory(roleUuid)

    // 从各种记忆类型中删除
    memory.episodic = memory.episodic.filter(record => record.id !== memoryId)
    memory.semantic = memory.semantic.filter(record => record.id !== memoryId)
    memory.traits = memory.traits.filter(record => record.id !== memoryId)
    memory.goals = memory.goals.filter(record => record.id !== memoryId)

    await this.saveMemory(roleUuid, memory)
  }

  /**
   * 添加记忆（用于导入功能）
   */
  async addMemory(roleUuid: string, memoryData: any): Promise<void> {
    const memory = await this.baseService.loadMemory(roleUuid)
    const now = Date.now()

    switch (memoryData.type) {
      case "episodic": {
        const episodicRecord: EnhancedMemoryEpisodicRecord = {
          id: memoryData.id,
          timestamp: new Date(memoryData.createdAt).getTime(),
          content: memoryData.content,
          keywords: memoryData.keywords,
          triggerType: memoryData.triggerType,
          priority: memoryData.priority,
          isConstant: memoryData.isConstant,
          lastAccessed: memoryData.lastAccessed ? new Date(memoryData.lastAccessed).getTime() : now,
          accessCount: memoryData.accessCount,
          relevanceWeight: memoryData.importanceScore,
          emotionalWeight: memoryData.emotionScore,
          timeDecayFactor: 0.1,
          relatedTopics: [],
          emotionalContext: [],
          metadata: {
            source: 'import',
            version: 'enhanced'
          }
        }
        memory.episodic.push(episodicRecord)
        break
      }

      case "semantic": {
        const semanticRecord = {
          id: memoryData.id,
          content: memoryData.content,
          keywords: memoryData.keywords,
          triggerType: memoryData.triggerType,
          priority: memoryData.priority,
          isConstant: memoryData.isConstant,
          relevanceWeight: memoryData.importanceScore,
          emotionalWeight: memoryData.emotionScore,
          updatedAt: new Date(memoryData.createdAt).getTime(),
          lastAccessed: memoryData.lastAccessed ? new Date(memoryData.lastAccessed).getTime() : now,
          accessCount: memoryData.accessCount,
          timeDecayFactor: 0.05,
          relatedTopics: [],
          emotionalContext: [],
          metadata: {
            source: 'import',
            version: 'enhanced'
          }
        }
        memory.semantic.push(semanticRecord)
        break
      }

      case "trait": {
        const traitRecord: EnhancedMemoryTrait = {
          id: memoryData.id,
          name: '导入的特质',
          value: memoryData.content,
          keywords: memoryData.keywords,
          triggerType: memoryData.triggerType,
          priority: memoryData.priority,
          isConstant: memoryData.isConstant,
          relevanceWeight: memoryData.importanceScore,
          emotionalWeight: memoryData.emotionScore,
          timeDecayFactor: 0.01,
          relatedTopics: [],
          emotionalContext: [],
          metadata: {
            source: 'import',
            version: 'enhanced'
          }
        }
        memory.traits.push(traitRecord)
        break
      }

      case "goal": {
        const goalRecord: EnhancedMemoryGoal = {
          id: memoryData.id,
          name: '导入的目标',
          value: memoryData.content,
          keywords: memoryData.keywords,
          triggerType: memoryData.triggerType,
          priority: memoryData.priority,
          isConstant: memoryData.isConstant,
          relevanceWeight: memoryData.importanceScore,
          emotionalWeight: memoryData.emotionScore,
          timeDecayFactor: 0.02,
          relatedTopics: [],
          emotionalContext: [],
          metadata: {
            source: 'import',
            version: 'enhanced'
          }
        }
        memory.goals.push(goalRecord)
        break
      }
    }

    await this.saveMemory(roleUuid, memory)
  }

  /**
   * 推断情感类型
   */
  private inferEmotionType(content: string): "positive" | "negative" | "neutral" {
    const positiveWords = ['开心', '高兴', '喜欢', '爱', '好', '棒', '成功', '满意', 'happy', 'love', 'good', 'great', 'wonderful', 'success', 'satisfied']
    const negativeWords = ['难过', '生气', '害怕', '讨厌', '坏', '糟', '失败', '失望', 'sad', 'angry', 'scared', 'hate', 'bad', 'terrible', 'failure', 'disappointed']

    const lowerContent = content.toLowerCase()

    const positiveCount = positiveWords.filter(word => lowerContent.includes(word)).length
    const negativeCount = negativeWords.filter(word => lowerContent.includes(word)).length

    if (positiveCount > negativeCount) return "positive"
    if (negativeCount > positiveCount) return "negative"
    return "neutral"
  }

  }