import type { ModeConfig, PromptComponent, CustomModePrompts } from "@roo-code/types"
import type { Mode } from "../../../shared/modes"
import type { RolePromptData, RolePersona } from "@roo-code/types"
import { getModeSelection } from "../../../shared/modes"

export interface RoleOverrideOptions {
	mode?: Mode
	customModes?: ModeConfig[]
	customModePrompts?: CustomModePrompts
	personaFallback?: RolePersona
	toneStrict?: boolean
}

export interface ModeSelection {
	roleDefinition: string
	baseInstructions: string
	description: string
}

/**
 * 角色覆盖处理器
 * 负责处理角色模式覆盖逻辑
 */
export class RoleOverrideProcessor {
	/**
	 * 应用角色覆盖
	 */
	applyRoleOverrides(
		selection: ModeSelection,
		rolePromptData: RolePromptData,
		options: RoleOverrideOptions = {},
	): ModeSelection {
		const { role } = rolePromptData
		const { mode, customModes, customModePrompts, personaFallback } = options
		const persona = role.modeOverrides?.persona || personaFallback || "hybrid"

		// 检查是否为SillyTavern转换的角色
		const hasSillyTavernFields = !!(
			role.personality ||
			role.scenario ||
			role.system_prompt ||
			role.post_history_instructions ||
			role.mes_example
		)

		// 如果是SillyTavern转换的角色，应用特定的覆盖逻辑
		if (hasSillyTavernFields) {
			return this.applySillyTavernRoleOverride(selection, rolePromptData, { personaFallback })
		}

		// 如果没有覆盖设置，使用温和的角色身份覆盖
		if (!role.modeOverrides || (!role.modeOverrides.roleDefinition && !role.modeOverrides.customInstructions)) {
			return this.applyGentleRoleOverride(selection, rolePromptData, { personaFallback })
		}

		// 强覆盖：使用显式的modeOverrides
		return this.applyStrongRoleOverride(selection, rolePromptData, role.modeOverrides, { personaFallback })
	}

	/**
	 * 获取模式选择
	 */
	getModeSelection(
		mode: Mode,
		customModePrompts?: CustomModePrompts,
		customModes?: ModeConfig[],
	): ModeSelection {
		return getModeSelection(mode, customModePrompts, customModes)
	}

