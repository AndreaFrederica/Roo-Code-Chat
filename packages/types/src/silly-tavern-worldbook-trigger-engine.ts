/**
 * SillyTavern世界书触发词引擎
 * 基于世界书词条的智能触发和动态注入系统
 */

import {
  WorldEntry,
  WorldBookConversionResult
} from './silly-tavern-worldbook.js';
import {
  WorldBookTriggerConfig,
  WorldBookTriggerEntry,
  WorldbookTriggerMatch,
  InjectionAction,
  InjectionResult,
  TriggerDebugInfo,
  WorldBookTriggerState,
  InjectionHistory,
  TriggerStats,
  SelectiveCondition,
  ContextRequirement,
  SmartMatchingOptions,
  SemanticSearchResult,
  BatchProcessingOptions,
  RealTimeTriggerOptions
} from './silly-tavern-worldbook-trigger.js';
import { ChatMessage } from './chat-message.js';

/**
 * 世界书触发词引擎
 */
export class WorldBookTriggerEngine {
  private state: WorldBookTriggerState = {
    loadedEntries: [],
    activeTriggers: [],
    injectionHistory: [],
    triggerStats: {
      totalTriggers: 0,
      todayTriggers: 0,
      popularEntries: [],
      avgResponseTime: 0
    },
    lastUpdated: Date.now()
  };

  private synonyms = new Map<string, string[]>();
  private semanticCache = new Map<string, SemanticSearchResult>();
  private realTimeQueue: Array<{
    message: ChatMessage;
    timestamp: number;
  }> = [];

  constructor(
    private config: WorldBookTriggerConfig,
    private smartMatching?: SmartMatchingOptions
  ) {
    this.initializeSynonyms();
  }

  /**
   * 加载世界书词条
   */
  async loadWorldBookEntries(entries: WorldEntry[]): Promise<void> {
    const startTime = Date.now();

    try {
      const triggerEntries = entries.map(this.convertToTriggerEntry);

      // 按优先级排序
      triggerEntries.sort((a, b) => {
        // 常驻词条优先
        if (a.isConstant && !b.isConstant) return -1;
        if (!a.isConstant && b.isConstant) return 1;

        // 按优先级排序
        return (b.priority || 0) - (a.priority || 0);
      });

      this.state.loadedEntries = triggerEntries;
      this.state.lastUpdated = Date.now();

      if (this.config.debugMode) {
        console.log(`[WorldBookTrigger] 加载了 ${triggerEntries.length} 个词条`);
        console.log(`[WorldBookTrigger] 常驻词条: ${triggerEntries.filter(e => e.isConstant).length} 个`);
        console.log(`[WorldBookTrigger] 触发词条: ${triggerEntries.filter(e => !e.isConstant).length} 个`);
      }

    } catch (error) {
      console.error('[WorldBookTrigger] 加载词条失败:', error);
      throw error;
    }
  }

  /**
   * 处理消息并触发相应词条
   */
  async processMessage(
    message: ChatMessage,
    conversationHistory: ChatMessage[] = []
  ): Promise<InjectionResult> {
    const startTime = Date.now();
    const debugInfo: TriggerDebugInfo = {
      messagesChecked: 0,
      candidatesCount: 0,
      matchedTriggers: [],
      skippedEntries: [],
      performance: {
        parseTime: 0,
        matchTime: 0,
        filterTime: 0,
        injectionTime: 0
      }
    };

    try {
      // 1. 准备消息上下文
      const recentMessages = this.prepareMessageContext(message, conversationHistory);
      debugInfo.messagesChecked = recentMessages.length;

      // 2. 查找匹配的触发词
      const matches = await this.findTriggerMatches(recentMessages, debugInfo);

      // 3. 过滤和验证触发条件
      const validMatches = await this.validateTriggerMatches(matches, recentMessages, debugInfo);

      // 4. 生成注入动作
      const actions = await this.generateInjectionActions(validMatches, debugInfo);

      // 5. 构建注入内容
      const result = await this.buildInjectionResult(actions, debugInfo);

      // 6. 更新统计和历史
      this.updateStatistics(result, debugInfo);

      const duration = Date.now() - startTime;
      result.duration = duration;
      result.debugInfo = debugInfo;

      if (this.config.debugMode) {
        console.log(`[WorldBookTrigger] 处理完成，耗时: ${duration}ms`);
        console.log(`[WorldBookTrigger] 注入词条: ${result.injectedCount}, 跳过: ${result.skippedCount}`);
      }

      return result;

    } catch (error) {
      console.error('[WorldBookTrigger] 处理消息失败:', error);

      return {
        actions: [],
        constantContent: '',
        triggeredContent: '',
        injectedCount: 0,
        skippedCount: 0,
        duration: Date.now() - startTime,
        debugInfo
      };
    }
  }

