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

import { RegexTargetSource } from "@roo-code/types"
import type { Mode } from "../../../shared/modes"
import { getModeSelection, getModeBySlug, modes, getGroupName } from "../../../shared/modes"
import { formatLanguage } from "../../../shared/language"
import type { DiffStrategy } from "../../../shared/tools"
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

export interface SystemPromptOptions {
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
}

export interface FilePromptOptions {
	context: vscode.ExtensionContext
	cwd: string
	mode: Mode
	customModePrompts?: CustomModePrompts
	customModes?: ModeConfig[]
	globalCustomInstructions?: string
	rolePromptData?: RolePromptData
	userAvatarRole?: Role
	enableUserAvatar?: boolean
	userAvatarVisibility?: UserAvatarVisibility
	language?: string
	experiments?: Record<string, boolean>
	enableInjectSystemPromptVariables?: boolean
	currentTask?: any
	todoList?: TodoItem[]
	anhPersonaMode?: RolePersona
	anhToneStrict?: boolean
}

/**
 * 系统提示词组装器
 * 负责协调各个生成器，组装完整的系统提示词
 */
export class PromptBuilder {
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
	async buildSystemPrompt(options: SystemPromptOptions): Promise<string> {
		const {
			context,
			cwd,
			supportsComputerUse,
			mcpHub,
			diffStrategy,
			browserViewportSize = "900x600",
			mode = "code",
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
		} = options

		if (!context) {
			throw new Error("Extension context is required for generating system prompt")
		}

		// 1. 应用 STProfile 预处理，确保角色在进入后续流程前已经完成变量替换及 S.T. 处理
		let processedRolePromptData = rolePromptData
		
		debugLog("[PromptBuilder] STProfile preprocessing check:", {
			hasRolePromptData: !!rolePromptData,
			hasRole: !!rolePromptData?.role,
			enabledTSProfiles: enabledTSProfiles,
			enabledTSProfilesCount: enabledTSProfiles?.length || 0,
			anhTsProfileAutoInject: anhTsProfileAutoInject,
			templateVariablesCount: Object.keys(anhTsProfileVariables || {}).length
		})
		
		if (rolePromptData?.role && enabledTSProfiles && enabledTSProfiles.length > 0) {
			debugLog("[PromptBuilder] Starting STProfile preprocessing...")
			const workspaceProfileDir = path.join(cwd, "novel-helper", ".anh-chat", "tsprofile")
			let globalProfileDir: string | undefined

			try {
				const globalStorageService = await getGlobalStorageService(context)
				globalProfileDir = globalStorageService.getGlobalTsProfilesPath()
				debugLog("[PromptBuilder] Global TSProfile directory resolved:", globalProfileDir)
			} catch (error) {
				console.warn("[SYSTEM_PROMPT] Failed to resolve global TSProfile directory:", error)
			}

			const originalRole = { ...rolePromptData.role }
			const processedRole = await this.stProfileGenerator.applyPreprocessing(rolePromptData.role, enabledTSProfiles, {
				scope: "workspace",
				autoInject: anhTsProfileAutoInject ?? true,
				templateVariables: anhTsProfileVariables ?? {},
				userAvatarRole,
				workspaceProfileDir,
				globalProfileDir,
			})
			
			processedRolePromptData = {
				...rolePromptData,
				role: processedRole,
			}
			
			debugLog("[PromptBuilder] STProfile preprocessing completed:", {
				originalRoleHasSystemPrompt: !!originalRole.system_prompt,
				processedRoleHasSystemPrompt: !!processedRole.system_prompt,
				originalRoleHasSystemSettings: !!originalRole.system_settings,
				processedRoleHasSystemSettings: !!processedRole.system_settings,
				originalRoleHasUserSettings: !!originalRole.user_settings,
				processedRoleHasUserSettings: !!processedRole.user_settings,
				originalRoleHasAssistantSettings: !!originalRole.assistant_settings,
				processedRoleHasAssistantSettings: !!processedRole.assistant_settings,
				systemPromptLength: processedRole.system_prompt?.length || 0,
				systemSettingsLength: processedRole.system_settings?.length || 0,
				userSettingsLength: processedRole.user_settings?.length || 0,
				assistantSettingsLength: processedRole.assistant_settings?.length || 0,
			})
		} else {
			debugLog("[PromptBuilder] Skipping STProfile preprocessing - no enabled profiles or role data")
		}

		const promptComponent = this.getPromptComponent(customModePrompts, mode)
		const currentMode = getModeBySlug(mode, customModes) || modes.find((m) => m.slug === mode) || modes[0]

		// 2. 优先尝试生成基于文件的系统提示词
		const filePrompt = await this.tryBuildFileSystemPrompt({
			context,
			cwd,
			mode,
			language,
			promptComponent,
			customModes,
			customModePrompts,
			globalCustomInstructions,
			rolePromptData: processedRolePromptData,
			userAvatarRole,
			enableUserAvatar,
			userAvatarVisibility,
			experiments,
			enableInjectSystemPromptVariables,
			currentTask,
			todoList,
			anhPersonaMode,
			rooIgnoreInstructions,
			settings,
		})

		if (filePrompt) {
			return filePrompt
		}

		// 3. 计算 Diff 策略与代码索引管理器
		const effectiveDiffStrategy = diffEnabled ? diffStrategy : undefined
		const codeIndexManager = CodeIndexManager.getInstance(context, cwd)

		// 4. 构建角色相关区块（使用新的字段变量方法）
		const roleSectionBlock = this.buildRoleSectionBlock(
			processedRolePromptData,
			userAvatarRole,
			enableUserAvatar,
			userAvatarVisibility,
		)

		// 5. 构建世界观与世界书区块
		const { worldsetSection: worldsetSectionBlock, worldBookSection: worldBookSectionBlock } =
			await this.worldBookGenerator.generateWorldSections({
				context,
				cwd,
				mode,
				enabledWorldsets,
				worldBookContent,
				rolePromptData: processedRolePromptData,
				userAvatarRole,
			})

		const memorySectionBlock = this.buildMemorySectionBlock(memoryTriggerResult, settings)

		// 6. 应用角色覆盖逻辑，生成角色定义与基础指令
		let { roleDefinition, baseInstructions } = getModeSelection(mode, promptComponent, customModes)
		if (processedRolePromptData) {
			const overridden = this.roleGenerator.applyRoleOverrides(
				{
					roleDefinition,
					baseInstructions,
					description: processedRolePromptData.role?.description || "",
				},
				processedRolePromptData,
				{
					mode,
					customModes,
					customModePrompts,
					personaFallback: anhPersonaMode || "hybrid",
				},
			)
			roleDefinition = overridden.roleDefinition
			baseInstructions = overridden.baseInstructions
		}

		// 7. 计算 MCP、模式等附加信息
		const hasMcpGroup = currentMode.groups.some((groupEntry) => getGroupName(groupEntry) === "mcp")
		const hasMcpServers = mcpHub && mcpHub.getServers().length > 0
		const shouldIncludeMcp = hasMcpGroup && hasMcpServers

		const [modesSectionContent, mcpServersSection] = await Promise.all([
			getModesSection(context),
			shouldIncludeMcp ? getMcpServersSection(mcpHub, effectiveDiffStrategy, enableMcpServerCreation) : Promise.resolve(""),
		])

		// 8. 依据 persona 模式构建主体提示词
		const personaMode = processedRolePromptData?.role?.modeOverrides?.persona || anhPersonaMode

		// Determine if we're in pure chat mode (only persona matters, not mode itself)
		let isPureChatMode = false
		if (personaMode === "chat") {
			isPureChatMode = true
		}

		let promptSections: string[] = [
			roleDefinition,
			"",
			roleSectionBlock,
		]

		if (worldsetSectionBlock) {
			promptSections.push(worldsetSectionBlock)
		}
		if (worldBookSectionBlock) {
			promptSections.push(worldBookSectionBlock)
		}

		if (memorySectionBlock) {
			promptSections.push(memorySectionBlock)
		}

		promptSections.push(markdownFormattingSection(), "")

		if (isPureChatMode) {
			const chatObjectiveSection = `====

OBJECTIVE

You are engaging in conversation with the user as your character. Focus on:
1. Maintaining your character's personality and speaking style
2. Responding naturally to the user's questions and comments
3. Providing helpful and engaging conversation
4. Using memory tools to remember important information from conversations
5. Asking questions when you need clarification to better help the user
6. Avoiding technical programming discussions unless specifically requested`

			const conversationGuidance =
				anhUseAskTool === false
					? `
- 尽量避免使用提问工具，直接与用户自然对话
- 如果需要澄清问题，直接在对话中询问，不要使用正式的提问工具
- 保持对话的流畅性和自然感，减少机械化的交互
- 像真人一样交流，而不是像机器人一样按流程操作`
					: ""

			const chatRulesSection = `====

RULES

- Be natural and conversational in your responses
- Feel free to use friendly greetings and expressions like "好的", "当然", "很高兴" etc.
- Use memory tools to remember important information shared in conversations
- You can ask questions to better understand the user or to continue the conversation
- Focus on building a good conversational experience
- Do not call the attempt_completion tool to end casual conversations. Only use it when executing a clearly defined task or subtask.
- If the user requests programming help, you can switch to a more technical mode${conversationGuidance}`

			const toolDescriptions = getToolDescriptionsForMode(
				mode,
				cwd,
				supportsComputerUse,
				codeIndexManager,
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
				.split("\n\n")
				.filter((section) => {
					if (
						section.includes("## ask_followup_question") ||
						section.includes("## add_") ||
						section.includes("## search_") ||
						section.includes("## get_") ||
						section.includes("## update_") ||
						section.includes("## cleanup_") ||
						section.includes("## recent_") ||
						section.includes("🧠 Memory Tools")
					) {
						return true
					}

					return (
						section.startsWith("# Tools") ||
						section.includes("Memory Tools") ||
						section.includes("Memory System")
					)
				})
				.join("\n\n")

			promptSections = promptSections.concat([
				getSystemInfoSection(cwd),
				"",
				chatObjectiveSection,
				"",
				chatRulesSection,
				"",
				toolDescriptions,
				"",
			])
		} else {
			promptSections = promptSections.concat([
				getSharedToolUseSection(),
				"",
				getToolDescriptionsForMode(
					mode,
					cwd,
					supportsComputerUse,
					codeIndexManager,
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
				),
				"",
				getToolUseGuidelinesSection(codeIndexManager),
				"",
				mcpServersSection,
				"",
				getCapabilitiesSection(cwd, supportsComputerUse, shouldIncludeMcp ? mcpHub : undefined, effectiveDiffStrategy, codeIndexManager),
				"",
				modesSectionContent,
				"",
				getRulesSection(cwd, supportsComputerUse, effectiveDiffStrategy, codeIndexManager, mode),
				"",
				anhUseAskTool === false
					? `====

CONVERSATION GUIDANCE

- 尽量避免使用提问工具，直接与用户自然对话
- 如果需要澄清问题，直接在对话中询问，不要使用正式的提问工具
- 保持对话的流畅性和自然感，减少机械化的交互
- 像真人一样交流，而不是像机器人一样按流程操作
`
					: `====

ASK TOOL USAGE GUIDANCE

当你需要澄清用户需求或者获取更多特定细节来完成任务时，请积极使用提问工具。以下是完整的工具描述：

## ask_followup_question
Description: Ask the user a question to gather additional information needed to complete the task. Use when you need clarification or more details to proceed effectively.

Parameters:
- question: (required) A clear, specific question addressing the information needed
- follow_up: (required) A list of 2-4 suggested answers, each in its own <suggest> tag. Suggestions must be complete, actionable answers without placeholders. Optionally include mode attribute to switch modes (code/architect/etc.)

Usage:
<ask_followup_question>
<question>Your question here</question>
<follow_up>
<suggest>First suggestion</suggest>
<suggest mode="code">Action with mode switch</suggest>
</follow_up>
</ask_followup_question>

Example:
<ask_followup_question>
<question>What is the path to the frontend-config.json file?</question>
<follow_up>
<suggest>./src/frontend-config.json</suggest>
<suggest>./config/frontend-config.json</suggest>
<suggest>./frontend-config.json</suggest>
</follow_up>
</ask_followup_question>

使用建议：
- 当需要澄清用户需求时，主动使用此工具
- 提供2-4个具体的建议选项，让用户快速选择
- 建议选项应该是完整的、可操作的答案
- 优先使用此工具而不是在对话中模糊询问
`,
				getSystemInfoSection(cwd),
				"",
				getObjectiveSection(codeIndexManager, experiments),
				"",
			])
		}

		const customInstructions = await addCustomInstructions(baseInstructions, globalCustomInstructions || "", cwd, mode, {
			language: language ?? formatLanguage(vscode.env.language),
			rooIgnoreInstructions,
			settings,
		})

		promptSections.push(customInstructions)

		const basePrompt = promptSections.join("\n")

		// 9. 应用 ST Regex 处理
		const regexVariables = this.buildRegexVariables({
			cwd,
			mode,
			rolePromptData: processedRolePromptData,
			userAvatarRole,
		})
		const promptAfterRegex = this.applyRegexProcessing(
			basePrompt,
			experiments,
			regexVariables,
			"system_prompt_generation",
		)

		// 10. 注入变量状态
		return this.injectVariableState(promptAfterRegex, {
			enableInjectSystemPromptVariables,
			currentTask,
			todoList,
			maxVariables: 50,
		})
	}

	/**
	 * 构建基于文件的系统提示词
	 */
	async buildFileBasedPrompt(options: FilePromptOptions): Promise<string> {
		const {
			context,
			cwd,
			mode,
			customModePrompts,
			customModes,
			globalCustomInstructions,
			rolePromptData,
			userAvatarRole,
			enableUserAvatar,
			userAvatarVisibility,
			language,
			experiments,
			enableInjectSystemPromptVariables,
			currentTask,
			todoList,
			anhPersonaMode,
			anhToneStrict,
		} = options

		if (!context) {
			throw new Error("Extension context is required for generating file-based system prompt")
		}

		if (!cwd) {
			throw new Error("Workspace directory (cwd) is required for generating file-based system prompt")
		}

		const promptComponent = this.getPromptComponent(customModePrompts, mode)

		const filePrompt = await this.tryBuildFileSystemPrompt({
			context,
			cwd,
			mode,
			language,
			promptComponent,
			customModes,
			customModePrompts,
			globalCustomInstructions,
			rolePromptData,
			userAvatarRole,
			enableUserAvatar,
			userAvatarVisibility,
			experiments,
			enableInjectSystemPromptVariables,
			currentTask,
			todoList,
			anhPersonaMode,
		})

		if (!filePrompt) {
			throw new Error(`No custom system prompt file found for mode: ${mode}`)
		}

		return filePrompt
	}

	private async tryBuildFileSystemPrompt(options: {
		context: vscode.ExtensionContext
		cwd: string
		mode: Mode
		language?: string
		promptComponent?: PromptComponent
		customModes?: ModeConfig[]
		customModePrompts?: CustomModePrompts
		globalCustomInstructions?: string
		rolePromptData?: RolePromptData
		userAvatarRole?: Role
		enableUserAvatar?: boolean
		userAvatarVisibility?: UserAvatarVisibility
		experiments?: Record<string, boolean>
		enableInjectSystemPromptVariables?: boolean
		currentTask?: any
		todoList?: TodoItem[]
		anhPersonaMode?: RolePersona
		anhToneStrict?: boolean
		rooIgnoreInstructions?: string
		settings?: SystemPromptSettings
	}): Promise<string | null> {
		const {
			context,
			cwd,
			mode,
			language,
			promptComponent,
			customModes,
			customModePrompts,
			globalCustomInstructions,
			rolePromptData,
			userAvatarRole,
			enableUserAvatar,
			userAvatarVisibility,
			experiments,
			enableInjectSystemPromptVariables,
			currentTask,
			todoList,
			anhPersonaMode,
			anhToneStrict,
			rooIgnoreInstructions,
			settings,
		} = options

		try {
			const variablesForPrompt: PromptVariables = {
				workspace: cwd,
				mode,
				language: language ?? formatLanguage(vscode.env.language),
				shell: vscode.env.shell,
				operatingSystem: os.type(),
			}

			const fileCustomSystemPrompt = await loadSystemPromptFile(cwd, mode, variablesForPrompt)
			if (!fileCustomSystemPrompt) {
				return null
			}

			console.log(`[SYSTEM_PROMPT] Using file-based system prompt for mode "${mode}"`)

			let { roleDefinition, baseInstructions } = getModeSelection(mode, promptComponent, customModes)

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
						personaFallback: anhPersonaMode || "hybrid",
						toneStrict: anhToneStrict,
					},
				)

				roleDefinition = overridden.roleDefinition
				baseInstructions = overridden.baseInstructions
			}

