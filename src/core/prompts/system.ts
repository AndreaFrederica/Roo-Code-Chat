import * as vscode from "vscode"
import * as os from "os"

import type { ModeConfig, PromptComponent, CustomModePrompts, TodoItem, Role } from "@roo-code/types"

import type { SystemPromptSettings } from "./types"
import type {
	RolePromptData,
	RoleModeOverrides,
	RolePersona,
	StorylineArc,
	MemoryTrait,
	MemoryGoal,
	MemoryEpisodicRecord,
} from "@roo-code/types"

import { Mode, modes, defaultModeSlug, getModeBySlug, getGroupName, getModeSelection } from "../../shared/modes"
import { DiffStrategy } from "../../shared/tools"
import { formatLanguage } from "../../shared/language"
import { isEmpty } from "../../utils/object"

import { McpHub } from "../../services/mcp/McpHub"
import { CodeIndexManager } from "../../services/code-index/manager"

import { PromptVariables, loadSystemPromptFile } from "./sections/custom-system-prompt"

import { getToolDescriptionsForMode } from "./tools"
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
} from "./sections"

// Helper function to get prompt component, filtering out empty objects
export function getPromptComponent(
	customModePrompts: CustomModePrompts | undefined,
	mode: string,
): PromptComponent | undefined {
	const component = customModePrompts?.[mode]
	// Return undefined if component is empty
	if (isEmpty(component)) {
		return undefined
	}
	return component
}