  /**
   * 实时触发处理
   */
  async setupRealTimeTriggering(options: RealTimeTriggerOptions): Promise<void> {
    if (!options.enabled) return;

    // 设置防抖处理
    let debounceTimer: NodeJS.Timeout;

    const processQueue = async () => {
      if (this.realTimeQueue.length === 0) return;

      const messages = [...this.realTimeQueue];
      this.realTimeQueue = [];

      for (const { message, timestamp } of messages) {
        // 检查时间间隔
        if (Date.now() - timestamp > options.debounceDelay) {
          continue;
        }

        try {
          await this.processMessage(message);

          // 等待最小触发间隔
          if (!options.allowConcurrent) {
            await new Promise(resolve => setTimeout(resolve, options.minTriggerInterval));
          }
        } catch (error) {
          console.error('[WorldBookTrigger] 实时触发失败:', error);
        }
      }
    };

    // 设置防抖定时器
    this.realTimeQueue = [];
    setInterval(processQueue, options.debounceDelay);
  }

  /**
   * 获取当前状态
   */
  getState(): WorldBookTriggerState {
    return { ...this.state };
  }

  /**
   * 清理过期历史记录
   */
  cleanupExpiredHistory(): void {
    const now = Date.now();
    this.state.injectionHistory = this.state.injectionHistory.filter(
      record => record.expireAt > now
    );
  }

  /**
   * 重置统计数据
   */
  resetStatistics(): void {
    this.state.triggerStats = {
      totalTriggers: 0,
      todayTriggers: 0,
      popularEntries: [],
      avgResponseTime: 0
    };
  }

  /* ------------------ 私有方法 ------------------ */

  private convertToTriggerEntry(entry: WorldEntry): WorldBookTriggerEntry {
    const primaryKeys = Array.isArray(entry.key) ? entry.key :
                      entry.key ? [entry.key] : [];
    const secondaryKeys = Array.isArray(entry.keysecondary) ? entry.keysecondary :
                         entry.keysecondary ? [entry.keysecondary] : [];

    return {
      entry,
      primaryKeys,
      secondaryKeys,
      isConstant: !!entry.constant,
      priority: entry.order || entry.displayIndex || 0,
      weight: entry.groupWeight || 1,
      selectiveConditions: this.parseSelectiveConditions(entry),
      contextRequirements: this.parseContextRequirements(entry),
      injectionTemplate: entry.comment || undefined
    };
  }

  private parseSelectiveConditions(entry: WorldEntry): SelectiveCondition[] {
    const conditions: SelectiveCondition[] = [];

    // 解析分组条件
    if (entry.group) {
      conditions.push({
        type: 'tag',
        value: entry.group,
        operator: 'equals',
        required: false
      });
    }

    // 解析选择逻辑
    if (entry.selective && entry.selectiveLogic) {
      // 根据selectiveLogic值创建条件
      conditions.push({
        type: 'custom',
        value: `selective_logic_${entry.selectiveLogic}`,
        operator: 'equals',
        required: true
      });
    }

    return conditions;
  }

  private parseContextRequirements(entry: WorldEntry): ContextRequirement[] {
    const requirements: ContextRequirement[] = [];

    // 解析深度要求
    if (entry.depth || entry.scanDepth) {
      requirements.push({
        type: 'min_messages',
        value: entry.depth || entry.scanDepth || 0,
        operator: 'gte'
      });
    }

    return requirements;
  }

  private prepareMessageContext(
    currentMessage: ChatMessage,
    conversationHistory: ChatMessage[]
  ): ChatMessage[] {
    const allMessages = [...conversationHistory, currentMessage];

    // 返回最近的N条消息
    return allMessages.slice(-this.config.checkHistoryLength);
  }

