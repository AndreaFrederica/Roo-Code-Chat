/**
 * AST语法分析器 - 将Token流转换为AST树
 * 解决半截标签问题的核心组件
 */

import { ASTNode, Token, TokenType, ParserState, TagRule, ASTNodeType } from './ast-fold-types'
import { ASTLexer } from './ast-lexer'

/** 解析错误 */
export class ParseError extends Error {
  constructor(message: string, public position: number, public token?: Token) {
    super(message)
    this.name = 'ParseError'
  }
}

/** 语法分析器 */
export class ASTParser {
  private lexer: ASTLexer
  private currentToken: Token
  private position: number
  private nodes: ASTNode[]
  private errorRecovery: boolean

  constructor(input: string, tagRules: TagRule[]) {
    this.lexer = new ASTLexer(input, { tagRules, skipWhitespace: true })
    this.currentToken = this.lexer.nextToken()
    this.position = 0
    this.nodes = []
    this.errorRecovery = true
  }

  /** 主解析方法 */
  public parse(): { nodes: ASTNode[], hasIncompleteTags: boolean, lastPosition: number } {
    try {
      this.parseDocument()
      return {
        nodes: this.nodes,
        hasIncompleteTags: this.hasIncompleteTags(),
        lastPosition: this.position
      }
    } catch (error) {
      if (error instanceof ParseError && this.errorRecovery) {
        // 错误恢复模式：返回已解析的部分
        console.warn('AST解析错误，恢复模式:', error.message)
        return {
          nodes: this.nodes,
          hasIncompleteTags: true,
          lastPosition: this.position
        }
      }
      throw error
    }
  }

  /** 解析整个文档 */
  private parseDocument(): void {
    while (this.currentToken.type !== 'EOF') {
      if (this.currentToken.type === 'TAG_OPEN') {
        this.parseTag()
      } else if (this.currentToken.type === 'TEXT') {
        this.parseText()
      } else {
        this.consumeToken()
      }
    }
    
    // 如果没有找到任何标签节点，将整个文本作为单个文本节点处理
    if (this.nodes.length === 0 && this.position > 0) {
      const fullText = this.lexer.getInput().slice(0, this.position)
      if (fullText.trim()) {
        this.nodes.push({
          type: 'text',
          startPos: 0,
          endPos: this.position,
          content: fullText,
          isComplete: true,
          children: [],
          rawTag: 'text'
        })
      }
    }
  }

  /** 解析标签 */
  private parseTag(): void {
    const tagToken = this.currentToken
    
    if (!tagToken.tagName) {
      this.consumeToken()
      return
    }

    // 检查是否为配置中定义的标签
    const matchingRule = this.lexer.getMatchingRule(tagToken.tagName)
    
    // 确定节点类型：如果有匹配规则就使用规则类型，否则使用标签名本身
    const nodeType: ASTNodeType = matchingRule ? matchingRule.type : (tagToken.tagName || 'unknown')

    if (tagToken.isSelfClosing) {
      // 自闭合标签，直接添加为叶子节点
      const node: ASTNode = {
        type: nodeType,
        startPos: tagToken.position,
        endPos: tagToken.position + tagToken.value.length,
        content: '',
        isComplete: true,
        children: [],
        rawTag: tagToken.tagName
      }
      this.nodes.push(node)
      this.consumeToken()
      return
    }

    // 记录开始标签的位置
    const startPos = tagToken.position
    this.consumeToken() // 消费开始标签
    
    // 解析内容直到遇到结束标签
    const content = this.parseUntilCloseTag(tagToken.tagName, nodeType, startPos)
    
    const node: ASTNode = {
      type: nodeType,
      startPos: startPos,
      endPos: content.endPos,
      content: content.text,
      isComplete: content.isComplete,
      children: content.children,
      rawTag: tagToken.tagName,
      attributes: tagToken.isSelfClosing ? {} : undefined
    }
    
    this.nodes.push(node)
  }

