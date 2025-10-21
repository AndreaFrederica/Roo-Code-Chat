import type {
  MemoryTriggerConfig,
  MemoryTriggerResult,
  ConversationContext,
  MemoryTriggerEntry
} from "@roo-code/types"
import type { ChatMessage } from "@roo-code/types"
import { MemoryType, TriggerType } from "@roo-code/types"
import { DEFAULT_MEMORY_TRIGGER_CONFIG } from "@roo-code/types"
import { EnhancedRoleMemoryService } from "./EnhancedRoleMemoryService.js"
import { RoleMemoryTriggerEngine } from "./RoleMemoryTriggerEngine.js"
import { MemoryRetriever } from "./MemoryRetriever.js"

interface MemoryAggregation {
  triggeredMemories: Map<string, MemoryTriggerEntry>
  stats: {
    keywordMatches: number
    semanticMatches: number
    temporalMatches: number
    emotionalMatches: number
  }
  injectedCount: number
  duration: number
}

/**
 * 角色记忆触发服务
 * 整合记忆存储、检索和触发功能的主服务
 */
export class RoleMemoryTriggerService {
  private memoryService: EnhancedRoleMemoryService
  private triggerEngine: RoleMemoryTriggerEngine
  private memoryRetriever: MemoryRetriever
  private config: MemoryTriggerConfig

  constructor(
    memoryService: EnhancedRoleMemoryService,
    config: Partial<MemoryTriggerConfig> = {}
  ) {
    this.memoryService = memoryService
    this.config = { ...DEFAULT_MEMORY_TRIGGER_CONFIG, ...config }

    // 初始化触发引擎和检索器
    this.triggerEngine = new RoleMemoryTriggerEngine(this.config, memoryService)
    this.memoryRetriever = new MemoryRetriever(memoryService)
  }

  /**
   * 处理消息并返回触发的记忆
   */
  async processMessageWithMemory(
    roleUuid: string,
    currentMessage: ChatMessage,
    conversationHistory: ChatMessage[] = [],
    options: {
      emotionalState?: string;
      currentTopic?: string;
      contextKeywords?: string[];
    } = {}
  ): Promise<MemoryTriggerResult | null> {
    try {
      // 构建对话上下文
      const context: ConversationContext = {
        roleUuid,
        currentMessage,
        conversationHistory,
        contextKeywords: options.contextKeywords || [],
        emotionalState: options.emotionalState,
        currentTopic: options.currentTopic
      }

      const maxDepth = this.config.maxRecursiveDepth ?? 0
      const aggregation: MemoryAggregation = {
        triggeredMemories: new Map(),
        stats: {
          keywordMatches: 0,
          semanticMatches: 0,
          temporalMatches: 0,
          emotionalMatches: 0
        },
        injectedCount: 0,
        duration: 0
      }

      await this.processMessageRecursive(
        context,
        0,
        maxDepth,
        new Set<string>(),
        aggregation
      )

      if (aggregation.triggeredMemories.size === 0) {
        return null
      }

      const allMemories = Array.from(aggregation.triggeredMemories.values())
      const constantMemories = allMemories.filter(memory => memory.isConstant)
      const triggeredMemories = allMemories.filter(memory => !memory.isConstant)

      const constantContent = this.renderMemories(constantMemories, '常驻记忆')
      const triggeredContent = this.renderMemories(triggeredMemories, '相关记忆')

      let combinedContent = ''
      if (constantContent && triggeredContent) {
        combinedContent = `${constantContent}\n\n${triggeredContent}`
      } else {
        combinedContent = constantContent || triggeredContent || ''
      }

      const fullContent = this.applyTemplate(combinedContent, constantContent, triggeredContent)

      return {
        triggeredMemories: allMemories,
        constantContent,
        triggeredContent,
        fullContent,
        injectedCount: aggregation.injectedCount,
        duration: aggregation.duration,
        stats: aggregation.stats
      }

    } catch (error) {
      console.error('[RoleMemoryTriggerService] 处理消息失败:', error)
      return null
    }
  }

