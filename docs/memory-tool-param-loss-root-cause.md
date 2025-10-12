# 记忆工具参数丢失问题 - 根本原因分析

## 问题描述

调试日志显示:
```
[MemoryTool Debug] block.params keys: args
[MemoryTool Debug] 直接访问 xml_memory: ❌ 不存在
[MemoryTool Debug] 直接访问 user_message: ❌ 不存在
[MemoryTool Debug] block.params.args 类型: string
[MemoryTool Debug] block.params.args 长度: 69
```

## 根本原因

**AI模型生成了错误的工具调用格式！**

### 预期格式 vs 实际格式

**预期的工具调用格式** (根据memory-tools.ts定义):
```xml
<add_episodic_memory>
<xml_memory>
<memory>
  <content>记忆内容</content>
  <keywords>关键词</keywords>
</memory>
</xml_memory>
<user_message>提示词</user_message>
</add_episodic_memory>
```

**AI实际生成的格式** (根据调试日志推断):
```xml
<add_episodic_memory>
<args>...69个字符的内容...</args>
</add_episodic_memory>
```

### 证据链

1. **调试日志显示** `block.params` 只有 `args` 键
2. **XML解析器逻辑** (`parseAssistantMessage.ts`) 正确工作
   - 解析器会寻找 `toolParamNames` 中定义的参数标签
   - `xml_memory` 和 `user_message` 都在 `toolParamNames` 中定义
   - 但解析器却找到了 `args` 标签
3. **对比其他工具**:
   - `ask_followup_question`: 使用直接参数 (`question`, `follow_up`)
   - `read_file`: 使用 `args` 包装嵌套XML
   - 记忆工具定义: 使用直接参数 (`xml_memory`, `user_message`)

### 为什么AI会使用args?

对比 `read_file` 工具的定义:

```typescript
// read_file工具定义
Parameters:
- args: Contains one or more file elements

Usage:
<read_file>
<args>
  <file>
    <path>path/to/file</path>
  </file>
</args>
</read_file>
```

**关键发现**: `read_file` 工具明确使用 `args` 参数来包装嵌套的XML结构！

记忆工具也包含嵌套的XML (`<memory>` 标签内嵌在 `<xml_memory>` 中)，AI模型可能因此混淆，认为也应该使用 `args` 包装。

## 问题原因总结

1. **工具定义不一致**:
   - `read_file`: 使用 `args` 包装嵌套XML
   - 记忆工具: 直接使用 `xml_memory` 参数
   
2. **AI模型的推理**:
   - 看到嵌套XML结构
   - 参考 `read_file` 的模式
   - 错误地使用 `args` 包装

3. **系统提示词的混淆**:
   - 系统中存在使用 `args` 的工具示例
   - 记忆工具的定义没有明确说明不要使用 `args`

## 解决方案

### 方案1: 修改记忆工具定义使用args (推荐)

**优点**:
- 与 `read_file` 等工具保持一致
- 符合"嵌套XML用args包装"的模式
- 不需要修改AI的行为

**实施**:
修改 `src/core/prompts/tools/memory-tools.ts`，改用 `args` 参数:

```typescript
Parameters:
- args: Contains the memory data in XML format

Usage:
<add_episodic_memory>
<args>
  <xml_memory>
    <memory>
      <content>记忆内容</content>
    </memory>
  </xml_memory>
  <user_message>提示词</user_message>
</args>
</add_episodic_memory>
```

### 方案2: 修改工具实现支持两种格式

**优点**:
- 向后兼容
- 无需修改工具定义

**实施**:
修改记忆工具实现，同时支持:
- 直接参数: `block.params.xml_memory`
- args包装: `block.params.args` (解析XML获取xml_memory)

### 方案3: 强化系统提示词

**优点**:
- 保持当前定义
- 通过提示词修正AI行为

**缺点**:
- 不能保证100%生效
- 增加提示词复杂度

## 对比分析

| 工具 | 参数格式 | 是否嵌套XML | 使用args |
|------|---------|------------|----------|
| ask_followup_question | question, follow_up | 是(但简单) | ❌ |
| read_file | args | 是(复杂嵌套) | ✅ |
| add_episodic_memory | xml_memory, user_message | 是(复杂嵌套) | ❌ (定义) ✅ (实际) |

**结论**: 复杂嵌套XML应该使用 `args` 包装，这是系统的约定俗成模式。

## 建议

立即实施**方案1**:
1. 修改所有记忆工具的定义，改用 `args` 参数
2. 修改工具实现，从 `args` 中解析参数
3. 保持与 `read_file` 等工具的一致性
