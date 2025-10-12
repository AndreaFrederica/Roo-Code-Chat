# 记忆工具参数丢失问题分析报告

## 问题描述

记忆工具（add_episodic_memory）在调用时遇到参数丢失问题:
- `block.params.xml_memory` 和 `block.params.user_message` 都返回 `undefined`
- 但 `block.params.args` 存在,是一个长度为69的字符串
- 提问工具（ask_followup_question）在相同的调用方式下能正常获取参数

## 代码对比分析

### 1. 提问工具的参数获取（正常工作）

**文件**: `src/core/tools/askFollowupQuestionTool.ts`

```typescript
export async function askFollowupQuestionTool(
	cline: Task,
	block: ToolUse,
	// ... 其他参数
) {
	// ✅ 直接从 block.params 获取参数
	const question: string | undefined = block.params.question
	const follow_up: string | undefined = block.params.follow_up
	
	// 参数验证
	if (!question) {
		cline.consecutiveMistakeCount++
		pushToolResult(await cline.sayAndCreateMissingParamError("ask_followup_question", "question"))
		return
	}
	
	// ... 后续处理
}
```

**关键特征**:
- 直接访问 `block.params.question`
- 没有使用 `args` 包装
- 参数验证简单直接

### 2. 记忆工具的参数获取（参数丢失）

**文件**: `src/core/tools/memoryTools/addEpisodicMemoryTool.ts`

```typescript
export async function addEpisodicMemoryFunction(
	cline: Task,
	block: ToolUse
): Promise<{ success: boolean; message?: string; error?: string; memoryId?: string }> {
	// ❌ 尝试直接获取,但失败
	let xml_memory: string | undefined = (block.params as any).xml_memory
	let user_message: string | undefined = (block.params as any).user_message

	console.log(`[MemoryTool Debug] block.params keys: ${Object.keys(block.params || {})}`)
	// 输出: args
	
	console.log(`[MemoryTool Debug] 直接访问 xml_memory:`, xml_memory ? "✅ 存在" : "❌ 不存在")
	// 输出: ❌ 不存在
	
	console.log(`[MemoryTool Debug] block.params.args 类型:`, typeof rawArgs)
	// 输出: string
	
	console.log(`[MemoryTool Debug] block.params.args 长度:`, rawArgs.length)
	// 输出: 69
	
	// ... 后续尝试从 args 中解析
}
```

**调试日志输出**:
```
[MemoryTool Debug] addEpisodicMemoryFunction called
[MemoryTool Debug] block.params keys: args
[MemoryTool Debug] 直接访问 xml_memory: ❌ 不存在
[MemoryTool Debug] 直接访问 user_message: ❌ 不存在
[MemoryTool Debug] block.params.args 类型: string
[MemoryTool Debug] block.params.args 长度: 69
[MemoryTool Debug] 最终 xml_memory: undefined
[MemoryTool Debug] 最终 user_message: undefined
```

### 3. presentAssistantMessage.ts 中的调用（调用方式相同）

**文件**: `src/core/assistant-message/presentAssistantMessage.ts`

```typescript
// 提问工具的调用
case "ask_followup_question":
	await askFollowupQuestionTool(
		cline,
		block,  // ✅ 传递相同的 block 对象
		askApproval,
		handleError,
		pushToolResult,
		removeClosingTag,
	)
	break

// 记忆工具的调用
case "add_episodic_memory":
	try {
		const result = await addEpisodicMemoryFunction(cline, block) // ✅ 传递相同的 block 对象
		// ... 结果处理
	} catch (error) {
		// ... 错误处理
	}
	break
```

**关键发现**: 两个工具的调用方式完全相同,都是传递 `block` 对象,但参数结构却不同!

## 根本原因分析

### 问题1: 参数包装方式不一致

根据调试日志,记忆工具收到的 `block.params` 结构是:
```typescript
{
  args: "<xml_memory>...</xml_memory><user_message>...</user_message>" // 69个字符的字符串
}
```

而提问工具收到的 `block.params` 结构是:
```typescript
{
  question: "问题内容",
  follow_up: "跟进内容"
}
```

### 问题2: 可能的原因

1. **模型输出格式不同**: 
   - 提问工具: 模型可能直接输出参数标签,被正确解析
   - 记忆工具: 模型输出被包装在 `args` 标签中

2. **工具定义差异**:
   需要检查两个工具在系统提示词中的定义是否有差异

3. **参数解析器行为**:
   可能对某些工具名称或参数类型有特殊处理

## 需要进一步检查的内容

### 1. 检查系统提示词中的工具定义

需要查看 `src/core/prompts/tools/memory-tools.ts` 和其他工具定义,对比:
- 参数定义格式
- 示例用法
- XML 格式说明

### 2. 检查参数解析逻辑

需要找到将模型输出解析为 `block.params` 的代码,了解:
- 何时参数被解析为对象
- 何时参数被包装在 `args` 中
- 是否有特殊的工具名称或参数名称处理

### 3. 检查 ToolUse 类型定义

需要查看 `ToolUse` 类型的定义,了解 `params` 的预期结构。

## 临时解决方案

在当前的 `addEpisodicMemoryTool.ts` 中已经实现了多层解析逻辑:
1. 首先尝试直接从 `block.params` 获取
2. 如果失败,从 `block.params.args` 通过 `normalizeToolArgs` 解析
3. 如果仍失败,使用正则表达式从字符串中提取

但这些方法都没有成功,说明 `block.params.args` 的字符串格式可能不符合预期。

## 下一步行动

1. ✅ 查看工具定义文件,对比提问工具和记忆工具的定义差异
2. ✅ 创建调试脚本模拟不同的参数结构
3. ⬜ 找到参数解析的源代码
4. ⬜ 确定为什么某些工具参数被包装在 `args` 中
5. ⬜ 实现统一的参数处理方案

## 结论

问题的根本原因是:
- **记忆工具的参数被错误地包装在 `block.params.args` 字符串中**
- **而提问工具的参数被正确解析为 `block.params` 的直接属性**

这种不一致可能源于:
1. 工具定义格式差异
2. 参数解析器对不同工具的特殊处理
3. 模型输出的 XML 格式差异

需要进一步调查参数解析逻辑和工具定义,才能找到根本的修复方案。