  private async findTriggerMatches(
    messages: ChatMessage[],
    debugInfo: TriggerDebugInfo
  ): Promise<WorldbookTriggerMatch[]> {
    const startTime = Date.now();
    const matches: WorldbookTriggerMatch[] = [];

    for (const triggerEntry of this.state.loadedEntries) {
      // 跳过常驻词条（不进行触发匹配）
      if (triggerEntry.isConstant) continue;

      const match = await this.matchEntry(triggerEntry, messages);
      if (match) {
        matches.push(match);
      }
    }

    debugInfo.performance.matchTime = Date.now() - startTime;
    debugInfo.candidatesCount = this.state.loadedEntries.length;

    return matches;
  }

  private async matchEntry(
    triggerEntry: WorldBookTriggerEntry,
    messages: ChatMessage[]
  ): Promise<WorldbookTriggerMatch | null> {
    const allKeywords = [
      ...triggerEntry.primaryKeys,
      ...triggerEntry.secondaryKeys
    ];

    if (allKeywords.length === 0) return null;

    let bestMatch: WorldbookTriggerMatch | null = null;
    let bestScore = 0;

    for (const message of messages) {
      const content = message.content || '';

      for (const keyword of allKeywords) {
        const match = await this.matchKeyword(content, keyword, triggerEntry);

        if (match && match.score > bestScore) {
          bestMatch = {
            entry: triggerEntry,
            matchedKeyword: keyword,
            matchType: this.getMatchType(keyword, triggerEntry),
            score: match.score,
            positions: match.positions,
            matchedMessages: [message]
          };
          bestScore = match.score;
        }
      }
    }

    return bestMatch;
  }

  private async matchKeyword(
    content: string,
    keyword: string,
    triggerEntry: WorldBookTriggerEntry
  ): Promise<{ score: number; positions: number[] } | null> {
    const positions: number[] = [];
    let score = 0;

    switch (this.config.matchStrategy) {
      case 'exact':
        if (this.exactMatch(content, keyword)) {
          score = 1.0;
          positions.push(this.findPosition(content, keyword));
        }
        break;

      case 'contains':
        if (this.containsMatch(content, keyword)) {
          score = 0.8;
          const pos = this.findPosition(content, keyword);
          if (pos !== -1) positions.push(pos);
        }
        break;

      case 'fuzzy':
        const fuzzyResult = this.fuzzyMatch(content, keyword);
        if (fuzzyResult.score >= this.config.fuzzyThreshold) {
          score = fuzzyResult.score;
          positions.push(...fuzzyResult.positions);
        }
        break;

      case 'semantic':
        if (this.smartMatching?.enableSemantic) {
          const semanticResult = await this.semanticMatch(content, keyword);
          if (semanticResult.similarityScore >= this.config.semanticThreshold) {
            score = semanticResult.similarityScore;
            positions.push(...this.findPositions(content, keyword));
          }
        }
        break;
    }

    // 考虑权重和优先级
    if (score > 0) {
      score *= (triggerEntry.weight || 1);
    }

    return score > 0 ? { score, positions } : null;
  }

  private exactMatch(content: string, keyword: string): boolean {
    const text = this.config.caseSensitive ? content : content.toLowerCase();
    const key = this.config.caseSensitive ? keyword : keyword.toLowerCase();
    return text === key;
  }

  private containsMatch(content: string, keyword: string): boolean {
    const text = this.config.caseSensitive ? content : content.toLowerCase();
    const key = this.config.caseSensitive ? keyword : keyword.toLowerCase();
    return text.includes(key);
  }

  private fuzzyMatch(content: string, keyword: string): { score: number; positions: number[] } {
    // 简单的模糊匹配实现（基于Levenshtein距离）
    const text = this.config.caseSensitive ? content : content.toLowerCase();
    const key = this.config.caseSensitive ? keyword : keyword.toLowerCase();

    const distance = this.levenshteinDistance(text, key);
    const maxLen = Math.max(text.length, key.length);
    const score = 1 - (distance / maxLen);

    return {
      score,
      positions: this.findPositions(text, key)
    };
  }