  /** 解析直到关闭标签 - 支持递归嵌套标签识别 */
  private parseUntilCloseTag(tagName: string, expectedType: ASTNodeType, startPos: number): { 
    text: string, 
    isComplete: boolean, 
    endPos: number,
    children: ASTNode[]
  } {
    const children: ASTNode[] = []
    let textBuffer = ''
    let textStartPos = this.position // 使用当前解析位置作为文本开始位置
    let foundMatchingCloseTag = false

    const pushTextNode = (endPos: number) => {
      if (textBuffer.length > 0 && textBuffer.trim()) {
        children.push({
          type: 'text',
          startPos: textStartPos,
          endPos,
          content: textBuffer,
          isComplete: true,
          children: [],
          rawTag: 'text'
        })
      }
      textBuffer = ''
      textStartPos = endPos
    }

    while (this.currentToken.type !== 'EOF' && !foundMatchingCloseTag) {
      if (this.currentToken.type === 'TAG_CLOSE') {
        // 检查关闭标签是否匹配
        if (this.currentToken.tagName?.toLowerCase() === tagName.toLowerCase() ||
            this.isMatchingCloseTag(tagName, this.currentToken.tagName || '')) {
          
          pushTextNode(this.currentToken.position)
          
          foundMatchingCloseTag = true
          const endPos = this.currentToken.position + this.currentToken.value.length
          this.consumeToken() // 消费结束标签
          
          return {
            text: this.lexer.getInput().slice(startPos, endPos),
            isComplete: true,
            endPos,
            children
          }
        } else {
          // 不是我们要的关闭标签，作为内容处理
          textBuffer += this.currentToken.value
          this.consumeToken()
        }
      } else if (this.currentToken.type === 'TAG_OPEN') {
        // 检查是否为嵌套标签
        const tagNameStr = this.currentToken.tagName || ''
        
        if (!this.currentToken.isSelfClosing) {
          pushTextNode(this.currentToken.position)
          
          // 保存嵌套标签的开始位置
          const nestedTagStart = this.currentToken.position
          const nestedRule = this.lexer.getMatchingRule(tagNameStr)
          const nestedNodeType: ASTNodeType = nestedRule ? nestedRule.type : (tagNameStr || 'unknown')
          
          this.consumeToken() // 消费嵌套开始标签

          // 递归解析嵌套标签内容
          const nestedContent = this.parseUntilCloseTag(tagNameStr, nestedNodeType, nestedTagStart)
          
          // 创建嵌套节点
          const nestedNode: ASTNode = {
            type: nestedNodeType,
            startPos: nestedTagStart,
            endPos: nestedContent.endPos,
            content: nestedContent.text,
            isComplete: nestedContent.isComplete,
            children: nestedContent.children,
            rawTag: tagNameStr
          }
          
          children.push(nestedNode)
          
          // 更新文本开始位置为嵌套标签之后
          textStartPos = nestedContent.endPos
        } else {
          // 自闭合标签，作为文本处理
          if (textBuffer.length === 0) {
            textStartPos = this.currentToken.position
          }
          textBuffer += this.currentToken.value
          this.consumeToken()
        }
      } else if (this.currentToken.type === 'TEXT') {
        if (textBuffer.length === 0) {
          textStartPos = this.currentToken.position
        }
        textBuffer += this.currentToken.value
        this.consumeToken()
      } else {
        if (textBuffer.length === 0) {
          textStartPos = this.currentToken.position
        }
        this.consumeToken()
      }
    }

    if (textBuffer.length > 0 && textBuffer.trim()) {
      pushTextNode(this.position)
    }

    const endPos = foundMatchingCloseTag ? 
      this.position : 
      startPos + this.lexer.getInput().slice(startPos).length

    return { 
      text: this.lexer.getInput().slice(startPos, endPos), 
      isComplete: foundMatchingCloseTag, 
      endPos, 
      children 
    }
  }

  /** 检查是否为匹配的关闭标签（支持跨语言） */
  private isMatchingCloseTag(openTag: string, closeTag: string): boolean {
    const openLower = openTag.toLowerCase()
    const closeLower = closeTag.toLowerCase()
    
    // 支持的思维标签列表
    const thinkingTags = ['thinking', '思考', 'thinkingprocess', 'think', 'think', 'thinkprocess']
    const variablesTags = ['updatevariable']
    
    // 检查是否为思维标签
    if (thinkingTags.includes(openLower) && thinkingTags.includes(closeLower)) {
      return true
    }
    
    // 检查是否为变量标签
    if (variablesTags.includes(openLower) && variablesTags.includes(closeLower)) {
      return true
    }
    
    // 直接匹配
    return openLower === closeLower
  }

