/**
 * 系统提示词组装器
 * 独立的组装流程文件，负责协调所有生成器并组装最终的系统提示词
 * 提供极其灵活的提示词结构调整能力
 */

import * as vscode from "vscode"
import * as os from "os"
import * as path from "path"
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
import type { Mode } from "../../../shared/modes"
import type { DiffStrategy } from "../../../shared/tools"

import { RegexTargetSource } from "@roo-code/types"
import { getModeBySlug, getModeSelection, modes, getGroupName } from "../../../shared/modes"
import { formatLanguage } from "../../../shared/language"
import { McpHub } from "../../../services/mcp/McpHub"
import { CodeIndexManager } from "../../../services/code-index/manager"
import { debugLog } from "../../../utils/debug"
import { isEmpty } from "../../../utils/object"

import { getRegexProcessorManager, debugRegexProcessorStatus } from "../../processors/RegexProcessorManager"
import { PromptVariables, loadSystemPromptFile } from "../sections/custom-system-prompt"
import { getGlobalStorageService } from "../../../services/storage/GlobalStorageService"
import { getToolDescriptionsForMode } from "../tools"
import {
	getRulesSection,
	getSystemInfoSection,
	getObjectiveSection,
	getSharedToolUseSection,
	getMcpServersSection,
	getToolUseGuidelinesSection,
	getCapabilitiesSection,
	getModesSection,
	addCustomInstructions,
	markdownFormattingSection,
} from "../sections"

import {
	RoleGenerator,
	STProfileGenerator,
	WorldBookGenerator,
	VariableInjector,
	type EnhancedRoleInfo,
} from "../generators"

import {
	PromptSegmentAssembler,
	PromptSegmentVariables,
	PromptSegmentAssemblyOptions,
	DEFAULT_SEGMENT_ORDER,
	CHAT_MODE_SEGMENT_ORDER,
	DEVELOPER_MODE_SEGMENT_ORDER,
} from "../types/prompt-segments"

export interface SystemPromptAssemblyOptions {
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
	// STProfile processing parameters
	enabledTSProfiles?: string[]
	anhTsProfileAutoInject?: boolean
	anhTsProfileVariables?: Record<string, any>
	// Variable state injection parameters
	enableInjectSystemPromptVariables?: boolean
	currentTask?: any
	// === 段组装选项 ===
	segmentOrder?: string[]
	includeUserAvatar?: boolean
	includeToolDefinitions?: boolean
	includeWorldbook?: boolean
	includeMCP?: boolean
	includeMemory?: boolean
	includeVariableState?: boolean
	userAvatarInsertBefore?: string
	toolDefinitionsInsertAfter?: string
	worldbookInsertAfter?: string
	summaryOnly?: boolean
	maxSegments?: number
	chatMode?: boolean
	developerMode?: boolean
	debugMode?: boolean
}

/**
 * 系统提示词组装器
 * 负责协调所有生成器，组装完整的系统提示词
 */
export class SystemPromptAssembler {
	private roleGenerator: RoleGenerator
	private stProfileGenerator: STProfileGenerator
	private worldBookGenerator: WorldBookGenerator
	private variableInjector: VariableInjector

	constructor() {
		this.roleGenerator = new RoleGenerator()
		this.stProfileGenerator = new STProfileGenerator()
		this.worldBookGenerator = new WorldBookGenerator()
		this.variableInjector = new VariableInjector()
	}

