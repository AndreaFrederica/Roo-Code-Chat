/**
 * 调试 block.params 的真实结构
 * 根据调试信息：block.params keys: args
 */

console.log("=== 调试 block.params 结构 ===\n")

// 根据实际调试信息，block.params 的结构是：
const actualBlockParams = {
  args: {
    xml_memory: "<memory>...</memory>",
    user_message: "我记下了这个信息"
  }
}

console.log("实际的 block.params 结构:")
console.log(JSON.stringify(actualBlockParams, null, 2))

console.log("\n这意味着:")
console.log("1. block.params.xml_memory = undefined ❌")
console.log("2. block.params.args.xml_memory = '<memory>...</memory>' ✅")

console.log("\n所以正确的访问方式是:")
console.log("const xml_memory = block.params.args.xml_memory")
console.log("const user_message = block.params.args.user_message")

console.log("\n我的函数式实现中的逻辑:")
console.log("if (!xml_memory && (block.params as any).args) {")
console.log("    xml_memory = (block.params as any).args.xml_memory")
console.log("    user_message = (block.params as any).args.user_message")
console.log("}")

console.log("\n这个逻辑是正确的，但为什么还是 undefined？")
console.log("可能的原因:")
console.log("1. (block.params as any).args 本身就是 undefined")
console.log("2. 参数格式比预期的更复杂")
console.log("3. 模型调用时参数传递有问题")

console.log("\n建议在函数式实现中添加更详细的调试:")
console.log("console.log('block.params 完整对象:', JSON.stringify(block.params, null, 2))")
console.log("console.log('block.params.args 类型:', typeof (block.params as any).args)")
console.log("console.log('block.params.args 内容:', (block.params as any).args)")