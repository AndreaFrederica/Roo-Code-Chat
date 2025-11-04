/**
 * AST词法分析器 - 将文本转换为Token流
 * 解决半截标签问题的关键组件
 */

import { Token, TokenType, TagRule } from './ast-fold-types'

/** 词法分析器配置 */
interface LexerConfig {
  tagRules: TagRule[]
  skipWhitespace: boolean
}

/** 词法分析器 */
export class ASTLexer {
  private input: string
  private position: number
  private config: LexerConfig
  private inputLength: number

  constructor(input: string, config: LexerConfig) {
    this.input = input
    this.position = 0
    this.inputLength = input.length
    this.config = config
  }

  /** 获取原始输入文本 */
  public getInput(): string {
    return this.input
  }

  /** 获取下一个Token */
  nextToken(): Token {
    this.skipWhitespace()

    if (this.position >= this.inputLength) {
      return {
        type: 'EOF',
        value: '',
        position: this.position
      }
    }

    const char = this.input[this.position]

    // 检查标签开始
    if (char === '<') {
      return this.parseTag()
    }

    // 普通文本
    return this.parseText()
  }

  /** 解析标签 */
  private parseTag(): Token {
    const startPos = this.position
    const char = this.input[this.position]

    if (char !== '<') {
      throw new Error(`Expected '<', got '${char}' at position ${this.position}`)
    }

    this.position++ // 跳过 '<'

    // 检查是否为结束标签
    const isCloseTag = this.position < this.inputLength && this.input[this.position] === '/'
    if (isCloseTag) {
      this.position++ // 跳过 '/'
      return this.parseCloseTag(startPos)
    }

    return this.parseOpenTag(startPos)
  }

  /** 解析开始标签 */
  private parseOpenTag(startPos: number): Token {
    const tagName = this.parseTagName()
    const attributes = this.parseAttributes()
    
    // 跳过空白字符
    this.skipWhitespace()

    let isSelfClosing = false
    // 检查自闭合标签
    if (this.position < this.inputLength && this.input[this.position] === '/') {
      this.position++
      isSelfClosing = true
    }

    // 检查标签结束
    if (this.position < this.inputLength && this.input[this.position] === '>') {
      this.position++ // 跳过 '>'
    } else {
      // 半截标签情况 - 不完整的标签
      return {
        type: 'TAG_OPEN',
        value: this.input.slice(startPos, this.position),
        position: startPos,
        tagName,
        isSelfClosing
      }
    }

    return {
      type: 'TAG_OPEN',
      value: this.input.slice(startPos, this.position),
      position: startPos,
      tagName,
      isSelfClosing
    }
  }

  /** 解析结束标签 */
  private parseCloseTag(startPos: number): Token {
    const tagName = this.parseTagName()
    
    // 跳过空白字符
    this.skipWhitespace()

    // 检查标签结束
    if (this.position < this.inputLength && this.input[this.position] === '>') {
      this.position++ // 跳过 '>'
    } else {
      // 半截标签情况 - 不完整的标签
      return {
        type: 'TAG_CLOSE',
        value: this.input.slice(startPos, this.position),
        position: startPos,
        tagName
      }
    }

    return {
      type: 'TAG_CLOSE',
      value: this.input.slice(startPos, this.position),
      position: startPos,
      tagName
    }
  }

  /** 解析标签名 */
  private parseTagName(): string {
    let result = ''
    
    while (this.position < this.inputLength) {
      const char = this.input[this.position]
      
      // 标签名可以包含字母、数字、连字符和中文字符
      if (/[a-zA-Z0-9\-一-龯]/.test(char)) {
        result += char
        this.position++
      } else {
        break
      }
    }

    return result
  }

  /** 解析属性（简化版本） */
  private parseAttributes(): Record<string, string> {
    const attributes: Record<string, string> = {}

    while (this.position < this.inputLength) {
      this.skipWhitespace()

      const char = this.input[this.position]
      
      // 检查标签结束
      if (char === '>' || char === '/') {
        break
      }

      // 解析属性名
      let attrName = ''
      while (this.position < this.inputLength) {
        const c = this.input[this.position]
        if (/[a-zA-Z0-9\-]/.test(c)) {
          attrName += c
          this.position++
        } else {
          break
        }
      }

      if (attrName) {
        attributes[attrName] = '' // 简化版本，不解析属性值
      }

      // 跳过到下一个可能的属性
      this.skipToNextAttribute()
    }

    return attributes
  }

  /** 跳转到下一个可能的属性 */
  private skipToNextAttribute(): void {
    while (this.position < this.inputLength) {
      const char = this.input[this.position]
      
      // 遇到空白字符或标签边界就停止
      if (char === ' ' || char === '\t' || char === '\n' || char === '\r' || char === '>' || char === '/') {
        break
      }
      
      this.position++
    }
  }

  /** 解析普通文本 */
  private parseText(): Token {
    const startPos = this.position
    let result = ''

    while (this.position < this.inputLength) {
      const char = this.input[this.position]
      
      // 遇到标签开始就停止
      if (char === '<') {
        break
      }
      
      result += char
      this.position++
    }

    return {
      type: 'TEXT',
      value: result,
      position: startPos
    }
  }

  /** 跳过空白字符 */
  private skipWhitespace(): void {
    while (this.position < this.inputLength) {
      const char = this.input[this.position]
      if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
        this.position++
      } else {
        break
      }
    }
  }

  /** 检查标签名是否匹配规则 */
  public isValidTagName(tagName: string): boolean {
    return this.config.tagRules.some(rule => 
      rule.names.some(name => name.toLowerCase() === tagName.toLowerCase())
    )
  }

  /** 获取匹配的标签规则 */
  public getMatchingRule(tagName: string): TagRule | null {
    return this.config.tagRules.find(rule => 
      rule.names.some(name => name.toLowerCase() === tagName.toLowerCase())
    ) || null
  }

  /** 获取剩余输入长度 */
  public getRemainingLength(): number {
    return this.inputLength - this.position
  }

  /** 检查是否到达输入末尾 */
  public isAtEnd(): boolean {
    return this.position >= this.inputLength
  }

  /** 预读取多个字符而不消费 */
  public peekChars(count: number): string {
    const endPos = Math.min(this.position + count, this.inputLength)
    return this.input.slice(this.position, endPos)
  }
}

/** 工具函数：快速创建词法分析器 */
export function createLexer(input: string, tagRules: TagRule[]): ASTLexer {
  return new ASTLexer(input, {
    tagRules,
    skipWhitespace: true
  })
}

/** 工具函数：将文本tokenize为Token数组 */
export function tokenizeText(input: string, tagRules: TagRule[]): Token[] {
  const lexer = createLexer(input, tagRules)
  const tokens: Token[] = []
  
  let token = lexer.nextToken()
  while (token.type !== 'EOF') {
    tokens.push(token)
    token = lexer.nextToken()
  }
  
  return tokens
}