	/**
	 * 构建完整的系统提示词
	 */
	async buildSystemPrompt(options: SystemPromptAssemblyOptions): Promise<string> {
		const startTime = Date.now()

		try {
			debugLog("[SystemPromptAssembler] Starting system prompt assembly", {
				mode: options.mode,
				hasRolePromptData: !!options.rolePromptData,
				hasWorldBookContent: !!options.worldBookContent,
				enabledTSProfiles: options.enabledTSProfiles?.length || 0,
				extensionToolsCount: options.extensionToolDescriptions?.length || 0,
			})

			// 1. 应用 STProfile 预处理
			const processedRolePromptData = await this.preprocessRoleProfile(options)

			// 2. 生成所有段变量
			const segments = await this.generateAllSegments(options, processedRolePromptData)

			// 3. 组装最终提示词
			const finalPrompt = this.assembleFinalPrompt(segments, options)

			const processingTime = Date.now() - startTime
			debugLog("[SystemPromptAssembler] System prompt assembly completed", {
				processingTime: `${processingTime}ms`,
				promptLength: finalPrompt.length,
			})

			return finalPrompt

		} catch (error) {
			const processingTime = Date.now() - startTime
			debugLog("[SystemPromptAssembler] System prompt assembly failed", {
				error: error instanceof Error ? error.message : "Unknown error",
				processingTime: `${processingTime}ms`,
			})

			// 降级到基本的系统提示词
			return this.generateFallbackSystemPrompt(options)
		}
	}

	/**
	 * 预处理角色配置文件
	 */
	private async preprocessRoleProfile(options: SystemPromptAssemblyOptions): Promise<RolePromptData | undefined> {
		const { rolePromptData, enabledTSProfiles, anhTsProfileAutoInject, anhTsProfileVariables, userAvatarRole, cwd, context } = options

		if (!rolePromptData?.role || !enabledTSProfiles || enabledTSProfiles.length === 0) {
			return rolePromptData
		}

		debugLog("[SystemPromptAssembler] Starting STProfile preprocessing...")

		try {
			const workspaceProfileDir = path.join(cwd, "novel-helper", ".anh-chat", "tsprofile")
			let globalProfileDir: string | undefined

			const globalStorageService = await getGlobalStorageService(context)
			globalProfileDir = globalStorageService.getGlobalTsProfilesPath()

			const originalRole = { ...rolePromptData.role }
			const processedRole = await this.stProfileGenerator.applyPreprocessing(
				rolePromptData.role,
				enabledTSProfiles,
				{
					scope: "workspace",
					autoInject: anhTsProfileAutoInject ?? true,
					templateVariables: anhTsProfileVariables ?? {},
					userAvatarRole,
					workspaceProfileDir,
					globalProfileDir,
				}
			)

			const processedRolePromptData = {
				...rolePromptData,
				role: processedRole,
			}

			debugLog("[SystemPromptAssembler] STProfile preprocessing completed", {
				originalRoleHasSystemPrompt: !!originalRole.system_prompt,
				processedRoleHasSystemPrompt: !!processedRole.system_prompt,
				originalRoleHasSystemSettings: !!originalRole.system_settings,
				processedRoleHasSystemSettings: !!processedRole.system_settings,
			})

			return processedRolePromptData
		} catch (error) {
			console.warn("[SystemPromptAssembler] Failed to preprocess STProfile:", error)
			return rolePromptData
		}
	}

	/**
	 * 生成所有段变量
	 */
	private async generateAllSegments(
		options: SystemPromptAssemblyOptions,
		processedRolePromptData: RolePromptData | undefined
	): Promise<PromptSegmentVariables> {
		const segments = PromptSegmentAssembler.createSegments()

		// 1. 生成角色相关段
		await this.generateRoleSegments(segments, options, processedRolePromptData)

		// 2. 生成世界观和世界书段
		await this.generateWorldSegments(segments, options, processedRolePromptData)

		// 3. 生成记忆段
		await this.generateMemorySegments(segments, options)

		// 4. 生成工具定义段
		await this.generateToolSegments(segments, options)

		// 5. 生成 MCP 相关段
		await this.generateMCPSegments(segments, options)

		// 6. 生成系统能力和规则段
		await this.generateSystemSegments(segments, options)

		// 7. 生成自定义指令段
		await this.generateCustomInstructionSegments(segments, options)

		// 8. 生成变量状态段
		await this.generateVariableStateSegments(segments, options)

		// 9. 生成格式化段
		await this.generateFormattingSegments(segments, options)

		return segments
	}

