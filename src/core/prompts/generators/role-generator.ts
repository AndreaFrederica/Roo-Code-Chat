import type {
	Role,
	RolePromptData,
	UserAvatarVisibility,
	RolePersona,
	ModeConfig,
	PromptComponent,
	CustomModePrompts,
} from "@roo-code/types"

import type { RoleModeOverrides } from "@roo-code/types"
import { applyTemplateVariablesToRole } from "../template-variables"
import { getModeBySlug, getModeSelection, type Mode } from "../../../shared/modes"
import { isEmpty } from "../../../utils/object"
import { PromptAssembler, type PromptSectionVariables } from "../types/prompt-sections"

export interface RoleSectionOptions {
	summaryOnly?: boolean
	disableTemplateReplacement?: boolean
}

export interface EnhancedRoleOptions {
	summaryOnly?: boolean
	includeSystemInstructions?: boolean
	includeUserAvatar?: boolean
	maxLength?: number
}

export interface EnhancedRoleInfo {
	roleDefinition: string
	roleSummary: string
	systemInstructions?: string
	userAvatarInfo?: string
	fullCharacterInfo: string
}

/**
 * 角色信息生成器
 * 负责生成角色详细信息、处理角色覆盖逻辑、为增强导向模式提供角色信息
 */
export class RoleGenerator {
	/**
	 * 生成AI角色字段变量（新版本）
	 */
	generateRoleSectionVariables(
		rolePromptData: RolePromptData,
		userAvatarRole?: Role,
		enableUserAvatar?: boolean,
		options: RoleSectionOptions = {},
	): PromptSectionVariables {
		if (!rolePromptData || !rolePromptData.role) {
			return {}
		}

		const { summaryOnly, disableTemplateReplacement } = options

		// Apply template variable replacement to the role before processing
		const processedRole = disableTemplateReplacement
			? (JSON.parse(JSON.stringify(rolePromptData.role)) as Role)
			: applyTemplateVariablesToRole(rolePromptData.role, userAvatarRole, enableUserAvatar)

		const { storyline, memory } = rolePromptData
		const variables = PromptAssembler.createVariables()

		// 统一处理所有角色字段，不区分来源
		const { profile } = processedRole

		// Build character overview section - only basic info
		const overviewItems: string[] = [`- Name: ${processedRole.name}`, `- Type: ${processedRole.type}`]

		if (processedRole.affiliation) {
			overviewItems.push(`- Affiliation: ${processedRole.affiliation}`)
		}
		if (processedRole.aliases && processedRole.aliases.length > 0) {
			overviewItems.push(`- Aliases: ${processedRole.aliases.join(" / ")}`)
		}
		if (processedRole.color) {
			overviewItems.push(`- Signature Color: ${processedRole.color}`)
		}

		// Only put summary in character overview
		let description = processedRole.description
		if (!description && profile?.appearance) {
			if (Array.isArray(profile.appearance)) {
				description = profile.appearance.join(", ")
			} else if (typeof profile.appearance === "string") {
				description = profile.appearance
			}
		}
		if (description) {
			overviewItems.push(`- Summary: ${description}`)
		}

		PromptAssembler.setField(variables, 'characterOverview', `### Character Overview\n${overviewItems.join("\n")}`)

		// 处理性格 - 优先使用SillyTavern的personality字段，然后是profile.personality
		const personalityText =
			processedRole.personality ||
			(profile?.personality && Array.isArray(profile.personality)
				? profile.personality.join(", ")
				: profile?.personality) ||
			""

		if (personalityText) {
			PromptAssembler.setField(variables, 'personality', `### Personality\n${personalityText}`)
		}

		// 处理背景 - 优先使用SillyTavern的background字段，然后是profile.background
		const backgroundText =
			processedRole.background ||
			(profile?.background && Array.isArray(profile.background)
				? profile.background.join(", ")
				: profile?.background) ||
			""

		if (backgroundText) {
			PromptAssembler.setField(variables, 'background', `### Background\n${backgroundText}`)
		}

		// 处理外貌 - 使用profile.appearance，如果有的话
		if (profile?.appearance && Array.isArray(profile.appearance) && profile.appearance.length > 0) {
			PromptAssembler.setField(variables, 'appearance', `### Appearance\n${profile.appearance.join("\n")}`)
		}

		// 处理技能 - 使用profile.skills，如果有的话
		if (profile?.skills && Array.isArray(profile.skills) && profile.skills.length > 0) {
			PromptAssembler.setField(variables, 'skills', `### Skills\n${profile.skills.join("\n")}`)
		}

		// 处理爱好 - 使用profile.hobbies，如果有的话
		if (profile?.hobbies && Array.isArray(profile.hobbies) && profile.hobbies.length > 0) {
			PromptAssembler.setField(variables, 'hobbies', `### Hobbies\n${profile.hobbies.join("\n")}`)
		}

		// 处理对话示例 - 优先使用SillyTavern的mes_example字段，然后是profile.example_messages
		const exampleMessagesText =
			processedRole.mes_example ||
			(profile?.example_messages && Array.isArray(profile.example_messages)
				? profile.example_messages.join("\n\n")
				: profile?.example_messages) ||
			""

		if (exampleMessagesText) {
			PromptAssembler.setField(variables, 'exampleInteractions', `### Example Interactions\n${exampleMessagesText}`)
		}

		// 处理备用问候语 - 使用profile.alternate_greetings，如果有的话
		if (
			profile?.alternate_greetings &&
			Array.isArray(profile.alternate_greetings) &&
			profile.alternate_greetings.length > 0
		) {
			PromptAssembler.setField(variables, 'alternateGreetings', `### Alternate Greetings\n${profile.alternate_greetings.join("\n")}`)
		}

		// 处理scenario字段
		if (processedRole.scenario) {
			PromptAssembler.setField(variables, 'scenario', `### Scenario\n${processedRole.scenario}`)
		}

		// 处理first_mes字段
		if (processedRole.first_mes) {
			PromptAssembler.setField(variables, 'firstMessage', `### First Message\n${processedRole.first_mes}`)
		}

		// 处理creator_notes字段
		if (processedRole.creator_notes) {
			PromptAssembler.setField(variables, 'creatorNotes', `### Creator Notes\n${processedRole.creator_notes}`)
		}

		// 处理系统提示词 - 确保在Character Overview和First Message之后添加
		if (processedRole.system_prompt) {
			// 在system_prompt后添加特殊指示，确保模型注意Character Overview和First Message
			const enhancedSystemPrompt = `${processedRole.system_prompt}

**重要提醒：请特别注意上面以 "### Character Overview" 和 "### First Message" 为标题的内容，这些是角色的详细信息，请根据这些内容开始角色扮演。你必须完全按照Character Overview中定义的角色特征和行为方式进行角色扮演。还有 "USER AVATAR" 这是 用户的身份信息\n### First Message 里面的内容是你的初始问候语，请根据这些内容开始角色扮演。**`
			PromptAssembler.setField(variables, 'systemInstructions', `### System Instructions\n${enhancedSystemPrompt}`)
		}

		// 处理STProfile注入的system_settings字段
		if (processedRole.system_settings) {
			PromptAssembler.setField(variables, 'systemSettings', `### System Settings\n${processedRole.system_settings}`)
		}

		// 处理STProfile注入的user_settings字段
		if (processedRole.user_settings) {
			PromptAssembler.setField(variables, 'userSettings', `### User Settings\n${processedRole.user_settings}`)
		}

		// 处理STProfile注入的assistant_settings字段
		if (processedRole.assistant_settings) {
			PromptAssembler.setField(variables, 'assistantSettings', `### Assistant Settings\n${processedRole.assistant_settings}`)
		}

		// 处理历史后指令
		if (processedRole.post_history_instructions) {
			PromptAssembler.setField(variables, 'additionalInstructions', `### Additional Instructions\n${processedRole.post_history_instructions}`)
		}

		// 处理扩展字段 (extensions)
		if (processedRole.extensions && typeof processedRole.extensions === "object") {
			const extensionKeys = Object.keys(processedRole.extensions).filter(
				(key) => processedRole.extensions![key],
			)
			if (extensionKeys.length > 0) {
				const extensionItems: string[] = []
				extensionKeys.forEach((key) => {
					const value = processedRole.extensions![key]
					if (value) {
						if (Array.isArray(value)) {
							extensionItems.push(`- ${key}: ${value.join(", ")}`)
						} else if (typeof value === "string") {
							extensionItems.push(`- ${key}: ${value}`)
						}
					}
				})
				if (extensionItems.length > 0) {
					PromptAssembler.setField(variables, 'extensions', `### Extensions\n${extensionItems.join("\n")}`)
				}
			}
		}

		// Add profile fields dynamically, excluding already processed fields
		const processedFields = new Set([
			"appearance",
			"personality",
			"background",
			"skills",
			"hobbies",
			"example_messages",
			"alternate_greetings",
		])

		if (profile) {
			Object.entries(profile).forEach(([key, value]) => {
				if (!processedFields.has(key) && value) {
					// 处理数组类型的字段
					if (Array.isArray(value) && value.length > 0) {
						const stringValues = value.filter((v): v is string => typeof v === "string")
						if (stringValues.length > 0) {
							const titleCase = key.charAt(0).toUpperCase() + key.slice(1)
							// 使用动态字段
							if (variables.dynamicFields && typeof variables.dynamicFields === 'object') {
								variables.dynamicFields[key] = `### ${titleCase}\n${stringValues.map((v) => `- ${v}`).join("\n")}`
							} else {
								variables.dynamicFields = {
									[key]: `### ${titleCase}\n${stringValues.map((v) => `- ${v}`).join("\n")}`
								}
							}
						}
					}
					// 处理字符串类型的字段
					else if (typeof value === "string" && value.trim()) {
						const titleCase = key.charAt(0).toUpperCase() + key.slice(1)
						// 使用动态字段
						if (variables.dynamicFields && typeof variables.dynamicFields === 'object') {
							variables.dynamicFields[key] = `### ${titleCase}\n${value}`
						} else {
							variables.dynamicFields = {
								[key]: `### ${titleCase}\n${value}`
							}
						}
					}
				}
			})
		}

		const addListSection = (title: string, values?: unknown) => {
			// Type guard to check if values is a string array
			if (!values || !Array.isArray(values) || values.length === 0) {
				return
			}
			const stringValues = values.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
			if (stringValues.length > 0) {
				const fieldName = title.replace('### ', '').toLowerCase()
				PromptAssembler.setField(variables, fieldName as keyof PromptSectionVariables, `${title}\n${stringValues.map((v) => `- ${v}`).join("\n")}`)
			}
		}

		// Add miscellaneous sections
		addListSection("### Titles", processedRole.titles)
		addListSection("### Relationships", processedRole.relationships)
		addListSection("### Tags", processedRole.tags)

		// 处理V3新增字段
		if (processedRole.nickname) {
			if (variables.dynamicFields && typeof variables.dynamicFields === 'object') {
				variables.dynamicFields.nickname = `### Nickname\n${processedRole.nickname}`
			} else {
				variables.dynamicFields = {
					nickname: `### Nickname\n${processedRole.nickname}`
				}
			}
		}

		if (processedRole.creator_notes_multilingual) {
			const notes = processedRole.creator_notes_multilingual
			const notesSections: string[] = []
			Object.entries(notes).forEach(([lang, content]) => {
				if (content && typeof content === "string" && content.trim()) {
					notesSections.push(`**${lang.toUpperCase()}**: ${content}`)
				}
			})
			if (notesSections.length > 0) {
				if (variables.dynamicFields && typeof variables.dynamicFields === 'object') {
					variables.dynamicFields.creatorNotesMultilingual = `### Creator Notes (Multilingual)\n${notesSections.join("\n\n")}`
				} else {
					variables.dynamicFields = {
						creatorNotesMultilingual: `### Creator Notes (Multilingual)\n${notesSections.join("\n\n")}`
					}
				}
			}
		}

		if (processedRole.group_only_greetings && Array.isArray(processedRole.group_only_greetings)) {
			const greetings = processedRole.group_only_greetings.filter((g) => typeof g === "string" && g.trim())
			if (greetings.length > 0) {
				if (variables.dynamicFields && typeof variables.dynamicFields === 'object') {
					variables.dynamicFields.groupGreetings = `### Group Greetings\n${greetings.join("\n")}`
				} else {
					variables.dynamicFields = {
						groupGreetings: `### Group Greetings\n${greetings.join("\n")}`
					}
				}
			}
		}

		// 处理记忆相关字段
		if (storyline?.arcs && storyline.arcs.length > 0) {
			const arcs = storyline.arcs.slice(0, 3)
			PromptAssembler.setField(variables, 'storylineHighlights', `### Storyline Highlights\n${arcs.map((arc) => `- ${arc.title}: ${arc.summary}`).join("\n")}`)
		}

		if (memory) {
			if (memory.traits && memory.traits.length > 0) {
				PromptAssembler.setField(variables, 'persistentTraits', `### Persistent Traits\n${memory.traits.map((trait) => {
					const confidence = trait.confidence !== undefined ? ` (confidence: ${trait.confidence})` : ""
					return `- ${trait.name}: ${trait.value}${confidence}`
				}).join("\n")}`)
			}

			if (memory.goals && memory.goals.length > 0) {
				PromptAssembler.setField(variables, 'goals', `### Goals\n${memory.goals.map((goal) => {
					const priority = goal.priority !== undefined ? ` (priority: ${goal.priority})` : ""
					return `- ${goal.value}${priority}`
				}).join("\n")}`)
			}

			if (memory.episodic && memory.episodic.length > 0) {
				const recent = memory.episodic.slice(-3)
				PromptAssembler.setField(variables, 'recentMemories', `### Recent Memories\n${recent.map((record) => {
					const timestamp = new Date(record.timestamp).toISOString()
					return `- [${timestamp}] ${record.content}`
				}).join("\n")}`)
			}
		}

		return variables
	}

