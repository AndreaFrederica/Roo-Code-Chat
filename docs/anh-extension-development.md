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

更多上下文字段见 `src/services/anh-chat/ExtensionManager.ts` 中 `AnhExtensionSystemPromptContext`。

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
