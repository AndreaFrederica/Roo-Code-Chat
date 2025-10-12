# Memory Tool 调试总结

## 问题回顾

`add_semantic_memory` 工具在调用时收到空的 `block.params`：

```javascript
{
  type: "tool_use",
  name: "add_semantic_memory",
  params: {},  // 空对象！
  partial: true,
}
```

## 调试过程

### 1. 初步假设 - toolParamNames 缺失
**假设**: `toolParamNames` 中没有包含内存工具的参数名

**验证结果**: ❌ 假设错误
- 在 `src/shared/tools.ts` 中发现 `toolParamNames` 已经包含了所有内存工具参数：
  ```typescript
  "xml_memory",
  "user_message", 
  "xml_traits",
  "xml_goals",
  "search_text",
  "memory_types",
  // ... 等等
  ```

### 2. 参数解析逻辑测试
**测试**: 创建了 `debug-assistant-message-parser.js` 来模拟参数解析逻辑

**结果**: ✅ 解析逻辑正常
- 模拟的 XML 解析成功识别了 `xml_memory` 和 `user_message` 参数
- 参数值正确提取
- `partial` 状态正确设置为 `false`

### 3. 添加调试日志
**行动**: 在 `AssistantMessageParser.processChunk` 中添加了详细的调试日志

**目的**: 追踪实际的解析过程，找出为什么真实场景下参数为空

## 当前状态

### 已完成的调试工作
1. ✅ 确认 `toolParamNames` 包含所有必要的参数名
2. ✅ 验证参数解析逻辑本身是正确的
3. ✅ 添加了调试日志到 `AssistantMessageParser`
4. ✅ 创建了调试脚本来模拟解析过程

### 剩余的调试步骤
1. 🔄 测试真实的工具调用场景
2. 🔄 分析 AI 模型生成的原始 XML 内容
3. 🔄 检查流式传输是否影响 XML 解析
4. 🔄 验证工具名称识别是否正常

## 可能的根本原因

基于当前的调试结果，问题可能在于：

### 1. 流式传输问题
- XML 标签在流式传输中被分割
- 参数开始标签 `<xml_memory>` 和结束标签 `</xml_memory>` 可能在不同的 chunk 中
- 解析器可能在等待完整的标签时出现问题

### 2. AI 生成的 XML 格式问题
- AI 可能生成了格式不正确的 XML
- 标签可能缺少闭合标签
- 可能存在特殊字符或编码问题

### 3. 工具名称识别问题
- `add_semantic_memory` 可能没有被正确识别为有效工具
- 这可能导致整个工具调用被忽略或错误处理

### 4. 时序问题
- 工具调用可能在完全解析完成之前就被传递给了 `presentAssistantMessage`
- `partial: true` 状态表明解析还没有完成

## 下一步行动

### 立即行动
1. **测试调试版本**: 使用添加了调试日志的版本测试真实的内存工具调用
2. **收集日志**: 观察 `[AMP Debug]` 日志输出，了解实际的解析过程
3. **对比分析**: 将真实场景与模拟场景进行对比

### 如果调试日志显示问题
1. **流式传输问题**: 可能需要修改解析逻辑以更好地处理跨 chunk 的标签
2. **XML 格式问题**: 可能需要在 AI prompt 中改进工具调用的格式指导
3. **工具识别问题**: 可能需要检查 `toolNames` 列表或工具注册逻辑

### 临时解决方案
如果问题复杂且需要时间修复，可以考虑：
1. 在 `addSemanticMemoryFunction` 中添加更好的错误处理
2. 提供更友好的错误信息给用户
3. 实现参数重试机制

## 技术细节

### 关键文件
- `src/core/assistant-message/AssistantMessageParser.ts` - 参数解析逻辑
- `src/shared/tools.ts` - 参数名定义
- `src/core/assistant-message/presentAssistantMessage.ts` - 工具调用处理
- `src/core/tools/memoryTools/addSemanticMemoryTool.ts` - 工具实现

### 调试日志
添加的调试日志会显示：
- 每个字符处理时的状态
- 参数识别过程
- 工具名称验证
- 参数值提取过程

### 测试脚本
- `debug-assistant-message-parser.js` - 模拟解析逻辑
- 可以用来测试不同的 XML 格式和边缘情况

## 结论

问题不在于参数名定义或基本的解析逻辑，而更可能在于流式传输、XML 格式或时序问题。添加的调试日志将帮助我们准确定位问题所在。

下一步是使用调试版本测试真实的工具调用场景，收集实际的解析日志来进一步分析问题。
