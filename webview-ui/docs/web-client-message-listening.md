# Web 客户端消息监听修复指南

## 问题描述

在 VSCode 扩展环境中，组件通过 `window.addEventListener("message")` 监听来自扩展的消息。但在 Web 客户端环境中，消息通过 WebSocket 传输，需要使用 `vscode.onMessage()` 来监听。

## 解决方案

使用统一的 `useMessageListener` Hook 来处理两种环境下的消息监听。

### 1. 导入 Hook

```typescript
import { useMessageListener } from "@/hooks/useMessageListener"
```

### 2. 替换现有的手动监听逻辑

**之前 (仅支持 VSCode 扩展):**
```typescript
useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    const message = event.data
    switch (message.type) {
      case "someMessageType":
        // 处理消息
        break
      // ... 其他消息类型
    }
  }

  window.addEventListener("message", handleMessage)
  return () => window.removeEventListener("message", handleMessage)
}, [])
```

**之后 (支持 VSCode 扩展 + Web 客户端):**
```typescript
useMessageListener([
  "someMessageType",
  "anotherMessageType",
  // ... 其他消息类型
], (message: any) => {
  switch (message.type) {
    case "someMessageType":
      // 处理消息
      break
    case "anotherMessageType":
      // 处理消息
      break
    // ... 其他消息类型
  }
}, [/* 依赖数组 */])
```

### 3. Hook API 说明

#### `useMessageListener(messageTypes, handler, dependencies)`

- **messageTypes**: `string[]` - 需要监听的消息类型数组
- **handler**: `(message: any) => void` - 消息处理函数
- **dependencies**: `any[]` - 依赖数组，当依赖变化时会重新设置监听器

#### 其他变体

- `useSingleMessageListener(messageType, handler, dependencies)` - 监听单个消息类型
- `useVSCodeMessageListener(handler, dependencies)` - 仅在 VSCode 扩展环境中监听
- `useWebClientMessageListener(messageTypes, handler, dependencies)` - 仅在 Web 客户端环境中监听

## 已修复的组件

✅ **TSProfileSettings** - TSProfile 相关消息
✅ **AssistantRoleSettings** - 角色相关消息

## 待修复的组件

以下组件仍需要应用此修复：

- [ ] `SettingsView.tsx`
- [ ] `MemoryManagementSettings.tsx`
- [ ] `WorldviewSettings.tsx`
- [ ] `SillyTavernWorldBookSettings.tsx`
- [ ] `PromptsSettings.tsx`
- [ ] `UserAvatarSettings.tsx`
- [ ] `ChatTextArea.tsx`
- [ ] `ChatRow.tsx`
- [ ] `ShareButton.tsx`
- [ ] `UserAvatarRoleSelector.tsx`
- [ ] `RoleSelector.tsx`
- [ ] 以及其他包含 `window.addEventListener("message")` 的组件

## 修复步骤

1. 在组件中导入 `useMessageListener` Hook
2. 识别组件监听的消息类型（通常在 `switch (message.type)` 中）
3. 用 `useMessageListener` 替换手动的 `useEffect` + `addEventListener` 逻辑
4. 确保传递正确的依赖数组
5. 测试在 VSCode 扩展和 Web 客户端环境中都正常工作

## 注意事项

- 在 `switch` 语句中使用词法声明（如 `const`）时，需要用花括号包装每个 case：
  ```typescript
  case "someType": {
    const variable = message.data
    // 处理逻辑
    break
  }
  ```
- Hook 会自动处理清理，无需手动移除事件监听器
- 优先使用 `useMessageListener` 而不是手动实现，确保一致的兼容性