function buildRolePromptSection(rolePromptData?: RolePromptData): string {
	if (!rolePromptData) {
		return ""
	}

	const { role, storyline, memory } = rolePromptData
	const sections: string[] = []

	// Build character overview section
	const overviewItems: string[] = [`- Name: ${role.name}`, `- Type: ${role.type}`]
	if (role.affiliation) {
		overviewItems.push(`- Affiliation: ${role.affiliation}`)
	}
	if (role.aliases && role.aliases.length > 0) {
		overviewItems.push(`- Aliases: ${role.aliases.join(" / ")}`)
	}
	if (role.color) {
		overviewItems.push(`- Signature Color: ${role.color}`)
	}
	
	// 优先使用顶层description，如果没有则使用profile.appearance
	const description = role.description || (typeof role.profile?.appearance === 'string' ? role.profile.appearance : '')
	if (description) {
		overviewItems.push(`- Summary: ${description}`)
	}

	sections.push(`### Character Overview\n${overviewItems.join("\n")}`)

	// 统一处理所有角色字段，不区分来源
	const { profile } = role

	// 处理性格 - 优先使用SillyTavern的personality字段，然后是profile.personality
	const personalityText = role.personality || (typeof profile?.personality === 'string' ? profile.personality : '')
	const personalityArray = Array.isArray(profile?.personality) ? profile.personality : []
	
	if (personalityText) {
		sections.push(`### Personality\n${personalityText}`)
	} else if (personalityArray.length > 0) {
		sections.push(`### Personality\n${personalityArray.map((trait) => `- ${trait}`).join("\n")}`)
	}

	// 处理背景/世界观 - 优先使用scenario，然后是profile.background
	const backgroundText = role.scenario || (typeof profile?.background === 'string' ? profile.background : '')
	if (backgroundText) {
		sections.push(`### Background\n${backgroundText}`)
	}

	// 处理初始消息/问候语
	const greeting = role.first_mes || (typeof profile?.greeting === 'string' ? profile.greeting : '')
	if (greeting) {
		sections.push(`### First Message\n${greeting}`)
	}

	// 处理示例对话
	if (role.mes_example) {
		sections.push(`### Example Interactions\n${role.mes_example}`)
	}

	// 处理备选问候语
	if (role.alternate_greetings && role.alternate_greetings.length > 0) {
		sections.push(`### Alternate Greetings\n${role.alternate_greetings.map((greeting, index) => `${index + 1}. ${greeting}`).join("\n")}`)
	}

	// 处理创作者备注
	if (role.creator_notes) {
		sections.push(`### Creator Notes\n${role.creator_notes}`)
	}

	// 处理系统提示词
	if (role.system_prompt) {
		sections.push(`### System Instructions\n${role.system_prompt}`)
	}

	// 处理历史后指令
	if (role.post_history_instructions) {
		sections.push(`### Additional Instructions\n${role.post_history_instructions}`)
	}

	const addListSection = (title: string, values?: unknown) => {
		// Type guard to check if values is a string array
		if (!values || !Array.isArray(values) || values.length === 0) {
			return
		}

		const stringValues = values.filter((v): v is string => typeof v === "string")
		if (stringValues.length === 0) {
			return
		}

		sections.push(`${title}\n${stringValues.map((value) => `- ${value}`).join("\n")}`)
	}

	// 处理profile中的数组字段
	addListSection("### Appearance", profile?.appearance)
	addListSection("### Skills", profile?.skills)
	addListSection("### Titles", profile?.titles)
	addListSection("### Hobbies", profile?.hobbies)
	addListSection("### Relationships", profile?.relationships)
	addListSection("### Notes", profile?.notes)

	// 处理标签
	if (role.tags && role.tags.length > 0) {
		sections.push(`### Tags\n${role.tags.join(", ")}`)
	}

	// 处理创作者信息
	if (role.creator) {
		sections.push(`### Creator\n${role.creator}`)
	}

	// 处理角色版本
	if (role.character_version) {
		sections.push(`### Version\n${role.character_version}`)
	}

	// 处理世界观词库 (Character Book)
	if (role.character_book && role.character_book.entries && role.character_book.entries.length > 0) {
		const { character_book } = role
		
		// 过滤并排序条目
		const sortedEntries = character_book.entries
			.filter(entry => entry.enabled !== false) // 只包含启用的条目
			.sort((a, b) => {
				// 首先按 insertion_order 排序（数值越小越优先）
				const orderA = a.insertion_order ?? 999
				const orderB = b.insertion_order ?? 999
				if (orderA !== orderB) return orderA - orderB
				
				// 然后按 priority 排序（数值越小越优先）
				const priorityA = a.priority ?? 999
				const priorityB = b.priority ?? 999
				return priorityA - priorityB
			})
			.slice(0, 15) // 增加条目数量限制到15个
		
		if (sortedEntries.length > 0) {
			// 构建条目列表
			const bookEntries = sortedEntries.map(entry => {
				const parts: string[] = []
				
				// 添加条目名称（如果有）
				if (entry.name) {
					parts.push(`**${entry.name}**`)
				}
				
				// 添加内容
				parts.push(entry.content)
				
				// 添加关键词信息
				const allKeys = [
					...(entry.keys || []),
					...(entry.secondary_keys || [])
				].filter(Boolean)
				
				if (allKeys.length > 0) {
					parts.push(`(Keywords: ${allKeys.join(', ')})`)
				}
				
				// 添加特殊标记
				const flags: string[] = []
				if (entry.constant) flags.push('常驻')
				if (entry.selective) flags.push('选择性')
				if (entry.case_sensitive) flags.push('区分大小写')
				
				if (flags.length > 0) {
					parts.push(`[${flags.join(', ')}]`)
				}
				
				return `- ${parts.join(' ')}`
			})
			
			// 构建标题
			let title = '### World Information'
			if (character_book.name) {
				title += ` - ${character_book.name}`
			}
			if (character_book.description) {
				title += `\n*${character_book.description}*`
			}
			
			// 添加元数据信息
			const metadata: string[] = []
			if (character_book.scan_depth) {
				metadata.push(`扫描深度: ${character_book.scan_depth}`)
			}
			if (character_book.token_budget) {
				metadata.push(`Token预算: ${character_book.token_budget}`)
			}
			if (character_book.recursive_scanning) {
				metadata.push('递归扫描: 启用')
			}
			
			let content = bookEntries.join('\n')
			if (metadata.length > 0) {
				content = `*配置: ${metadata.join(', ')}*\n\n${content}`
			}
			
			sections.push(`${title}\n${content}`)
		}
	}

	// TODO: Extensions字段支持还未实现 (extensions field support not yet implemented)
	// if (role.extensions) { ... }

	const arcs = storyline?.arcs?.slice(0, 3)
	if (arcs && arcs.length > 0) {
		sections.push(
			`### Storyline Highlights\n${arcs.map((arc: StorylineArc) => `- ${arc.title}: ${arc.summary}`).join("\n")}`,
		)
	}

	if (memory) {
		if (memory.traits && memory.traits.length > 0) {
			sections.push(
				`### Persistent Traits\n${memory.traits
					.map((trait: MemoryTrait) => {
						const confidence = trait.confidence !== undefined ? ` (confidence: ${trait.confidence})` : ""
						return `- ${trait.name}: ${trait.value}${confidence}`
					})
					.join("\n")}`,
			)
		}

		if (memory.goals && memory.goals.length > 0) {
			sections.push(
				`### Goals\n${memory.goals
					.map((goal: MemoryGoal) => {
						const priority = goal.priority !== undefined ? ` (priority: ${goal.priority})` : ""
						return `- ${goal.value}${priority}`
					})
					.join("\n")}`,
			)
		}

		if (memory.episodic && memory.episodic.length > 0) {
			const recent = memory.episodic.slice(-3)
			sections.push(
				`### Recent Memories\n${recent
					.map((record: MemoryEpisodicRecord) => {
						const timestamp = new Date(record.timestamp).toISOString()
						return `- [${timestamp}] ${record.content}`
					})
					.join("\n")}`,
			)
		}
	}

	return sections.filter(Boolean).join("\n\n")
}

