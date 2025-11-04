/**
 * AST折叠引擎 - 基于AST生成折叠块
 * 替代部分正则匹配，解决半截标签问题
 */

import { ASTNode, TagRule, ProtectionRule } from './ast-fold-types'
import { Block } from '@/types/block'
import { parseTextToAST, StreamingASTParser, hasIncompleteTags } from './ast-parser'
import type { BlockRule } from './fold-config'

/** AST折叠引擎配置 */
export interface ASTFoldEngineConfig {
  tagRules: TagRule[]
  protectionRules?: ProtectionRule[]
  enableStreaming?: boolean
  maxBufferSize?: number
  enableFallback?: boolean
}

/** AST折叠引擎 */
export class ASTFoldEngine {
  private config: ASTFoldEngineConfig
  private streamingParser: StreamingASTParser | null = null

  constructor(config: ASTFoldEngineConfig) {
    this.config = {
      enableStreaming: true,
      maxBufferSize: 10000,
      enableFallback: true,
      protectionRules: this.getDefaultProtectionRules(),
      ...config
    }
  }

  /** 处理文本，生成折叠块 */
  public processText(text: string, fallbackBlocks?: Block[]): { 
    blocks: Block[], 
    hasIncompleteTags: boolean, 
    usedAST: boolean 
  } {
    try {
      // 1. 预处理：保护代码块等
      const processedText = this.applyProtectionRules(text)
      
      // 2. AST解析
      const astNodes = parseTextToAST(processedText, this.config.tagRules)
      
      if (astNodes.length === 0) {
        // 没有找到AST节点，回退到正则系统
        return {
          blocks: fallbackBlocks || this.createFallbackBlocks(text),
          hasIncompleteTags: false,
          usedAST: false
        }
      }

      // 3. 检查是否有不完整的标签
      const hasIncomplete = this.checkIncompleteTags(text, processedText)
      
      // 4. 转换为Block
      const blocks = this.astNodesToBlocks(astNodes, processedText)
      
      return {
        blocks,
        hasIncompleteTags: hasIncomplete,
        usedAST: true
      }
    } catch (error) {
      console.warn('AST折叠引擎错误，回退到正则系统:', error)
      return {
        blocks: fallbackBlocks || this.createFallbackBlocks(text),
        hasIncompleteTags: false,
        usedAST: false
      }
    }
  }

  /** 流式处理文本片段 */
  public processStreamingText(text: string, isComplete: boolean = false): {
    blocks: Block[],
    hasNewCompleteTags: boolean,
    bufferContent: string
  } {
    if (!this.streamingParser) {
      this.streamingParser = new StreamingASTParser(this.config.tagRules)
    }

    const result = this.streamingParser.addText(text)
    const bufferContent = this.streamingParser.getBuffer()
    
    if (isComplete) {
      const finalResult = this.streamingParser.markComplete()
      // 关键修复：使用完整的缓冲区内容来生成最终的blocks
      return {
        blocks: this.astNodesToBlocks(finalResult.nodes, bufferContent),
        hasNewCompleteTags: result.hasNewCompleteTags,
        bufferContent: bufferContent
      }
    }

    return {
      blocks: this.astNodesToBlocks(result.nodes, bufferContent),
      hasNewCompleteTags: result.hasNewCompleteTags,
      bufferContent
    }
  }

  /** 重置流式解析器 */
  public resetStreaming(): void {
    if (this.streamingParser) {
      this.streamingParser.reset()
    }
  }

