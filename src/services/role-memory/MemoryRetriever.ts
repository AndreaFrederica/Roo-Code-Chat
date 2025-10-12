import type {
  MemoryTriggerEntry,
  MemoryQuery,
  MemoryType
} from "@roo-code/types"
import type { ConversationContext } from "@roo-code/types"
import { TriggerType } from "@roo-code/types"
import { EnhancedRoleMemoryService } from "./EnhancedRoleMemoryService.js"
import { KeywordRetrievalStrategy } from "./retrieval-strategies/KeywordRetrievalStrategy.js"
import { SemanticRetrievalStrategy } from "./retrieval-strategies/SemanticRetrievalStrategy.js"
import { TemporalRetrievalStrategy } from "./retrieval-strategies/TemporalRetrievalStrategy.js"
import { EmotionalRetrievalStrategy } from "./retrieval-strategies/EmotionalRetrievalStrategy.js"

/**
 * 记忆检索器
 * 使用多种策略检索相关的记忆条目
 */
export class MemoryRetriever {
  private memoryService: EnhancedRoleMemoryService
  private strategies: Map<TriggerType, any>

  constructor(memoryService: EnhancedRoleMemoryService) {
    this.memoryService = memoryService
    this.strategies = new Map()

    // 初始化检索策略
    this.initializeStrategies()
  }

  /**
   * 检索记忆条目
   */
  async retrieveMemories(
    context: ConversationContext,
    enabledStrategies: TriggerType[] = [TriggerType.KEYWORD, TriggerType.SEMANTIC, TriggerType.TEMPORAL, TriggerType.EMOTIONAL]
  ): Promise<MemoryTriggerEntry[]> {
    const results: MemoryTriggerEntry[] = []

    // 使用每种启用的策略进行检索
    for (const strategyType of enabledStrategies) {
      const strategy = this.strategies.get(strategyType)
      if (strategy) {
        try {
          const strategyResults = await strategy.retrieve(context)
          results.push(...strategyResults)
        } catch (error) {
          console.error(`[MemoryRetriever] ${strategyType} 策略检索失败:`, error)
        }
      }
    }

    // 去重和排序
    const uniqueResults = this.deduplicateResults(results)
    return this.rankResults(uniqueResults, context)
  }

  /**
   * 根据查询参数检索记忆
   */
  async queryMemories(query: MemoryQuery): Promise<MemoryTriggerEntry[]> {
    return await this.memoryService.queryMemories(query)
  }

  /**
   * 获取角色的所有记忆
   */
  async getAllMemories(roleUuid: string): Promise<MemoryTriggerEntry[]> {
    const query = {
      roleUuid,
      limit: 1000
    }
    return await this.memoryService.queryMemories(query)
  }

  /**
   * 按类型获取记忆
   */
  async getMemoriesByType(roleUuid: string, type: MemoryType): Promise<MemoryTriggerEntry[]> {
    const query = {
      roleUuid,
      types: [type],
      limit: 100
    }
    return await this.memoryService.queryMemories(query)
  }

  /**
   * 获取常驻记忆
   */
  async getConstantMemories(roleUuid: string): Promise<MemoryTriggerEntry[]> {
    const allMemories = await this.getAllMemories(roleUuid)
    return allMemories.filter(memory => memory.isConstant)
  }

  /**
   * 搜索记忆内容
   */
  async searchMemories(roleUuid: string, searchText: string): Promise<MemoryTriggerEntry[]> {
    const allMemories = await this.getAllMemories(roleUuid)
    const lowerSearchText = searchText.toLowerCase()

    return allMemories.filter(memory => {
      // 搜索内容
      if (memory.content.toLowerCase().includes(lowerSearchText)) {
        return true
      }

      // 搜索关键词
      if (memory.keywords.some(keyword => keyword.toLowerCase().includes(lowerSearchText))) {
        return true
      }

      // 搜索相关话题
      if (memory.relatedTopics.some(topic => topic.toLowerCase().includes(lowerSearchText))) {
        return true
      }

      return false
    })
  }

  /**
   * 获取最近访问的记忆
   */
  async getRecentMemories(roleUuid: string, limit: number = 10): Promise<MemoryTriggerEntry[]> {
    const allMemories = await this.getAllMemories(roleUuid)

    return allMemories
      .sort((a, b) => b.lastAccessed - a.lastAccessed)
      .slice(0, limit)
  }

  /**
   * 获取高优先级记忆
   */
  async getHighPriorityMemories(roleUuid: string, minPriority: number = 70): Promise<MemoryTriggerEntry[]> {
    const allMemories = await this.getAllMemories(roleUuid)

    return allMemories.filter(memory => memory.priority >= minPriority)
  }

  /**
   * 添加自定义检索策略
   */
  addStrategy(type: TriggerType, strategy: any): void {
    this.strategies.set(type, strategy)
  }

  /**
   * 移除检索策略
   */
  removeStrategy(type: TriggerType): void {
    this.strategies.delete(type)
  }

  /**
   * 获取可用的策略列表
   */
  getAvailableStrategies(): TriggerType[] {
    return Array.from(this.strategies.keys())
  }

  /* ------------------ 私有方法 ------------------ */

  /**
   * 初始化检索策略
   */
  private initializeStrategies(): void {
    this.strategies.set(TriggerType.KEYWORD, new KeywordRetrievalStrategy(this.memoryService))
    this.strategies.set(TriggerType.SEMANTIC, new SemanticRetrievalStrategy(this.memoryService))
    this.strategies.set(TriggerType.TEMPORAL, new TemporalRetrievalStrategy(this.memoryService))
    this.strategies.set(TriggerType.EMOTIONAL, new EmotionalRetrievalStrategy(this.memoryService))
  }

  /**
   * 去重结果
   */
  private deduplicateResults(results: MemoryTriggerEntry[]): MemoryTriggerEntry[] {
    const seen = new Set<string>()
    const uniqueResults: MemoryTriggerEntry[] = []

    for (const memory of results) {
      if (!seen.has(memory.id)) {
        seen.add(memory.id)
        uniqueResults.push(memory)
      }
    }

    return uniqueResults
  }

  /**
   * 排序结果
   */
  private rankResults(results: MemoryTriggerEntry[], context: ConversationContext): MemoryTriggerEntry[] {
    return results.sort((a, b) => {
      // 常驻记忆优先
      if (a.isConstant && !b.isConstant) return -1
      if (!a.isConstant && b.isConstant) return 1

      // 按优先级排序
      const priorityDiff = b.priority - a.priority
      if (priorityDiff !== 0) return priorityDiff

      // 按相关性权重排序
      const relevanceDiff = b.relevanceWeight - a.relevanceWeight
      if (relevanceDiff !== 0) return relevanceDiff

      // 按最近访问时间排序
      return b.lastAccessed - a.lastAccessed
    })
  }
}