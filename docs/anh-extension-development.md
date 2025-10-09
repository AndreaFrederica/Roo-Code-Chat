# ANH Chat 插件开发指南

本文介绍如何为 ANH Chat 编写插件，包括项目结构、可用的 TypeScript 定义以及常见调试技巧。

---

## 目录

1. [目录结构](#目录结构)
2. [Manifest 字段说明](#manifest-字段说明)
3. [运行时上下文（Context）](#运行时上下文context)
4. [系统提示词 Hook](#系统提示词-hook)
5. [插件设置（Settings）](#插件设置settings)
6. [生命周期与调试](#生命周期与调试)
7. [TypeScript 类型定义](#typescript-类型定义)

---

## 目录结构

插件位于工作区的：

```
novel-helper/.anh-chat/extensions/<plugin-id>/
```

一个最小插件包含：

```
extension.json     # 插件 manifest
index.mjs          # 插件入口（ESM 或 CJS）
```

---

## Manifest 字段说明

`extension.json` 中支持的字段：

| 字段          | 类型                | 说明                                                                 |
| ------------- | ------------------- | -------------------------------------------------------------------- |
| `name`        | `string` (必填)     | 插件显示名称                                                         |
| `main`        | `string` (必填)     | 入口文件路径，相对于 manifest                                       |
| `capabilities`| `string[]` (必填)  | 声明的能力。目前支持 `systemPrompt`                                 |
| `enabled`     | `boolean`           | 默认是否启用                                                         |
| `description` | `string`            | 插件说明                                                             |
| `settings`    | `AnhExtensionSettingDefinition[]` | 在设置面板生成 UI；详见下文 [插件设置](#插件设置settings) |
| `modules`     | `(\"vscode\" \\| \"fs\" \\| \"os\" \\| \"path\")[]` | 需要注入的 Node/VSC 模块（可选，超出白名单将被忽略） |

示例：

```jsonc
{
  "name": "Sample Prompt Logger",
  "main": "./index.mjs",
  "capabilities": ["systemPrompt"],
  "enabled": true,
  "description": "Logs role prompt data.",
  "settings": [
    {
      "id": "appendMessage",
      "type": "string",
      "label": "Appended message",
      "default": "Hello from sample plugin",
      "multiline": true
    },
    {
      "id": "logRoleData",
      "type": "boolean",
      "label": "Log role prompt data",
      "default": true
    }
  ]
}
```

---

## 运行时上下文（Context）

入口文件需要导出 `activate(context)` 函数，返回一个含有钩子的对象。

```ts
export async function activate(context) {
  context.logger.info(`[${context.manifest.name}] activated`);

  return {
    systemPrompt(systemContext) {
      // ...
    }
  };
}

export async function deactivate(context) {
  context.logger.info(`[${context.manifest.name}] deactivated`);
}
```

`context` 为 `AnhExtensionContext`：

| 属性              | 类型                    | 说明                                              |
| ----------------- | ----------------------- | ------------------------------------------------- |
| `id`              | `string`                | 插件文件夹名称                                    |
| `manifest`        | `AnhExtensionManifest`  | 解析后的 manifest                                 |
| `extensionPath`   | `string`                | 入口文件绝对路径                                  |
| `basePath`        | `string`                | `novel-helper/.anh-chat` 目录                     |
| `logger`          | `{ info, warn, error }` | 写入扩展输出面板                                  |
| `settings`        | `Readonly<Record<string, unknown>>` | 当前设置快照                 |
| `modules`         | `Readonly<Partial<AnhExtensionModuleMap>>` | 通过 manifest `modules` 请求到的模块 |
| `getSetting(key)` | `(key: string) => any`  | 读取设置，未定义返回 `undefined`                  |
| `setSetting(key, value)` | `(key: string, value: any) => Promise<void>` | 更新单个设置并持久化 |
| `updateSettings(values)` | `(partial) => Promise<void>` | 批量更新设置                              |
| `getModule(id)`   | `(id: \"vscode\" \\| \"fs\" \\| \"os\" \\| \"path\") => unknown` | 访问注入模块 |

示例：使用 VS Code 与文件系统 API：

```ts
export async function activate(context) {
  const vscode = context.getModule("vscode");
  const fs = context.getModule("fs");

  vscode?.window.showInformationMessage("Plugin activated!");
  const exists = fs?.existsSync(context.extensionPath);
  context.logger.info(`Extension path exists: ${exists}`);
}
```

---

## 系统提示词 Hook

当 manifest 声明了 `systemPrompt` 能力时，插件可以在生成系统提示词时注入内容。

```ts
return {
  systemPrompt({ basePrompt, mode, cwd, rolePromptData }) {
    const summary = `Mode: ${mode}, cwd: ${cwd}`;
    return {
      append: `\n\n### Plugin Info\n${summary}`
    };
  }
};
```

`systemPrompt` 支持返回：

* `string`：追加到 prompt 末尾
* `{ append?: string | string[], prepend?: string | string[], replace?: string }`

若只需要观察最终结果，可实现可选的 `systemPromptFinal` 钩子。它会在所有插件修改完成后触发，参数中包含 `finalPrompt` 字段：

```ts
return {
  systemPromptFinal({ finalPrompt, mode }) {
    context.logger.info(`Final prompt for ${mode} has ${finalPrompt.length} characters.`);
  }
};
```

即使插件只实现 `systemPromptFinal`，只要在 manifest 中声明 `systemPrompt` 能力即可收到回调。

`systemPromptFinal` 的上下文类型为 `AnhExtensionSystemPromptFinalContext`（在 `types/anh-extension-sdk.d.ts` 中可直接引用 `SystemPromptFinalContext`）。除 `finalPrompt` 外，其余字段与 `systemPrompt` 相同，例如 `mode`、`cwd`、`rolePromptData` 等，便于根据最终提示词结合原始上下文做进一步处理或记录。

更多上下文字段见 `src/services/anh-chat/ExtensionManager.ts` 中 `AnhExtensionSystemPromptContext`。

---

## 工具 Hook

声明 `tools` 能力后，插件可以向模型暴露自定义工具。工具 hook 需要返回两个成员：

- `getTools()`：返回一组 `AnhExtensionToolDefinition`，用于描述工具的名称、展示文案以及应注入到系统提示中的说明。
- `invoke(request)`：当模型调用 `extension:<extension-id>/<tool-name>` 时执行，实现具体逻辑并返回 `AnhExtensionToolResult`。

```ts
return {
  tools: {
    async getTools() {
      return [
        {
          name: "echo_message",
          displayName: "Echo Message",
          description: "Echoes the provided text and logs it to the sample plugin output channel.",
          prompt: `- extension:${context.id}/echo_message — Echo the provided \`text\` parameter and log it to the plugin output channel.`,
          requiresApproval: false,
        },
      ]
    },
    async invoke({ parameters, cwd, taskId }) {
      const text = typeof parameters.text === "string" ? parameters.text.trim() : ""

      if (!text) {
        return { success: false, error: "Parameter 'text' is required." }
      }

      context.logger.info(`Echo tool called for task ${taskId} at ${cwd}: ${text}`)

      return {
        success: true,
        message: `Plugin echo: ${text}`,
      }
    },
  },
}
```

工具定义字段说明：

- `name`：插件内部唯一的工具名称，会自动组合成 `extension:<extension-id>/<name>`。
- `displayName` 与 `description`：用于设置 UI/日志友好的标题和简介。
- `prompt`：注入到系统提示 “Tools” 部分的文本，建议说明调用格式与参数。
- `requiresApproval`：是否在执行前弹出用户确认（默认 `true`）。
- `modes`：可选，限定工具仅在特定模式下显示。

`invoke` 函数会收到 `AnhExtensionToolInvokeRequest`，包含当前任务的 `cwd`、`workspacePath`、`mode`、`taskId`、`providerState` 以及模型传入的 `parameters`。返回值可包含：

- `success: true` 时可附带 `message`（字符串）或 `blocks`（文本/图片块数组），将直接展示在聊天记录中。
- `success: false` 时提供 `error` 字段以反馈问题。

---

## 插件设置（Settings）

Manifest 的 `settings` 会在设置页的 “Extensions” Tab 自动渲染。支持的类型：

* `string`（可选 `multiline`、`placeholder`）
* `number`（可选 `min`、`max`、`step`）
* `boolean`
* `select`（需提供 `options: { value, label }[]`）

插件通过 `context.getSetting` 读取、`setSetting` 更新。设置值持久化在 VS Code 全局状态（`ContextProxy` 管理），并在 UI 与后端之间自动同步。

---

## 生命周期与调试

* 插件目录改动后，可运行 “Developer: Reload Window” 让扩展重新扫描。
* `context.logger` 输出会出现在 ANH Chat 扩展的输出面板中（`View → Output → ANH Chat`）。
* 若 `activate` 抛出异常，插件将被标记为加载失败，错误信息会写入输出面板。

---

## TypeScript 类型定义

项目提供了 `types/anh-extension-sdk.d.ts`（见仓库根目录）。在插件目录内创建 `tsconfig.json`，并将该 `.d.ts` include，即可获得完整的编写提示。

主要导出的类型别名包括：

- `Hooks`：插件可返回的钩子集合（例如 `systemPrompt`、`systemPromptFinal`）
- `SystemPromptContext` / `SystemPromptResult`：系统提示词钩子参数及返回值
- `SystemPromptFinalContext` / `SystemPromptFinalHook`：最终提示词回调的上下文与函数签名
- `ToolDefinition` / `ToolHooks`：工具定义与钩子结构
- `ToolInvokeRequest` / `ToolResult`：工具执行时的上下文与返回值
- `Context`：`activate` / `deactivate` 拿到的运行时上下文

示例 `tsconfig.json`：

```json
{
  "compilerOptions": {
    "module": "es2022",
    "target": "es2022",
    "moduleResolution": "node",
    "strict": true,
    "types": ["../types/anh-extension-sdk"]
  },
  "include": ["./*.ts", "./*.mts", "./*.cts", "./*.tsx"]
}
```

---

祝开发顺利！若需要扩展新的能力，可以参考 `AnhExtensionManager` 的实现并提交 PR。***