  /** AST节点转换为Block - 支持递归处理children */
  private astNodesToBlocks(
    astNodes: ASTNode[],
    originalText: string,
    rangeStart = 0,
    rangeEnd = originalText.length,
  ): Block[] {
    const blocks: Block[] = []
    let lastPosition = rangeStart

    for (const node of astNodes) {
      const segmentEnd = Math.min(node.startPos, rangeEnd)
      if (segmentEnd > lastPosition) {
        // 添加文本块 - 但要排除已经被AST处理的标签内容
        let textContent = originalText.slice(lastPosition, segmentEnd)

        // 关键修复：清理文本块中的AST标签，避免重复渲染
        textContent = this.cleanASTTagsFromText(textContent)

        if (textContent.trim()) {
          blocks.push({
            type: 'text',
            content: textContent,
            start: lastPosition,
            end: segmentEnd,
          })
        }
      }

      // 递归处理子节点，仅在父节点需要时保留文本子块
      const rawChildBlocks =
        node.children && node.children.length > 0
          ? this.astNodesToBlocks(node.children, originalText, node.startPos, Math.min(node.endPos, rangeEnd))
          : []

      const blockType = this.mapASTTypeToBlockType(node.type)
      const childBlocks =
        node.type === 'variables'
          ? rawChildBlocks.filter((child) => child.type !== 'text')
          : rawChildBlocks

      const shouldPreserveContent =
        blockType === 'variables' || blockType === 'code' || blockType === 'text'

      // 添加折叠块，支持嵌套子块
      const block: Block = {
        type: blockType,
        content: shouldPreserveContent ? node.content : '',
        start: node.startPos,
        end: node.endPos,
        defaultCollapsed: this.getDefaultCollapsed(node.type),
        children: childBlocks.length > 0 ? childBlocks : undefined,
      }

      blocks.push(block)

      lastPosition = Math.max(lastPosition, Math.min(node.endPos, rangeEnd))
    }

    if (lastPosition < rangeEnd) {
      let remainingText = originalText.slice(lastPosition, rangeEnd)
      remainingText = this.cleanASTTagsFromText(remainingText)

      if (remainingText.trim()) {
        blocks.push({
          type: 'text',
          content: remainingText,
          start: lastPosition,
          end: rangeEnd,
        })
      }
    }

    return blocks
  }

  /** 从文本中清理AST标签，避免重复渲染 */
  private cleanASTTagsFromText(text: string): string {
    if (!text) return text
    
    // 移除常见的AST标签
    return text
      .replace(/<\/?(thinking|思考|think|Think|UpdateVariable)[^>]*>/gi, '')
      .replace(/<\s*\/\s*(thinking|思考|think|Think|UpdateVariable)\s*>/gi, '')
      .trim()
  }

  /** 映射AST节点类型到Block类型 */
  private mapASTTypeToBlockType(astType: string): string {
    const mapping: Record<string, string> = {
      'thinking': 'thinking',
      'variables': 'variables',
      'meta': 'meta',
      'code': 'code',
      'unknown': 'text'
    }
    return mapping[astType] || 'text'
  }

  /** 获取默认折叠状态 */
  private getDefaultCollapsed(astType: string): boolean {
    const collapsedByDefault = new Set(['thinking', 'meta'])
    return collapsedByDefault.has(astType)
  }

  /** 检查不完整的标签 */
  private checkIncompleteTags(originalText: string, processedText: string): boolean {
    // 如果处理后的文本比原始文本短，说明可能有保护规则影响了结果
    if (processedText.length !== originalText.length) {
      return true
    }

    // 检查是否还有未完成的标签
    return hasIncompleteTags(processedText, this.config.tagRules)
  }

  /** 应用保护规则（类似于现有的 defaultPreReplace） */
  private applyProtectionRules(text: string): string {
    let result = text

    for (const rule of this.config.protectionRules || []) {
      result = result.replace(rule.pattern, rule.replacement as string)
    }

    return result
  }

  /** 创建回退块（当AST解析失败时使用） */
  private createFallbackBlocks(text: string): Block[] {
    return [{
      type: 'text',
      content: text,
      start: 0,
      end: text.length
    }]
  }

