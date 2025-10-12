/**
 * 调试记忆工具参数传递问题
 * 对比提问工具和记忆工具的参数结构
 */

// 模拟 askFollowupQuestionTool 的参数结构（正常工作）
const askFollowupBlock = {
	type: "tool_use",
	name: "ask_followup_question",
	params: {
		question: "这是一个测试问题？",
		follow_up: "<suggest>选项1</suggest><suggest>选项2</suggest>"
	}
}

console.log("=== 提问工具参数结构（正常工作）===")
console.log("block.params:", askFollowupBlock.params)
console.log("block.params.question:", askFollowupBlock.params.question)
console.log("block.params.follow_up:", askFollowupBlock.params.follow_up)
console.log()

// 模拟 addEpisodicMemoryTool 的参数结构（可能的问题）
// 情况1: 参数被包装在 args 字符串中
const episodicMemoryBlock1 = {
	type: "tool_use",
	name: "add_episodic_memory",
	params: {
		args: "<xml_memory><memory><content>测试内容</content></memory></xml_memory>"
	}
}

console.log("=== 记忆工具参数结构 - 情况1（args包装）===")
console.log("block.params:", episodicMemoryBlock1.params)
console.log("block.params.xml_memory:", episodicMemoryBlock1.params.xml_memory)
console.log("block.params.user_message:", episodicMemoryBlock1.params.user_message)
console.log("block.params.args:", episodicMemoryBlock1.params.args)
console.log("block.params.args 类型:", typeof episodicMemoryBlock1.params.args)
console.log("block.params.args 长度:", episodicMemoryBlock1.params.args?.length || 0)
console.log()

// 情况2: 参数正确解析（期望的结构）
const episodicMemoryBlock2 = {
	type: "tool_use",
	name: "add_episodic_memory",
	params: {
		xml_memory: "<memory><content>测试内容</content></memory>",
		user_message: "我记住了这个重要信息"
	}
}

console.log("=== 记忆工具参数结构 - 情况2（正确结构）===")
console.log("block.params:", episodicMemoryBlock2.params)
console.log("block.params.xml_memory:", episodicMemoryBlock2.params.xml_memory)
console.log("block.params.user_message:", episodicMemoryBlock2.params.user_message)
console.log()

// 情况3: 参数被错误包装（根据调试日志推测）
const episodicMemoryBlock3 = {
	type: "tool_use",
	name: "add_episodic_memory",
	params: {
		args: "xml_memory user_message" // 69个字符的字符串，可能只包含参数名
	}
}

console.log("=== 记忆工具参数结构 - 情况3（可能的错误结构）===")
console.log("block.params:", episodicMemoryBlock3.params)
console.log("block.params.args:", episodicMemoryBlock3.params.args)
console.log("block.params.args 类型:", typeof episodicMemoryBlock3.params.args)
console.log("block.params.args 长度:", episodicMemoryBlock3.params.args.length)
console.log()

// 分析：根据调试日志
console.log("=== 根据实际调试日志分析 ===")
console.log("调试日志显示:")
console.log("1. block.params.args 是一个字符串")
console.log("2. block.params.args 长度为 69")
console.log("3. 直接访问 block.params.xml_memory 和 block.params.user_message 都是 undefined")
console.log()
console.log("可能的原因:")
console.log("1. 模型输出的 XML 格式不正确，导致参数解析失败")
console.log("2. 参数被错误地包装成了一个字符串")
console.log("3. 工具定义与实际调用格式不匹配")
console.log()
console.log("解决方案:")
console.log("1. 检查系统提示词中记忆工具的定义格式")
console.log("2. 确保模型输出正确的 XML 格式")
console.log("3. 修改参数解析逻辑以处理包装情况")

// 测试字符串长度
const testString1 = "xml_memory user_message"
const testString2 = "<xml_memory>content</xml_memory><user_message>message</user_message>"
console.log()
console.log("=== 字符串长度测试 ===")
console.log(`"${testString1}" 长度:`, testString1.length)
console.log(`"${testString2}" 长度:`, testString2.length)
