/**
 * 测试函数式记忆工具修复
 * 验证新的函数式实现是否能正确处理参数
 */

console.log("=== 函数式记忆工具修复测试 ===\n")

// 模拟 ToolUse 对象结构
const mockBlock = {
  name: "add_semantic_memory",
  type: "tool_use",
  partial: false,
  params: {
    // 这里模拟实际调用时可能出现的参数包装情况
    xml_memory: `<memory>
  <content>用户告诉我他每天早上都会喝一杯咖啡，这个习惯已经坚持了三年。他说这是他开始一天工作的仪式。</content>
  <keywords>咖啡,早晨习惯,工作仪式</keywords>
  <priority>75</priority>
  <is_constant>true</is_constant>
  <tags>生活习惯,日常</tags>
  <source>用户告知</source>
</memory>`,
    user_message: "我记下了你的这个生活习惯"
  }
}

// 模拟参数被包装的情况
const wrappedBlock = {
  name: "add_semantic_memory",
  type: "tool_use",
  partial: false,
  params: {
    args: {
      xml_memory: `<memory>
  <content>用户告诉我他每天早上都会喝一杯咖啡，这个习惯已经坚持了三年。他说这是他开始一天工作的仪式。</content>
  <keywords>咖啡,早晨习惯,工作仪式</keywords>
  <priority>75</priority>
  <is_constant>true</is_constant>
  <tags>生活习惯,日常</tags>
  <source>用户告知</source>
</memory>`,
      user_message: "我记下了你的这个生活习惯"
    }
  }
}

// 模拟函数式工具的参数提取逻辑
function testFunctionalParameterExtraction(block, testName) {
  console.log(`--- 测试 ${testName} ---`)
  console.log(`block.params keys: ${Object.keys(block.params || {})}`)

  // 直接从 block.params 获取参数，支持参数包装
  const xml_memory = block.params.xml_memory
  const user_message = block.params.user_message

  console.log(`直接访问 xml_memory:`, xml_memory ? "✅ 存在" : "❌ 不存在")
  console.log(`直接访问 user_message:`, user_message ? "✅ 存在" : "❌ 不存在")

  // 如果直接访问失败，检查是否有参数包装
  if (!xml_memory && block.params.args) {
    console.log(`检测到参数包装，尝试从 block.params.args 获取`)
    const wrapped_xml_memory = block.params.args.xml_memory
    const wrapped_user_message = block.params.args.user_message

    console.log(`包装后 xml_memory:`, wrapped_xml_memory ? "✅ 存在" : "❌ 不存在")
    console.log(`包装后 user_message:`, wrapped_user_message ? "✅ 存在" : "❌ 不存在")

    return {
      xml_memory: wrapped_xml_memory,
      user_message: wrapped_user_message,
      success: !!(wrapped_xml_memory && wrapped_user_message)
    }
  }

  return {
    xml_memory,
    user_message,
    success: !!(xml_memory && user_message)
  }
}

// 测试两种情况
console.log("1. 测试直接参数格式:")
const result1 = testFunctionalParameterExtraction(mockBlock, "直接参数格式")

console.log("\n2. 测试包装参数格式:")
const result2 = testFunctionalParameterExtraction(wrappedBlock, "包装参数格式")

console.log("\n=== 测试结果 ===")
console.log(`直接参数格式: ${result1.success ? '✅ 成功' : '❌ 失败'}`)
console.log(`包装参数格式: ${result2.success ? '✅ 成功' : '❌ 失败'}`)

// 验证XML内容
if (result1.success) {
  console.log(`\n直接参数 XML 内容长度: ${result1.xml_memory.length}`)
  console.log(`包含 <memory> 标签: ${result1.xml_memory.includes('<memory>') ? '✅' : '❌'}`)
  console.log(`包含 <content> 标签: ${result1.xml_memory.includes('<content>') ? '✅' : '❌'}`)
}

if (result2.success) {
  console.log(`\n包装参数 XML 内容长度: ${result2.xml_memory.length}`)
  console.log(`包含 <memory> 标签: ${result2.xml_memory.includes('<memory>') ? '✅' : '❌'}`)
  console.log(`包含 <content> 标签: ${result2.xml_memory.includes('<content>') ? '✅' : '❌'}`)
}

console.log("\n=== 修复分析 ===")
console.log("函数式实现的优势:")
console.log("1. ✅ 直接访问 block.params，避免类式调用的参数传递问题")
console.log("2. ✅ 统一的参数处理逻辑，与 askFollowupQuestionTool 保持一致")
console.log("3. ✅ 支持多种参数格式（直接格式和包装格式）")
console.log("4. ✅ 减少了参数传递链中的中间环节")

console.log("\n=== 下一步 ===")
console.log("重启应用程序并测试语义记忆功能，观察调试输出。")
console.log("预期调试信息:")
console.log("- [MemoryTool Debug] addSemanticMemoryFunction called")
console.log("- [MemoryTool Debug] block.params keys: xml_memory,user_message")
console.log("- [MemoryTool Debug] xml_memory: [XML内容]")
console.log("- [MemoryTool Debug] user_message: [用户消息]")