/**
 * AST折叠系统的类型定义
 * 提供结构化的标签解析，替代部分正则匹配
 */

/** AST节点类型 - 支持扩展的自定义类型 */
export type ASTNodeType =
  | 'thinking'
  | 'variables'
  | 'meta'
  | 'code'
  | 'unknown'
  | (string & {})

/** AST节点接口 */
export interface ASTNode {
  type: ASTNodeType
  startPos: number
  endPos: number
  content: string
  attributes?: Record<string, string>
  isComplete: boolean
  children?: ASTNode[]
  rawTag?: string // 原始标签名，用于调试
}

/** 词法单元类型 */
export type TokenType = 
  | 'TAG_OPEN' // <tag>
  | 'TAG_CLOSE' // </tag>
  | 'TEXT' // 普通文本
  | 'WHITESPACE' // 空白字符
  | 'EOF' // 结束

/** 词法单元 */
export interface Token {
  type: TokenType
  value: string
  position: number
  tagName?: string // 标签名（仅对TAG_OPEN和TAG_CLOSE有效）
  isSelfClosing?: boolean // 是否为自闭合标签
}

/** 解析状态 */
export type ParserState = 
  | 'WAITING_START' // 等待开始标签
  | 'IN_OPEN_TAG' // 在开始标签中
  | 'IN_CONTENT' // 在内容中
  | 'IN_CLOSE_TAG' // 在结束标签中
  | 'COMPLETE' // 完成

/** 流式解析上下文 */
export interface StreamingContext {
  buffer: string
  position: number
  state: ParserState
  pendingTag?: {
    name: string
    type: ASTNodeType
    attributes: Record<string, string>
    startPos: number
  }
  completedNodes: ASTNode[]
  partialNode?: ASTNode // 当前正在构建的不完整节点
}

/** 标签匹配规则 */
export interface TagRule {
  names: string[] // 支持的标签名列表
  type: ASTNodeType
  defaultCollapsed?: boolean
  isBlockLevel?: boolean // 是否为块级标签
}

/** 预处理的保护规则（类似于现有系统的 defaultPreReplace） */
export interface ProtectionRule {
  pattern: RegExp
  replacement: string | ((match: string) => string)
  slotPrefix: string
}

/** AST折叠器配置 */
export interface ASTFoldConfig {
  tagRules: TagRule[]
  protectionRules: ProtectionRule[]
  enableStreaming: boolean // 是否启用流式处理
  maxBufferSize: number // 最大缓冲区大小
  enableFallback: boolean // 是否启用降级到正则的机制
}