	/**
	 * 应用SillyTavern特定角色覆盖：使用SillyTavern提示字段
	 */
	private applySillyTavernRoleOverride(
		selection: ModeSelection,
		rolePromptData: RolePromptData,
		options: { personaFallback?: RolePersona } = {},
	): ModeSelection {
		const { role } = rolePromptData
		const persona = role.modeOverrides?.persona || options.personaFallback || "hybrid"

		// 从SillyTavern字段构建角色定义
		let newRoleDefinition = ""

		// 如果有system_prompt则使用，否则从角色信息创建
		if (role.system_prompt) {
			newRoleDefinition = role.system_prompt
		} else {
			// 从角色信息创建角色定义
			const name = role.name || "Assistant"
			const description = role.description || ""
			const personality = role.personality || ""

			if (persona === "chat") {
				newRoleDefinition = `You are ${name}${description ? `. ${description}` : ""}${personality ? ` Your personality: ${personality}` : ""}.`
			} else {
				newRoleDefinition = `You are ${name}, a character with programming capabilities${description ? `. ${description}` : ""}${personality ? ` Your personality: ${personality}` : ""}.`
			}
		}

		// 从SillyTavern字段构建基础指令
		const instructionParts: string[] = []

		// 如果有scenario则添加
		if (role.scenario) {
			instructionParts.push(`### Scenario\n${role.scenario}`)
		}

		// 如果有示例消息则添加
		if (role.mes_example) {
			instructionParts.push(`### Example Interactions\n${role.mes_example}`)
		}

		// 如果有历史后指令则添加
		if (role.post_history_instructions) {
			instructionParts.push(`### Additional Instructions\n${role.post_history_instructions}`)
		}

		// 如果有创作者备注则添加
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
	 * 温和角色覆盖：向现有角色定义添加角色身份
	 */
	private applyGentleRoleOverride(
		selection: ModeSelection,
		rolePromptData: RolePromptData,
		options: { personaFallback?: RolePersona } = {},
	): ModeSelection {
		const { role } = rolePromptData
		const persona = role.modeOverrides?.persona || options.personaFallback || "hybrid"

		// 向角色定义添加角色身份
		let newRoleDefinition = selection.roleDefinition

		// 添加角色上下文
		const roleContext = `You are currently roleplaying as ${role.name}${role.description ? ` - ${role.description}` : ""}.`

		if (persona === "chat") {
			newRoleDefinition = `${roleContext} ${selection.roleDefinition}`
		} else {
			newRoleDefinition = `${roleContext} While maintaining your programming capabilities, ${selection.roleDefinition.toLowerCase()}`
		}

		// 添加角色特定指令
		const instructionParts: string[] = [selection.baseInstructions]

		// 如果有scenario则添加
		if (role.scenario) {
			instructionParts.push(`Current scenario: ${role.scenario}`)
		}

		// 添加个性说明
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
	 * 强角色覆盖：使用角色的显式modeOverrides
	 */
	private applyStrongRoleOverride(
		selection: ModeSelection,
		rolePromptData: RolePromptData,
		modeOverrides: any,
		options: { personaFallback?: RolePersona } = {},
	): ModeSelection {
		const { role } = rolePromptData

		// 使用显式覆盖
		const newRoleDefinition = modeOverrides.roleDefinition || selection.roleDefinition
		const newBaseInstructions = modeOverrides.customInstructions || selection.baseInstructions
		const newDescription = role.description || selection.description

		return {
			roleDefinition: newRoleDefinition,
			baseInstructions: newBaseInstructions,
			description: newDescription,
		}
	}

	/**
	 * 创建角色人格头部
	 */
	createPersonaHeader(role: any, persona: RolePersona): string {
		const name = role.name || "Assistant"
		const type = role.type || "AI Assistant"

		switch (persona) {
			case "chat":
				return `# ${name} - Conversational AI\n\nYou are ${name}, a friendly and knowledgeable ${type.toLowerCase()} focused on natural conversation and helping users.`
			// case "code": // legacy support // legacy support
			// 	return `# ${name} - Programming Assistant\n\nYou are ${name}, an expert ${type.toLowerCase()} specializing in software development, debugging, and technical problem-solving.`
			case "hybrid":
			default:
				return `# ${name} - Versatile Assistant\n\nYou are ${name}, a capable ${type.toLowerCase()} able to handle both conversational and technical tasks with expertise.`
		}
	}

	/**
	 * 创建语调指令
	 */
	createToneInstructions(role: any, persona: RolePersona, toneStrict: boolean = false): string {
		const baseInstructions = {
			chat: "Maintain a friendly, approachable tone. Be encouraging and supportive in your responses.",
			code: "Be precise and technical in your explanations. Focus on accuracy and best practices.",
			hybrid: "Adapt your tone to match the user's needs - conversational for general topics, technical for programming tasks.",
		}

		const baseInstruction = baseInstructions[persona] || baseInstructions.hybrid

		if (toneStrict) {
			return `${baseInstruction}\n\n**Important:** Maintain consistent tone throughout the conversation. Do not switch between different personas unless explicitly requested.`
		}

		return baseInstruction
	}

	/**
	 * 检查角色是否有特定的人格模式覆盖
	 */
	hasPersonaOverride(role: any): boolean {
		return !!(role.modeOverrides?.persona)
	}

	/**
	 * 获取角色的有效人格模式
	 */
	getEffectivePersona(role: any, fallback: RolePersona = "hybrid"): RolePersona {
		return role.modeOverrides?.persona || fallback
	}
}