  private async processMessageRecursive(
    context: ConversationContext,
    depth: number,
    maxDepth: number,
    processedIds: Set<string>,
    aggregation: MemoryAggregation
  ): Promise<void> {
    const result = await this.triggerEngine.processMessage(context)

    aggregation.duration += result.duration
    aggregation.stats.keywordMatches += result.stats.keywordMatches
    aggregation.stats.semanticMatches += result.stats.semanticMatches
    aggregation.stats.temporalMatches += result.stats.temporalMatches
    aggregation.stats.emotionalMatches += result.stats.emotionalMatches

    const newTriggeredContents: string[] = []

    for (const memory of result.triggeredMemories) {
      if (processedIds.has(memory.id)) {
        continue
      }

      processedIds.add(memory.id)
      aggregation.triggeredMemories.set(memory.id, memory)
      aggregation.injectedCount += 1
      newTriggeredContents.push(memory.content)
    }

    if (depth < maxDepth && newTriggeredContents.length > 0) {
      const combinedContent = newTriggeredContents.join('\n\n')
      if (combinedContent.trim().length > 0) {
        const recursiveMessage: ChatMessage = {
          role: context.currentMessage.role ?? 'assistant',
          content: combinedContent,
          timestamp: Date.now()
        }

        const nextContext: ConversationContext = {
          roleUuid: context.roleUuid,
          currentMessage: recursiveMessage,
          conversationHistory: [...context.conversationHistory, context.currentMessage],
          contextKeywords: context.contextKeywords,
          emotionalState: context.emotionalState,
          currentTopic: context.currentTopic
        }

        await this.processMessageRecursive(
          nextContext,
          depth + 1,
          maxDepth,
          processedIds,
          aggregation
        )
      }
    }
  }

  private renderMemories(memories: MemoryTriggerEntry[], title: string): string {
    if (memories.length === 0) {
      return ''
    }

    const sections: string[] = []

    if (this.config.injectionConfig.separateByType) {
      const grouped = memories.reduce<Record<MemoryType, MemoryTriggerEntry[]>>((acc, memory) => {
        if (!acc[memory.type]) {
          acc[memory.type] = []
        }
        acc[memory.type].push(memory)
        return acc
      }, {
        [MemoryType.EPISODIC]: [],
        [MemoryType.SEMANTIC]: [],
        [MemoryType.TRAIT]: [],
        [MemoryType.GOAL]: []
      })

      for (const [typeKey, entries] of Object.entries(grouped)) {
        const typedEntries = entries as MemoryTriggerEntry[]
        if (typedEntries.length === 0) {
          continue
        }
        const typeTitle = this.getTypeLabel(typeKey as MemoryType)
        const content = typedEntries.map((entry) => this.formatMemoryEntry(entry)).join('\n\n---\n\n')
        sections.push(`### ${typeTitle}\n${content}`)
      }
    } else {
      const content = memories.map((entry) => this.formatMemoryEntry(entry)).join('\n\n---\n\n')
      sections.push(`### ${title}\n${content}`)
    }

    return sections.join('\n\n')
  }

  private formatMemoryEntry(memory: MemoryTriggerEntry): string {
    let content = ''

    if (this.config.injectionConfig.showTimestamps) {
      const date = new Date(memory.timestamp)
      content += `*${date.toLocaleDateString()} ${date.toLocaleTimeString()}*\n`
    }

    content += memory.content

    if (this.config.injectionConfig.showSource) {
      const sourceLabel = this.getTypeLabel(memory.type)
      content += `\n\n*来源: ${sourceLabel}*`
    }

    return content
  }

  private getTypeLabel(type: MemoryType): string {
    const labels: Record<MemoryType, string> = {
      [MemoryType.EPISODIC]: "情景记忆",
      [MemoryType.SEMANTIC]: "语义记忆",
      [MemoryType.TRAIT]: "特质记忆",
      [MemoryType.GOAL]: "目标记忆"
    }
    return labels[type] || type
  }

  private applyTemplate(content: string, constantContent: string, triggeredContent: string): string {
    let template = this.config.injectionConfig.template

    template = template.replace(/\{\{content\}\}/g, content)
    template = template.replace(/\{\{constantContent\}\}/g, constantContent)
    template = template.replace(/\{\{triggeredContent\}\}/g, triggeredContent)

    return template
  }

  /**
   * 添加情景记忆
   */
  async addEpisodicMemory(
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
    return await this.memoryService.addEpisodicMemoryWithTrigger(
      roleUuid,
      content,
      keywords,
      options,
      enhancedOptions
    )
  }

