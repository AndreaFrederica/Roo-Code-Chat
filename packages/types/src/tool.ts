import { z } from "zod"

/**
 * ToolGroup
 */

export const toolGroups = ["read", "edit", "browser", "command", "mcp", "modes", "memory"] as const

export const toolGroupsSchema = z.enum(toolGroups)

export type ToolGroup = z.infer<typeof toolGroupsSchema>

/**
 * ToolName
 */

export const toolNames = [
	"execute_command",
	"read_file",
	"write_to_file",
	"apply_diff",
	"insert_content",
	"search_and_replace",
	"search_files",
	"list_files",
	"list_code_definition_names",
	"browser_action",
	"use_mcp_tool",
	"access_mcp_resource",
	"ask_followup_question",
	"attempt_completion",
	"switch_mode",
	"new_task",
	"fetch_instructions",
	"codebase_search",
	"update_todo_list",
	"run_slash_command",
	"generate_image",
	"add_episodic_memory",
	"add_semantic_memory",
	"update_traits",
	"update_goals",
	"search_memories",
	"get_memory_stats",
	"get_recent_memories",
	"cleanup_memories",
] as const

export const toolNamesSchema = z.enum(toolNames)

export type BuiltInToolName = (typeof toolNames)[number]

export type ExtensionToolName = `extension:${string}`

export const extensionToolNameRegex = /^extension:[a-zA-Z0-9/_-]+$/

export type ToolName = BuiltInToolName | ExtensionToolName

export const toolIdentifierSchema = z.union([
	toolNamesSchema,
	z
		.string()
		.regex(extensionToolNameRegex, {
			message: "Extension tool names must follow the pattern 'extension:<extension-id>/<tool-id>'",
		}),
])

/**
 * ToolUsage
 */

export const toolUsageSchema = z.record(z.string(), z.object({ attempts: z.number(), failures: z.number() }))

export type ToolUsage = z.infer<typeof toolUsageSchema>

export function isExtensionToolName(name: string): name is ExtensionToolName {
	return extensionToolNameRegex.test(name)
}

/**
 * Tool interface for defining tools with their metadata and execution logic
 */
export interface Tool {
	name: string
	displayName: string
	description: string
	parameters: {
		properties: Record<string, {
			type: string
			description: string
			optional?: boolean
			items?: { type: string }
		}>
		required: string[]
	}
	execute: (args: any, context: any, provider: any) => Promise<{
		success: boolean
		message?: string
		error?: string
		[key: string]: any
	}>
}