  /** 解析文本 */
  private parseText(): void {
    if (this.currentToken.value.trim()) {
      const node: ASTNode = {
        type: 'text',
        startPos: this.currentToken.position,
        endPos: this.currentToken.position + this.currentToken.value.length,
        content: this.currentToken.value,
        isComplete: true,
        children: [],
        rawTag: 'text'
      }
      this.nodes.push(node)
    }
    this.consumeToken()
  }

  /** 消费当前Token */
  private consumeToken(): void {
    if (this.currentToken.type !== 'EOF') {
      this.position = this.currentToken.position + this.currentToken.value.length
      this.currentToken = this.lexer.nextToken()
    }
  }

  /** 检查是否有不完整的标签 */
  private hasIncompleteTags(): boolean {
    // 检查最后几个Token是否包含不完整的开始标签
    const recentTokens: Token[] = []
    
    // 这里简化实现，实际需要更复杂的逻辑
    // 检查最后的位置是否在标签中间
    return this.position < this.lexer.getRemainingLength()
  }

  /** 获取当前解析位置 */
  public getCurrentPosition(): number {
    return this.position
  }

  /** 设置错误恢复模式 */
  public setErrorRecovery(enabled: boolean): void {
    this.errorRecovery = enabled
  }
}

/** 流式解析器 - 用于处理实时文本 */
export class StreamingASTParser {
  private tagRules: TagRule[]
  private buffer: string
  private isComplete: boolean
  private lastNodeIndex: number
  private allParsedNodes: ASTNode[]
  private pendingTags: Array<{ name: string; position: number; type: ASTNodeType }>

  constructor(tagRules: TagRule[]) {
    this.tagRules = tagRules
    this.buffer = ''
    this.isComplete = false
    this.lastNodeIndex = 0
    this.allParsedNodes = []
    this.pendingTags = []
  }

  /** 添加文本片段 */
  public addText(text: string): { nodes: ASTNode[], hasNewCompleteTags: boolean } {
    this.buffer += text
    this.isComplete = text.includes('\n') || text.length > 1000 // 简单的完成检测
    
    const result = this.parseBuffer()
    return result
  }

  /** 解析当前缓冲区 */
  private parseBuffer(): { nodes: ASTNode[], hasNewCompleteTags: boolean } {
    try {
      const parser = new ASTParser(this.buffer, this.tagRules)
      const parseResult = parser.parse()
      
      // 关键修复：保存所有解析的节点，返回新增的节点
      this.allParsedNodes = parseResult.nodes
      const newNodes = parseResult.nodes.slice(this.lastNodeIndex)
      this.lastNodeIndex = parseResult.nodes.length
      
      return {
        nodes: newNodes,
        hasNewCompleteTags: parseResult.hasIncompleteTags === false && newNodes.length > 0
      }
    } catch (error) {
      console.warn('流式解析错误:', error)
      return { nodes: [], hasNewCompleteTags: false }
    }
  }

  /** 获取当前缓冲区内容 */
  public getBuffer(): string {
    return this.buffer
  }

  /** 标记为已完成 */
  public markComplete(): { nodes: ASTNode[], remainingBuffer: string } {
    this.isComplete = true
    
    // 最终解析，确保获得所有节点
    try {
      const parser = new ASTParser(this.buffer, this.tagRules)
      const parseResult = parser.parse()
      this.allParsedNodes = parseResult.nodes
      
      return {
        nodes: parseResult.nodes,
        remainingBuffer: ''
      }
    } catch (error) {
      console.warn('流式完成解析错误:', error)
      return {
        nodes: this.allParsedNodes,
        remainingBuffer: ''
      }
    }
  }

  /** 重置解析器 */
  public reset(): void {
    this.buffer = ''
    this.isComplete = false
    this.lastNodeIndex = 0
    this.allParsedNodes = []
    this.pendingTags = []
  }
}

/** 工具函数：快速解析文本为AST */
export function parseTextToAST(input: string, tagRules: TagRule[]): ASTNode[] {
  const parser = new ASTParser(input, tagRules)
  const result = parser.parse()
  return result.nodes
}

/** 工具函数：检查文本是否包含不完整的标签 */
export function hasIncompleteTags(input: string, tagRules: TagRule[]): boolean {
  const parser = new ASTParser(input, tagRules)
  const result = parser.parse()
  return result.hasIncompleteTags
}