  /**
   * 添加语义记忆
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
    return await this.memoryService.addSemanticMemory(
      roleUuid,
      content,
      keywords,
      options,
      enhancedOptions
    )
  }

  /**
   * 更新特质记忆
   */
  async updateTraits(
    roleUuid: string,
    traits: Array<{
      name: string;
      value: string;
      confidence?: number;
      keywords?: string[];
      priority?: number;
      isConstant?: boolean;
    }>
  ): Promise<void> {
    const enhancedTraits = traits.map(trait => ({
      ...trait,
      keywords: trait.keywords || [],
      triggerType: 'keyword' as TriggerType,
      priority: trait.priority || 70,
      isConstant: trait.isConstant !== undefined ? trait.isConstant : true,
      relatedTopics: [],
      emotionalContext: []
    }))

    await this.memoryService.updateTraitsWithTrigger(roleUuid, enhancedTraits)
  }

  /**
   * 更新目标记忆
   */
  async updateGoals(
    roleUuid: string,
    goals: Array<{
      value: string;
      priority?: number;
      keywords?: string[];
      isConstant?: boolean;
    }>
  ): Promise<void> {
    const enhancedGoals = goals.map(goal => ({
      ...goal,
      keywords: goal.keywords || [],
      triggerType: 'emotional' as TriggerType,
      priority: goal.priority || 60,
      isConstant: goal.isConstant || false,
      relatedTopics: [],
      emotionalContext: []
    }))

    await this.memoryService.updateGoalsWithTrigger(roleUuid, enhancedGoals)
  }

  /**
   * 搜索记忆
   */
  async searchMemories(roleUuid: string, searchText: string): Promise<MemoryTriggerEntry[]> {
    return await this.memoryRetriever.searchMemories(roleUuid, searchText)
  }

  /**
   * 获取常驻记忆
   */
  async getConstantMemories(roleUuid: string): Promise<MemoryTriggerEntry[]> {
    return await this.memoryRetriever.getConstantMemories(roleUuid)
  }

  /**
   * 获取最近记忆
   */
  async getRecentMemories(roleUuid: string, limit: number = 10): Promise<MemoryTriggerEntry[]> {
    return await this.memoryRetriever.getRecentMemories(roleUuid, limit)
  }

  /**
   * 获取高优先级记忆
   */
  async getHighPriorityMemories(roleUuid: string, minPriority: number = 70): Promise<MemoryTriggerEntry[]> {
    return await this.memoryRetriever.getHighPriorityMemories(roleUuid, minPriority)
  }

  /**
   * 获取记忆统计
   */
  async getMemoryStats(roleUuid: string): Promise<{
    total: number;
    byType: Record<string, number>;
    recentAccess: number;
    averageAccessCount: number;
  }> {
    return await this.memoryService.getMemoryStats(roleUuid)
  }

  /**
   * 清理过期记忆
   */
  async cleanupExpiredMemories(roleUuid: string, maxAge?: number): Promise<void> {
    await this.memoryService.cleanupExpiredMemories(roleUuid, maxAge)
  }

  /**
   * 清空角色的所有记忆
   */
  async clearRoleMemories(roleUuid: string): Promise<void> {
    const memory = await this.memoryService.getAllMemories(roleUuid)

    // 删除所有记忆条目
    for (const memoryEntry of memory) {
      await this.memoryService.deleteMemory(roleUuid, memoryEntry.id)
    }

    console.log(`[RoleMemoryTriggerService] 已清空角色 ${roleUuid} 的所有记忆`)
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<MemoryTriggerConfig>): void {
    this.config = { ...this.config, ...config }
    this.triggerEngine.updateConfig(this.config)
  }

  /**
   * 获取当前配置
   */
  getConfig(): MemoryTriggerConfig {
    return { ...this.config }
  }

  /**
   * 启用/禁用触发系统
   */
  setEnabled(enabled: boolean): void {
    this.updateConfig({ enabled })
  }

