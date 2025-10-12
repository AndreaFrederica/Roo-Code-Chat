import type { MemoryTriggerEntry } from "@roo-code/types"
import type { ConversationContext } from "@roo-code/types"
import { EnhancedRoleMemoryService } from "../EnhancedRoleMemoryService.js"

/**
 * 语义检索策略
 * 基于语义相似度检索相关记忆
 */
export class SemanticRetrievalStrategy {
  constructor(private memoryService: EnhancedRoleMemoryService) {}

  /**
   * 检索记忆
   */
  async retrieve(context: ConversationContext): Promise<MemoryTriggerEntry[]> {
    // 获取角色的所有记忆
    const allMemories = await this.memoryService.queryMemories({
      roleUuid: context.roleUuid,
      limit: 50
    })

    // 计算语义相似度并排序
    const scoredMemories = allMemories
      .map(memory => ({
        memory,
        score: this.calculateSemanticSimilarity(memory, context)
      }))
      .filter(item => item.score > 0.2) // 过滤掉低相似度
      .sort((a, b) => b.score - a.score)
      .slice(0, 10) // 限制结果数量
      .map(item => item.memory)

    return scoredMemories
  }

  /**
   * 计算语义相似度
   */
  private calculateSemanticSimilarity(
    memory: MemoryTriggerEntry,
    context: ConversationContext
  ): number {
    let similarityScore = 0

    // 1. 话题相似度
    similarityScore += this.calculateTopicSimilarity(memory, context)

    // 2. 内容相似度
    similarityScore += this.calculateContentSimilarity(memory, context)

    // 3. 上下文相似度
    similarityScore += this.calculateContextSimilarity(memory, context)

    // 4. 情感相似度
    similarityScore += this.calculateEmotionalSimilarity(memory, context)

    // 应用记忆的权重
    similarityScore *= memory.relevanceWeight

    return Math.min(similarityScore, 1.0)
  }

  /**
   * 计算话题相似度
   */
  private calculateTopicSimilarity(
    memory: MemoryTriggerEntry,
    context: ConversationContext
  ): number {
    let topicScore = 0

    // 记忆的相关话题
    const memoryTopics = [
      ...memory.relatedTopics,
      ...memory.keywords
    ].map(t => t.toLowerCase())

    // 上下文话题
    const contextTopics = [
      ...context.contextKeywords,
      context.currentTopic
    ].filter((t): t is string => Boolean(t))
    .map(t => t.toLowerCase())

    // 计算话题重叠度
    const overlap = this.calculateOverlap(memoryTopics, contextTopics)
    topicScore = overlap * 0.4 // 话题相似度权重为0.4

    return topicScore
  }

  /**
   * 计算内容相似度
   */
  private calculateContentSimilarity(
    memory: MemoryTriggerEntry,
    context: ConversationContext
  ): number {
    let contentScore = 0

    // 提取记忆内容的关键词
    const memoryKeywords = this.extractKeywords(memory.content)

    // 当前消息的关键词
    const currentKeywords = this.extractKeywords(context.currentMessage.content)

    // 历史消息的关键词
    const historyKeywords = context.conversationHistory
      .slice(-2)
      .flatMap(msg => this.extractKeywords(msg.content))

    // 计算关键词重叠度
    const currentOverlap = this.calculateOverlap(memoryKeywords, currentKeywords)
    const historyOverlap = this.calculateOverlap(memoryKeywords, historyKeywords)

    contentScore = (currentOverlap * 0.3 + historyOverlap * 0.2) // 内容相似度权重为0.5

    return contentScore
  }

  /**
   * 计算上下文相似度
   */
  private calculateContextSimilarity(
    memory: MemoryTriggerEntry,
    context: ConversationContext
  ): number {
    let contextScore = 0

    // 检查记忆是否与对话主题相关
    if (context.currentTopic) {
      const topicRelevance = this.calculateRelevance(memory.content, context.currentTopic)
      contextScore += topicRelevance * 0.2
    }

    // 检查记忆的时间上下文
    const timeContext = this.calculateTimeContext(memory, context)
    contextScore += timeContext * 0.1

    return contextScore
  }

  /**
   * 计算情感相似度
   */
  private calculateEmotionalSimilarity(
    memory: MemoryTriggerEntry,
    context: ConversationContext
  ): number {
    let emotionalScore = 0

    if (context.emotionalState) {
      // 检查情感上下文匹配
      const emotionMatch = memory.emotionalContext.some(emotion =>
        emotion.toLowerCase() === context.emotionalState?.toLowerCase()
      )

      if (emotionMatch) {
        emotionalScore += 0.3
      }

      // 应用记忆的情感权重
      emotionalScore *= memory.emotionalWeight
    }

    return emotionalScore
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

    const stopWords = [
      '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'
    ]

    return words.filter(word => !stopWords.includes(word)).slice(0, 10)
  }

  /**
   * 计算两个数组的重叠度
   */
  private calculateOverlap(arr1: string[], arr2: string[]): number {
    if (arr1.length === 0 || arr2.length === 0) return 0

    const set1 = new Set(arr1)
    const set2 = new Set(arr2)

    let overlap = 0
    for (const item of set1) {
      if (set2.has(item)) {
        overlap++
      }
    }

    // 使用Jaccard相似度
    const union = set1.size + set2.size - overlap
    return union > 0 ? overlap / union : 0
  }

  /**
   * 计算文本相关性
   */
  private calculateRelevance(text: string, topic: string): number {
    const lowerText = text.toLowerCase()
    const lowerTopic = topic.toLowerCase()

    // 直接匹配
    if (lowerText.includes(lowerTopic)) {
      return 1.0
    }

    // 关键词匹配
    const textKeywords = this.extractKeywords(text)
    const topicKeywords = this.extractKeywords(topic)

    return this.calculateOverlap(textKeywords, topicKeywords)
  }

  /**
   * 计算时间上下文相关性
   */
  private calculateTimeContext(memory: MemoryTriggerEntry, context: ConversationContext): number {
    const now = Date.now()
    const memoryAge = now - memory.timestamp

    // 新记忆有更高的时间相关性
    if (memoryAge < 60 * 60 * 1000) { // 1小时内
      return 0.8
    } else if (memoryAge < 24 * 60 * 60 * 1000) { // 24小时内
      return 0.6
    } else if (memoryAge < 7 * 24 * 60 * 60 * 1000) { // 7天内
      return 0.4
    } else {
      return 0.2
    }
  }
}