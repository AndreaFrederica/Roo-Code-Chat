import type { MemoryTriggerEntry } from "@roo-code/types"
import type { ConversationContext } from "@roo-code/types"
import { EnhancedRoleMemoryService } from "../EnhancedRoleMemoryService.js"

/**
 * 情感检索策略
 * 基于情感相关性检索相关记忆
 */
export class EmotionalRetrievalStrategy {
  private emotionKeywords = {
    happy: ['开心', '高兴', '快乐', '愉快', '欢乐', '喜悦', 'happy', 'joy', 'glad', 'pleased', 'excited'],
    sad: ['难过', '伤心', '悲伤', '沮丧', '失落', '忧伤', 'sad', 'unhappy', 'sorrowful', 'depressed', 'gloomy'],
    angry: ['生气', '愤怒', '恼火', '气愤', '怒火', '气愤', 'angry', 'mad', 'furious', 'irritated', 'annoyed'],
    fear: ['害怕', '恐惧', '担心', '忧虑', '焦虑', '不安', 'afraid', 'scared', 'fearful', 'anxious', 'worried'],
    surprised: ['惊讶', '意外', '震惊', '吃惊', '惊奇', 'surprised', 'amazed', 'shocked', 'astonished'],
    disgusted: ['厌恶', '恶心', '反感', '嫌弃', 'disgusted', 'revolted', 'repulsed']
  }

  constructor(private memoryService: EnhancedRoleMemoryService) {}

  /**
   * 检索记忆
   */
  async retrieve(context: ConversationContext): Promise<MemoryTriggerEntry[]> {
    // 检测当前情感状态
    const currentEmotion = this.detectEmotion(context)

    if (!currentEmotion) {
      return []
    }

    // 获取角色的所有记忆
    const allMemories = await this.memoryService.queryMemories({
      roleUuid: context.roleUuid,
      limit: 50
    })

    // 计算情感相关性并排序
    const scoredMemories = allMemories
      .map(memory => ({
        memory,
        score: this.calculateEmotionalRelevance(memory, currentEmotion, context)
      }))
      .filter(item => item.score > 0.2) // 过滤掉低相关性
      .sort((a, b) => b.score - a.score)
      .slice(0, 10) // 限制结果数量
      .map(item => item.memory)

    return scoredMemories
  }

  /**
   * 检测当前情感状态
   */
  private detectEmotion(context: ConversationContext): string | null {
    // 如果上下文中有明确的情感状态，直接使用
    if (context.emotionalState) {
      return context.emotionalState
    }

    // 从当前消息中检测情感
    const currentText = context.currentMessage.content.toLowerCase()
    const detectedEmotion = this.detectEmotionFromText(currentText)

    if (detectedEmotion) {
      return detectedEmotion
    }

    // 从最近的对话历史中检测情感
    const recentTexts = context.conversationHistory
      .slice(-2)
      .map(msg => msg.content.toLowerCase())
      .join(' ')

    return this.detectEmotionFromText(recentTexts)
  }

  /**
   * 从文本检测情感
   */
  private detectEmotionFromText(text: string): string | null {
    let maxScore = 0
    let detectedEmotion = null

    for (const [emotion, keywords] of Object.entries(this.emotionKeywords)) {
      const score = this.calculateEmotionScore(text, keywords)
      if (score > maxScore && score > 0.3) { // 设置最小阈值
        maxScore = score
        detectedEmotion = emotion
      }
    }

    return detectedEmotion
  }

