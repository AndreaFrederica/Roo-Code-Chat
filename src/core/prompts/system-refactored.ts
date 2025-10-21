import * as vscode from "vscode"
import type {
	ModeConfig,
	PromptComponent,
	CustomModePrompts,
	TodoItem,
	Role,
	UserAvatarVisibility,
	SystemPromptSettings,
	RolePromptData,
	RolePersona,
	MemoryTriggerResult,
} from "@roo-code/types"

import type { Mode } from "../../shared/modes"

import type { DiffStrategy } from "../../shared/tools"
import { McpHub } from "../../services/mcp/McpHub"
import { debugLog } from "../../utils/debug"
import { defaultModeSlug } from "../../shared/modes"
import { isEmpty } from "../../utils/object"

// 导入重构后的模块
import {
	PromptBuilder,
	EnvironmentBuilder,
	type SystemPromptOptions,
	type FilePromptOptions,
} from "./index"

// 向后兼容性已通过新的模块化架构实现



// 创建全局实例（单例模式）
let promptBuilderInstance: PromptBuilder | null = null
let environmentBuilderInstance: EnvironmentBuilder | null = null

/**
 * 获取PromptBuilder实例
 */
function getPromptBuilder(): PromptBuilder {
	if (!promptBuilderInstance) {
		promptBuilderInstance = new PromptBuilder()
	}
	return promptBuilderInstance
}

/**
 * 获取EnvironmentBuilder实例
 */
function getEnvironmentBuilder(): EnvironmentBuilder {
	if (!environmentBuilderInstance) {
		environmentBuilderInstance = new EnvironmentBuilder()
	}
	return environmentBuilderInstance
}

/**
 * 系统提示词生成函数（重构后）
 * 这是主要的系统提示词生成入口点
 */
export const SYSTEM_PROMPT = async (
	context: vscode.ExtensionContext,
	cwd: string,
	supportsComputerUse: boolean,
	mcpHub?: McpHub,
	diffStrategy?: DiffStrategy,
	browserViewportSize?: string,
	mode: Mode = defaultModeSlug,
	customModePrompts?: CustomModePrompts,
	customModes?: ModeConfig[],
	globalCustomInstructions?: string,
	diffEnabled?: boolean,
	experiments?: Record<string, boolean>,
	enableMcpServerCreation?: boolean,
	language?: string,
	rooIgnoreInstructions?: string,
	partialReadsEnabled?: boolean,
	settings?: SystemPromptSettings,
	todoList?: TodoItem[],
	modelId?: string,
	rolePromptData?: RolePromptData,
	anhPersonaMode?: RolePersona,
	anhToneStrict?: boolean,
	anhUseAskTool?: boolean,
	userAvatarRole?: Role,
	enableUserAvatar?: boolean,
	enabledWorldsets?: string[],
	userAvatarVisibility?: UserAvatarVisibility,
	extensionToolDescriptions?: string[],
	worldBookContent?: string,
	memoryTriggerResult?: MemoryTriggerResult,
	// STProfile processing parameters
	enabledTSProfiles?: string[],
	anhTsProfileAutoInject?: boolean,
	anhTsProfileVariables?: Record<string, any>,
	// Variable state injection parameter
	enableInjectSystemPromptVariables?: boolean,
	currentTask?: any, // Task instance for getting variable state
): Promise<string> => {
	const startTime = Date.now()

	try {
		debugLog("[SYSTEM_PROMPT] Starting system prompt generation (refactored)", {
			mode,
			hasRolePromptData: !!rolePromptData,
			hasWorldBookContent: !!worldBookContent,
			enabledTSProfiles: enabledTSProfiles?.length || 0,
			extensionToolsCount: extensionToolDescriptions?.length || 0,
		})

		const promptBuilder = getPromptBuilder()

		const systemPrompt = await promptBuilder.buildSystemPrompt({
			context,
			cwd,
			supportsComputerUse,
			mcpHub,
			diffStrategy,
			browserViewportSize,
			mode,
			customModePrompts,
			customModes,
			globalCustomInstructions,
			diffEnabled,
			experiments,
			enableMcpServerCreation,
			language,
			rooIgnoreInstructions,
			partialReadsEnabled,
			settings,
			todoList,
			modelId,
			rolePromptData,
			anhPersonaMode,
			anhToneStrict,
			anhUseAskTool,
			userAvatarRole,
			enableUserAvatar,
			enabledWorldsets,
			userAvatarVisibility,
			extensionToolDescriptions,
			worldBookContent,
			memoryTriggerResult,
			enabledTSProfiles,
			anhTsProfileAutoInject,
			anhTsProfileVariables,
			enableInjectSystemPromptVariables,
			currentTask,
		})

		const processingTime = Date.now() - startTime
		debugLog("[SYSTEM_PROMPT] System prompt generation completed", {
			processingTime: `${processingTime}ms`,
			promptLength: systemPrompt.length,
		})

		return systemPrompt

	} catch (error) {
		const processingTime = Date.now() - startTime
		debugLog("[SYSTEM_PROMPT] System prompt generation failed", {
			error: error instanceof Error ? error.message : "Unknown error",
			processingTime: `${processingTime}ms`,
		})

		// 降级到基本的系统提示词
		return generateFallbackSystemPrompt(mode, customModes, customModePrompts, globalCustomInstructions)
	}
}

