# 完全自定义 User-Agent 功能实现文档

## 概述

本文档记录了在 RooCode 中实现完全自定义 User-Agent 功能的详细过程。该功能允许用户选择两种自定义 User-Agent 模式：
1. **分段模式（segments）**：在默认 User-Agent 基础上添加自定义内容
2. **完全自定义模式（full）**：完全替换默认 User-Agent

## 实现时间
2024年12月

## 功能特性

### 1. 两种自定义模式
- **分段模式**：保持原有行为，在默认 `RooCode/${version}` 基础上添加自定义内容
- **完全自定义模式**：允许用户完全控制 User-Agent 字符串，不包含任何默认内容

### 2. 用户界面改进
- 添加了模式选择开关
- 根据选择的模式显示不同的输入框和说明
- 包含用户责任声明，提醒用户合理使用该功能

## 技术实现

### 1. 状态管理扩展

#### ExtensionStateContext.tsx
添加了两个新的状态字段：
```typescript
// 新增状态字段
customUserAgentMode: "segments" | "full"
customUserAgentFull: string

// 对应的设置方法
setCustomUserAgentMode: (mode: "segments" | "full") => void
setCustomUserAgentFull: (userAgent: string) => void
```

#### webviewMessageHandler.ts
添加了对新消息类型的处理：
```typescript
case "customUserAgentMode":
    await updateGlobalState("customUserAgentMode", message.customUserAgentMode)
    await provider.postStateToWebview()
    break

case "customUserAgentFull":
    await updateGlobalState("customUserAgentFull", message.customUserAgentFull)
    await provider.postStateToWebview()
    break
```

### 2. UI 界面更新

#### ExperimentalSettings.tsx
完全重构了自定义 User-Agent 的 UI：

```typescript
// 模式选择
<div className="setting-item">
    <label className="setting-label">
        <input
            type="checkbox"
            checked={customUserAgentMode === "full"}
            onChange={handleCustomUserAgentModeChange}
        />
        完全自定义 User-Agent
    </label>
</div>

// 根据模式显示不同的输入框
{customUserAgentMode === "full" ? (
    // 完全自定义模式的输入框
    <VSCodeTextField
        value={customUserAgentFull || ""}
        onInput={handleCustomUserAgentFullChange}
        placeholder="例如：MyApp/1.0.0 (Windows NT 10.0; Win64; x64)"
    />
) : (
    // 分段模式的输入框
    <VSCodeTextField
        value={customUserAgent || ""}
        onInput={handleCustomUserAgentChange}
        placeholder="例如：MyCompany/1.0"
    />
)}
```

### 3. 核心逻辑更新

#### getCustomUserAgent 函数
更新了 `src/api/providers/constants.ts` 中的核心函数：

```typescript
export function getCustomUserAgent(
    customUserAgent?: string,
    customUserAgentMode?: "segments" | "full",
    customUserAgentFull?: string
): string {
    // 完全自定义模式
    if (customUserAgentMode === "full" && customUserAgentFull?.trim()) {
        return customUserAgentFull.trim()
    }
    
    // 分段模式（原有逻辑）
    const envUserAgent = process.env.CUSTOM_USER_AGENT
    if (customUserAgent?.trim()) {
        return customUserAgent.trim()
    }
    if (envUserAgent?.trim()) {
        return envUserAgent.trim()
    }
    
    // 默认值
    return `RooCode/${Package.version}`
}
```

### 4. API 调用更新

#### buildApiHandler 函数
更新了函数签名以支持新参数：

```typescript
export function buildApiHandler(
    configuration: ProviderSettings, 
    customUserAgent?: string,
    customUserAgentMode?: "segments" | "full",
    customUserAgentFull?: string
): ApiHandler
```

#### 所有调用点更新
更新了以下文件中的 `buildApiHandler` 调用：

1. **ClineProvider.ts**
   - `upsertProviderProfile` 方法中的两个调用点
   - 从 `contextProxy.getGlobalState()` 获取所有自定义 User-Agent 参数

2. **generateSystemPrompt.ts**
   - `generateSystemPrompt` 函数中的调用点
   - 从 `provider.contextProxy.getGlobalState()` 获取参数

3. **Task.ts**
   - 构造函数中的调用点
   - `condenseContext` 方法中的两个调用点
   - 通过 `providerRef` 获取 provider 实例，再获取全局状态

4. **single-completion-handler.ts**
   - 更新函数签名添加新参数
   - 将参数传递给 `buildApiHandler`

## 使用方式

### 1. 分段模式（默认）
- 用户在"自定义 User-Agent"输入框中输入内容
- 系统使用该内容作为 User-Agent
- 如果未设置，使用默认的 `RooCode/${version}`

### 2. 完全自定义模式
- 用户勾选"完全自定义 User-Agent"选项
- 在新出现的输入框中输入完整的 User-Agent 字符串
- 系统直接使用该字符串，不添加任何默认内容

## 安全考虑

### 用户责任声明
在 UI 中添加了明确的用户责任声明：
> **注意**：完全自定义 User-Agent 可能影响 API 服务的正常识别和统计。请确保您的自定义 User-Agent 符合相关服务的使用条款，并承担由此产生的任何后果。

### 验证和限制
- 输入验证：确保 User-Agent 字符串不为空
- 长度限制：通过 UI 输入框的自然限制
- 格式建议：在占位符中提供标准格式示例

## 向后兼容性

该实现完全向后兼容：
- 现有的 `customUserAgent` 设置继续工作
- 未设置新字段时，系统使用原有逻辑
- 所有现有的 API 调用都能正常工作

## 测试建议

1. **功能测试**
   - 测试分段模式的 User-Agent 设置
   - 测试完全自定义模式的 User-Agent 设置
   - 测试模式切换的 UI 行为

2. **兼容性测试**
   - 验证现有配置的向后兼容性
   - 测试不同 API 提供商的 User-Agent 处理

3. **边界测试**
   - 测试空字符串输入
   - 测试特殊字符输入
   - 测试超长字符串输入

## 相关文件

### 核心文件
- `src/api/providers/constants.ts` - 核心 User-Agent 生成逻辑
- `src/api/index.ts` - API 处理器构建函数
- `webview-ui/src/components/settings/ExperimentalSettings.tsx` - UI 界面
- `webview-ui/src/context/ExtensionStateContext.tsx` - 状态管理

### 调用点文件
- `src/core/webview/ClineProvider.ts`
- `src/core/webview/generateSystemPrompt.ts`
- `src/core/task/Task.ts`
- `src/utils/single-completion-handler.ts`
- `src/core/webview/webviewMessageHandler.ts`

## 总结

完全自定义 User-Agent 功能的实现为用户提供了更大的灵活性，同时保持了向后兼容性和系统的稳定性。通过清晰的 UI 设计和合理的技术架构，用户可以根据需要选择合适的自定义模式，满足不同场景下的需求。