/**
 * 测试AST解析器的简单脚本
 */

// 模拟AST解析器的核心逻辑
function testASTParser() {
  console.log('=== AST解析器测试 ===')
  
  const testText = '普通文本 <thinking>这是思考内容</thinking> 更多文本'
  console.log('测试文本:', testText)
  
  // 模拟基本的词法分析
  const tokens = []
  let position = 0
  let i = 0
  
  while (i < testText.length) {
    const char = testText[i]
    
    if (char === '<') {
      // 找到标签开始
      let tagEnd = testText.indexOf('>', i)
      if (tagEnd === -1) break
      
      const tagContent = testText.substring(i, tagEnd + 1)
      tokens.push({
        type: 'TAG',
        value: tagContent,
        position: i
      })
      i = tagEnd + 1
      position = i
    } else {
      // 普通文本
      let textEnd = testText.indexOf('<', i)
      if (textEnd === -1) textEnd = testText.length
      
      const textContent = testText.substring(i, textEnd)
      if (textContent.trim()) {
        tokens.push({
          type: 'TEXT',
          value: textContent,
          position: i
        })
      }
      i = textEnd === testText.length ? textEnd : textEnd
      position = i
    }
  }
  
  console.log('解析的tokens:')
  tokens.forEach((token, index) => {
    console.log(`${index}:`, token)
  })
  
  // 模拟AST节点构建
  const nodes = []
  for (const token of tokens) {
    if (token.type === 'TAG') {
      const isThinking = token.value.includes('thinking')
      if (isThinking) {
        // 提取thinking内容
        const contentMatch = token.value.match(/<thinking>([\s\S]*?)<\/thinking>/i)
        if (contentMatch) {
          nodes.push({
            type: 'thinking',
            content: contentMatch[1],
            startPos: token.position,
            endPos: token.position + token.value.length,
            isComplete: true,
            children: [],
            rawTag: 'thinking'
          })
        }
      }
    } else if (token.type === 'TEXT') {
      nodes.push({
        type: 'text',
        content: token.value,
        startPos: token.position,
        endPos: token.position + token.value.length,
        isComplete: true,
        children: [],
        rawTag: 'text'
      })
    }
  }
  
  console.log('\n构建的AST节点:')
  nodes.forEach((node, index) => {
    console.log(`${index}:`, {
      type: node.type,
      content: node.content,
      startPos: node.startPos,
      endPos: node.endPos,
      isComplete: node.isComplete,
      rawTag: node.rawTag
    })
  })
  
  // 测试UpdateVariable
  console.log('\n=== 测试UpdateVariable ===')
  const updateVarText = '<UpdateVariable>变量内容</UpdateVariable>'
  console.log('UpdateVariable文本:', updateVarText)
  
  const updateVarMatch = updateVarText.match(/<UpdateVariable>([\s\S]*?)<\/UpdateVariable>/i)
  if (updateVarMatch) {
    console.log('UpdateVariable匹配成功:', {
      content: updateVarMatch[1],
      full: updateVarMatch[0]
    })
  } else {
    console.log('UpdateVariable匹配失败')
  }
}

testASTParser()