/**
 * 生成基于文件的系统提示词
 */
export const generateFileBasedSystemPrompt = async (
	mode: string,
	customModePrompts?: CustomModePrompts,
	customModes?: ModeConfig[],
	globalCustomInstructions?: string,
	_diffStrategy?: DiffStrategy,
	rolePromptData?: RolePromptData,
	userAvatarRole?: Role,
	enableUserAvatar?: boolean,
	userAvatarVisibility?: UserAvatarVisibility,
	_extensionToolDescriptions?: string[],
	language?: string,
	enableInjectSystemPromptVariables?: boolean,
	currentTask?: any,
	environment?: {
		context: vscode.ExtensionContext
		cwd: string
		experiments?: Record<string, boolean>
		todoList?: TodoItem[]
		anhPersonaMode?: RolePersona
		anhToneStrict?: boolean
	},
): Promise<string> => {
	const promptBuilder = getPromptBuilder()

	if (!environment?.context || !environment.cwd) {
		throw new Error("Context and cwd are required to generate a file-based system prompt in the refactored flow")
	}

	return await promptBuilder.buildFileBasedPrompt({
		context: environment.context,
		cwd: environment.cwd,
		mode,
		customModePrompts,
		customModes,
		globalCustomInstructions,
		rolePromptData,
		userAvatarRole,
		enableUserAvatar,
		userAvatarVisibility,
		language,
		experiments: environment.experiments,
		enableInjectSystemPromptVariables,
		currentTask,
		todoList: environment.todoList,
		anhPersonaMode: environment.anhPersonaMode,
		anhToneStrict: environment.anhToneStrict,
	})
}

/**
 * 生成环境详情（用于getEnvironmentDetails）
 */
export const generateEnvironmentDetails = async (
	cline: any, // ClineProvider instance
	options: {
		mode?: Mode
		customModes?: ModeConfig[]
		customModePrompts?: CustomModePrompts
		globalCustomInstructions?: string
		language?: string
		experiments?: Record<string, boolean>
		state?: any
		rolePromptData?: RolePromptData
		userAvatarRole?: Role
		enableUserAvatar?: boolean
		userAvatarVisibility?: UserAvatarVisibility
		extensionToolDescriptions?: string[]
		worldBookContent?: string
		enabledWorldsets?: string[]
		enabledTSProfiles?: string[]
		anhTsProfileAutoInject?: boolean
		anhTsProfileVariables?: Record<string, any>
		currentTask?: any
	} = {},
): Promise<string> => {
	const environmentBuilder = getEnvironmentBuilder()

	return await environmentBuilder.buildEnvironmentDetails({
		cline,
		...options,
	})
}

/**
 * 为增强导向模式生成增强的角色信息
 */
