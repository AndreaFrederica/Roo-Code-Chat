/**
 * Template variable replacement utilities for SillyTavern-style placeholders
 * Supports {{char}} and {{user}} template variables in role fields
 */

import type { Role } from "@roo-code/types"

/**
 * Common template placeholders supported by the system
 * Supports both {{char}}/{{user}} and <char>/<user> formats
 */
export interface TemplateVariables {
	char: string
	user: string
}

/**
 * Default user name when no specific user name is available
 */
const DEFAULT_USER_NAME = "User"

/**
 * Get the user name for template replacement
 * Returns the user avatar role name if enabled, otherwise returns a default value
 */
export function getUserName(userAvatarRole?: Role, enableUserAvatar?: boolean): string {
	// If user avatar is enabled and has a role with a name, use that
	if (enableUserAvatar && userAvatarRole?.name) {
		return userAvatarRole.name
	}

	// Otherwise, use the default value
	return DEFAULT_USER_NAME
}

/**
 * Replace template variables in a string
 * Supports {{char}}, {{user}}, <char>, and <user> placeholders
 */
export function replaceTemplateVariables(
	text: string,
	charName: string,
	userAvatarRole?: Role,
	enableUserAvatar?: boolean,
): string {
	if (!hasTemplateVariables(text)) {
		return text
	}

	const userName = getUserName(userAvatarRole, enableUserAvatar)

	// Replace {{char}} with character name (case-insensitive)
	let result = text.replace(/\{\{\s*char\s*\}\}/gi, charName)

	// Replace {{user}} with user name (case-insensitive)
	result = result.replace(/\{\{\s*user\s*\}\}/gi, userName)

	// Replace <char> with character name (case-insensitive)
	// Only replace standalone <char> tags, not part of larger structure tags like <GrayWill>
	result = result.replace(/<\s*char\s*>/gi, charName)

	// Replace <user> with user name (case-insensitive)
	// Only replace standalone <user> tags, not part of larger structure tags
	result = result.replace(/<\s*user\s*>/gi, userName)

	return result
}

/**
 * Apply template variable replacement to a role object
 * Processes all relevant fields that might contain template variables
 */
export function applyTemplateVariablesToRole(role: Role, userAvatarRole?: Role, enableUserAvatar?: boolean): Role {
	if (!role) return role

	const charName = role.name || "角色"

	// Create a deep copy to avoid modifying the original
	const processedRole: Role = JSON.parse(JSON.stringify(role))

	// Process basic fields
	if (processedRole.description) {
		processedRole.description = replaceTemplateVariables(
			processedRole.description,
			charName,
			userAvatarRole,
			enableUserAvatar,
		)
	}
	if (processedRole.personality) {
		processedRole.personality = replaceTemplateVariables(
			processedRole.personality,
			charName,
			userAvatarRole,
			enableUserAvatar,
		)
	}
	if (processedRole.scenario) {
		processedRole.scenario = replaceTemplateVariables(
			processedRole.scenario,
			charName,
			userAvatarRole,
			enableUserAvatar,
		)
	}
	if (processedRole.first_mes) {
		processedRole.first_mes = replaceTemplateVariables(
			processedRole.first_mes,
			charName,
			userAvatarRole,
			enableUserAvatar,
		)
	}
	if (processedRole.mes_example) {
		processedRole.mes_example = replaceTemplateVariables(
			processedRole.mes_example,
			charName,
			userAvatarRole,
			enableUserAvatar,
		)
	}
	if (processedRole.creator_notes) {
		processedRole.creator_notes = replaceTemplateVariables(
			processedRole.creator_notes,
			charName,
			userAvatarRole,
			enableUserAvatar,
		)
	}
	if (processedRole.system_prompt) {
		processedRole.system_prompt = replaceTemplateVariables(
			processedRole.system_prompt,
			charName,
			userAvatarRole,
			enableUserAvatar,
		)
	}
	if (processedRole.post_history_instructions) {
		processedRole.post_history_instructions = replaceTemplateVariables(
			processedRole.post_history_instructions,
			charName,
			userAvatarRole,
			enableUserAvatar,
		)
	}

	// Process alternate greetings
	if (processedRole.alternate_greetings && Array.isArray(processedRole.alternate_greetings)) {
		processedRole.alternate_greetings = processedRole.alternate_greetings.map((greeting) =>
			replaceTemplateVariables(greeting, charName, userAvatarRole, enableUserAvatar),
		)
	}

	// Process profile fields
	if (processedRole.profile) {
		if (processedRole.profile.greeting && typeof processedRole.profile.greeting === "string") {
			processedRole.profile.greeting = replaceTemplateVariables(
				processedRole.profile.greeting,
				charName,
				userAvatarRole,
				enableUserAvatar,
			)
		}
		if (processedRole.profile.appearance && typeof processedRole.profile.appearance === "string") {
			processedRole.profile.appearance = replaceTemplateVariables(
				processedRole.profile.appearance,
				charName,
				userAvatarRole,
				enableUserAvatar,
			)
		}
		if (processedRole.profile.personality && typeof processedRole.profile.personality === "string") {
			processedRole.profile.personality = replaceTemplateVariables(
				processedRole.profile.personality,
				charName,
				userAvatarRole,
				enableUserAvatar,
			)
		}
		if (processedRole.profile.background && typeof processedRole.profile.background === "string") {
			processedRole.profile.background = replaceTemplateVariables(
				processedRole.profile.background,
				charName,
				userAvatarRole,
				enableUserAvatar,
			)
		}
		if (processedRole.profile.skills && typeof processedRole.profile.skills === "string") {
			processedRole.profile.skills = replaceTemplateVariables(
				processedRole.profile.skills,
				charName,
				userAvatarRole,
				enableUserAvatar,
			)
		}
		if (processedRole.profile.relationships && typeof processedRole.profile.relationships === "string") {
			processedRole.profile.relationships = replaceTemplateVariables(
				processedRole.profile.relationships,
				charName,
				userAvatarRole,
				enableUserAvatar,
			)
		}
	}

	// Process character book entries
	if (processedRole.character_book?.entries && Array.isArray(processedRole.character_book.entries)) {
		processedRole.character_book.entries = processedRole.character_book.entries.map((entry) => ({
			...entry,
			content: entry.content
				? replaceTemplateVariables(entry.content, charName, userAvatarRole, enableUserAvatar)
				: entry.content,
			comment: entry.comment
				? replaceTemplateVariables(entry.comment, charName, userAvatarRole, enableUserAvatar)
				: entry.comment,
		}))
	}

	return processedRole
}

/**
 * Check if a text contains template variables
 * @param text - The text to check
 * @returns True if the text contains {{char}}, {{user}}, <char>, or <user> placeholders
 */
export function hasTemplateVariables(text: string): boolean {
	if (!text || typeof text !== "string") {
		return false
	}

	// Check for both {{char}}/{{user}} and <char>/<user> formats
	const doubleBracePattern = /\{\{(char|user)\}\}/gi
	const angleBracketPattern = /<\s*(char|user)\s*>/gi

	return doubleBracePattern.test(text) || angleBracketPattern.test(text)
}