	/**
	 * 生成角色相关段
	 */
	private async generateRoleSegments(
		segments: PromptSegmentVariables,
		options: SystemPromptAssemblyOptions,
		processedRolePromptData: RolePromptData | undefined
	): Promise<void> {
		if (!processedRolePromptData) {
			return
		}

		// 生成 AI 角色段变量
		const aiRoleSegments = this.roleGenerator.generateRoleSectionVariables(
			processedRolePromptData,
			options.userAvatarRole,
			options.enableUserAvatar,
			{}
		)

		// 生成用户头像段
		const userAvatarSegment = this.roleGenerator.generateUserAvatarSection(
			options.enableUserAvatar,
			options.userAvatarRole,
			options.userAvatarVisibility ?? "full"
		)

		// 合并角色段
		if (userAvatarSegment && userAvatarSegment.trim()) {
			const userAvatarContent = userAvatarSegment
				.replace(/USER AVATAR\s*\n/, '')
				.replace(/以下是目前设置的用户角色信息。在对话中请将用户视为扮演以下角色：\s*\n/, '')
				.trim()

			if (userAvatarContent) {
				PromptSegmentAssembler.setSegment(segments, 'userAvatar', userAvatarContent)
			}
		}

		// 合并 AI 角色段 - 确保类型兼容性
		// aiRoleSegments 是 PromptSectionVariables，需要转换为 PromptSegmentVariables
		const convertedSegments: Partial<PromptSegmentVariables> = {}
		
		// 直接复制所有兼容的字段
		Object.entries(aiRoleSegments).forEach(([key, value]) => {
			if (value && typeof value === 'string' && value.trim().length > 0) {
				// 类型断言：PromptSectionVariables 的字段兼容 PromptSegmentVariables
				(convertedSegments as any)[key] = value.trim()
			} else if (value && typeof value === 'object' && !Array.isArray(value)) {
				// 处理动态字段
				(convertedSegments as any)[key] = value
			}
		})

		// 使用转换后的段
		PromptSegmentAssembler.setSegments(segments, convertedSegments)
	}

	/**
	 * 生成世界观和世界书段
	 */
	private async generateWorldSegments(
		segments: PromptSegmentVariables,
		options: SystemPromptAssemblyOptions,
		processedRolePromptData: RolePromptData | undefined
	): Promise<void> {
		if (!options.context || !options.cwd) {
			return
		}

		try {
			const { worldsetSection, worldBookSection } = await this.worldBookGenerator.generateWorldSections({
				context: options.context,
				cwd: options.cwd,
				mode: options.mode || 'act',
				enabledWorldsets: options.enabledWorldsets,
				worldBookContent: options.worldBookContent,
				rolePromptData: processedRolePromptData,
				userAvatarRole: options.userAvatarRole,
			})

			if (worldsetSection) {
				PromptSegmentAssembler.setSegment(segments, 'worldsetSection', worldsetSection)
			}

			if (worldBookSection) {
				PromptSegmentAssembler.setSegment(segments, 'worldbookContent', worldBookSection)
			}
		} catch (error) {
			console.warn("[SystemPromptAssembler] Failed to generate world segments:", error)
		}
	}

