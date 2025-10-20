# 系统提示词变量注入功能实现指南

## 功能概述

本功能允许在系统提示词末尾自动注入当前任务的变量状态，使AI能够访问和使用任务中定义的变量，增强对话的上下文连续性和个性化。

**功能特点：**
- 🔧 实验性功能，可通过设置页面开关控制
- 📊 自动从最新消息中提取变量状态
- 💾 支持所有变量类型的JSON序列化
- 🔍 提供详细的使用格式说明
- ⚡ 完整的错误处理和日志记录

## 实现架构

### 整体架构图

```
用户界面 (ExperimentalSettings.tsx)
    ↓ 用户启用/禁用
前端状态管理 (ExtensionStateContext.tsx)
    ↓ 状态变化同步
消息传递 (WebviewMessage.ts ↔ ExtensionMessage.ts)
    ↓ 消息处理
后端处理器 (webviewMessageHandler.ts)
    ↓ 状态更新
提供者状态 (ClineProvider.ts)
    ↓ 系统提示词生成
核心注入逻辑 (system.ts + generateSystemPrompt.ts)
    ↓ 应用到AI对话
任务系统 (Task.ts)
```

### 消息流图

```
[用户操作] → [UI复选框状态变化] → [ExtensionStateContext]
    ↓
[useCallback触发] → [WebviewMessage发送] → [webviewMessageHandler]
    ↓
[updateGlobalState] → [ClineProvider状态更新] → [重新生成系统提示词]
    ↓
[SYSTEM_PROMPT函数] → [变量状态注入] → [AI获得变量信息]
```

## 实现步骤详解

### 步骤 1: 数据结构定义
**文件**: `packages/types/src/global-settings.ts`
**作用**: 定义全局配置字段，确保数据类型安全

```typescript
// 在 globalSettingsSchema 中添加
enableInjectSystemPromptVariables: z.boolean().optional(),

// 在 EVALS_SETTINGS 中添加默认值
enableInjectSystemPromptVariables: false,
```

**重要性**: ⭐⭐⭐⭐⭐
- 确保数据持久化和类型安全
- 提供默认值避免未定义错误

---

### 步骤 2: 前端状态管理
**文件**: `webview-ui/src/context/ExtensionStateContext.tsx`
**作用**: 管理前端状态和状态变化监听

```typescript
// 接口扩展
interface ExtendedExtensionState extends ExtensionState {
  enableInjectSystemPromptVariables?: boolean,
}

// 状态管理
const [enableInjectSystemPromptVariables, setEnableInjectSystemPromptVariables] = useState<boolean>(false)

// 状态监听和同步
useEffect(() => {
  if (enableInjectSystemPromptVariables !== undefined) {
    const handler = createDebouncedHandler("enableInjectSystemPromptVariables", enableInjectSystemPromptVariables)
    debouncedHandlers.current["enableInjectSystemPromptVariables"] = handler
    return () => {
      handler.cancel()
    }
  }
}, [enableInjectSystemPromptVariables])

// Getter/Setter方法
get enableInjectSystemPromptVariables() {
  return this.state.enableInjectSystemPromptVariables ?? false
}
set enableInjectSystemPromptVariables(value: boolean) {
  this.setState({ enableInjectSystemPromptVariables: value })
}
```

**重要性**: ⭐⭐⭐⭐⭐
- 管理UI状态和用户体验
- 实现防抖优化避免频繁更新
- 提供统一的状态访问接口

---

### 步骤 3: 消息类型定义
**文件**: `src/shared/WebviewMessage.ts` 和 `src/shared/ExtensionMessage.ts`
**作用**: 定义前后端通信的消息格式

```typescript
// WebviewMessage.ts
export type WebviewMessage =
  | { type: "enableInjectSystemPromptVariables", bool?: boolean }
  // ... 其他消息类型

// ExtensionMessage.ts
export type ExtensionMessage =
  | { type: "enableInjectSystemPromptVariables", bool?: boolean }
  // ... 其他消息类型
```

**重要性**: ⭐⭐⭐⭐
- 确保前后端通信协议一致
- 类型安全防止消息格式错误

---

### 步骤 4: 消息处理器
**文件**: `src/core/webview/webviewMessageHandler.ts`
**作用**: 处理从前端发来的设置更新消息

```typescript
case "enableInjectSystemPromptVariables":
  await updateGlobalState("enableInjectSystemPromptVariables", message.bool ?? false)
  break
```

**重要性**: ⭐⭐⭐⭐
- 桥接前后端通信
- 更新全局状态到持久化存储

---

### 步骤 5: 提供者状态同步
**文件**: `src/core/webview/ClineProvider.ts`
**作用**: 在三个关键位置同步状态