interface RoleOverrideOptions {
	personaFallback?: RolePersona
	toneStrict?: boolean
}

/**
 * Apply role-specific overrides to the mode selection
 * This allows roles to customize their persona, tone, and behavior
 * Also supports SillyTavern prompt field injection for converted roles
 */
function applyRoleOverrides(
	selection: { roleDefinition: string; baseInstructions: string; description: string },
	rolePromptData: RolePromptData | undefined,
	mode: Mode,
	options: RoleOverrideOptions = {},
): { roleDefinition: string; baseInstructions: string; description: string } {
	if (!rolePromptData?.role) {
		return selection
	}

	const { role } = rolePromptData
	const modeOverrides = role.modeOverrides

	// Check if this is a SillyTavern converted role
	const hasSillyTavernFields = !!(
		role.personality ||
		role.scenario ||
		role.system_prompt ||
		role.post_history_instructions ||
		role.mes_example
	)

	// If this is a SillyTavern converted role, apply SillyTavern-specific overrides
	if (hasSillyTavernFields) {
		return applySillyTavernRoleOverride(selection, rolePromptData, options)
	}

	// If no overrides, do gentle override with role identity
	if (!modeOverrides || (!modeOverrides.roleDefinition && !modeOverrides.customInstructions)) {
		return applyGentleRoleOverride(selection, rolePromptData, options)
	}

	// Strong override: use explicit modeOverrides
	return applyStrongRoleOverride(selection, rolePromptData, modeOverrides, options)
}

/**
 * SillyTavern-specific role override: Use SillyTavern prompt fields
 */
