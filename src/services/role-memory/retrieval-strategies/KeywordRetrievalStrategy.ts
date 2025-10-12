import type { MemoryTriggerEntry } from "@roo-code/types"
import type { ConversationContext } from "@roo-code/types"
import { EnhancedRoleMemoryService } from "../EnhancedRoleMemoryService.js"

/**
 * 关键词检索策略
 * 基于关键词匹配检索相关记忆
 */
export class KeywordRetrievalStrategy {
  constructor(private memoryService: EnhancedRoleMemoryService) {}

  /**
   * 检索记忆
   */
  async retrieve(context: ConversationContext): Promise<MemoryTriggerEntry[]> {
    // 提取上下文关键词
    const keywords = this.extractKeywords(context)

    if (keywords.length === 0) {
      return []
    }

    // 构建查询
    const query = {
      roleUuid: context.roleUuid,
      keywords,
      limit: 20
    }

    // 查询匹配的记忆
    const memories = await this.memoryService.queryMemories(query)

    // 计算关键词匹配分数并过滤
    const scoredMemories = memories
      .map(memory => ({
        memory,
        score: this.calculateKeywordScore(memory, keywords, context)
      }))
      .filter(item => item.score > 0.1) // 过滤掉低分匹配
      .sort((a, b) => b.score - a.score)
      .map(item => item.memory)

    return scoredMemories
  }

  /**
   * 提取关键词
   */
  private extractKeywords(context: ConversationContext): string[] {
    const keywords = new Set<string>()

    // 从当前消息提取关键词
    const currentKeywords = this.extractKeywordsFromText(context.currentMessage.content)
    currentKeywords.forEach(keyword => keywords.add(keyword))

    // 从对话历史提取关键词
    for (const message of context.conversationHistory.slice(-3)) {
      const historyKeywords = this.extractKeywordsFromText(message.content)
      historyKeywords.forEach(keyword => keywords.add(keyword))
    }

    // 添加已有的上下文关键词
    context.contextKeywords.forEach(keyword => keywords.add(keyword))

    return Array.from(keywords).slice(0, 15)
  }

  /**
   * 从文本提取关键词
   */
  private extractKeywordsFromText(text: string): string[] {
    const words = text
      .toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1)

    // 移除停用词
    const stopWords = [
      '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did'
    ]

    return words.filter(word => !stopWords.includes(word)).slice(0, 10)
  }

  /**
   * 计算关键词匹配分数
   */
  private calculateKeywordScore(
    memory: MemoryTriggerEntry,
    keywords: string[],
    context: ConversationContext
  ): number {
    let totalScore = 0
    let matchCount = 0

    // 当前消息内容
    const currentText = context.currentMessage.content.toLowerCase()

    // 历史消息内容
    const historyText = context.conversationHistory
      .slice(-3)
      .map(msg => msg.content.toLowerCase())
      .join(' ')

    // 检查记忆的关键词匹配
    for (const keyword of memory.keywords) {
      const lowerKeyword = keyword.toLowerCase()

      // 在当前消息中匹配
      if (currentText.includes(lowerKeyword)) {
        totalScore += 1.0
        matchCount++
      }
      // 在历史消息中匹配
      else if (historyText.includes(lowerKeyword)) {
        totalScore += 0.7
        matchCount++
      }
      // 与上下文关键词匹配
      else if (keywords.some(ck => ck.toLowerCase() === lowerKeyword)) {
        totalScore += 0.5
        matchCount++
      }
    }

    // 检查内容本身的关键词匹配
    const contentWords = this.extractKeywordsFromText(memory.content)
    for (const contentWord of contentWords) {
      const lowerWord = contentWord.toLowerCase()

      if (currentText.includes(lowerWord)) {
        totalScore += 0.3
      } else if (historyText.includes(lowerWord)) {
        totalScore += 0.2
      }
    }

    // 标准化分数
    if (memory.keywords.length > 0) {
      totalScore = totalScore / memory.keywords.length
    }

    // 应用记忆的权重
    totalScore *= memory.relevanceWeight

    return Math.min(totalScore, 1.0)
  }
}