```typescript
// 位置1: getState方法
enableInjectSystemPromptVariables: enableInjectSystemPromptVariables ?? false,

// 位置2: Webview状态获取
const enableInjectSystemPromptVariables = state.enableInjectSystemPromptVariables ?? false

// 位置3: 状态发布到Webview
enableInjectSystemPromptVariables: enableInjectSystemPromptVariables ?? false,
```

**重要性**: ⭐⭐⭐⭐⭐
- 确保状态在所有组件间同步
- 提供统一的状态访问点

---

### 步骤 6: 用户界面控件
**文件**: `webview-ui/src/components/settings/ExperimentalSettings.tsx`
**作用**: 提供用户开关控制的UI界面

```typescript
// 状态获取和事件处理
const enableInjectSystemPromptVariables = cachedState.enableInjectSystemPromptVariables ?? false
const handleEnableInjectSystemPromptVariablesChange = useCallback((checked: boolean) => {
  dispatch({
    type: "enableInjectSystemPromptVariables",
    bool: checked,
  })
}, [dispatch])

// UI组件
<VSCodeCheckbox
  checked={enableInjectSystemPromptVariables}
  onChange={handleEnableInjectSystemPromptVariablesChange}
>
  在系统提示词末尾注入任务状态变量
</VSCodeCheckbox>
<VSCodeDescription>
  开启后会在系统提示词末尾自动注入当前任务的变量状态，让AI能够访问这些变量。
  <strong style="color: var(--vscode-errorForeground);">
    注意：这可能会增加API调用成本，因为系统提示词会变长。
  </strong>
</VSCodeDescription>
```

**重要性**: ⭐⭐⭐⭐
- 提供用户友好的操作界面
- 包含费用提醒和功能说明

---

### 步骤 7: 设置保存逻辑
**文件**: `webview-ui/src/components/settings/SettingsView.tsx`
**作用**: 处理设置的批量保存和消息发送

```typescript
// 状态解构
const { enableInjectSystemPromptVariables } = cachedState

// 消息发送和依赖数组设置
useCallback(() => {
  // ... 其他设置保存逻辑
  if (enableInjectSystemPromptVariables !== undefined) {
    vscode.postMessage({
      type: "enableInjectSystemPromptVariables",
      bool: enableInjectSystemPromptVariables,
    })
  }
  // ...
}, [
  // ... 其他依赖
  enableInjectSystemPromptVariables, // 重要：确保依赖数组完整
])
```

**重要性**: ⭐⭐⭐⭐⭐
- 确保设置正确保存到持久化存储
- 防止依赖数组遗漏导致的状态不同步

---

### 步骤 8: 核心注入逻辑 - 系统提示词函数
**文件**: `src/core/prompts/system.ts`
**作用**: 在系统提示词生成时注入变量状态

```typescript
// 新增参数
enableInjectSystemPromptVariables?: boolean,
currentTask?: any, // Task实例用于获取变量状态

// 文件式提示词注入
let filePromptWithVariableState = filePrompt
if (enableInjectSystemPromptVariables && currentTask) {
  try {
    const variableState = currentTask.getLatestVariableState()
    if (Object.keys(variableState).length > 0) {
      const variableStateSection = `

====
TASK VARIABLE STATE

The following variables are currently available and can be used in your responses:
${Object.entries(variableState)
    .map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`)
    .join('\n')}

You can reference these variables using the format: _.variableName
For example: _.userInput, _.counter, _.projectStatus, etc.

====
`
      filePromptWithVariableState = filePrompt + variableStateSection
    }
  } catch (error) {
    console.warn(`[SYSTEM_PROMPT] ❌ Failed to inject variable state into file prompt:`, error)
  }
}

// 生成式提示词注入（类似逻辑）
const generatedPrompt = await generatePrompt(...)
let promptWithVariableState = generatedPrompt
// ... 同样的注入逻辑
```

**重要性**: ⭐⭐⭐⭐⭐
- 核心功能实现，实际注入变量状态
- 支持两种系统提示词生成模式
- 包含完整的错误处理

---

### 步骤 9: 系统提示词生成器集成
**文件**: `src/core/webview/generateSystemPrompt.ts`
**作用**: 连接UI状态和核心注入逻辑

```typescript
// 状态获取
const {
  // ... 其他状态
  enableInjectSystemPromptVariables,
} = providerState

