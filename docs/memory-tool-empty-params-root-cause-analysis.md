# Memory Tool 参数为空的根本原因分析

## 问题描述

`add_semantic_memory` 工具在调用时收到空的 `block.params`：

```javascript
{
  type: "tool_use",
  name: "add_semantic_memory",
  params: {},  // 空对象！
  partial: true,
}
```

## 根本原因分析

### 1. 工具调用流程回顾

工具调用的完整流程是：
1. AI 模型生成工具调用文本（XML 格式）
2. `AssistantMessageParser` 解析 XML 文本，构建 `ToolUse` 对象
3. `presentAssistantMessage` 接收完整的 `ToolUse` 对象
4. 调用具体的工具函数（如 `addSemanticMemoryFunction`）

### 2. 问题定位

通过分析代码，问题出现在 **步骤 2**：`AssistantMessageParser` 解析 XML 时没有正确处理参数。

#### 关键代码分析

在 `AssistantMessageParser.ts` 中：

```typescript
// 参数解析逻辑
if (this.currentToolUse && this.currentParamName) {
    const currentParamValue = this.accumulator.slice(this.currentParamValueStartIndex)
    if (currentParamValue.length > this.MAX_PARAM_LENGTH) {
        // Reset to a safe state
        this.currentParamName = undefined
        this.currentParamValueStartIndex = 0
        continue
    }
    const paramClosingTag = `</${this.currentParamName}>`
    // Streamed param content: always write the currently accumulated value
    if (currentParamValue.endsWith(paramClosingTag)) {
        // End of param value.
        const paramValue = currentParamValue.slice(0, -paramClosingTag.length)
        this.currentToolUse.params[this.currentParamName] =
            this.currentParamName === "content"
                ? paramValue.replace(/^\n/, "").replace(/\n$/, "")
                : paramValue.trim()
        this.currentParamName = undefined
        continue
    } else {
        // Partial param value is accumulating.
        // Write the currently accumulated param content in real time
        this.currentToolUse.params[this.currentParamName] = currentParamValue
        continue
    }
}
```

#### 参数识别逻辑

```typescript
// 识别参数开始标签
const possibleParamOpeningTags = toolParamNames.map((name) => `<${name}>`)
for (const paramOpeningTag of possibleParamOpeningTags) {
    if (this.accumulator.endsWith(paramOpeningTag)) {
        // Start of a new parameter.
        const paramName = paramOpeningTag.slice(1, -1)
        if (!toolParamNames.includes(paramName as ToolParamName)) {
            // Handle invalid parameter name gracefully
            continue
        }
        this.currentParamName = paramName as ToolParamName
        this.currentParamValueStartIndex = this.accumulator.length
        break
    }
}
```

### 3. 核心问题

**问题**：`toolParamNames` 中没有包含 `add_semantic_memory` 工具的参数名称！

#### 验证问题

1. `add_semantic_memory` 工具定义的参数：
   - `xml_memory`
   - `user_message`

2. 但 `toolParamNames`（来自 `@roo-code/types`）可能不包含这些自定义参数名

3. 当解析器遇到 `<xml_memory>` 标签时：
   - 检查 `xml_memory` 是否在 `toolParamNames` 中
   - 如果不在，跳过该参数
   - 结果：参数被忽略，`params` 保持为空对象

### 4. 为什么会出现 `partial: true`

`partial: true` 表示工具调用还没有完全解析完成，因为：
- 参数没有正确识别
- 解析器等待更多内容来完成工具调用
- 但由于参数名不在允许列表中，永远不会完成

## 解决方案

### 方案 1：扩展 toolParamNames（推荐）

在 `@roo-code/types` 包中添加内存工具的参数名：

```typescript
// 在 toolParamNames 中添加
"xml_memory",
"user_message",
"search_text",
"memory_type",
// ... 其他内存工具参数
```

### 方案 2：自定义参数解析

在 `AssistantMessageParser` 中为内存工具添加特殊的参数处理逻辑：

```typescript
// 在 getKnownToolNames() 附近添加
private getMemoryToolParamNames(): string[] {
    if (this.currentToolUse?.name?.startsWith('add_') || 
        this.currentToolUse?.name?.startsWith('search_') ||
        this.currentToolUse?.name?.startsWith('get_') ||
        this.currentToolUse?.name?.startsWith('cleanup_')) {
        return ["xml_memory", "user_message", "search_text", "memory_type"]
    }
    return []
}

// 在参数识别逻辑中添加
const memoryToolParams = this.getMemoryToolParamNames()
const allPossibleParams = [...toolParamNames, ...memoryToolParams]
const possibleParamOpeningTags = allPossibleParams.map((name) => `<${name}>`)
```

### 方案 3：修复工具调用格式

确保 AI 模型生成的工具调用使用正确的参数格式，或者使用标准的参数名称。

## 临时解决方案

在 `addSemanticMemoryFunction` 中添加更好的错误处理：

```typescript
export async function addSemanticMemoryFunction(
    cline: Task,
    block: ToolUse
): Promise<{ success: boolean; message?: string; error?: string; memoryId?: string }> {
    
    // 详细的调试日志
    console.log(`[MemoryTool Debug] addSemanticMemoryFunction called`)
    console.log(`[MemoryTool Debug] block.params keys: ${Object.keys(block.params || {})}`)
    console.log(`[MemoryTool Debug] block.params:`, JSON.stringify(block.params, null, 2))
    console.log(`[MemoryTool Debug] block.partial:`, block.partial)
    
    // 检查参数是否为空
    if (!block.params || Object.keys(block.params).length === 0) {
        const errorMsg = "工具调用参数为空。这可能是由于参数解析问题导致的。请尝试重新生成工具调用。"
        return {
            success: false,
            error: errorMsg
        }
    }
    
    // 继续现有逻辑...
}
```

## 验证步骤

1. **检查 toolParamNames**：确认内存工具的参数名是否在允许列表中
2. **添加调试日志**：在 `AssistantMessageParser` 中添加参数识别的调试日志
3. **测试工具调用**：生成一个简单的 `add_semantic_memory` 调用，观察解析过程
4. **对比其他工具**：查看其他正常工作的工具是如何处理参数的

## 影响范围

这个问题可能影响：
- 所有自定义工具（如果参数名不在标准列表中）
- 特别是内存工具，因为它们使用了非标准的参数名称
- 其他使用自定义参数的工具

## 优先级

**高优先级** - 这会导致内存工具完全无法工作，需要尽快修复。

## 相关文件

- `src/core/assistant-message/AssistantMessageParser.ts`
- `packages/types/src/tools.ts`（可能）
- `src/core/tools/memoryTools/addSemanticMemoryTool.ts`
- `src/core/assistant-message/presentAssistantMessage.ts`