function applySillyTavernRoleOverride(
	selection: { roleDefinition: string; baseInstructions: string; description: string },
	rolePromptData: RolePromptData,
	options: RoleOverrideOptions,
): { roleDefinition: string; baseInstructions: string; description: string } {
	const { role } = rolePromptData
	const persona = role.modeOverrides?.persona || options.personaFallback || "hybrid"

	// Build role definition from SillyTavern fields
	let newRoleDefinition = ""
	
	// Use system_prompt if available, otherwise create from character info
	if (role.system_prompt) {
		newRoleDefinition = role.system_prompt
	} else {
		// Create role definition from character info
		const name = role.name || "Assistant"
		const description = role.description || ""
		const personality = role.personality || ""
		
		if (persona === "chat") {
			newRoleDefinition = `You are ${name}${description ? `. ${description}` : ""}${personality ? ` Your personality: ${personality}` : ""}.`
		} else {
			newRoleDefinition = `You are ${name}, a character with programming capabilities${description ? `. ${description}` : ""}${personality ? ` Your personality: ${personality}` : ""}.`
		}
	}

	// Build base instructions from SillyTavern fields
	const instructionParts: string[] = []

	// Add scenario if available
	if (role.scenario) {
		instructionParts.push(`### Scenario\n${role.scenario}`)
	}

	// Add example messages if available
	if (role.mes_example) {
		instructionParts.push(`### Example Interactions\n${role.mes_example}`)
	}

	// Add post-history instructions if available
	if (role.post_history_instructions) {
		instructionParts.push(`### Additional Instructions\n${role.post_history_instructions}`)
	}

	// Add creator notes if available
	if (role.creator_notes) {
		instructionParts.push(`### Creator Notes\n${role.creator_notes}`)
	}

	// Create tone instructions based on persona
	const toneInstructions = createToneInstructions(role, persona, options.toneStrict ?? true)
	if (toneInstructions) {
		instructionParts.push(toneInstructions)
	}

	// Combine with original base instructions
	if (selection.baseInstructions) {
		instructionParts.push(selection.baseInstructions)
	}

	const newBaseInstructions = instructionParts.join("\n\n")

	return {
		roleDefinition: newRoleDefinition,
		baseInstructions: newBaseInstructions,
		description: selection.description,
	}
}

/**
 * Gentle override: Insert role identity while keeping original instructions
 */
function applyGentleRoleOverride(
	selection: { roleDefinition: string; baseInstructions: string; description: string },
	rolePromptData: RolePromptData,
	options: RoleOverrideOptions,
): { roleDefinition: string; baseInstructions: string; description: string } {
	const { role } = rolePromptData
	const persona = role.modeOverrides?.persona || options.personaFallback || "hybrid"
	const toneStrict = role.modeOverrides?.toneStrictByDefault ?? options.toneStrict ?? true

	// Create persona header
	const personaHeader = createPersonaHeader(role, persona)

	// Create tone instructions
	const toneInstructions = createToneInstructions(role, persona, toneStrict)

	// 完全替换角色定义，而不是追加
	// 当选择了非默认角色时，完全替换默认的 "You are Roo..." 定义
	const newRoleDefinition = personaHeader

	// New baseInstructions: tone instructions + original baseInstructions
	const newBaseInstructions = toneInstructions
		? `${toneInstructions}\n\n${selection.baseInstructions}`
		: selection.baseInstructions

	return {
		roleDefinition: newRoleDefinition,
		baseInstructions: newBaseInstructions,
		description: selection.description,
	}
}

/**
 * Strong override: Use explicit roleDefinition and customInstructions from modeOverrides
 */
function applyStrongRoleOverride(
	selection: { roleDefinition: string; baseInstructions: string; description: string },
	rolePromptData: RolePromptData,
	modeOverrides: NonNullable<RoleModeOverrides>,
	options: RoleOverrideOptions,
): { roleDefinition: string; baseInstructions: string; description: string } {
	const { role } = rolePromptData
	const persona = modeOverrides?.persona || options.personaFallback || "hybrid"

	// Use explicit roleDefinition or create default
	const newRoleDefinition = modeOverrides?.roleDefinition || createPersonaHeader(role, persona)

	// Use explicit customInstructions
	const newBaseInstructions = modeOverrides?.customInstructions || selection.baseInstructions

	return {
		roleDefinition: newRoleDefinition,
		baseInstructions: newBaseInstructions,
		description: selection.description,
	}
}

/**
 * Create persona header based on role information
 */