  private async semanticMatch(content: string, keyword: string): Promise<SemanticSearchResult> {
    // 这里应该集成真正的语义搜索API
    // 目前返回模拟结果
    const cacheKey = `${content}_${keyword}`;

    if (this.semanticCache.has(cacheKey)) {
      return this.semanticCache.get(cacheKey)!;
    }

    // 模拟语义搜索结果
    const result: SemanticSearchResult = {
      entryId: '',
      similarityScore: Math.random() * 0.8 + 0.2, // 0.2-1.0
      matchedConcepts: [keyword],
      confidence: 0.8
    };

    this.semanticCache.set(cacheKey, result);
    return result;
  }

  private getMatchType(keyword: string, triggerEntry: WorldBookTriggerEntry): 'primary' | 'secondary' | 'fuzzy' | 'semantic' {
    if (triggerEntry.primaryKeys.includes(keyword)) return 'primary';
    if (triggerEntry.secondaryKeys.includes(keyword)) return 'secondary';
    if (this.config.matchStrategy === 'fuzzy') return 'fuzzy';
    if (this.config.matchStrategy === 'semantic') return 'semantic';
    return 'primary';
  }

  private findPosition(content: string, keyword: string): number {
    const text = this.config.caseSensitive ? content : content.toLowerCase();
    const key = this.config.caseSensitive ? keyword : keyword.toLowerCase();
    return text.indexOf(key);
  }

  private findPositions(content: string, keyword: string): number[] {
    const positions: number[] = [];
    const text = this.config.caseSensitive ? content : content.toLowerCase();
    const key = this.config.caseSensitive ? keyword : keyword.toLowerCase();

    let pos = text.indexOf(key);
    while (pos !== -1) {
      positions.push(pos);
      pos = text.indexOf(key, pos + 1);
    }

    return positions;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    // 超级简化的字符串相似度计算
    if (str1 === str2) return 0;
    if (str1.length === 0) return str2.length;
    if (str2.length === 0) return str1.length;

    let distance = 0;
    const minLength = Math.min(str1.length, str2.length);

    for (let i = 0; i < minLength; i++) {
      if (str1[i] !== str2[i]) distance++;
    }

    distance += Math.abs(str1.length - str2.length);
    return distance;
  }

  private async validateTriggerMatches(
    matches: WorldbookTriggerMatch[],
    messages: ChatMessage[],
    debugInfo: TriggerDebugInfo
  ): Promise<WorldbookTriggerMatch[]> {
    const startTime = Date.now();
    const validMatches: WorldbookTriggerMatch[] = [];

    for (const match of matches) {
      // 检查冷却时间
      const entryId = match.entry.entry.uid?.toString();
      if (entryId && this.isInCooldown(entryId)) {
        debugInfo.skippedEntries.push({
          entryId: entryId,
          reason: 'cooldown'
        });
        continue;
      }

      // 检查选择性条件
      if (!await this.checkSelectiveConditions(match.entry, messages)) {
        debugInfo.skippedEntries.push({
          entryId: entryId || '',
          reason: 'selective_condition'
        });
        continue;
      }

      // 检查上下文要求
      if (!this.checkContextRequirements(match.entry, messages)) {
        debugInfo.skippedEntries.push({
          entryId: entryId || '',
          reason: 'context_requirement'
        });
        continue;
      }

      validMatches.push(match);
    }

    debugInfo.performance.filterTime = Date.now() - startTime;
    return validMatches;
  }

  private isInCooldown(entryId: string): boolean {
    const now = Date.now();
    const recentInjections = this.state.injectionHistory.filter(
      record => record.entryId === entryId &&
                (now - record.timestamp) < this.config.injectionCooldown
    );

    return recentInjections.length > 0;
  }

  private async checkSelectiveConditions(
    triggerEntry: WorldBookTriggerEntry,
    messages: ChatMessage[]
  ): Promise<boolean> {
    if (!triggerEntry.selectiveConditions || triggerEntry.selectiveConditions.length === 0) {
      return true;
    }

    for (const condition of triggerEntry.selectiveConditions) {
      const result = await this.evaluateCondition(condition, messages);
      if (condition.required && !result) {
        return false;
      }
    }

    return true;
  }