	/**
	 * 生成记忆段
	 */
	private async generateMemorySegments(
		segments: PromptSegmentVariables,
		options: SystemPromptAssemblyOptions
	): Promise<void> {
		const { memoryTriggerResult, settings } = options

		if (!memoryTriggerResult || settings?.memorySystemEnabled === false) {
			return
		}

		let memoryContent = memoryTriggerResult.fullContent ? memoryTriggerResult.fullContent.trim() : ""

		if (!memoryContent) {
			const segments: string[] = []
			if (memoryTriggerResult.constantContent && memoryTriggerResult.constantContent.trim()) {
				segments.push(memoryTriggerResult.constantContent.trim())
			}
			if (memoryTriggerResult.triggeredContent && memoryTriggerResult.triggeredContent.trim()) {
				segments.push(memoryTriggerResult.triggeredContent.trim())
			}
			memoryContent = segments.join("\n\n").trim()
		}

		if (memoryContent) {
			const formattedMemorySection = `

====

ROLE MEMORY CONTEXT

Use the following memories to maintain continuity, personality, and story consistency:

${memoryContent}

====

`
			PromptSegmentAssembler.setSegment(segments, 'memorySection', formattedMemorySection)
		}
	}

	/**
	 * 生成工具定义段
	 */
	private async generateToolSegments(
		segments: PromptSegmentVariables,
		options: SystemPromptAssemblyOptions
	): Promise<void> {
		const {
			mode,
			cwd,
			supportsComputerUse,
			mcpHub,
			diffStrategy,
			browserViewportSize = "900x600",
			customModes,
			experiments,
			partialReadsEnabled,
			settings,
			enableMcpServerCreation,
			modelId,
			anhUseAskTool,
			extensionToolDescriptions,
		} = options

		const currentMode = (mode && getModeBySlug(mode, customModes)) || modes.find((m) => m.slug === mode) || modes[0]
		const effectiveDiffStrategy = options.diffEnabled ? diffStrategy : undefined
		const codeIndexManager = CodeIndexManager.getInstance(options.context!, cwd!)

		// 计算 MCP 相关
		const hasMcpGroup = currentMode.groups.some((groupEntry) => getGroupName(groupEntry) === "mcp")
		const hasMcpServers = mcpHub && mcpHub.getServers().length > 0
		const shouldIncludeMcp = hasMcpGroup && hasMcpServers

		// 生成工具描述
		try {
			const toolDescriptions = getToolDescriptionsForMode(
				mode || "act",
				cwd!,
				supportsComputerUse,
				codeIndexManager!,
				effectiveDiffStrategy,
				browserViewportSize,
				shouldIncludeMcp ? mcpHub : undefined,
				customModes,
				experiments,
				partialReadsEnabled,
				settings,
				enableMcpServerCreation,
				modelId,
				anhUseAskTool === false,
				extensionToolDescriptions,
			)

			PromptSegmentAssembler.setSegment(segments, 'toolDefinitions', toolDescriptions)
		} catch (error) {
			console.warn("[SystemPromptAssembler] Failed to generate tool definitions:", error)
		}

		// 生成工具使用指南
		try {
			const toolUseGuidelines = getToolUseGuidelinesSection(codeIndexManager)
			PromptSegmentAssembler.setSegment(segments, 'toolUseGuidelines', toolUseGuidelines)
		} catch (error) {
			console.warn("[SystemPromptAssembler] Failed to generate tool use guidelines:", error)
		}

		// 生成共享工具使用
		try {
			const sharedToolUse = getSharedToolUseSection()
			PromptSegmentAssembler.setSegment(segments, 'sharedToolUse', sharedToolUse)
		} catch (error) {
			console.warn("[SystemPromptAssembler] Failed to generate shared tool use:", error)
		}
	}

	/**
	 * 生成 MCP 相关段
	 */
	private async generateMCPSegments(
		segments: PromptSegmentVariables,
		options: SystemPromptAssemblyOptions
	): Promise<void> {
		const { mode, mcpHub, diffStrategy, enableMcpServerCreation } = options

		if (!mcpHub) {
			return
		}

		const currentMode = (mode && getModeBySlug(mode, options.customModes)) || modes.find((m) => m.slug === mode) || modes[0]
		const hasMcpGroup = currentMode.groups.some((groupEntry) => getGroupName(groupEntry) === "mcp")
		const hasMcpServers = mcpHub.getServers().length > 0

		if (hasMcpGroup && hasMcpServers) {
			try {
				const mcpServersSection = await getMcpServersSection(
					mcpHub,
					diffStrategy,
					enableMcpServerCreation
				)
				PromptSegmentAssembler.setSegment(segments, 'mcpServers', mcpServersSection)
			} catch (error) {
				console.warn("[SystemPromptAssembler] Failed to generate MCP section:", error)
			}
		}
	}