	/**
	 * 生成AI角色详细信息（保持向后兼容）
	 */
	generateRoleSection(
		rolePromptData: RolePromptData,
		userAvatarRole?: Role,
		enableUserAvatar?: boolean,
		options: RoleSectionOptions = {},
	): string {
		const variables = this.generateRoleSectionVariables(rolePromptData, userAvatarRole, enableUserAvatar, options)
		return PromptAssembler.assemblePrompt(variables, { summaryOnly: options.summaryOnly })
	}

	/**
	 * 生成用户头像角色信息
	 */
	generateUserAvatarSection(
		enableUserAvatar?: boolean,
		userAvatarRole?: Role,
		visibility?: UserAvatarVisibility,
	): string {
		if (!enableUserAvatar || !userAvatarRole) {
			return ""
		}

		const normalizedVisibility: UserAvatarVisibility = visibility || "full"

		const summaryOnly = normalizedVisibility === "summary"
		const section = this.generateRoleSection({ role: userAvatarRole }, undefined, false,
			{
				disableTemplateReplacement: true,
				summaryOnly,
			},
		)

		if (!section) {
			return `

USER AVATAR
用户的角色信息不可用或已被隐藏。

`
		}

		if (normalizedVisibility === "hidden") {
			return `

USER AVATAR
用户已选择隐藏角色信息。

`
		}

		return `

USER AVATAR
以下是目前设置的用户角色信息。在对话中请将用户视为扮演以下角色：

${section}

`
	}