// 参数传递到SYSTEM_PROMPT函数
const systemPrompt = await SYSTEM_PROMPT(
  // ... 其他参数
  // Pass variable state injection parameters
  enableInjectSystemPromptVariables,
  currentTask,
)
```

**重要性**: ⭐⭐⭐⭐
- 连接UI状态和核心功能
- 传递必要的参数到系统提示词生成

---

### 步骤 10: 任务系统集成
**文件**: `src/core/task/Task.ts`
**作用**: 在任务系统中集成变量状态注入

```typescript
// 参数传递
const prompt = await SYSTEM_PROMPT(
  // ... 其他参数
  // Variable state injection parameters
  providerStateSnapshot.enableInjectSystemPromptVariables as boolean | undefined,
  this, // Pass current task instance
)
```

**重要性**: ⭐⭐⭐⭐
- 在任务层面集成功能
- 确保变量状态的正确传递

---

## 技术细节

### 变量状态获取机制

```typescript
// Task.ts中的getLatestVariableState方法
public getLatestVariableState(): Record<string, any> {
  try {
    // 从最新到最旧遍历消息，查找包含变量状态的消息
    for (let i = this.clineMessages.length - 1; i >= 0; i--) {
      const message = this.clineMessages[i] as any
      if (message.tool && message.tool.variableState) {
        return message.tool.variableState
      }
    }
  } catch (error) {
    console.error("Error getting latest variable state:", error)
  }
  return {}
}
```

### 注入格式说明

当功能启用且有变量状态时，会在系统提示词末尾注入以下格式的区块：

```
====
TASK VARIABLE STATE

The following variables are currently available and can be used in your responses:
- userInput: "请帮我分析这个项目"
- counter: 5
- projectStatus: "in_analysis"
- lastUpdate: "2025-10-20T12:30:00Z"

You can reference these variables using the format: _.variableName
For example: _.userInput, _.counter, _.projectStatus, etc.

====
```

### 错误处理策略

1. **变量状态获取失败**: 记录警告日志，不影响系统提示词生成
2. **类型转换错误**: 使用as类型断言，确保类型安全
3. **空变量状态**: 不注入任何内容，避免无意义的注入
4. **消息发送失败**: 使用防抖机制，避免频繁重试

## 数据流详解

### 正常流程

1. **用户操作**: 用户在设置页面启用/禁用功能
2. **状态更新**: `ExtensionStateContext` 更新本地状态
3. **防抖处理**: `useCallback` + `debounce` 避免频繁消息发送
4. **消息传递**: 发送 `WebviewMessage` 到后端
5. **消息处理**: `webviewMessageHandler` 处理消息
6. **状态持久化**: `updateGlobalState` 保存到存储
7. **状态同步**: `ClineProvider` 同步状态到所有组件
8. **系统提示词生成**: 调用 `SYSTEM_PROMPT` 函数
9. **变量状态注入**: 获取最新变量状态并注入
10. **AI对话**: AI获得包含变量信息的系统提示词

### 错误处理流程

1. **消息发送失败**: 记录错误，状态回滚
2. **变量获取失败**: 记录警告，继续生成不包含变量的系统提示词
3. **类型错误**: 使用类型断言，确保编译通过
4. **UI渲染错误**: 显示默认状态，不影响其他功能

## 开发注意事项

### 关键点

1. **依赖数组完整性**: 在 `SettingsView.tsx` 中确保所有新字段都添加到依赖数组
2. **类型安全**: 使用 TypeScript 类型定义确保类型安全
3. **错误边界**: 在关键位置添加 try-catch 错误处理
4. **状态一致性**: 确保前端和后端状态保持同步
5. **性能优化**: 使用防抖机制避免频繁状态更新

### 常见问题

1. **状态不同步**: 检查 `ClineProvider.ts` 中的状态同步是否完整
2. **类型错误**: 确保所有文件中的类型定义一致
3. **功能不生效**: 检查消息传递链路是否完整
4. **UI更新延迟**: 检查防抖时间设置是否合理

## 测试验证

### 功能测试

1. **UI测试**: 验证设置页面复选框功能正常
2. **状态同步测试**: 验证启用/禁用后状态正确保存
3. **系统提示词测试**: 验证有变量时正确注入
4. **空状态测试**: 验证无变量时不注入内容
5. **错误恢复测试**: 验证各种错误情况下的恢复能力

### 日志监控

关键日志标识符：
- `[generateSystemPrompt] ✅ Injected variable state`
- `[SYSTEM_PROMPT] ✅ Injected variable state`
- `[SYSTEM_PROMPT] ℹ️ No variable state available`
- `[SYSTEM_PROMPT] ❌ Failed to inject variable state`

## 总结

本功能实现涉及 **10个核心步骤**，修改了 **8个关键文件**，实现了完整的数据流从用户界面到AI对话的端到端集成。通过严格遵循数据流实现模式，确保了功能的可靠性、类型安全性和用户体验。

**核心价值：**
- 🎯 增强AI对话的上下文连续性
- 🔧 提供灵活的实验性功能控制
- 📊 支持复杂的变量状态管理
- 🛡️ 完善的错误处理和类型安全
- 📝 详细的使用说明和文档支持