  /**
   * 计算情感分数
   */
  private calculateEmotionScore(text: string, keywords: string[]): number {
    let matchCount = 0
    const words = text.split(/\s+/)

    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        matchCount++
      }
    }

    return keywords.length > 0 ? matchCount / keywords.length : 0
  }

  /**
   * 计算情感相关性
   */
  private calculateEmotionalRelevance(
    memory: MemoryTriggerEntry,
    currentEmotion: string,
    context: ConversationContext
  ): number {
    let emotionalScore = 0

    // 1. 情感上下文匹配
    emotionalScore += this.calculateEmotionalContextMatch(memory, currentEmotion)

    // 2. 内容情感匹配
    emotionalScore += this.calculateContentEmotionalMatch(memory, currentEmotion)

    // 3. 情感强度匹配
    emotionalScore += this.calculateEmotionalIntensityMatch(memory, currentEmotion, context)

    // 4. 应用记忆的情感权重
    emotionalScore *= memory.emotionalWeight

    // 应用记忆的整体权重
    emotionalScore *= memory.relevanceWeight

    return Math.min(emotionalScore, 1.0)
  }

  /**
   * 计算情感上下文匹配
   */
  private calculateEmotionalContextMatch(memory: MemoryTriggerEntry, currentEmotion: string): number {
    let contextScore = 0

    // 检查记忆的情感上下文
    const exactMatch = memory.emotionalContext.some(emotion =>
      emotion.toLowerCase() === currentEmotion.toLowerCase()
    )

    if (exactMatch) {
      contextScore += 0.8
    }

    // 检查情感类别匹配
    const emotionCategory = this.getEmotionCategory(currentEmotion)
    const categoryMatch = memory.emotionalContext.some(emotion =>
      this.getEmotionCategory(emotion.toLowerCase()) === emotionCategory
    )

    if (categoryMatch) {
      contextScore += 0.4
    }

    return Math.min(contextScore, 0.8)
  }

  /**
   * 计算内容情感匹配
   */
  private calculateContentEmotionalMatch(memory: MemoryTriggerEntry, currentEmotion: string): number {
    const contentText = memory.content.toLowerCase()
    const emotionKeywords = this.emotionKeywords[currentEmotion as keyof typeof this.emotionKeywords]

    if (!emotionKeywords) {
      return 0
    }

    const emotionScore = this.calculateEmotionScore(contentText, emotionKeywords)
    return emotionScore * 0.5 // 内容情感匹配权重为0.5
  }

  /**
   * 计算情感强度匹配
   */
  private calculateEmotionalIntensityMatch(
    memory: MemoryTriggerEntry,
    currentEmotion: string,
    context: ConversationContext
  ): number {
    let intensityScore = 0

    // 检测当前情感的强度
    const currentIntensity = this.detectEmotionalIntensity(context)

    // 检测记忆的情感强度
    const memoryIntensity = this.detectMemoryEmotionalIntensity(memory)

    // 如果强度相似，增加分数
    const intensityDiff = Math.abs(currentIntensity - memoryIntensity)
    if (intensityDiff < 0.3) {
      intensityScore += 0.2
    }

    return intensityScore
  }

  /**
   * 获取情感类别
   */
  private getEmotionCategory(emotion: string): string {
    const categories = {
      happy: 'positive',
      sad: 'negative',
      angry: 'negative',
      fear: 'negative',
      surprised: 'neutral',
      disgusted: 'negative'
    }

    for (const [emotionName, category] of Object.entries(categories)) {
      if (emotion.includes(emotionName)) {
        return category
      }
    }

    return 'neutral'
  }

  /**
   * 检测情感强度
   */
  private detectEmotionalIntensity(context: ConversationContext): number {
    let intensity = 0.5 // 默认中等强度

    const allTexts = [
      context.currentMessage.content,
      ...context.conversationHistory.slice(-2).map(msg => msg.content)
    ].join(' ').toLowerCase()

    // 强度词汇
    const strongWords = ['非常', '极其', '特别', '超级', 'really', 'very', 'extremely', 'incredibly']
    const weakWords = ['有点', '稍微', '略微', 'a bit', 'slightly', 'somewhat']

    const strongCount = strongWords.filter(word => allTexts.includes(word)).length
    const weakCount = weakWords.filter(word => allTexts.includes(word)).length

    if (strongCount > 0) {
      intensity += 0.3
    }
    if (weakCount > 0) {
      intensity -= 0.2
    }

    // 检查标点符号强度
    const exclamationCount = (allTexts.match(/!/g) || []).length
    if (exclamationCount >= 2) {
      intensity += 0.2
    }

    return Math.max(0, Math.min(1, intensity))
  }

  /**
   * 检测记忆的情感强度
   */
  private detectMemoryEmotionalIntensity(memory: MemoryTriggerEntry): number {
    const contentText = memory.content.toLowerCase()

    // 检查强度词汇
    const strongWords = ['非常', '极其', '特别', '超级', 'really', 'very', 'extremely']
    const weakWords = ['有点', '稍微', '略微', 'a bit', 'slightly']

    const strongCount = strongWords.filter(word => contentText.includes(word)).length
    const weakCount = weakWords.filter(word => contentText.includes(word)).length

    let intensity = 0.5
    if (strongCount > 0) {
      intensity += 0.3
    }
    if (weakCount > 0) {
      intensity -= 0.2
    }

    // 使用记忆的情感权重作为强度参考
    intensity = (intensity + memory.emotionalWeight) / 2

    return Math.max(0, Math.min(1, intensity))
  }

  /**
   * 获取与情感相关的记忆
   */
  async getEmotionalMemories(roleUuid: string, emotion: string): Promise<MemoryTriggerEntry[]> {
    const allMemories = await this.memoryService.queryMemories({
      roleUuid,
      limit: 100
    })

    return allMemories.filter(memory => {
      // 检查情感上下文
      const contextMatch = memory.emotionalContext.some(em =>
        em.toLowerCase() === emotion.toLowerCase() ||
        this.getEmotionCategory(em.toLowerCase()) === this.getEmotionCategory(emotion)
      )

      if (contextMatch) {
        return true
      }

      // 检查内容情感
      const contentText = memory.content.toLowerCase()
      const emotionKeywords = this.emotionKeywords[emotion as keyof typeof this.emotionKeywords]

      if (emotionKeywords) {
        const emotionScore = this.calculateEmotionScore(contentText, emotionKeywords)
        return emotionScore > 0.3
      }

      return false
    })
  }

  /**
   * 获取高情感权重的记忆
   */
  async getHighEmotionalWeightMemories(
    roleUuid: string,
    minWeight: number = 0.7
  ): Promise<MemoryTriggerEntry[]> {
    const allMemories = await this.memoryService.queryMemories({
      roleUuid,
      limit: 100
    })

    return allMemories
      .filter(memory => memory.emotionalWeight >= minWeight)
      .sort((a, b) => b.emotionalWeight - a.emotionalWeight)
  }
}