	/**
	 * 为增强导向模式生成增强的角色信息
	 */
	generateEnhancedRoleInfo(
		rolePromptData: RolePromptData,
		userAvatarRole?: Role,
		enableUserAvatar?: boolean,
		options: EnhancedRoleOptions = {},
	): EnhancedRoleInfo {
		if (!rolePromptData || !rolePromptData.role) {
			return {
				roleDefinition: "",
				roleSummary: "",
				fullCharacterInfo: "",
			}
		}

		const { summaryOnly = false, includeSystemInstructions = true, includeUserAvatar = true, maxLength = 2000 } = options

		// 生成完整角色信息
		const fullCharacterInfo = this.generateRoleSection(rolePromptData, userAvatarRole, enableUserAvatar, {
			summaryOnly,
		})

		// 提取角色定义摘要
		const role = rolePromptData.role
		const roleDefinition = `You are ${role.name}${role.description ? `, ${role.description}` : ""}${role.personality ? `. Personality: ${role.personality}` : ""}`

		// 生成简洁的角色摘要
		const roleSummaryItems: string[] = [`Name: ${role.name}`, `Type: ${role.type}`]
		if (role.description) roleSummaryItems.push(`Description: ${role.description}`)
		if (role.personality) roleSummaryItems.push(`Personality: ${role.personality}`)
		if (role.affiliation) roleSummaryItems.push(`Affiliation: ${role.affiliation}`)

		const roleSummary = roleSummaryItems.join(" | ")

		// 提取系统指令
		let systemInstructions = ""
		if (includeSystemInstructions && role.system_prompt) {
			systemInstructions = role.system_prompt
			if (systemInstructions.length > maxLength) {
				systemInstructions = systemInstructions.substring(0, maxLength) + "..."
			}
		}

		// 生成用户头像信息
		let userAvatarInfo = ""
		if (includeUserAvatar && enableUserAvatar && userAvatarRole) {
			const userSection = this.generateUserAvatarSection(enableUserAvatar, userAvatarRole, "summary")
			userAvatarInfo = userSection.replace("USER AVATAR", "").trim()
		}

		return {
			roleDefinition,
			roleSummary,
			systemInstructions,
			userAvatarInfo,
			fullCharacterInfo,
		}
	}

