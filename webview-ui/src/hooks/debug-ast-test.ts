/**
 * 调试AST处理的测试文件
 */

import { parseTextToAST } from '@/components/common/ast-parser'
import { TagRule } from '@/components/common/ast-fold-types'

// 简单的测试
const testText = '普通文本 <thinking>这是思考内容</thinking> 更多文本'

// 创建基本的TagRule
const tagRules: TagRule[] = [
  {
    names: ['thinking', '思考', 'think', 'Think'],
    type: 'thinking',
    defaultCollapsed: true,
    isBlockLevel: true
  },
  {
    names: ['UpdateVariable'],
    type: 'UpdateVariable',
    defaultCollapsed: false,
    isBlockLevel: true
  }
]

console.log('=== AST调试测试 ===')
console.log('输入文本:', testText)
console.log('TagRules:', tagRules)

try {
  const astNodes = parseTextToAST(testText, tagRules)
  console.log('解析结果:')
  console.log('节点数量:', astNodes.length)
  
  astNodes.forEach((node, index) => {
    console.log(`节点 ${index}:`, {
      type: node.type,
      content: node.content,
      startPos: node.startPos,
      endPos: node.endPos,
      isComplete: node.isComplete,
      rawTag: node.rawTag,
      children: node.children
    })
  })
} catch (error) {
  console.error('AST解析失败:', error)
}