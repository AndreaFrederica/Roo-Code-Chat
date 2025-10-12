/**
 * 测试记忆工具参数传递
 * 这个脚本用于验证工具参数的传递是否正确
 */

console.log("=== 记忆工具参数传递测试 ===\n")

// 模拟工具定义
const addSemanticMemoryTool = {
	name: "add_semantic_memory",
	parameters: {
		properties: {
			xml_memory: {
				type: "string",
				description: "XML格式的记忆数据，包含完整的语义记忆信息。格式：<memory><content>语义记忆内容</content><keywords>关键词1,关键词2</keywords><priority>80</priority><is_constant>false</is_constant><tags>标签1,标签2</tags><source>用户告知</source></memory>",
			},
			user_message: {
				type: "string",
				description: "AI告诉用户的提示词，用于提升用户体验。例如：'我记下了这个重要的信息'",
			},
		},
		required: ["xml_memory", "user_message"],
	}
}

// 模拟模型调用
console.log("1. 工具定义检查:")
console.log(`工具名称: ${addSemanticMemoryTool.name}`)
console.log(`必需参数: ${addSemanticMemoryTool.parameters.required.join(", ")}`)
console.log(`参数属性:`, Object.keys(addSemanticMemoryTool.parameters.properties))
console.log("")

console.log("2. 参数名称匹配检查:")
const expectedParams = ["xml_memory", "user_message"]
const actualParams = Object.keys(addSemanticMemoryTool.parameters.properties)

const paramsMatch = expectedParams.every(param => actualParams.includes(param))
console.log(`参数名称是否匹配: ${paramsMatch}`)
console.log("")

console.log("3. 模拟正确的模型调用格式:")
const correctModelCall = {
	tool_name: "add_semantic_memory",
	parameters: {
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

console.log("正确的调用格式:")
console.log(JSON.stringify(correctModelCall, null, 2))
console.log("")

console.log("4. 可能的问题分析:")
console.log("- 模型可能使用了错误的参数名")
console.log("- 模型可能没有正确生成XML格式")
console.log("- 模型可能将参数传递为undefined")
console.log("- 工具定义和描述可能不匹配")
console.log("")

console.log("5. 建议的调试步骤:")
console.log("1. 检查控制台输出中的调试信息")
console.log("2. 确认模型调用的参数名称")
console.log("3. 验证XML格式是否正确")
console.log("4. 检查工具注册是否正确")
console.log("")

console.log("=== 测试完成 ===")