	/**
	 * 应用角色覆盖逻辑
	 */
	applyRoleOverrides(
		selection: { roleDefinition: string; baseInstructions: string; description: string },
		rolePromptData: RolePromptData,
		options: {
			mode?: Mode
			customModes?: ModeConfig[]
			customModePrompts?: CustomModePrompts
			personaFallback?: RolePersona
			toneStrict?: boolean
		} = {},
	): { roleDefinition: string; baseInstructions: string; description: string } {
		const { role } = rolePromptData
		const { mode, customModes, customModePrompts, personaFallback } = options
		const persona = role.modeOverrides?.persona || personaFallback || "hybrid"

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
			return this.applySillyTavernRoleOverride(selection, rolePromptData, {
				personaFallback,
				toneStrict: options.toneStrict,
			})
		}

		// If no overrides, do gentle override with role identity
		if (!role.modeOverrides || (!role.modeOverrides!.roleDefinition && !role.modeOverrides!.customInstructions)) {
			return this.applyGentleRoleOverride(selection, rolePromptData, {
				personaFallback,
				toneStrict: options.toneStrict,
			})
		}

		// Strong override: use explicit modeOverrides
		return this.applyStrongRoleOverride(selection, rolePromptData, role.modeOverrides!, {
			personaFallback,
			toneStrict: options.toneStrict,
		})
	}

	/**
	 * SillyTavern-specific role override: Use SillyTavern prompt fields
	 */
	private applySillyTavernRoleOverride(
		selection: { roleDefinition: string; baseInstructions: string; description: string },
		rolePromptData: RolePromptData,
		options: { personaFallback?: RolePersona; toneStrict?: boolean } = {},
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

		// Add post history instructions if available
		if (role.post_history_instructions) {
			instructionParts.push(`### Additional Instructions\n${role.post_history_instructions}`)
		}

		// Add creator notes if available
		if (role.creator_notes) {
			instructionParts.push(`### Creator Notes\n${role.creator_notes}`)
		}

		const newBaseInstructions = instructionParts.join("\n\n")

		return {
			roleDefinition: newRoleDefinition,
			baseInstructions: newBaseInstructions,
			description: role.description || selection.description,
		}
	}

	/**
	 * Gentle role override: Add role identity to existing role definition
	 */
	private applyGentleRoleOverride(
		selection: { roleDefinition: string; baseInstructions: string; description: string },
		rolePromptData: RolePromptData,
		options: { personaFallback?: RolePersona; toneStrict?: boolean } = {},
	): { roleDefinition: string; baseInstructions: string; description: string } {
		const { role } = rolePromptData
		const persona = role.modeOverrides?.persona || options.personaFallback || "hybrid"

		// Add role identity to role definition
		let newRoleDefinition = selection.roleDefinition

		// Add role context
		const roleContext = `You are currently roleplaying as ${role.name}${role.description ? ` - ${role.description}` : ""}.`

		if (persona === "chat") {
			newRoleDefinition = `${roleContext} ${selection.roleDefinition}`
		} else {
			newRoleDefinition = `${roleContext} While maintaining your programming capabilities, ${selection.roleDefinition.toLowerCase()}`
		}

		// Add role-specific instructions
		const instructionParts: string[] = [selection.baseInstructions]

		// Add scenario if available
		if (role.scenario) {
			instructionParts.push(`Current scenario: ${role.scenario}`)
		}

		// Add personality notes
		if (role.personality) {
			instructionParts.push(`Personality traits to embody: ${role.personality}`)
		}

		const newBaseInstructions = instructionParts.join("\n\n")

		return {
			roleDefinition: newRoleDefinition,
			baseInstructions: newBaseInstructions,
			description: role.description || selection.description,
		}
	}

	/**
	 * Strong role override: Use explicit modeOverrides from role
	 */
	private applyStrongRoleOverride(
		selection: { roleDefinition: string; baseInstructions: string; description: string },
		rolePromptData: RolePromptData,
		modeOverrides: RoleModeOverrides,
		options: { personaFallback?: RolePersona; toneStrict?: boolean } = {},
	): { roleDefinition: string; baseInstructions: string; description: string } {
		const { role } = rolePromptData

		// Use explicit overrides
		const newRoleDefinition = modeOverrides!.roleDefinition || selection.roleDefinition
		const newBaseInstructions = modeOverrides!.customInstructions || selection.baseInstructions
		const newDescription = role.description || selection.description

		return {
			roleDefinition: newRoleDefinition,
			baseInstructions: newBaseInstructions,
			description: newDescription,
		}
	}
}
