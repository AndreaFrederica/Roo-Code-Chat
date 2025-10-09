import type {
	AnhExtensionManifest,
	AnhExtensionContext,
	AnhExtensionHooks,
	AnhExtensionSystemPromptContext,
	AnhExtensionSystemPromptResult,
	AnhExtensionSettingDefinition,
	AnhExtensionModuleId,
	AnhExtensionModuleMap,
} from "@roo-code/types"

/**
 * 该文件提供 ANH Chat 插件开发时可用的类型定义。
 *
 * 使用方法（插件目录下）：
 *
 * ```json
 * {
 *   "compilerOptions": {
 *     "types": ["../types/anh-extension-sdk"]
 *   }
 * }
 * ```
 */

declare namespace AnhExtensionSDK {
	/**
	 * 插件 manifest 类型。
	 */
	type Manifest = AnhExtensionManifest & {
		settings?: AnhExtensionSettingDefinition[]
	}

	/**
	 * 插件上下文（activate / deactivate 会拿到）。
	 */
	type Context = AnhExtensionContext
	type ModuleId = AnhExtensionModuleId
	type ModuleMap = AnhExtensionModuleMap

	/**
	 * 插件钩子集合。
	 */
	type Hooks = AnhExtensionHooks

	/**
	 * `systemPrompt` 钩子的上下文。
	 */
	type SystemPromptContext = AnhExtensionSystemPromptContext

	/**
	 * `systemPrompt` 钩子的返回值类型。
	 */
	type SystemPromptResult = AnhExtensionSystemPromptResult
}

/**
 * 插件入口 `activate` 函数。
 */
export type Activate = (context: AnhExtensionSDK.Context) =>
	| Promise<AnhExtensionSDK.Hooks | void>
	| AnhExtensionSDK.Hooks
	| void

/**
 * 插件 `deactivate` 函数。
 */
export type Deactivate = (context: AnhExtensionSDK.Context) => Promise<void> | void

export type {
	AnhExtensionSettingDefinition,
	AnhExtensionSystemPromptContext,
	AnhExtensionSystemPromptResult,
} from "@roo-code/types"