	/**
	 * 生成系统能力和规则段
	 */
	private async generateSystemSegments(
		segments: PromptSegmentVariables,
		options: SystemPromptAssemblyOptions
	): Promise<void> {
		const {
			mode,
			cwd,
			supportsComputerUse,
			mcpHub,
			diffStrategy,
			customModes,
			experiments,
			partialReadsEnabled,
			settings,
			enableMcpServerCreation,
			modelId,
			anhUseAskTool,
			extensionToolDescriptions,
		} = options

		const currentMode = (mode && getModeBySlug(mode, customModes)) || modes.find((m) => m.slug === mode) || modes[0]
		const effectiveDiffStrategy = options.diffEnabled ? diffStrategy : undefined
		const codeIndexManager = CodeIndexManager.getInstance(options.context!, cwd!)

		// 计算 MCP 相关
		const hasMcpGroup = currentMode.groups.some((groupEntry) => getGroupName(groupEntry) === "mcp")
		const hasMcpServers = mcpHub && mcpHub.getServers().length > 0
		const shouldIncludeMcp = hasMcpGroup && hasMcpServers

		// 生成能力段
		try {
			const capabilities = getCapabilitiesSection(
				cwd,
				supportsComputerUse,
				shouldIncludeMcp ? mcpHub : undefined,
				effectiveDiffStrategy,
				codeIndexManager
			)
			PromptSegmentAssembler.setSegment(segments, 'capabilities', capabilities)
		} catch (error) {
			console.warn("[SystemPromptAssembler] Failed to generate capabilities:", error)
		}

		// 生成规则段
		try {
			const rules = getRulesSection(
				cwd,
				supportsComputerUse,
				effectiveDiffStrategy,
				codeIndexManager,
				mode
			)
			PromptSegmentAssembler.setSegment(segments, 'rules', rules)
		} catch (error) {
			console.warn("[SystemPromptAssembler] Failed to generate rules:", error)
		}

		// 生成目标段
		try {
			const objectives = getObjectiveSection(codeIndexManager, experiments)
			PromptSegmentAssembler.setSegment(segments, 'objectives', objectives)
		} catch (error) {
			console.warn("[SystemPromptAssembler] Failed to generate objectives:", error)
		}

		// 生成模式段
		try {
			const modes = await getModesSection(options.context)
			PromptSegmentAssembler.setSegment(segments, 'modes', modes)
		} catch (error) {
			console.warn("[SystemPromptAssembler] Failed to generate modes:", error)
		}

		// 生成系统信息段
		try {
			const systemInfo = getSystemInfoSection(cwd)
			PromptSegmentAssembler.setSegment(segments, 'systemInfo', systemInfo)
		} catch (error) {
			console.warn("[SystemPromptAssembler] Failed to generate system info:", error)
		}
	}

