## 目标
- 完全沿用现有 TSProfile 正则设定面板：用户在 TSProfile 面板打开/编辑/保存正则。
- 当正则绑定“类型符合流后处理要求”时，保存后自动转换并注册到“输出流后处理设置”中，作为新的正则来源（`source: tsprofile:<id>`）。

## 界面与交互
- TSProfile 面板：不新增独立入口；继续使用原有正则编辑 UI 与保存按钮。
- 自动行为：保存 TSProfile 后，触发后端转换与导入；用户在“输出流后处理设置”中即可看到新来源分组，不需要二次操作。

## 筛选与映射
- 筛选条件：
  - `runStages` 包含 AI 输出或后处理（映射为 OSP `stage: "output" | "post-ast"`）。
  - `targetSource` 指向助手输出相关目标（如 `RegexTargetSource.AI_OUTPUT`）。
  - 具备正则执行必要字段：`pattern` 必填，`flags` 可选，`replacement` 或 `replacementFunction` 可选。
- 字段映射（STRegexBinding → OSP Rule）：
  - `id`: 绑定内置 `id`；若无，用 `sha1(pattern|flags|replacement|targetSource|runStages|priority)` 生成。
  - `name`/`description`/`pattern`/`flags`/`replacement`/`replacementFunction`/`groups`/`priority`/`dependsOn`/`params`：直接透传。
  - `stage`: `AI_OUTPUT → "output"`；`POST_PROCESSING → "post-ast"`；（如存在）`PRE_PROCESSING → "pre-ast"`。
  - `source`: 赋值 `tsprofile:<stableId>`。

## 稳定来源 ID 策略
- `stableSourceId = "tsprofile:" + sha1(scope + "|" + profileName + "|osp")`
- 在扩展全局状态中缓存映射（profileKey → stableSourceId），确保跨会话稳定；仅当 `scope/profileName` 变更时才变化。

## 后端逻辑（保存钩子）
- 位置：TSProfile 保存消息处理处（webviewMessageHandler.ts 中既有 TSProfile 保存 handler）。
- 增强：保存成功后，后台：
  - 解析最新 `regexBindings`，筛选符合条件的条目。
  - 映射为 OSP `Rule` 数组，设置 `source` 为 `tsprofile:<stableId>`。
  - 合并到 `outputStreamProcessorConfig.enabledRules.regex`（复合键：`regex.<source>.<ruleId>`）。
  - 在“全部规则”聚合中注册该来源与规则。
  - 通过 `ClineProvider.postStateToWebview()` 下发更新。

## 输出流后处理设置（复用）
- 保持现状：按 `source` 分组展示、启用/禁用；新增来源自动出现为 `tsprofile:<id>`。
- 默认启用策略：可选两种
  - 保守：导入后默认为禁用，用户在 OSP 面板启用。
  - 积极：导入后沿用 TSProfile 的启用标记（若有），初次导入时可直接启用。

## 运行期处理
- 不改动处理器：规则进入 `enabledRules` 后，`RegexProcessorManager` 与 types 包处理器按 `stage/priority` 正常执行。
- 流式推进逻辑参考：`src/core/assistant-message/presentAssistantMessage.ts:154` 保持不变。

## 验证流程
- 在 TSProfile 面板新增/编辑一条符合条件的正则，点击保存。
- 打开“输出流后处理设置”，看到 `tsprofile:<id>` 分组与对应规则。
- 启用后，验证助手输出在对应阶段发生预期替换/高亮等效果。

## 受影响文件
- TSProfile 面板：`webview-ui/src/components/settings/TSProfileSettings.tsx`
- 后端消息处理：`src/core/webview/webviewMessageHandler.ts`
- 规则聚合与下发：`src/core/webview/ClineProvider.ts`
- 运行期处理器（复用）：`src/core/processors/RegexProcessorManager.ts`、`packages/types/src/st-profile-processor.ts`