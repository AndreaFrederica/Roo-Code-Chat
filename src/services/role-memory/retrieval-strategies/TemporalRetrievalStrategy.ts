import type { MemoryTriggerEntry } from "@roo-code/types"
import type { ConversationContext } from "@roo-code/types"
import { EnhancedRoleMemoryService } from "../EnhancedRoleMemoryService.js"

/**
 * 时间检索策略
 * 基于时间邻近性检索相关记忆
 */
export class TemporalRetrievalStrategy {
  constructor(private memoryService: EnhancedRoleMemoryService) {}

  /**
   * 检索记忆
   */
  async retrieve(context: ConversationContext): Promise<MemoryTriggerEntry[]> {
    // 获取角色的所有记忆
    const allMemories = await this.memoryService.queryMemories({
      roleUuid: context.roleUuid,
      limit: 100
    })

    // 计算时间相关性并排序
    const scoredMemories = allMemories
      .map(memory => ({
        memory,
        score: this.calculateTemporalRelevance(memory, context)
      }))
      .filter(item => item.score > 0.1) // 过滤掉低相关性
      .sort((a, b) => b.score - a.score)
      .slice(0, 15) // 限制结果数量
      .map(item => item.memory)

    return scoredMemories
  }

  /**
   * 计算时间相关性
   */
  private calculateTemporalRelevance(
    memory: MemoryTriggerEntry,
    context: ConversationContext
  ): number {
    let temporalScore = 0

    // 1. 记忆年龄相关性
    temporalScore += this.calculateAgeRelevance(memory)

    // 2. 访问频率相关性
    temporalScore += this.calculateAccessFrequencyRelevance(memory)

    // 3. 时间模式相关性
    temporalScore += this.calculateTemporalPatternRelevance(memory, context)

    // 4. 时间衰减相关性
    temporalScore += this.calculateTimeDecayRelevance(memory)

    // 应用记忆的权重
    temporalScore *= memory.relevanceWeight

    return Math.min(temporalScore, 1.0)
  }

  /**
   * 计算记忆年龄相关性
   */
  private calculateAgeRelevance(memory: MemoryTriggerEntry): number {
    const now = Date.now()
    const memoryAge = now - memory.timestamp

    // 新记忆有更高的相关性
    if (memoryAge < 60 * 60 * 1000) { // 1小时内
      return 0.8
    } else if (memoryAge < 24 * 60 * 60 * 1000) { // 24小时内
      return 0.6
    } else if (memoryAge < 3 * 24 * 60 * 60 * 1000) { // 3天内
      return 0.4
    } else if (memoryAge < 7 * 24 * 60 * 60 * 1000) { // 7天内
      return 0.3
    } else if (memoryAge < 30 * 24 * 60 * 60 * 1000) { // 30天内
      return 0.2
    } else {
      return 0.1
    }
  }

  /**
   * 计算访问频率相关性
   */
  private calculateAccessFrequencyRelevance(memory: MemoryTriggerEntry): number {
    // 访问次数越多的记忆越重要
    const accessCount = memory.accessCount || 0

    if (accessCount === 0) {
      return 0.0
    } else if (accessCount <= 2) {
      return 0.1
    } else if (accessCount <= 5) {
      return 0.2
    } else if (accessCount <= 10) {
      return 0.3
    } else {
      return 0.4
    }
  }

  /**
   * 计算时间模式相关性
   */
  private calculateTemporalPatternRelevance(
    memory: MemoryTriggerEntry,
    context: ConversationContext
  ): number {
    let patternScore = 0

    // 检查是否在相似的时间段访问
    const now = new Date()
    const memoryTime = new Date(memory.timestamp)

    // 相同时间段（如都是晚上）
    const currentHour = now.getHours()
    const memoryHour = memoryTime.getHours()

    if (Math.abs(currentHour - memoryHour) <= 2) {
      patternScore += 0.1
    }

    // 相同星期几
    if (now.getDay() === memoryTime.getDay()) {
      patternScore += 0.1
    }

    // 检查是否包含时间相关关键词
    const temporalKeywords = [
      '昨天', '今天', '明天', '前天', '后天',
      '早上', '上午', '中午', '下午', '晚上', '深夜',
      'yesterday', 'today', 'tomorrow', 'morning', 'afternoon', 'evening', 'night'
    ]

    const currentText = context.currentMessage.content.toLowerCase()
    const memoryText = memory.content.toLowerCase()

    const hasTemporalKeyword = temporalKeywords.some(keyword =>
      currentText.includes(keyword) || memoryText.includes(keyword)
    )

    if (hasTemporalKeyword) {
      patternScore += 0.2
    }

    return patternScore
  }

  /**
   * 计算时间衰减相关性
   */
  private calculateTimeDecayRelevance(memory: MemoryTriggerEntry): number {
    const now = Date.now()
    const memoryAge = now - memory.timestamp
    const decayFactor = memory.timeDecayFactor || 0.1

    // 使用指数衰减函数
    const decayScore = Math.exp(-memoryAge * decayFactor / (24 * 60 * 60 * 1000))

    // 常驻记忆衰减较慢
    const adjustedScore = memory.isConstant ? decayScore * 1.5 : decayScore

    return Math.min(adjustedScore, 0.5) // 限制最大分数为0.5
  }

  /**
   * 获取最近记忆
   */
  async getRecentMemories(roleUuid: string, hours: number = 24): Promise<MemoryTriggerEntry[]> {
    const allMemories = await this.memoryService.queryMemories({
      roleUuid,
      limit: 100
    })

    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000)

    return allMemories
      .filter(memory => memory.timestamp >= cutoffTime)
      .sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * 获取经常访问的记忆
   */
  async getFrequentlyAccessedMemories(
    roleUuid: string,
    minAccessCount: number = 5
  ): Promise<MemoryTriggerEntry[]> {
    const allMemories = await this.memoryService.queryMemories({
      roleUuid,
      limit: 100
    })

    return allMemories
      .filter(memory => (memory.accessCount || 0) >= minAccessCount)
      .sort((a, b) => (b.accessCount || 0) - (a.accessCount || 0))
  }

  /**
   * 获取可能过期的记忆
   */
  async getPotentiallyExpiredMemories(
    roleUuid: string,
    days: number = 30
  ): Promise<MemoryTriggerEntry[]> {
    const allMemories = await this.memoryService.queryMemories({
      roleUuid,
      limit: 200
    })

    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000)

    return allMemories.filter(memory => {
      // 排除常驻记忆
      if (memory.isConstant) return false

      // 高优先级记忆不过期
      if (memory.priority >= 80) return false

      // 最近访问过的记忆不过期
      if (memory.lastAccessed >= cutoffTime) return false

      return true
    })
  }
}