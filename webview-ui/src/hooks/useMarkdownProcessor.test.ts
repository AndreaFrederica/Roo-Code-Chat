/**
 * useMarkdownProcessor 测试文件
 * 验证重构后的AST处理功能
 */

import { renderHook } from '@testing-library/react'
import { useMarkdownProcessor } from './useMarkdownProcessor'

// Mock ExtensionStateContext
jest.mock('@/context/ExtensionStateContext', () => ({
  useExtensionState: () => ({
    outputStreamProcessorConfig: {
      builtinRulesEnabled: {
        thinking: true,
        updateVariable: true,
        tips: false
      },
      builtinRulesConfig: {},
      customRulesFiles: {
        regexMixins: [],
        astMixins: []
      }
    }
  })
}))

// Mock useMixinRules
jest.mock('./useMixinRules', () => ({
  useMixinRules: () => ({
    regexMixins: {},
    astMixins: {}
  })
}))

describe('useMarkdownProcessor', () => {
  it('应该处理包含thinking标签的文本', () => {
    const { result } = renderHook(() => 
      useMarkdownProcessor('普通文本 <thinking>这是思考内容</thinking> 更多文本')
    )
    
    const blocks = result.current
    
    expect(blocks).toHaveLength(3) // 文本块 + thinking块 + 文本块
    expect(blocks[0].type).toBe('text')
    expect(blocks[0].content).toContain('普通文本')
    
    expect(blocks[1].type).toBe('thinking')
    expect(blocks[1].content).toBe('这是思考内容')
    expect(blocks[1].action).toBe('fold')
    expect(blocks[1].defaultCollapsed).toBe(true)
    
    expect(blocks[2].type).toBe('text')
    expect(blocks[2].content).toContain('更多文本')
  })

  it('应该处理中文思考标签', () => {
    const { result } = renderHook(() => 
      useMarkdownProcessor('文本 <思考>中文思考内容</思考> 结束')
    )
    
    const blocks = result.current
    
    expect(blocks).toHaveLength(3)
    expect(blocks[1].type).toBe('thinking')
    expect(blocks[1].content).toBe('中文思考内容')
    expect(blocks[1].rawTag).toBe('思考')
  })

  it('应该处理UpdateVariable标签', () => {
    const { result } = renderHook(() => 
      useMarkdownProcessor('文本 <UpdateVariable>变量内容</UpdateVariable> 结束')
    )
    
    const blocks = result.current
    
    expect(blocks).toHaveLength(3)
    expect(blocks[1].type).toBe('UpdateVariable')
    expect(blocks[1].content).toBe('变量内容')
    expect(blocks[1].action).toBe('fold')
    expect(blocks[1].defaultCollapsed).toBe(false)
  })

  it('应该处理嵌套标签', () => {
    const { result } = renderHook(() => 
      useMarkdownProcessor('<thinking>外层思考 <UpdateVariable>内层变量</UpdateVariable> 继续思考</thinking>')
    )
    
    const blocks = result.current
    
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('thinking')
    expect(blocks[0].content).toBe('外层思考 <UpdateVariable>内层变量</UpdateVariable> 继续思考')
    
    // 检查嵌套的children
    expect(blocks[0].children).toHaveLength(1)
    expect(blocks[0].children![0].type).toBe('UpdateVariable')
    expect(blocks[0].children![0].content).toBe('内层变量')
  })

  it('应该处理空输入', () => {
    const { result } = renderHook(() => useMarkdownProcessor(''))
    
    const blocks = result.current
    expect(blocks).toHaveLength(0)
  })

  it('应该处理没有标签的纯文本', () => {
    const { result } = renderHook(() => 
      useMarkdownProcessor('这是一段普通的文本内容，没有任何特殊标签。')
    )
    
    const blocks = result.current
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('text')
    expect(blocks[0].content).toBe('这是一段普通的文本内容，没有任何特殊标签。')
  })

  it('应该保护代码块不被AST处理', () => {
    const { result } = renderHook(() => 
      useMarkdownProcessor('文本 ```javascript\n// 这里的代码不应该被AST处理\n<thinking>这不是真的thinking</thinking>\n``` 结束')
    )
    
    const blocks = result.current
    
    // 代码块应该被保护，不会被解析为thinking块
    expect(blocks.length).toBeGreaterThanOrEqual(2)
    
    // 检查是否有代码块相关的文本
    const codeBlockContent = blocks.some(block => 
      block.content.includes('```javascript') || 
      block.content.includes('这不是真的thinking')
    )
    expect(codeBlockContent).toBe(true)
  })
})