			const customInstructions = await addCustomInstructions(
				baseInstructions,
				globalCustomInstructions || "",
				cwd,
				mode,
				{
					language: language ?? formatLanguage(vscode.env.language),
					rooIgnoreInstructions,
					settings,
				},
			)

			const roleSectionBlock = this.buildRoleSectionBlock(
				rolePromptData,
				userAvatarRole,
				enableUserAvatar,
				userAvatarVisibility,
			)

			let filePrompt = `${roleDefinition}

${roleSectionBlock}${fileCustomSystemPrompt}

${customInstructions}`

			const regexVariables = this.buildRegexVariables({
				cwd,
				mode,
				rolePromptData,
				userAvatarRole,
			})

			filePrompt = this.applyRegexProcessing(filePrompt, experiments, regexVariables, "file_system_prompt")

			return this.injectVariableState(filePrompt, {
				enableInjectSystemPromptVariables,
				currentTask,
				todoList,
				maxVariables: 50,
			})
		} catch (error) {
			console.warn("[SYSTEM_PROMPT] Failed to build file-based system prompt:", error)
			return null
		}
	}

	private buildMemorySectionBlock(
		memoryTriggerResult: MemoryTriggerResult | undefined,
		settings: SystemPromptSettings | undefined,
	): string {
		if (!memoryTriggerResult || settings?.memorySystemEnabled === false) {
			return ""
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

		if (!memoryContent) {
			return ""
		}

		return `

====

ROLE MEMORY CONTEXT

Use the following memories to maintain continuity, personality, and story consistency:

${memoryContent}

====

`
	}

	private buildRoleSectionBlock(
		rolePromptData: RolePromptData | undefined,
		userAvatarRole: Role | undefined,
		enableUserAvatar: boolean | undefined,
		userAvatarVisibility: UserAvatarVisibility | undefined,
	): string {
		if (!rolePromptData) {
			return ""
		}

		// 使用新的字段变量方法生成AI角色字段
		const aiRoleVariables = this.roleGenerator.generateRoleSectionVariables(rolePromptData, userAvatarRole, enableUserAvatar, {})
		
		// 生成用户头像字段
		const userAvatarSection = this.roleGenerator.generateUserAvatarSection(
			enableUserAvatar,
			userAvatarRole,
			userAvatarVisibility ?? "full",
		)

		// 将用户头像信息添加到字段变量中
		if (userAvatarSection && userAvatarSection.trim()) {
			// 提取用户头像内容，去除 "USER AVATAR" 标题
			const userAvatarContent = userAvatarSection
				.replace(/USER AVATAR\s*\n/, '')
				.replace(/以下是目前设置的用户角色信息。在对话中请将用户视为扮演以下角色：\s*\n/, '')
				.trim()

			if (userAvatarContent) {
				// 使用 PromptAssembler 的 setField 方法设置用户头像字段
				// 注意：这里我们直接修改字段变量对象
				if (aiRoleVariables.dynamicFields && typeof aiRoleVariables.dynamicFields === 'object') {
					aiRoleVariables.dynamicFields.userAvatar = userAvatarContent
				} else {
					aiRoleVariables.dynamicFields = {
						userAvatar: userAvatarContent
					}
				}
			}
		}

		// 使用 PromptAssembler 组装最终内容，确保 USER AVATAR 在 system settings 前面
		const finalContent = this.roleGenerator.generateRoleSection(rolePromptData, userAvatarRole, enableUserAvatar, {})

		// 如果有用户头像部分，需要重新组装以确保正确的顺序
		if (userAvatarSection && userAvatarSection.trim()) {
			// 使用 PromptAssembler 来确保正确的字段顺序
			const assembledContent = this.roleGenerator.generateRoleSection(rolePromptData, userAvatarRole, enableUserAvatar, {})
			
			// 手动插入用户头像部分到 system settings 前面
			const systemSettingsIndex = assembledContent.indexOf('### System Settings')
			if (systemSettingsIndex !== -1) {
				// 在 system settings 前面插入用户头像
				const beforeSystemSettings = assembledContent.substring(0, systemSettingsIndex)
				const afterSystemSettings = assembledContent.substring(systemSettingsIndex)
				
				// 构建用户头像部分
				const userAvatarPart = `\n\nUSER AVATAR\n${userAvatarSection.trim()}\n\n`
				
				return beforeSystemSettings + userAvatarPart + afterSystemSettings
			}
		}

		return finalContent
	}

	private buildRegexVariables(options: {
		cwd: string
		mode: Mode | string
		rolePromptData?: RolePromptData
		userAvatarRole?: Role
	}): Record<string, any> {
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

	private applyRegexProcessing(
		content: string,
		experiments: Record<string, boolean> | undefined,
		variables: Record<string, any>,
		stage: "file_system_prompt" | "system_prompt_generation",
	): string {
		if (!experiments?.stRegexProcessor) {
			console.log("[ANH-Chat:SystemPrompt] ⏭️ ST regex processor is not enabled in experiments")
			return content
		}

		try {
			const regexManager = getRegexProcessorManager()
			console.log("[ANH-Chat:SystemPrompt] 🔍 ST regex processor is enabled in experiments, applying processing...")

			if (!regexManager.isProcessorEnabled()) {
				console.log("[ANH-Chat:SystemPrompt] ⏭️ Regex processor is enabled but not initialized, skipping processing")
				return content
			}

			const startTime = Date.now()
			const processed = regexManager.processFinalContent(content, RegexTargetSource.PROMPT_CONTENT, {
				variables,
				stage,
			})
			const processingTime = Date.now() - startTime

			console.log(`[ANH-Chat:SystemPrompt] ✅ ST regex processing completed in ${processingTime}ms`)
			console.log(`[ANH-Chat:SystemPrompt] 📏 Prompt length before: ${content.length}, after: ${processed.length}`)

			if (processed !== content) {
				console.log("[ANH-Chat:SystemPrompt] 🔄 System prompt was MODIFIED by regex processing")
			} else {
				console.log("[ANH-Chat:SystemPrompt] ⏭️ System prompt was unchanged by regex processing")
			}

			debugRegexProcessorStatus()

			return processed
		} catch (error) {
			console.warn("[ANH-Chat:SystemPrompt] ❌ Failed to apply ST regex processing:", error)
			return content
		}
	}

	private injectVariableState(
		basePrompt: string,
		options: {
			enableInjectSystemPromptVariables?: boolean
			currentTask?: any
			todoList?: TodoItem[]
			maxVariables?: number
		},
	): string {
		const { enableInjectSystemPromptVariables, currentTask, todoList, maxVariables = 50 } = options

		if (!enableInjectSystemPromptVariables || !currentTask) {
			return basePrompt
		}

		try {
			const variableState = currentTask.getLatestVariableState?.() || {}
			if (!variableState || Object.keys(variableState).length === 0) {
				console.log("[SYSTEM_PROMPT] ℹ️ No variable state available to inject")
				return basePrompt
			}

			const todoVariables = todoList ? this.variableInjector.extractVariablesFromTodoList(todoList) : {}
			const combinedVariables = { ...variableState, ...todoVariables }
			const cleanedVariables = this.variableInjector.cleanVariableState(combinedVariables)

			const injectionResult = this.variableInjector.injectVariableState(basePrompt, cleanedVariables, {
				enabled: true,
				format: "structured",
				maxVariables,
			})

			if (injectionResult.injected) {
				debugLog(`Variable state injection successful: ${injectionResult.variablesCount} variables`)
				return injectionResult.content
			}

			return basePrompt
		} catch (error) {
			console.warn("[SYSTEM_PROMPT] ❌ Failed to inject variable state:", error)
			return basePrompt
		}
	}

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
	 * 组装系统提示词各个部分
	 */
	private async assemblePromptSections(options: {
		roleDefinition: string
		customInstructions: string
		globalCustomInstructions?: string
		roleSectionBlock: string
		worldsetSectionBlock: string
		supportsComputerUse: boolean
		mcpHub?: McpHub
		diffStrategy?: DiffStrategy
		browserViewportSize?: string
		mode: Mode
		customModes?: ModeConfig[]
		diffEnabled?: boolean
		language?: string
		partialReadsEnabled?: boolean
		settings?: SystemPromptSettings
		rooIgnoreInstructions?: string
		extensionToolDescriptions?: string[]
		enableMcpServerCreation?: boolean
	}): Promise<string[]> {
		const {
			roleDefinition,
			customInstructions,
			globalCustomInstructions,
			roleSectionBlock,
			worldsetSectionBlock,
			supportsComputerUse,
			mcpHub,
			diffStrategy,
			browserViewportSize,
			mode,
			customModes,
			diffEnabled,
			language,
			partialReadsEnabled,
			settings,
			rooIgnoreInstructions,
			extensionToolDescriptions,
			enableMcpServerCreation,
		} = options

		const sections: string[] = []

		// 角色定义
		sections.push(roleDefinition)

		// 角色信息块
		if (roleSectionBlock) {
			sections.push(roleSectionBlock.trim())
		}

		// 世界观设定
		if (worldsetSectionBlock) {
			sections.push(worldsetSectionBlock.trim())
		}

		// 工具描述
		if (extensionToolDescriptions && extensionToolDescriptions.length > 0) {
			sections.push(extensionToolDescriptions.join("\n\n"))
		}

		// 能力部分
		// sections.push(getCapabilitiesSection(
		// 	supportsComputerUse,
		// 	mode,
		// 	customModes,
		// 	partialReadsEnabled
		// ))

		// 工具使用指南
		// sections.push(getToolUseGuidelinesSection(mode, customModes))

		// 共享工具使用部分
		// sections.push(getSharedToolUseSection(diffStrategy, settings?.memoryToolsEnabled || false))

		// MCP服务器部分
		if (mcpHub) {
			// const mcpServersContent = await getMcpServersSection(
			// 	mcpHub,
			// 	mode,
			// 	customModes,
			// 	enableMcpServerCreation,
			// 	extensionToolDescriptions || [],
			// )
			const mcpServersContent = ""
			if (mcpServersContent) {
				sections.push(mcpServersContent)
			}
		}

		// 浏览器工具部分
		if (supportsComputerUse) {
			sections.push(
				`You have access to a browser tool to help the user accomplish their tasks. When using the browser:
- Take screenshots to understand the current state of a website
- Interact with web pages by clicking elements and typing text
- Extract information from web pages to answer questions
- Use the browser for research, testing, and verification tasks
- The browser viewport size is ${browserViewportSize}

Only use the browser when it's genuinely helpful for the user's request.`,
			)
		}

		// 模式部分
		// sections.push(getModesSection(mode, customModes))

		// 规则部分
		// sections.push(getRulesSection(settings?.useAgentRules ?? true, rooIgnoreInstructions))

		// 目标部分
		// sections.push(getObjectiveSection())

		// 系统信息部分
		// sections.push(getSystemInfoSection(language))

		// 自定义指令
		// addCustomInstructions(sections, [customInstructions, globalCustomInstructions])

		// Markdown格式化部分
		sections.push(markdownFormattingSection())

		return sections
	}

}