export const generateEnhancedRoleInfo = (
	rolePromptData: RolePromptData,
	userAvatarRole?: Role,
	enableUserAvatar?: boolean,
	options: {
		maxLength?: number
		includeSystemInstructions?: boolean
		includeWorldBookSummary?: boolean
		includeVariableSummary?: boolean
		worldBookContent?: string
		currentTask?: any
	} = {},
) => {
	const promptBuilder = getPromptBuilder()

	return promptBuilder.generateEnhancedRoleInfo(rolePromptData, userAvatarRole, !!enableUserAvatar)
}

/**
 * 降级系统提示词生成（当主要生成失败时使用）
 */
function generateFallbackSystemPrompt(
	mode: Mode,
	customModes?: ModeConfig[],
	customModePrompts?: CustomModePrompts,
	globalCustomInstructions?: string,
): string {
	const modeConfig = customModes?.find((m) => m.slug === mode)
	const promptComponent = customModePrompts?.[mode]

	const roleDefinition = modeConfig?.roleDefinition ||
		promptComponent?.roleDefinition ||
		"You are a helpful assistant."

	const customInstructions = modeConfig?.customInstructions ||
		promptComponent?.customInstructions || ""

	return `${roleDefinition}

${customInstructions}

${globalCustomInstructions ? `\n\n${globalCustomInstructions}` : ""}

Please help the user with their requests to the best of your abilities.`
}

/**
 * 清理资源（用于测试或重启）
 */
export function clearSystemPromptCache(): void {
	promptBuilderInstance = null
	environmentBuilderInstance = null
	debugLog("[SYSTEM_PROMPT] Cache cleared")
}

// 向后兼容性通过新的模块化架构实现

// 为了向后兼容，保留原有的接口
interface LegacySystemPromptOptions {
	context: vscode.ExtensionContext
	cwd: string
	supportsComputerUse: boolean
	mcpHub?: McpHub
	diffStrategy?: DiffStrategy
	browserViewportSize?: string
	mode?: Mode
	customModePrompts?: CustomModePrompts
	customModes?: ModeConfig[]
	globalCustomInstructions?: string
	diffEnabled?: boolean
	experiments?: Record<string, boolean>
	enableMcpServerCreation?: boolean
	language?: string
	rooIgnoreInstructions?: string
	partialReadsEnabled?: boolean
	settings?: SystemPromptSettings
	todoList?: TodoItem[]
	modelId?: string
	rolePromptData?: RolePromptData
	anhPersonaMode?: RolePersona
	anhToneStrict?: boolean
	anhUseAskTool?: boolean
	userAvatarRole?: Role
	enableUserAvatar?: boolean
	enabledWorldsets?: string[]
	userAvatarVisibility?: UserAvatarVisibility
	extensionToolDescriptions?: string[]
	worldBookContent?: string
	memoryTriggerResult?: MemoryTriggerResult
	enabledTSProfiles?: string[]
	anhTsProfileAutoInject?: boolean
	anhTsProfileVariables?: Record<string, any>
	enableInjectSystemPromptVariables?: boolean
	currentTask?: any
}

// 兼容性包装器
export const generatePrompt = async (options: LegacySystemPromptOptions): Promise<string> => {
	return SYSTEM_PROMPT(
		options.context,
		options.cwd,
		options.supportsComputerUse,
		options.mcpHub,
		options.diffStrategy,
		options.browserViewportSize,
		options.mode,
		options.customModePrompts,
		options.customModes,
		options.globalCustomInstructions,
		options.diffEnabled,
		options.experiments,
		options.enableMcpServerCreation,
		options.language,
		options.rooIgnoreInstructions,
		options.partialReadsEnabled,
		options.settings,
		options.todoList,
		options.modelId,
		options.rolePromptData,
		options.anhPersonaMode,
		options.anhToneStrict,
		options.anhUseAskTool,
		options.userAvatarRole,
		options.enableUserAvatar,
		options.enabledWorldsets,
		options.userAvatarVisibility,
		options.extensionToolDescriptions,
		options.worldBookContent,
		options.memoryTriggerResult,
		options.enabledTSProfiles,
		options.anhTsProfileAutoInject,
		options.anhTsProfileVariables,
		options.enableInjectSystemPromptVariables,
		options.currentTask,
	)
}