function createPersonaHeader(role: any, persona: RolePersona): string {
	const name = role.name || "Assistant"
	const type = role.type || "助手"
	const description = role.description || ""

	if (persona === "chat") {
		// Pure chat persona - no coding emphasis
		return `You are ${name}, a ${type}${description ? `. ${description}` : ""}.`
	}

	// Hybrid persona - coding capable but with role identity
	return `You are ${name}, a ${type} with programming capabilities${description ? `. ${description}` : ""}.`
}

/**
 * Create tone instructions based on role and persona
 */
function createToneInstructions(role: any, persona: RolePersona, toneStrict: boolean): string {
	if (persona === "chat") {
		// Pure chat mode - conversational, no coding constraints
		return `在对话时请保持角色的性格、说话风格和特点。你可以自由地与用户交流，不需要主动编写代码或执行命令。`
	}

	// Hybrid mode with tone control
	if (toneStrict) {
		// Strict tone - minimal personality, focus on coding
		return `在帮助用户编程时，保持专业和高效。完成任务后避免过多的对话。`
	} else {
		// Relaxed tone - can show personality while coding
		return `在帮助用户编程时，你可以保持角色的性格和说话风格。你正在协助用户完成编程任务，请在保持角色特点的同时确保代码质量和任务完成度。`
	}
}