	/**
	 * 生成自定义指令段
	 */
	private async generateCustomInstructionSegments(
		segments: PromptSegmentVariables,
		options: SystemPromptAssemblyOptions
	): Promise<void> {
		const { mode, customModePrompts, customModes, globalCustomInstructions, cwd, language, rooIgnoreInstructions, settings, rolePromptData } = options

		try {
			// 获取模式选择
			const promptComponent = this.getPromptComponent(customModePrompts, mode || "act")
			let { roleDefinition, baseInstructions } = getModeSelection(mode || "act", promptComponent, customModes)

			// 应用角色覆盖
			if (rolePromptData) {
				const overridden = this.roleGenerator.applyRoleOverrides(
					{
						roleDefinition,
						baseInstructions,
						description: rolePromptData.role?.description || "",
					},
					rolePromptData,
					{
						mode,
						customModes,
						customModePrompts,
						personaFallback: options.anhPersonaMode || "hybrid",
					},
				)
				roleDefinition = overridden.roleDefinition
				baseInstructions = overridden.baseInstructions
			}

			// 添加自定义指令
			const customInstructions = await addCustomInstructions(
				baseInstructions,
				globalCustomInstructions || "",
				cwd!,
				mode || "act",
				{
					language: language ?? formatLanguage(vscode.env.language),
					rooIgnoreInstructions,
					settings,
				},
			)

			PromptSegmentAssembler.setSegment(segments, 'customInstructions', customInstructions)
		} catch (error) {
			console.warn("[SystemPromptAssembler] Failed to generate custom instructions:", error)
		}
	}

	/**
	 * 生成变量状态段
	 */
	private async generateVariableStateSegments(
		segments: PromptSegmentVariables,
		options: SystemPromptAssemblyOptions
	): Promise<void> {
		const { enableInjectSystemPromptVariables, currentTask, todoList } = options

		if (!enableInjectSystemPromptVariables || !currentTask) {
			return
		}

		try {
			const variableState = currentTask.getLatestVariableState?.() || {}
			if (!variableState || Object.keys(variableState).length === 0) {
				console.log("[SystemPromptAssembler] No variable state available to inject")
				return
			}

			const todoVariables = todoList ? this.variableInjector.extractVariablesFromTodoList(todoList) : {}
			const combinedVariables = { ...variableState, ...todoVariables }
			const cleanedVariables = this.variableInjector.cleanVariableState(combinedVariables)

			const injectionResult = this.variableInjector.injectVariableState(
				"",
				cleanedVariables,
				{
					enabled: true,
					format: "structured",
					maxVariables: 50,
				}
			)

			if (injectionResult.injected && injectionResult.content) {
				PromptSegmentAssembler.setSegment(segments, 'variableState', injectionResult.content)
			}
		} catch (error) {
			console.warn("[SystemPromptAssembler] Failed to generate variable state:", error)
		}
	}

	/**
	 * 生成格式化段
	 */
	private async generateFormattingSegments(
		segments: PromptSegmentVariables,
		options: SystemPromptAssemblyOptions
	): Promise<void> {
		try {
			const markdownFormatting = markdownFormattingSection()
			PromptSegmentAssembler.setSegment(segments, 'markdownFormatting', markdownFormatting)
		} catch (error) {
			console.warn("[SystemPromptAssembler] Failed to generate formatting:", error)
		}
	}

	/**
	 * 组装最终提示词
	 */
	private assembleFinalPrompt(
		segments: PromptSegmentVariables,
		options: SystemPromptAssemblyOptions
	): string {
		// 确定段顺序
		let segmentOrder = options.segmentOrder || DEFAULT_SEGMENT_ORDER

		// 根据模式调整顺序
		if (options.chatMode) {
			segmentOrder = CHAT_MODE_SEGMENT_ORDER
		} else if (options.developerMode) {
			segmentOrder = DEVELOPER_MODE_SEGMENT_ORDER
		}

		// 构建组装选项
		const assemblyOptions: PromptSegmentAssemblyOptions = {
			segmentOrder,
			includeUserAvatar: options.includeUserAvatar,
			includeToolDefinitions: options.includeToolDefinitions,
			includeWorldbook: options.includeWorldbook,
			includeMCP: options.includeMCP,
			includeMemory: options.includeMemory,
			includeVariableState: options.includeVariableState,
			userAvatarInsertBefore: options.userAvatarInsertBefore,
			toolDefinitionsInsertAfter: options.toolDefinitionsInsertAfter,
			worldbookInsertAfter: options.worldbookInsertAfter,
			summaryOnly: options.summaryOnly,
			maxSegments: options.maxSegments,
			chatMode: options.chatMode,
			developerMode: options.developerMode,
			debugMode: options.debugMode,
		}

		// 应用正则处理
		const processedSegments = this.applyRegexProcessing(segments, options)

		// 组装最终提示词
		return PromptSegmentAssembler.assemblePrompt(processedSegments, assemblyOptions)
	}

