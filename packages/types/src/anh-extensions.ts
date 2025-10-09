import type { CustomModePrompts, ModeConfig } from "./mode.js"
import type { Experiments } from "./experiment.js"
import type { TodoItem } from "./todo.js"
import type { RolePromptData, Role, RolePersona } from "./anh-chat.js"
import type { UserAvatarVisibility } from "./global-settings.js"
import type { SystemPromptSettings } from "./system-prompt.js"
import type * as vscodeTypes from "vscode"
import type * as fsTypes from "fs"
import type * as osTypes from "os"
import type * as pathTypes from "path"

export type AnhExtensionSettingType = "string" | "number" | "boolean" | "select"

export interface AnhExtensionSettingDefinitionBase {
	id: string
	label: string
	type: AnhExtensionSettingType
	description?: string
	required?: boolean
}

export interface AnhExtensionStringSetting extends AnhExtensionSettingDefinitionBase {
	type: "string"
	default?: string
	placeholder?: string
	multiline?: boolean
}

export interface AnhExtensionNumberSetting extends AnhExtensionSettingDefinitionBase {
	type: "number"
	default?: number
	min?: number
	max?: number
	step?: number
}

export interface AnhExtensionBooleanSetting extends AnhExtensionSettingDefinitionBase {
	type: "boolean"
	default?: boolean
}

export interface AnhExtensionSelectOption {
	value: string
	label: string
}

export interface AnhExtensionSelectSetting extends AnhExtensionSettingDefinitionBase {
	type: "select"
	default?: string
	options: AnhExtensionSelectOption[]
}

export type AnhExtensionSettingDefinition =
	| AnhExtensionStringSetting
	| AnhExtensionNumberSetting
	| AnhExtensionBooleanSetting
	| AnhExtensionSelectSetting

export type AnhExtensionSettingsValues = Record<string, unknown>

export type AnhExtensionCapability = "systemPrompt" | "tools"
export type AnhExtensionModuleMap = {
	vscode: typeof vscodeTypes
	fs: typeof fsTypes
	os: typeof osTypes
	path: typeof pathTypes
}
export type AnhExtensionModuleId = keyof AnhExtensionModuleMap

export interface AnhExtensionManifest {
	name: string
	version?: string
	description?: string
	main: string
	capabilities: AnhExtensionCapability[]
	enabled?: boolean
	settings?: AnhExtensionSettingDefinition[]
	modules?: AnhExtensionModuleId[]
}

export interface AnhExtensionToolDefinition {
	/**
	 * Unique identifier for the tool within the extension.
	 * Combined with the extension id to form the global tool name.
	 */
	name: string
	/**
	 * Human-readable label shown in logs and UI.
	 * Defaults to the `name` when omitted.
	 */
	displayName?: string
	/**
	 * One-line summary describing the purpose of the tool.
	 */
	description?: string
	/**
	 * Instructional text appended to the system prompt's tools section.
	 * Should explain when and how to call the tool, including parameter guidance.
	 */
	prompt: string
	/**
	 * Optional list of mode slugs in which the tool is available.
	 * If omitted, the tool is available in all modes.
	 */
	modes?: string[]
	/**
	 * Whether invoking this tool should request user approval first.
	 * Defaults to true for safety.
	 */
	requiresApproval?: boolean
}

export interface AnhExtensionToolInvokeRequest {
	/**
	 * The extension-scoped tool name as defined in `AnhExtensionToolDefinition.name`.
	 */
	toolName: string
	/**
	 * Fully-qualified tool identifier (`extension:<extension-id>/<tool-name>`).
	 */
	fullToolName: string
	/**
	 * Parameters supplied by the model when invoking the tool.
	 */
	parameters: Record<string, string | undefined>
	/**
	 * Active task identifier if available.
	 */
	taskId?: string
	/**
	 * Current working directory for the task.
	 */
	cwd: string
	/**
	 * Root workspace path for the current task.
	 */
	workspacePath: string
	/**
	 * Active mode slug, if resolved.
	 */
	mode?: string
	/**
	 * Snapshot of provider state to help tools adapt to environment settings.
	 */
	providerState?: Record<string, unknown>
}

export type AnhExtensionToolResultBlock =
	| { type: "text"; text: string }
	| { type: "image"; base64: string; mimeType: string; altText?: string }

