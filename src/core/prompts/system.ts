import * as vscode from "vscode"
import * as os from "os"

import type { ModeConfig, PromptComponent, CustomModePrompts, TodoItem } from "@roo-code/types"

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
	if (role.description) {
		overviewItems.push(`- Summary: ${role.description}`)
	}

	sections.push(`### Character Overview\n${overviewItems.join("\n")}`)

	const { profile } = role
	if (profile?.background) {
		sections.push(`### Background\n${profile.background}`)
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

	addListSection("### Appearance", profile?.appearance)
	addListSection("### Personality", profile?.personality)
	addListSection("### Skills", profile?.skills)
	addListSection("### Titles", profile?.titles)
	addListSection("### Hobbies", profile?.hobbies)
	addListSection("### Relationships", profile?.relationships)
	addListSection("### Notes", profile?.notes)

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

	// If no overrides, do gentle override with role identity
	if (!modeOverrides || (!modeOverrides.roleDefinition && !modeOverrides.customInstructions)) {
		return applyGentleRoleOverride(selection, rolePromptData, options)
	}

	// Strong override: use explicit modeOverrides
	return applyStrongRoleOverride(selection, rolePromptData, modeOverrides, options)
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

	// New roleDefinition: persona header + original roleDefinition
	const newRoleDefinition = `${personaHeader}\n\n${selection.roleDefinition}`

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

	const roleSection = buildRolePromptSection(rolePromptData)
	const roleSectionBlock = roleSection
		? `${roleSection}

`
		: ""

	// Determine if we're in pure chat mode
	const isPureChatMode = anhPersonaMode === "chat"

	// Debug logging
	console.log("[ANH-Chat:SystemPrompt] Persona mode:", anhPersonaMode, "Is pure chat:", isPureChatMode)

	// Build prompt sections based on persona mode
	let promptSections = [
		roleDefinition,
		"",
		roleSectionBlock,
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

		const chatRulesSection = `====

RULES

- Be natural and conversational in your responses
- Feel free to use friendly greetings and expressions like "好的", "当然", "很高兴" etc.
- You can ask questions to better understand the user or to continue the conversation
- Focus on building a good conversational experience
- If the user requests programming help, you can switch to a more technical mode`

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

		const roleSection = buildRolePromptSection(rolePromptData)
		const roleSectionBlock = roleSection ? `${roleSection}\n\n` : ""

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
	)
}
