# 自定义 User Agent 实现文档

## 概述

本文档记录了在 Roo Code Chat 项目中实现自定义 User Agent 功能的详细过程。该功能允许用户在设置中配置自定义的 User Agent 字符串，用于所有 API 请求。

## 实现的功能

### 1. 设置项添加

在全局设置中添加了 `customUserAgent` 设置项：

- **位置**: `src/shared/ExtensionMessage.ts` 中的 `GlobalState` 接口
- **类型**: `string | undefined`
- **默认值**: `undefined`（使用默认 User Agent）

### 2. 核心函数修改

#### getCustomUserAgent 函数

- **文件**: `src/api/providers/anthropic.ts`
- **修改**: 添加了可选的 `customUserAgent` 参数
- **功能**: 当提供自定义 User Agent 时使用它，否则使用默认值

```typescript
export function getCustomUserAgent(customUserAgent?: string): string {
	return customUserAgent || `${vscode.env.appName}/${vscode.version} RooCodeChat/${getVersion()}`
}
```

#### buildApiHandler 函数

- **文件**: `src/api/index.ts`
- **修改**: 添加了可选的 `customUserAgent` 参数
- **功能**: 将自定义 User Agent 传递给所有 API handler 构造函数

```typescript
export function buildApiHandler(configuration: ProviderSettings, customUserAgent?: string): ApiHandler {
	const enhancedOptions = {
		...options,
		...(customUserAgent && { customUserAgent })
	}
	// 使用 enhancedOptions 创建各种 API handler
}
```

### 3. 调用点更新

更新了所有 `buildApiHandler` 的调用点，使其能够传递全局状态中的 `customUserAgent`：

#### ClineProvider.ts
- `upsertProviderProfile` 方法中的两个调用点
- 从 `contextProxy.getGlobalState()` 获取 `customUserAgent`

#### generateSystemPrompt.ts
- `generateSystemPrompt` 函数中的调用点
- 从 `provider.contextProxy.getGlobalState()` 获取 `customUserAgent`

#### Task.ts
- 构造函数中的调用点
- `condenseContext` 方法中的两个调用点
- 通过 `providerRef` 获取 provider 实例，再获取全局状态

#### single-completion-handler.ts
- 函数签名添加了 `customUserAgent` 参数
- 将参数传递给 `buildApiHandler`

#### 测试文件
- `enhance-prompt.spec.ts` 中的测试调用
- 添加了 `undefined` 作为 `customUserAgent` 参数

### 4. API Handler 支持

所有 API handler 构造函数都已更新以支持 `customUserAgent` 选项：

- AnthropicHandler
- ClaudeCodeHandler
- OpenAIHandler
- AzureOpenAIHandler
- OpenRouterHandler
- BedrockHandler
- VertexHandler
- GeminiHandler
- OpenAICompatibleHandler
- OllamaHandler
- LMStudioHandler
- VSCodeLMHandler
- FakeAIHandler
- XAIHandler
- GroqHandler
- DeepInfraHandler
- HuggingFaceHandler

## 使用方式

1. 用户可以在设置中配置 `customUserAgent` 字段
2. 如果设置了自定义值，所有 API 请求将使用该 User Agent
3. 如果未设置，将使用默认的 User Agent 格式：`${vscode.env.appName}/${vscode.version} RooCodeChat/${getVersion()}`

## 技术细节

### 数据流

1. 用户在设置中配置 `customUserAgent`
2. 设置保存到全局状态 (`GlobalState.customUserAgent`)
3. 创建 API handler 时，从全局状态获取 `customUserAgent`
4. 传递给 `buildApiHandler` 函数
5. `buildApiHandler` 将其添加到 options 中
6. 各个 API handler 构造函数接收并使用该值

### 向后兼容性

- 所有新增的参数都是可选的
- 未设置自定义 User Agent 时，行为与之前完全一致
- 不会影响现有的 API 调用逻辑

## 测试建议

1. 验证设置项能够正确保存和读取
2. 测试不同 API provider 是否都能正确使用自定义 User Agent
3. 验证未设置自定义值时的默认行为
4. 检查所有调用点是否正确传递参数

## 注意事项

- 自定义 User Agent 应该遵循 HTTP 标准格式
- 某些 API provider 可能对 User Agent 有特定要求
- 建议在文档中说明 User Agent 的作用和使用场景