	/**
	 * 应用正则处理
	 */
	private applyRegexProcessing(
		segments: PromptSegmentVariables,
		options: SystemPromptAssemblyOptions
	): PromptSegmentVariables {
		if (!options.experiments?.stRegexProcessor) {
			return segments
		}

		try {
			const regexManager = getRegexProcessorManager()
			if (!regexManager.isProcessorEnabled()) {
				return segments
			}

			// 构建正则变量
			const regexVariables = this.buildRegexVariables(options)

			// 处理每个段
			const processedSegments = PromptSegmentAssembler.createSegments()
			Object.entries(segments).forEach(([segmentName, segmentContent]) => {
				if (segmentContent && typeof segmentContent === 'string') {
					const processed = regexManager.processFinalContent(
						segmentContent,
						RegexTargetSource.PROMPT_CONTENT,
						{
							variables: regexVariables,
							stage: "segment_processing",
						}
					)
					PromptSegmentAssembler.setSegment(processedSegments, segmentName as keyof PromptSegmentVariables, processed)
				}
			})

			return processedSegments
		} catch (error) {
			console.warn("[SystemPromptAssembler] Failed to apply regex processing:", error)
			return segments
		}
	}

	/**
	 * 构建正则变量
	 */
	private buildRegexVariables(options: SystemPromptAssemblyOptions): Record<string, any> {
		const { cwd, mode, rolePromptData, userAvatarRole } = options
		const role = rolePromptData?.role

		const now = new Date()

		return {
			user: userAvatarRole?.name || "用户",
			char: role?.name || "",
			name: role?.name || "",
			description: role?.description || "",
			personality: role?.personality || "",
			scenario: role?.scenario || "",
			first_mes: role?.first_mes || "",
			mes_example: role?.mes_example || "",
			isodate: now.toISOString().split("T")[0],
			isotime: now.toTimeString().split(" ")[0],
			mode,
			workspace: cwd,
		}
	}

	/**
	 * 生成降级系统提示词
	 */
	private generateFallbackSystemPrompt(options: SystemPromptAssemblyOptions): string {
		const { mode, customModes, customModePrompts, globalCustomInstructions } = options
		const modeConfig = customModes?.find((m) => m.slug === mode)
		const promptComponent = mode ? customModePrompts?.[mode] : undefined

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
	 * 获取提示组件
	 */
	private getPromptComponent(
		customModePrompts: CustomModePrompts | undefined,
		mode: Mode,
	): PromptComponent | undefined {
		const component = customModePrompts?.[mode]
		if (!component || isEmpty(component)) {
			return undefined
		}
		return component
	}

	/**
	 * 为增强导向模式生成增强的角色信息
	 */
	generateEnhancedRoleInfo(
		rolePromptData: RolePromptData,
		userAvatarRole?: Role,
		enableUserAvatar?: boolean,
	): EnhancedRoleInfo {
		return this.roleGenerator.generateEnhancedRoleInfo(rolePromptData, userAvatarRole, enableUserAvatar, {
			summaryOnly: true,
			includeSystemInstructions: true,
			includeUserAvatar: true,
			maxLength: 2000,
		})
	}

	/**
	 * 获取段预览（用于调试）
	 */
	static getSegmentPreview(segments: PromptSegmentVariables): string {
		return PromptSegmentAssembler.getSegmentPreview(segments)
	}

	/**
	 * 验证段完整性
	 */
	static validateSegments(segments: PromptSegmentVariables) {
		return PromptSegmentAssembler.validateSegments(segments)
	}
}
