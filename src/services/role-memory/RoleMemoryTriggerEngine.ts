import type {
  MemoryTriggerEntry,
  MemoryTriggerConfig,
  MemoryTriggerResult,
  TriggerMatch,
  ConversationContext
} from "@roo-code/types"
import {
  TriggerType,
  MemoryType
} from "@roo-code/types"
import type { ChatMessage } from "@roo-code/types"
import { EnhancedRoleMemoryService } from "./EnhancedRoleMemoryService.js"

/**
 * 角色记忆触发引擎
 * 基于世界书触发机制，实现智能的记忆触发和注入
 */
export class RoleMemoryTriggerEngine {
  private config: MemoryTriggerConfig
  private memoryService: EnhancedRoleMemoryService

  constructor(
    config: MemoryTriggerConfig,
    memoryService: EnhancedRoleMemoryService
  ) {
    this.config = config
    this.memoryService = memoryService
  }

  /**
   * 处理消息并触发相应记忆
   */
  async processMessage(context: ConversationContext): Promise<MemoryTriggerResult> {
    const startTime = Date.now()

    if (!this.config.enabled) {
      return this.createEmptyResult(Date.now() - startTime)
    }

    try {
      // 1. 查找匹配的记忆条目
      const matches = await this.findMatchingMemories(context)

      // 2. 过滤和排序匹配结果
      const validMatches = await this.filterAndSortMatches(matches, context)

      // 3. 构建触发结果
      const result = await this.buildTriggerResult(validMatches, context)

      // 4. 更新访问统计
      await this.updateAccessStats(result.triggeredMemories)

      const duration = Date.now() - startTime
      result.duration = duration

      if (this.config.debugMode) {
        console.log(`[RoleMemoryTrigger] 处理完成，耗时: ${duration}ms`)
        console.log(`[RoleMemoryTrigger] 触发记忆: ${result.injectedCount} 条`)
      }

      return result

    } catch (error) {
      console.error('[RoleMemoryTrigger] 处理消息失败:', error)
      return this.createEmptyResult(Date.now() - startTime)
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<MemoryTriggerConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 获取当前配置
   */
  getConfig(): MemoryTriggerConfig {
    return { ...this.config }
  }

  /* ------------------ 私有方法 ------------------ */

  /**
   * 查找匹配的记忆条目
   */
  private async findMatchingMemories(context: ConversationContext): Promise<TriggerMatch[]> {
    const matches: TriggerMatch[] = []

    // 提取上下文关键词
    const keywords = this.extractContextKeywords(context)

    // 构建查询参数
    const queryParams = {
      roleUuid: context.roleUuid,
      keywords: keywords.length > 0 ? keywords : undefined,
      minRelevance: this.config.retrievalConfig.relevanceThreshold,
      limit: 50
    }

    // 查询所有类型的记忆
    const memories = await this.memoryService.queryMemories(queryParams)

    // 为每个记忆条目进行匹配计算
    for (const memory of memories) {
      const match = await this.matchMemory(memory, context)
      if (match) {
        matches.push(match)
      }
    }

    return matches
  }

  /**
   * 匹配单个记忆条目
   */
  private async matchMemory(
    memory: MemoryTriggerEntry,
    context: ConversationContext
  ): Promise<TriggerMatch | null> {
    let totalScore = 0
    let bestMatchType: TriggerType = TriggerType.KEYWORD
    const details: any = {}

    // 关键词匹配
    if (this.config.triggerStrategies.keywordMatching) {
      const keywordScore = this.calculateKeywordMatch(memory, context)
      if (keywordScore > 0) {
        totalScore = Math.max(totalScore, keywordScore)
        bestMatchType = TriggerType.KEYWORD
        details.keywordMatches = this.findKeywordMatches(memory, context)
      }
    }

    // 语义相似度匹配
    if (this.config.triggerStrategies.semanticSimilarity) {
      const semanticScore = await this.calculateSemanticSimilarity(memory, context)
      if (semanticScore > 0) {
        totalScore = Math.max(totalScore, semanticScore)
        bestMatchType = TriggerType.SEMANTIC
        details.semanticSimilarity = semanticScore
      }
    }

    // 时间邻近性匹配
    if (this.config.triggerStrategies.temporalProximity) {
      const temporalScore = this.calculateTemporalProximity(memory, context)
      if (temporalScore > 0) {
        totalScore = Math.max(totalScore, temporalScore)
        bestMatchType = TriggerType.TEMPORAL
        details.temporalScore = temporalScore
      }
    }

    // 情感相关性匹配
    if (this.config.triggerStrategies.emotionalRelevance) {
      const emotionalScore = this.calculateEmotionalRelevance(memory, context)
      if (emotionalScore > 0) {
        totalScore = Math.max(totalScore, emotionalScore)
        bestMatchType = TriggerType.EMOTIONAL
        details.emotionalScore = emotionalScore
      }
    }

    // 应用记忆本身的权重
    totalScore *= memory.relevanceWeight

    // 检查是否达到阈值
    if (totalScore < this.config.retrievalConfig.relevanceThreshold) {
      return null
    }

    return {
      entry: memory,
      score: totalScore,
      matchType: bestMatchType,
      details
    }
  }

  /**
   * 计算关键词匹配分数
   */
  private calculateKeywordMatch(memory: MemoryTriggerEntry, context: ConversationContext): number {
    const messageText = context.currentMessage.content.toLowerCase()
    const historyText = context.conversationHistory
      .map(msg => msg.content.toLowerCase())
      .join(' ')

    const allText = messageText + ' ' + historyText

    let matchCount = 0
    let totalKeywords = memory.keywords.length

    for (const keyword of memory.keywords) {
      const lowerKeyword = keyword.toLowerCase()
      if (allText.includes(lowerKeyword)) {
        matchCount++
      }
    }

    if (totalKeywords === 0) return 0

    return (matchCount / totalKeywords) * memory.priority / 100
  }

  /**
   * 查找关键词匹配
   */
  private findKeywordMatches(memory: MemoryTriggerEntry, context: ConversationContext): string[] {
    const messageText = context.currentMessage.content.toLowerCase()
    const historyText = context.conversationHistory
      .map(msg => msg.content.toLowerCase())
      .join(' ')

    const allText = messageText + ' ' + historyText
    const matches: string[] = []

    for (const keyword of memory.keywords) {
      const lowerKeyword = keyword.toLowerCase()
      if (allText.includes(lowerKeyword)) {
        matches.push(keyword)
      }
    }

    return matches
  }

  /**
   * 计算语义相似度
   */
  private async calculateSemanticSimilarity(
    memory: MemoryTriggerEntry,
    context: ConversationContext
  ): Promise<number> {
    // 这里应该集成真正的语义搜索API
    // 目前返回基于话题相关性的简单计算
    let similarityScore = 0

    const contextTopics = [
      ...context.contextKeywords,
      ...(context.currentTopic ? [context.currentTopic] : [])
    ].filter(Boolean)

    const memoryTopics = [
      ...memory.relatedTopics,
      ...memory.keywords
    ]

    for (const contextTopic of contextTopics) {
      for (const memoryTopic of memoryTopics) {
        if (this.calculateWordSimilarity(contextTopic.toLowerCase(), memoryTopic.toLowerCase()) > 0.7) {
          similarityScore += 0.3
        }
      }
    }

    return Math.min(similarityScore, 1.0) * memory.relevanceWeight
  }

  /**
   * 计算时间邻近性
   */
  private calculateTemporalProximity(
    memory: MemoryTriggerEntry,
    context: ConversationContext
  ): number {
    const now = Date.now()
    const memoryAge = now - memory.timestamp

    // 新记忆有更高的时间相关性
    if (memoryAge < 24 * 60 * 60 * 1000) { // 24小时内
      return 0.8 * memory.relevanceWeight
    } else if (memoryAge < 7 * 24 * 60 * 60 * 1000) { // 7天内
      return 0.5 * memory.relevanceWeight
    } else if (memoryAge < 30 * 24 * 60 * 60 * 1000) { // 30天内
      return 0.3 * memory.relevanceWeight
    }

    // 考虑时间衰减因子
    const decayFactor = memory.timeDecayFactor
    const timeScore = Math.exp(-memoryAge * decayFactor / (24 * 60 * 60 * 1000))

    return timeScore * memory.relevanceWeight
  }

  /**
   * 计算情感相关性
   */
  private calculateEmotionalRelevance(
    memory: MemoryTriggerEntry,
    context: ConversationContext
  ): number {
    if (!context.emotionalState) return 0

    let relevanceScore = 0

    // 检查情感上下文匹配
    for (const emotion of memory.emotionalContext) {
      if (emotion.toLowerCase() === context.emotionalState?.toLowerCase()) {
        relevanceScore += 0.5
      }
    }

    // 应用情感权重
    relevanceScore *= memory.emotionalWeight

    return Math.min(relevanceScore, 1.0) * memory.relevanceWeight
  }

  /**
   * 过滤和排序匹配结果
   */
  private async filterAndSortMatches(
    matches: TriggerMatch[],
    context: ConversationContext
  ): Promise<TriggerMatch[]> {
    // 按分数排序
    matches.sort((a, b) => b.score - a.score)

    // 按类型分组并限制数量
    const typeCounts = {
      [MemoryType.EPISODIC]: 0,
      [MemoryType.SEMANTIC]: 0,
      [MemoryType.TRAIT]: 0,
      [MemoryType.GOAL]: 0
    }

    const filteredMatches: TriggerMatch[] = []

    for (const match of matches) {
      const type = match.entry.type
      // Map memory types to config property names
      const configPropertyMap = {
        [MemoryType.EPISODIC]: 'episodic',
        [MemoryType.SEMANTIC]: 'semantic',
        [MemoryType.TRAIT]: 'traits',
        [MemoryType.GOAL]: 'goals'
      }
      const configProperty = configPropertyMap[type] as keyof typeof this.config.retrievalConfig.maxMemoriesPerType
      const maxCount = this.config.retrievalConfig.maxMemoriesPerType[configProperty]

      if (typeCounts[type] < maxCount) {
        filteredMatches.push(match)
        typeCounts[type]++
      }
    }

    return filteredMatches
  }

  /**
   * 构建触发结果
   */
  private async buildTriggerResult(
    matches: TriggerMatch[],
    context: ConversationContext
  ): Promise<MemoryTriggerResult> {
    // 分离常驻记忆和触发记忆
    const constantMemories = matches.filter(match => match.entry.isConstant)
    const triggeredMemories = matches.filter(match => !match.entry.isConstant)

    // 生成常驻内容
    const constantContent = this.formatMemories(constantMemories, '常驻记忆')

    // 生成触发内容
    const triggeredContent = this.formatMemories(triggeredMemories, '相关记忆')

    // 生成完整内容
    let fullContent = ''
    if (constantContent && triggeredContent) {
      fullContent = `${constantContent}\n\n${triggeredContent}`
    } else {
      fullContent = constantContent || triggeredContent || ''
    }

    // 应用模板
    if (this.config.injectionConfig.template) {
      fullContent = this.applyTemplate(fullContent, constantContent, triggeredContent)
    }

    // 统计信息
    const stats = this.calculateStats(matches)

    return {
      triggeredMemories: matches.map(m => m.entry),
      constantContent,
      triggeredContent,
      fullContent,
      injectedCount: matches.length,
      duration: 0, // 将在调用方设置
      stats
    }
  }

  /**
   * 格式化记忆内容
   */
  private formatMemories(matches: TriggerMatch[], title: string): string {
    if (matches.length === 0) return ''

    const sections: string[] = []

    if (this.config.injectionConfig.separateByType) {
      // 按类型分组
      const groupedByType = matches.reduce((groups, match) => {
        const type = match.entry.type
        if (!groups[type]) groups[type] = []
        groups[type].push(match)
        return groups
      }, {} as Record<MemoryType, TriggerMatch[]>)

      for (const [type, typeMatches] of Object.entries(groupedByType)) {
        if (typeMatches.length > 0) {
          const typeTitle = this.getTypeLabel(type as MemoryType)
          const content = typeMatches
            .map(match => this.formatSingleMemory(match))
            .join('\n\n---\n\n')
          sections.push(`### ${typeTitle}\n${content}`)
        }
      }
    } else {
      // 不分组，直接显示
      const content = matches
        .map(match => this.formatSingleMemory(match))
        .join('\n\n---\n\n')
      sections.push(`### ${title}\n${content}`)
    }

    return sections.join('\n\n')
  }

  /**
   * 格式化单个记忆
   */
  private formatSingleMemory(match: TriggerMatch): string {
    const memory = match.entry
    let content = ''

    // 添加时间戳
    if (this.config.injectionConfig.showTimestamps) {
      const date = new Date(memory.timestamp)
      content += `*${date.toLocaleDateString()} ${date.toLocaleTimeString()}*\n`
    }

    // 添加内容
    content += memory.content

    // 添加来源信息
    if (this.config.injectionConfig.showSource) {
      const sourceLabel = this.getTypeLabel(memory.type)
      content += `\n\n*来源: ${sourceLabel}*`
    }

    return content
  }

  /**
   * 获取类型标签
   */
  private getTypeLabel(type: MemoryType): string {
    const labels = {
      [MemoryType.EPISODIC]: '情景记忆',
      [MemoryType.SEMANTIC]: '语义记忆',
      [MemoryType.TRAIT]: '特质记忆',
      [MemoryType.GOAL]: '目标记忆'
    }
    return labels[type] || type
  }

  /**
   * 应用模板
   */
  private applyTemplate(
    content: string,
    constantContent: string,
    triggeredContent: string
  ): string {
    let template = this.config.injectionConfig.template

    // 简单的模板替换
    template = template.replace(/\{\{content\}\}/g, content)
    template = template.replace(/\{\{constantContent\}\}/g, constantContent)
    template = template.replace(/\{\{triggeredContent\}\}/g, triggeredContent)

    return template
  }

  /**
   * 计算统计信息
   */
  private calculateStats(matches: TriggerMatch[]) {
    const stats = {
      keywordMatches: 0,
      semanticMatches: 0,
      temporalMatches: 0,
      emotionalMatches: 0
    }

    for (const match of matches) {
      switch (match.matchType) {
        case TriggerType.KEYWORD:
          stats.keywordMatches++
          break
        case TriggerType.SEMANTIC:
          stats.semanticMatches++
          break
        case TriggerType.TEMPORAL:
          stats.temporalMatches++
          break
        case TriggerType.EMOTIONAL:
          stats.emotionalMatches++
          break
      }
    }

    return stats
  }

  /**
   * 提取上下文关键词
   */
  private extractContextKeywords(context: ConversationContext): string[] {
    const keywords = new Set<string>()

    // 从当前消息提取
    const currentKeywords = this.extractKeywords(context.currentMessage.content)
    currentKeywords.forEach(keyword => keywords.add(keyword))

    // 从对话历史提取
    for (const message of context.conversationHistory.slice(-3)) { // 最近3条消息
      const historyKeywords = this.extractKeywords(message.content)
      historyKeywords.forEach(keyword => keywords.add(keyword))
    }

    // 添加已有的上下文关键词
    context.contextKeywords.forEach(keyword => keywords.add(keyword))

    return Array.from(keywords).slice(0, 20) // 限制数量
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    const words = text
      .toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1)

    const stopWords = ['的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']

    return words.filter(word => !stopWords.includes(word)).slice(0, 10)
  }

  /**
   * 计算词汇相似度
   */
  private calculateWordSimilarity(word1: string, word2: string): number {
    if (word1 === word2) return 1.0

    // 简单的字符相似度计算
    const longer = word1.length > word2.length ? word1 : word2
    const shorter = word1.length > word2.length ? word2 : word1

    if (longer.length === 0) return 1.0

    const editDistance = this.levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }

  /**
   * 计算编辑距离
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = []

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  }

  /**
   * 更新访问统计
   */
  private async updateAccessStats(memories: MemoryTriggerEntry[]): Promise<void> {
    for (const memory of memories) {
      await this.memoryService.updateAccessStats(memory.roleUuid, memory.id)
    }
  }

  /**
   * 创建空结果
   */
  private createEmptyResult(duration: number): MemoryTriggerResult {
    return {
      triggeredMemories: [],
      constantContent: '',
      triggeredContent: '',
      fullContent: '',
      injectedCount: 0,
      duration,
      stats: {
        keywordMatches: 0,
        semanticMatches: 0,
        temporalMatches: 0,
        emotionalMatches: 0
      }
    }
  }
}