  /** 获取默认的保护规则 */
  private getDefaultProtectionRules(): ProtectionRule[] {
    return [
      // 保护代码块
      {
        pattern: /(^|[\r\n])(```|~~~)[^\r\n]*[\r\n][\s\S]*?\2(?=[\r\n]|$)/g,
        replacement: (match: string) => {
          return match.startsWith('\n') ? '\n' : '' + `\u0000__SLOT__${match}\u0000`
        },
        slotPrefix: 'code'
      },
      // 保护行内代码
      {
        pattern: /`[^`\r\n]+`/g,
        replacement: (match: string) => `\u0000__SLOT__${match}\u0000`,
        slotPrefix: 'inline-code'
      }
    ]
  }

  /** 从现有BlockRule转换到AST TagRule */
  public static convertBlockRuleToTagRule(blockRule: BlockRule): TagRule {
    // 从正则中提取标签名的简化版本
    const tagNames = this.extractTagNamesFromRegex(blockRule.re.source)
    
    return {
      names: tagNames,
      type: (blockRule.toType as any) || 'thinking',
      defaultCollapsed: blockRule.defaultCollapsed,
      isBlockLevel: true
    }
  }

  /** 从正则表达式提取标签名 */
  private static extractTagNamesFromRegex(regexSource: string): string[] {
    const names: string[] = []
    
    // 方法1: 直接字符串查找标签名（优先级最高）
    const tagNamesMap: Record<string, string[]> = {
      'UpdateVariable': ['UpdateVariable'],
      'thinking': ['thinking'],
      '思考': ['thinking', '思考'],
      '思索': ['thinking'],
      'ThinkingProcess': ['thinking', 'ThinkingProcess'],
      'Tips': ['Tips', 'Tip']
    }
    
    for (const [pattern, tagNames] of Object.entries(tagNamesMap)) {
      if (regexSource.includes(pattern)) {
        for (const name of tagNames) {
          if (!names.includes(name)) {
            names.push(name)
          }
        }
      }
    }
    
    // 方法2: 匹配 <tag> 或 <\s*tag 格式的标签名
    if (names.length === 0) {
      const tagNameMatches = regexSource.match(/<\s*([a-zA-Z][a-zA-Z0-9]*)/gi)
      if (tagNameMatches) {
        for (const match of tagNameMatches) {
          // 移除 '<' 和可能的空白字符
          const tagName = match.replace(/<\s*/i, '')
          if (tagName && !names.includes(tagName)) {
            names.push(tagName)
          }
        }
      }
    }

    // 如果没有找到明确的标签名，使用默认的thinking相关标签
    if (names.length === 0) {
      names.push('thinking', '思考', 'think', 'Think')
    }

    return names
  }

  /** 获取性能统计信息 */
  public getPerformanceStats(): {
    bufferSize: number,
    isStreaming: boolean,
    totalProcessed: number
  } {
    return {
      bufferSize: this.streamingParser?.getBuffer().length || 0,
      isStreaming: this.config.enableStreaming || false,
      totalProcessed: 0 // 可以扩展以跟踪处理总量
    }
  }
}

/** 工具函数：快速创建AST折叠引擎 */
export function createASTFoldEngine(tagRules: TagRule[]): ASTFoldEngine {
  return new ASTFoldEngine({
    tagRules,
    enableStreaming: true,
    enableFallback: true
  })
}

/** 工具函数：从BlockRule数组创建TagRule数组 */
export function convertBlockRulesToTagRules(blockRules: BlockRule[]): TagRule[] {
  return blockRules.map(rule => ASTFoldEngine.convertBlockRuleToTagRule(rule))
}

/** 测试函数：演示AST折叠引擎的工作原理 */
export function demonstrateASTFolding(): void {
  console.log('=== AST折叠引擎演示 ===')
  
  const tagRules: TagRule[] = [
    {
      names: ['thinking', '思考'],
      type: 'thinking',
      defaultCollapsed: true
    },
    {
      names: ['UpdateVariable'],
      type: 'variables',
      defaultCollapsed: false
    }
  ]

  const engine = createASTFoldEngine(tagRules)
  
  const testCases = [
    '<thinking>这是一个完整的思维块</thinking>',
    '<思考>这是一个中文思维块',
    '普通文本 <thinking>半截的思维块</thinking',
    '混合内容 <thinking>完整块</thinking> 普通文本'
  ]

  for (const testCase of testCases) {
    console.log(`\n测试: ${testCase}`)
    const result = engine.processText(testCase)
    console.log('结果:', result)
  }
}