  private async evaluateCondition(
    condition: SelectiveCondition,
    messages: ChatMessage[]
  ): Promise<boolean> {
    // 这里应该根据实际的角色、场景等信息来评估条件
    // 目前返回true作为默认实现
    switch (condition.type) {
      case 'tag':
      case 'character':
      case 'user':
      case 'scenario':
        // TODO: 实现具体的条件评估逻辑
        return true;
      case 'custom':
        return condition.value === 'selective_logic_1'; // 示例
      default:
        return true;
    }
  }

  private checkContextRequirements(
    triggerEntry: WorldBookTriggerEntry,
    messages: ChatMessage[]
  ): boolean {
    if (!triggerEntry.contextRequirements || triggerEntry.contextRequirements.length === 0) {
      return true;
    }

    for (const requirement of triggerEntry.contextRequirements) {
      if (!this.evaluateRequirement(requirement, messages)) {
        return false;
      }
    }

    return true;
  }

  private evaluateRequirement(
    requirement: ContextRequirement,
    messages: ChatMessage[]
  ): boolean {
    switch (requirement.type) {
      case 'min_messages':
        return messages.length >= (requirement.value as number);
      case 'max_messages':
        return messages.length <= (requirement.value as number);
      case 'time_since_last':
        // TODO: 实现时间检查逻辑
        return true;
      case 'user_role':
        // TODO: 实现角色检查逻辑
        return true;
      case 'conversation_topic':
        // TODO: 实现话题检查逻辑
        return true;
      default:
        return true;
    }
  }

  private async generateInjectionActions(
    matches: WorldbookTriggerMatch[],
    debugInfo: TriggerDebugInfo
  ): Promise<InjectionAction[]> {
    const startTime = Date.now();
    const actions: InjectionAction[] = [];

    // 添加常驻词条
    const constantEntries = this.state.loadedEntries.filter(entry => entry.isConstant);
    for (const entry of constantEntries) {
      const action = this.createInjectionAction(entry, 'constant');
      actions.push(action);
    }

    // 添加触发的词条（按优先级和分数排序）
    const sortedMatches = matches.sort((a, b) => {
      // 先按优先级排序
      const priorityDiff = (b.entry.priority || 0) - (a.entry.priority || 0);
      if (priorityDiff !== 0) return priorityDiff;

      // 再按分数排序
      return b.score - a.score;
    });

    // 限制注入数量
    const limitedMatches = sortedMatches.slice(0, this.config.maxInjectEntries);

    for (const match of limitedMatches) {
      const action = this.createInjectionAction(match.entry, 'triggered', match.score);
      actions.push(action);
    }

    debugInfo.performance.injectionTime = Date.now() - startTime;
    return actions;
  }

  private createInjectionAction(
    triggerEntry: WorldBookTriggerEntry,
    injectionType: 'constant' | 'triggered',
    score: number = 1.0
  ): InjectionAction {
    const content = this.formatEntryContent(triggerEntry, injectionType);

    return {
      type: injectionType === 'constant' ? 'inject_constant' : 'inject_entry',
      entryId: triggerEntry.entry.uid?.toString() || '',
      content,
      position: 'context',
      temporary: injectionType === 'triggered',
      duration: injectionType === 'triggered' ? 5 : undefined, // 5条消息后过期
      priority: triggerEntry.priority || 0
    };
  }

  private formatEntryContent(
    triggerEntry: WorldBookTriggerEntry,
    injectionType: 'constant' | 'triggered'
  ): string {
    const { entry } = triggerEntry;
    let content = '';

    // 添加标题
    const title = entry.comment || entry.key?.[0] || `词条 #${entry.uid}`;
    content += `## ${title}\n\n`;

    // 添加关键词信息
    if (entry.key && entry.key.length > 0) {
      content += `**关键词：** ${entry.key.join(' · ')}\n`;
    }
    if (entry.keysecondary && entry.keysecondary.length > 0) {
      content += `**同义词：** ${entry.keysecondary.join(' · ')}\n`;
    }
    content += '\n';

    // 添加主要内容
    if (entry.content) {
      content += entry.content;
    } else {
      content += '*(暂无详细内容)*';
    }

    return content;
  }