async function generatePrompt(
	context: vscode.ExtensionContext,
	cwd: string,
	supportsComputerUse: boolean,
	mode: Mode,
	mcpHub?: McpHub,
	diffStrategy?: DiffStrategy,
	browserViewportSize?: string,
	promptComponent?: PromptComponent,
	customModeConfigs?: ModeConfig[],
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
): Promise<string> {
	if (!context) {
		throw new Error("Extension context is required for generating system prompt")
	}

	// If diff is disabled, don't pass the diffStrategy
	const effectiveDiffStrategy = diffEnabled ? diffStrategy : undefined

	// Get the full mode config to ensure we have the role definition (used for groups, etc.)
	const modeConfig = getModeBySlug(mode, customModeConfigs) || modes.find((m) => m.slug === mode) || modes[0]
	let { roleDefinition, baseInstructions } = getModeSelection(mode, promptComponent, customModeConfigs)

	// Apply role overrides if a role is selected
	if (rolePromptData) {
		const overridden = applyRoleOverrides(
			{ roleDefinition, baseInstructions, description: "" },
			rolePromptData,
			mode,
			{ 
				personaFallback: anhPersonaMode || "hybrid",
				toneStrict: anhToneStrict,
			},
		)
		roleDefinition = overridden.roleDefinition
		baseInstructions = overridden.baseInstructions
	}

	// Check if MCP functionality should be included
	const hasMcpGroup = modeConfig.groups.some((groupEntry) => getGroupName(groupEntry) === "mcp")
	const hasMcpServers = mcpHub && mcpHub.getServers().length > 0
	const shouldIncludeMcp = hasMcpGroup && hasMcpServers

	const [modesSection, mcpServersSection] = await Promise.all([
		getModesSection(context),
		shouldIncludeMcp
			? getMcpServersSection(mcpHub, effectiveDiffStrategy, enableMcpServerCreation)
			: Promise.resolve(""),
	])

	const codeIndexManager = CodeIndexManager.getInstance(context, cwd)

	// Build role sections for both AI role and user avatar role
	const aiRoleSection = buildRolePromptSection(rolePromptData)
	const aiRoleSectionBlock = aiRoleSection
		? `${aiRoleSection}

	`
		: ""

	// Build user avatar role section if enabled
	// TODO 完成用户代理角色的
	let userAvatarSectionBlock = ""
	if (enableUserAvatar && userAvatarRole) {
		console.log("[ANH-Chat:SystemPrompt] Building user avatar section for role:", userAvatarRole.name)
		console.log("[ANH-Chat:SystemPrompt] User avatar role data:", userAvatarRole)
		const userAvatarPromptData = {
			role: userAvatarRole,
			storyline: { arcs: [] },
			memory: { traits: [], goals: [], episodic: [] }
		}
		const userAvatarSection = buildRolePromptSection(userAvatarPromptData)
		userAvatarSectionBlock = userAvatarSection
			? `

USER AVATAR
这是用户的角色，现在用户的角色是：${userAvatarRole.name}
${userAvatarSection}

`
			: ""
	}

	const roleSectionBlock = aiRoleSectionBlock + userAvatarSectionBlock

	// Load worldset content if enabled
	let worldsetSectionBlock = ""
	if (enabledWorldsets && enabledWorldsets.length > 0) {
		try {
			const path = require("path")
			const fs = require("fs")
			const worldsetContents: string[] = []
			
			for (const worldsetName of enabledWorldsets) {
				const worldsetPath = path.join(cwd, "worldset", worldsetName)
				
				if (fs.existsSync(worldsetPath)) {
					const worldsetContent = fs.readFileSync(worldsetPath, "utf-8")
					worldsetContents.push(`## ${worldsetName}\n\n${worldsetContent}`)
				}
			}
			
			if (worldsetContents.length > 0) {
				worldsetSectionBlock = `

====

WORLDVIEW SETTING

The following worldview settings are currently active and should guide your responses:

${worldsetContents.join('\n\n---\n\n')}

====

`
			}
		} catch (error) {
			console.error("[ANH-Chat:SystemPrompt] Error loading worldsets:", error)
		}
	}

	// Determine if we're in pure chat mode
	const isPureChatMode = anhPersonaMode === "chat"

	// Debug logging
	console.log("[ANH-Chat:SystemPrompt] Persona mode:", anhPersonaMode, "Is pure chat:", isPureChatMode)

	// Build prompt sections based on persona mode
	let promptSections = [
		roleDefinition,
		"",
		roleSectionBlock,
		worldsetSectionBlock, // Add worldset content here
		markdownFormattingSection(),
		""
	]

	if (isPureChatMode) {
		// Pure chat mode - minimal sections, focus on conversation
		const chatObjectiveSection = `====

OBJECTIVE

You are engaging in conversation with the user as your character. Focus on:
1. Maintaining your character's personality and speaking style
2. Responding naturally to the user's questions and comments
3. Providing helpful and engaging conversation
4. Avoiding technical programming discussions unless specifically requested`

		// Add natural conversation guidance when ask tool is disabled
		const conversationGuidance = anhUseAskTool === false ? `
- 尽量避免使用提问工具，直接与用户自然对话
- 如果需要澄清问题，直接在对话中询问，不要使用正式的提问工具
- 保持对话的流畅性和自然感，减少机械化的交互
- 像真人一样交流，而不是像机器人一样按流程操作` : ""

		const chatRulesSection = `====

RULES

- Be natural and conversational in your responses
- Feel free to use friendly greetings and expressions like "好的", "当然", "很高兴" etc.
- You can ask questions to better understand the user or to continue the conversation
- Focus on building a good conversational experience
- If the user requests programming help, you can switch to a more technical mode${conversationGuidance}`

		promptSections = promptSections.concat([
			getSystemInfoSection(cwd),
			"",
			chatObjectiveSection,
			"",
			chatRulesSection,
			""
		])
	} else {
		// Hybrid mode - full tool and capability sections
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
				customModeConfigs,
				experiments,
				partialReadsEnabled,
				settings,
				enableMcpServerCreation,
				modelId,
				anhUseAskTool === false, // Disable ask tool when anhUseAskTool is false
			),
			"",
			getToolUseGuidelinesSection(codeIndexManager),
			"",
			mcpServersSection,
			"",
			getCapabilitiesSection(cwd, supportsComputerUse, shouldIncludeMcp ? mcpHub : undefined, effectiveDiffStrategy, codeIndexManager),
			"",
			modesSection,
			"",
			getRulesSection(cwd, supportsComputerUse, effectiveDiffStrategy, codeIndexManager, mode),
			"",
			// Add natural conversation guidance when ask tool is disabled
			anhUseAskTool === false ? `
====

CONVERSATION GUIDANCE

- 尽量避免使用提问工具，直接与用户自然对话
- 如果需要澄清问题，直接在对话中询问，不要使用正式的提问工具
- 保持对话的流畅性和自然感，减少机械化的交互
- 像真人一样交流，而不是像机器人一样按流程操作
` : "",
			getSystemInfoSection(cwd),
			"",
			getObjectiveSection(codeIndexManager, experiments),
			""
		])
	}

	// Add custom instructions at the end
	promptSections.push(
		await addCustomInstructions(baseInstructions, globalCustomInstructions || "", cwd, mode, {
			language: language ?? formatLanguage(vscode.env.language),
			rooIgnoreInstructions,
			settings,
		})
	)

	const basePrompt = promptSections.join("\n")

	// Debug logging
	console.log("[ANH-Chat:SystemPrompt] Generated prompt sections count:", promptSections.length)
	console.log("[ANH-Chat:SystemPrompt] Pure chat mode:", isPureChatMode)

	return basePrompt
}

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
): Promise<string> => {
	if (!context) {
		throw new Error("Extension context is required for generating system prompt")
	}

	// Try to load custom system prompt from file
	const variablesForPrompt: PromptVariables = {
		workspace: cwd,
		mode: mode,
		language: language ?? formatLanguage(vscode.env.language),
		shell: vscode.env.shell,
		operatingSystem: os.type(),
	}
	const fileCustomSystemPrompt = await loadSystemPromptFile(cwd, mode, variablesForPrompt)

	// Check if it's a custom mode
	const promptComponent = getPromptComponent(customModePrompts, mode)

	// Get full mode config from custom modes or fall back to built-in modes
	const currentMode = getModeBySlug(mode, customModes) || modes.find((m) => m.slug === mode) || modes[0]

	// If a file-based custom system prompt exists, use it
	if (fileCustomSystemPrompt) {
		let { roleDefinition, baseInstructions: baseInstructionsForFile } = getModeSelection(
			mode,
			promptComponent,
			customModes,
		)

		// Apply role overrides for file-based prompts too
		if (rolePromptData) {
			const overridden = applyRoleOverrides(
				{ roleDefinition, baseInstructions: baseInstructionsForFile, description: "" },
				rolePromptData,
				mode,
				{ 
					personaFallback: anhPersonaMode || "hybrid",
					toneStrict: anhToneStrict,
				},
			)
			roleDefinition = overridden.roleDefinition
			baseInstructionsForFile = overridden.baseInstructions
		}

		const customInstructions = await addCustomInstructions(
			baseInstructionsForFile,
			globalCustomInstructions || "",
			cwd,
			mode,
			{
				language: language ?? formatLanguage(vscode.env.language),
				rooIgnoreInstructions,
				settings,
			},
		)

		const aiRoleSection = buildRolePromptSection(rolePromptData)
		const aiRoleSectionBlock = aiRoleSection ? `${aiRoleSection}\n\n` : ""

		// Build user avatar role section if enabled
		let userAvatarSectionBlock = ""
		if (enableUserAvatar && userAvatarRole) {
			const userAvatarPromptData = {
				role: userAvatarRole,
				storyline: { arcs: [] },
				memory: { traits: [], goals: [], episodic: [] }
			}
			const userAvatarSection = buildRolePromptSection(userAvatarPromptData)
			userAvatarSectionBlock = userAvatarSection
				? `\n\nUSER AVATAR\n${userAvatarSection}\n\n`
				: ""
		}

		const roleSectionBlock = aiRoleSectionBlock + userAvatarSectionBlock

		// For file-based prompts, don't include the tool sections
		return `${roleDefinition}

${roleSectionBlock}${fileCustomSystemPrompt}

${customInstructions}`
	}

	// If diff is disabled, don't pass the diffStrategy
	const effectiveDiffStrategy = diffEnabled ? diffStrategy : undefined

	return generatePrompt(
		context,
		cwd,
		supportsComputerUse,
		currentMode.slug,
		mcpHub,
		effectiveDiffStrategy,
		browserViewportSize,
		promptComponent,
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
	)
}