  /**
   * 启用/禁用特定触发策略
   */
  setTriggerStrategy(strategy: TriggerType, enabled: boolean): void {
    const strategies = { ...this.config.triggerStrategies }
    switch (strategy) {
      case TriggerType.KEYWORD:
        strategies.keywordMatching = enabled
        break
      case TriggerType.SEMANTIC:
        strategies.semanticSimilarity = enabled
        break
      case TriggerType.TEMPORAL:
        strategies.temporalProximity = enabled
        break
      case TriggerType.EMOTIONAL:
        strategies.emotionalRelevance = enabled
        break
    }

    this.updateConfig({ triggerStrategies: strategies })
  }

  /**
   * 设置检索配置
   */
  setRetrievalConfig(config: Partial<MemoryTriggerConfig['retrievalConfig']>): void {
    const retrievalConfig = { ...this.config.retrievalConfig, ...config }
    this.updateConfig({ retrievalConfig })
  }

  /**
   * 设置注入配置
   */
  setInjectionConfig(config: Partial<MemoryTriggerConfig['injectionConfig']>): void {
    const injectionConfig = { ...this.config.injectionConfig, ...config }
    this.updateConfig({ injectionConfig })
  }

  /**
   * 批量导入记忆
   */
  async importMemories(
    roleUuid: string,
    memories: Array<{
      type: 'episodic' | 'semantic' | 'trait' | 'goal';
      content: string;
      keywords?: string[];
      priority?: number;
      isConstant?: boolean;
      metadata?: Record<string, unknown>;
    }>
  ): Promise<string[]> {
    const ids: string[] = []

    for (const memoryData of memories) {
      try {
        let id: string

        switch (memoryData.type) {
          case 'episodic':
            id = await this.addEpisodicMemory(
              roleUuid,
              memoryData.content,
              memoryData.keywords || [],
              {
                priority: memoryData.priority,
                isConstant: memoryData.isConstant
              }
            )
            break

          case 'semantic':
            id = await this.addSemanticMemory(
              roleUuid,
              memoryData.content,
              memoryData.keywords || [],
              {
                priority: memoryData.priority,
                isConstant: memoryData.isConstant
              }
            )
            break

          case 'trait':
            // 特质记忆需要特殊处理
            await this.updateTraits(roleUuid, [{
              name: memoryData.content,
              value: memoryData.content,
              priority: memoryData.priority,
              keywords: memoryData.keywords,
              isConstant: memoryData.isConstant
            }])
            id = `trait_${Date.now()}`
            break

          case 'goal':
            // 目标记忆需要特殊处理
            await this.updateGoals(roleUuid, [{
              value: memoryData.content,
              priority: memoryData.priority,
              keywords: memoryData.keywords,
              isConstant: memoryData.isConstant
            }])
            id = `goal_${Date.now()}`
            break

          default:
            continue
        }

        ids.push(id)

      } catch (error) {
        console.error(`[RoleMemoryTriggerService] 导入记忆失败:`, error)
      }
    }

    return ids
  }

  /**
   * 导出记忆数据
   */
  async exportMemories(roleUuid: string): Promise<Array<{
    id: string;
    type: string;
    content: string;
    keywords: string[];
    priority: number;
    isConstant: boolean;
    timestamp: number;
    metadata?: Record<string, unknown>;
  }>> {
    const allMemories = await this.memoryRetriever.getAllMemories(roleUuid)

    return allMemories.map(memory => ({
      id: memory.id,
      type: memory.type,
      content: memory.content,
      keywords: memory.keywords,
      priority: memory.priority,
      isConstant: memory.isConstant,
      timestamp: memory.timestamp,
      metadata: memory.metadata
    }))
  }

  /**
   * 重置服务状态
   */
  async reset(): Promise<void> {
    // 重新创建触发引擎和检索器
    this.triggerEngine = new RoleMemoryTriggerEngine(this.config, this.memoryService)
    this.memoryRetriever = new MemoryRetriever(this.memoryService)
  }

  /**
   * 获取底层增强角色记忆服务实例
   */
  getEnhancedRoleMemoryService(): EnhancedRoleMemoryService {
    return this.memoryService
  }

  /**
   * 获取服务状态
   */
  getStatus(): {
    enabled: boolean;
    config: MemoryTriggerConfig;
    availableStrategies: TriggerType[];
  } {
    return {
      enabled: this.config.enabled,
      config: this.config,
      availableStrategies: this.memoryRetriever.getAvailableStrategies()
    }
  }
}