  private async buildInjectionResult(
    actions: InjectionAction[],
    debugInfo: TriggerDebugInfo
  ): Promise<InjectionResult> {
    // 分离常驻内容和触发内容
    const constantActions = actions.filter(action => action.type === 'inject_constant');
    const triggeredActions = actions.filter(action => action.type === 'inject_entry');

    const constantContent = constantActions
      .map(action => action.content)
      .join('\n\n---\n\n');

    const triggeredContent = triggeredActions
      .map(action => action.content)
      .join('\n\n---\n\n');

    return {
      actions,
      constantContent,
      triggeredContent,
      injectedCount: actions.length,
      skippedCount: debugInfo.skippedEntries.length,
      duration: 0, // 将在调用方设置
      debugInfo
    };
  }

  private updateStatistics(result: InjectionResult, debugInfo: TriggerDebugInfo): void {
    const now = Date.now();

    // 更新触发统计
    this.state.triggerStats.totalTriggers += result.injectedCount;

    // 更新今日统计（简化实现）
    const today = new Date().toDateString();
    if (this.state.lastUpdated < new Date(today).getTime()) {
      this.state.triggerStats.todayTriggers = result.injectedCount;
    } else {
      this.state.triggerStats.todayTriggers += result.injectedCount;
    }

    // 更新平均响应时间
    const totalTime = this.state.triggerStats.avgResponseTime * (this.state.triggerStats.totalTriggers - result.injectedCount) + result.duration;
    this.state.triggerStats.avgResponseTime = totalTime / this.state.triggerStats.totalTriggers;

    // 更新热门词条
    for (const action of result.actions) {
      this.updatePopularEntries(action.entryId, action.content);
    }

    // 添加到注入历史
    for (const action of result.actions) {
      if (action.temporary && action.duration) {
        this.state.injectionHistory.push({
          entryId: action.entryId,
          timestamp: now,
          triggerKeyword: '', // 可以从debugInfo中获取
          injectionType: action.type === 'inject_constant' ? 'constant' : 'triggered',
          expireAt: now + (action.duration * 1000) // 假设duration是秒数
        });
      }
    }

    this.state.lastUpdated = now;
  }

  private updatePopularEntries(entryId: string, content: string): void {
    // 提取标题
    const titleMatch = content.match(/^## (.+)$/m);
    const title = titleMatch?.[1] || '未知词条';

    // 查找现有记录
    let popularEntry = this.state.triggerStats.popularEntries.find(entry => entry.entryId === entryId) || null;

    if (popularEntry) {
      popularEntry.triggerCount++;
    } else {
      this.state.triggerStats.popularEntries.push({
        entryId,
        title,
        triggerCount: 1
      });
    }

    // 按触发次数排序，保留前10个
    this.state.triggerStats.popularEntries
      .sort((a, b) => b.triggerCount - a.triggerCount)
      .splice(10);
  }

  private initializeSynonyms(): void {
    // 初始化基础同义词词典
    this.synonyms.set('你好', ['您好', 'hi', 'hello', '哈喽']);
    this.synonyms.set('再见', ['拜拜', 'bye', 'goodbye', '回见']);
    this.synonyms.set('谢谢', ['感谢', '谢了', 'thanks', 'thank you']);

    // 添加自定义同义词
    if (this.smartMatching?.customSynonyms) {
      for (const [word, synonyms] of Object.entries(this.smartMatching.customSynonyms)) {
        this.synonyms.set(word, synonyms);
      }
    }
  }
}

// Re-export types that are commonly used by external modules
export type {
  WorldBookTriggerState,
  WorldBookTriggerConfig,
  WorldBookTriggerEntry,
  WorldbookTriggerMatch,
  InjectionAction,
  InjectionResult,
  TriggerDebugInfo,
  InjectionHistory,
  TriggerStats,
  SelectiveCondition,
  ContextRequirement,
  SmartMatchingOptions,
  SemanticSearchResult,
  BatchProcessingOptions,
  RealTimeTriggerOptions
} from './silly-tavern-worldbook-trigger.js';

export type {
  WorldEntry,
  WorldBookConversionResult
} from './silly-tavern-worldbook.js';