export interface AnhExtensionToolResultSuccess {
	success: true
	/**
	 * Optional primary message to show in the transcript.
	 */
	message?: string
	/**
	 * Optional structured blocks (text/image) to render as tool output.
	 */
	blocks?: AnhExtensionToolResultBlock[]
	/**
	 * Arbitrary metadata for future use or debugging.
	 */
	metadata?: Record<string, unknown>
}

export interface AnhExtensionToolResultError {
	success: false
	error: string
}

export type AnhExtensionToolResult = AnhExtensionToolResultSuccess | AnhExtensionToolResultError

export interface AnhExtensionToolHooks {
	getTools?(): Promise<AnhExtensionToolDefinition[] | void> | AnhExtensionToolDefinition[] | void
	invoke(
		request: AnhExtensionToolInvokeRequest,
	): Promise<AnhExtensionToolResult | void> | AnhExtensionToolResult | void
}

export interface AnhExtensionRuntimeState {
	id: string
	manifest: AnhExtensionManifest
	enabled: boolean
	registeredCapabilities: AnhExtensionCapability[]
	entryPath: string
	lastLoadedAt?: number
	error?: string
	settingsSchema?: AnhExtensionSettingDefinition[]
}

export type AnhExtensionCapabilityRegistry = Record<AnhExtensionCapability, string[]>

export interface AnhExtensionSystemPromptContext {
	basePrompt: string
	cwd: string
	mode: string
	providerState: Record<string, unknown>
	taskId?: string
	canUseBrowserTool: boolean
	browserViewportSize?: string
	todoList?: TodoItem[]
	modelId?: string
	rolePromptData?: RolePromptData
	personaMode?: RolePersona
	toneStrict?: boolean
	useAskTool?: boolean
	userAvatarRole?: Role
	enableUserAvatar?: boolean
	enabledWorldsets?: string[]
	userAvatarVisibility?: UserAvatarVisibility
	customModePrompts?: CustomModePrompts
	customModes?: ModeConfig[]
	customInstructions?: string
	diffEnabled?: boolean
	experiments?: Experiments
	enableMcpServerCreation?: boolean
	language?: string
	rooIgnoreInstructions?: string
	partialReadsEnabled?: boolean
	settings?: SystemPromptSettings
}

export interface AnhExtensionSystemPromptResult {
	append?: string | string[]
	prepend?: string | string[]
	replace?: string
}

export type AnhExtensionSystemPromptHook = (
	context: AnhExtensionSystemPromptContext,
) =>
	| Promise<AnhExtensionSystemPromptResult | string | void>
	| AnhExtensionSystemPromptResult
	| string
	| void

export interface AnhExtensionSystemPromptFinalContext
	extends Omit<AnhExtensionSystemPromptContext, "basePrompt"> {
	finalPrompt: string
}

export type AnhExtensionSystemPromptFinalHook = (
	context: AnhExtensionSystemPromptFinalContext,
) => Promise<void> | void

export interface AnhExtensionHooks {
	systemPrompt?: AnhExtensionSystemPromptHook
	systemPromptFinal?: AnhExtensionSystemPromptFinalHook
	tools?: AnhExtensionToolHooks
}

export interface AnhExtensionContextLogger {
	info(message: string, ...details: unknown[]): void
	warn(message: string, ...details: unknown[]): void
	error(message: string, ...details: unknown[]): void
}

export interface AnhExtensionContext {
	id: string
	manifest: AnhExtensionManifest
	extensionPath: string
	basePath: string
	logger: AnhExtensionContextLogger
	settings: Readonly<AnhExtensionSettingsValues>
	modules: Readonly<Partial<AnhExtensionModuleMap>>
	getSetting<T = unknown>(key: string): T | undefined
	setSetting<T = unknown>(key: string, value: T): Promise<void>
	updateSettings(values: Partial<AnhExtensionSettingsValues>): Promise<void>
	getModule<M extends AnhExtensionModuleId>(module: M): AnhExtensionModuleMap[M] | undefined
}

export interface AnhExtensionModule {
	activate(context: AnhExtensionContext): Promise<AnhExtensionHooks | void> | AnhExtensionHooks | void
	deactivate?(context: AnhExtensionContext): Promise<void> | void
}
