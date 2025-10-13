import * as vscode from "vscode"
import * as os from "os"
import * as path from "path"
import * as fs from "fs/promises"

import type {
	ModeConfig,
	PromptComponent,
	CustomModePrompts,
	TodoItem,
	Role,
	UserAvatarVisibility,
} from "@roo-code/types"

import type { SystemPromptSettings } from "@roo-code/types"
import type {
	RolePromptData,
	RoleModeOverrides,
	RolePersona,
	StorylineArc,
	MemoryTrait,
	MemoryGoal,
	MemoryEpisodicRecord,
} from "@roo-code/types"

// Import STProfileProcessor for STProfile handling
import {
	STProfileProcessor,
	processSTProfile,
	processLiquidTemplateVariables,
	type STProcessOptions,
	type STProfileComplete,
	type LiquidTemplateProcessingOptions,
	compilePresetChannels,
} from "@roo-code/types"

import { debugLog } from "../../utils/debug"

import { Mode, modes, defaultModeSlug, getModeBySlug, getGroupName, getModeSelection } from "../../shared/modes"
import { DiffStrategy } from "../../shared/tools"
import { formatLanguage } from "../../shared/language"
import { isEmpty } from "../../utils/object"

import { McpHub } from "../../services/mcp/McpHub"
import { CodeIndexManager } from "../../services/code-index/manager"

import { PromptVariables, loadSystemPromptFile } from "./sections/custom-system-prompt"
import { applyTemplateVariablesToRole } from "./template-variables"

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

interface RolePromptSectionOptions {
	summaryOnly?: boolean
	disableTemplateReplacement?: boolean
}

const SUMMARY_SECTION_TITLES = new Set([
	"### Character Overview",
	"### Personality",
	"### Background",
	"### Appearance",
	"### Skills",
	"### Hobbies",
	"### Titles",
	"### Relationships",
	"### Notes",
	"### Tags",
])

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

/**
 * 检测文件是否为 mixin 文件
 */
function isMixinFile(fileName: string): boolean {
	return fileName.includes(".mixin.json") || fileName.endsWith(".mixin.jsonc")
}

/**
 * 从 mixin 文件名提取主 profile 文件名
 */
function extractMainProfileName(mixinFileName: string): string {
	// 将 "profile-name.mixin.json" 转换为 "profile-name.json"
	return mixinFileName.replace(".mixin.json", ".json").replace(".mixin.jsonc", ".jsonc")
}

/**
 * Load available TSProfiles from the workspace
 */
async function loadTsProfiles(): Promise<any[]> {
	try {
		// Get workspace path
		const workspaceFolders = vscode.workspace.workspaceFolders
		if (!workspaceFolders || workspaceFolders.length === 0) {
			debugLog("TSProfile: No workspace path found")
			return []
		}

		const workspacePath = workspaceFolders[0].uri.fsPath
		const profileDir = path.join(workspacePath, "novel-helper", ".anh-chat", "tsprofile")
		debugLog(`TSProfile: Profile directory: ${profileDir}`)

		// Check if profile directory exists
		try {
			await fs.access(profileDir)
			debugLog(`TSProfile: Directory exists: ${profileDir}`)
		} catch {
			// Directory doesn't exist, create it
			debugLog(`TSProfile: Creating directory: ${profileDir}`)
			await fs.mkdir(profileDir, { recursive: true })
			return []
		}

		const files = await fs.readdir(profileDir, { withFileTypes: true })
		debugLog(`TSProfile: Found ${files.length} files in directory`)

		// 分离主 profile 文件和 mixin 文件
		const mainProfileFiles: string[] = []
		const mixinFiles: string[] = []

		for (const file of files) {
			if (file.isFile() && (file.name.endsWith(".json") || file.name.endsWith(".jsonc"))) {
				if (isMixinFile(file.name)) {
					mixinFiles.push(file.name)
				} else {
					mainProfileFiles.push(file.name)
				}
			}
		}

		debugLog(`TSProfile: Found ${mainProfileFiles.length} main profiles and ${mixinFiles.length} mixin files`)

		const profiles: any[] = []

		// 处理主 profile 文件
		for (const fileName of mainProfileFiles) {
			const filePath = path.join(profileDir, fileName)
			try {
				const stats = await fs.stat(filePath)
				const profileData = await fs.readFile(filePath, "utf-8")
				const parsed = JSON.parse(profileData)

				// Create STProfileProcessor instance
				const processor = new STProfileProcessor()

				// Validate the profile using STProfileProcessor
				const validation = processor.parse(parsed)
				if (!validation) {
					throw new Error("Invalid STProfile format")
				}

				// 检查是否存在对应的 mixin 文件
				const mixinFileName = fileName.replace(".json", ".mixin.json").replace(".jsonc", ".mixin.jsonc")
				const mixinFilePath = path.join(profileDir, mixinFileName)
				let hasMixin = false
				let mixinPromptsCount = 0

				try {
					await fs.access(mixinFilePath)
					const mixinContent = await fs.readFile(mixinFilePath, "utf-8")
					const mixinData = JSON.parse(mixinContent)
					hasMixin = true
					mixinPromptsCount = mixinData.prompts?.length || 0
					debugLog(`TSProfile: Found mixin for ${fileName}: ${mixinFileName}`)
				} catch {
					// 没有找到 mixin 文件或 mixin 文件无效，这是正常情况
				}

				// Get prompt counts from validation
				const promptsCount = validation.prompts?.length || 0
				const enabledCount = validation.prompts?.filter((p: any) => p.enabled !== false).length || 0

				profiles.push({
					name: parsed.name || fileName,
					path: filePath,
					description: parsed.description || "",
					promptsCount,
					enabledCount,
					lastModified: stats.mtime.getTime(),
					// 添加 mixin 信息到 profile
					hasMixin,
					mixinPromptsCount,
					mixinPath: hasMixin ? mixinFilePath : undefined,
				})
			} catch (error) {
				console.warn(`Failed to load profile ${fileName}:`, error)
			}
		}

		// 处理孤立的 mixin 文件（没有对应主 profile 的 mixin 文件）
		for (const mixinFileName of mixinFiles) {
			const mainProfileName = extractMainProfileName(mixinFileName)

			// 检查是否有对应的主 profile 文件
			if (!mainProfileFiles.includes(mainProfileName)) {
				const filePath = path.join(profileDir, mixinFileName)
				try {
					const stats = await fs.stat(filePath)
					const mixinData = await fs.readFile(filePath, "utf-8")
					const parsed = JSON.parse(mixinData)

					debugLog(`TSProfile: Found orphan mixin file: ${mixinFileName}`)

					profiles.push({
						name: `${mixinFileName} (孤立mixin)`,
						path: filePath,
						description: `Mixin文件，缺少对应的主profile: ${mainProfileName}`,
						promptsCount: parsed.prompts?.length || 0,
						enabledCount: parsed.prompts?.filter((p: any) => p.enabled !== false).length || 0,
						lastModified: stats.mtime.getTime(),
						isOrphanMixin: true,
						expectedMainProfile: mainProfileName,
					})
				} catch (error) {
					console.warn(`Failed to load orphan mixin ${mixinFileName}:`, error)
				}
			}
		}

		return profiles.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0))
	} catch (error) {
		console.error("Error loading TSProfiles:", error)
		return []
	}
}

/**
 * Validate a TSProfile file
 */
async function validateTsProfile(filePath: string): Promise<{ success: boolean; error?: string }> {
	try {
		const profileData = await fs.readFile(filePath, "utf-8")
		const parsed = JSON.parse(profileData)

		// Create STProfileProcessor instance
		const processor = new STProfileProcessor()

		// Parse and validate the profile using STProfileProcessor
		const validation = processor.parse(parsed)
		if (!validation) {
			return {
				success: false,
				error: "Invalid STProfile format",
			}
		}

		return { success: true }
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		}
	}
}

/**
 * Apply STProfile preprocessing to a role if STProfile is enabled and configured
 * This function should be called at the beginning of SYSTEM_PROMPT generation
 */
async function applyTsProfilePreprocessing(
	role: Role,
	enabledTSProfiles: string[] = [],
	anhTsProfileAutoInject: boolean = true,
	anhTsProfileVariables: Record<string, any> = {},
	userAvatarRole?: Role,
): Promise<Role> {
	try {
		// Debug: Log TSProfile state
		debugLog("applyTsProfilePreprocessing - Start:", {
			roleName: role.name,
			enabledTSProfiles,
			anhTsProfileAutoInject,
			variablesCount: Object.keys(anhTsProfileVariables).length,
		})

		// If no TSProfiles are enabled, return original role
		if (enabledTSProfiles.length === 0) {
			debugLog("applyTsProfilePreprocessing - No TSProfiles enabled, returning original role")
			return role
		}

		console.log(`[SystemPrompt] Applying TSProfile preprocessing for ${enabledTSProfiles.length} profiles`)

		// Load all available profiles
		const allProfiles = await loadTsProfiles()
		let processedRole = { ...role }

		// If role doesn't have system_prompt, generate basic "You are..." introduction first
		if (!processedRole.system_prompt && processedRole.name) {
			const name = processedRole.name || "Assistant"
			const description = processedRole.description || ""
			const personality = processedRole.personality || ""

			processedRole.system_prompt = `You are ${name}${description ? `. ${description}` : ""}${personality ? ` Your personality: ${personality}` : ""}.`

			debugLog("applyTsProfilePreprocessing - Generated basic role definition:", {
				roleName: processedRole.name,
				generatedSystemPrompt: processedRole.system_prompt,
				length: processedRole.system_prompt.length,
			})
		}

		// Process each enabled profile
		for (const profileName of enabledTSProfiles) {
			const profile = allProfiles.find((p) => p.name === profileName)
			if (!profile) {
				console.log(`[SystemPrompt] TSProfile not found: ${profileName}`)
				continue
			}

			// Validate the profile
			const validationResult = await validateTsProfile(profile.path)
			if (!validationResult.success) {
				console.log(`[SystemPrompt] TSProfile validation failed for ${profileName}: ${validationResult.error}`)
				continue
			}

			// Read and parse the profile file
			const profileData = await fs.readFile(profile.path, "utf-8")
			const parsed = JSON.parse(profileData)

			// Create STProfileProcessor instance
			const processor = new STProfileProcessor()

			// Prepare template variables
			const templateVariables = {
				user: userAvatarRole?.name || "用户",
				char: role.name || "",
				name: role.name || "",
				description: role.description || "",
				personality: role.personality || "",
				scenario: role.scenario || "",
				first_mes: role.first_mes || "",
				mes_example: role.mes_example || "",
				isodate: new Date().toISOString().split("T")[0],
				isotime: new Date().toTimeString().split(" ")[0],
				...anhTsProfileVariables,
			}

			// Process STProfile with template variables
			const stProfileOptions: STProcessOptions = {
				variables: templateVariables,
				compile: {
					characterId: 100001,
					onlyEnabled: true,
					templateOptions: {
						strict: false,
						keepVariableDefinitions: false,
						removeUnprocessed: true,
						maxRecursionDepth: 10,
					},
				},
				inject: {
					keepRawInExtensions: false,
					keepCompiledInExtensions: false,
				},
			}

			// 自动检测并加载 mixin 文件
			let mixinPath: string | undefined
			try {
				const profileDir = path.dirname(profile.path)
				const profileBaseName = path.basename(profile.path, ".json").replace(".jsonc", "")
				const mixinFileName = `${profileBaseName}.mixin.json`
				mixinPath = path.join(profileDir, mixinFileName)

				// 检查 mixin 文件是否存在
				await fs.access(mixinPath)
				debugLog(`[STProfile] Found and loading mixin for ${profileName}: ${mixinFileName}`)

				// 将 mixin 路径添加到处理选项中
				stProfileOptions.mixin = mixinPath
			} catch (error) {
				// 没有找到 mixin 文件，这是正常情况
				debugLog(`[STProfile] No mixin found for ${profileName}`)
			}

			// Process the profile (with or without mixin)
			const injectionResult = await processor.process(processedRole, parsed, stProfileOptions)

			// Debug: Log injection results
			debugLog(`STProfile injection for ${profileName}:`, {
				anhTsProfileAutoInject,
				success: injectionResult.success,
				systemLength: injectionResult.role.system_settings?.length || 0,
				userLength: injectionResult.role.user_settings?.length || 0,
				assistantLength: injectionResult.role.assistant_settings?.length || 0,
				beforeInjection: {
					hasSystemPrompt: !!processedRole.system_prompt,
					hasExtensions: !!processedRole.extensions,
				},
			})

			// Update processed role if injection was successful
			if (injectionResult.success && anhTsProfileAutoInject) {
				processedRole = injectionResult.role

				debugLog(`STProfile injection completed for ${profileName}:`, {
					hasSystemPrompt: !!processedRole.system_prompt,
					hasExtensions: !!processedRole.extensions,
					extensionsKeys: processedRole.extensions ? Object.keys(processedRole.extensions) : [],
				})

				// 对注入后的角色的描述性字段进行模板处理
				try {
					debugLog(`[STProfile] Processing template variables for role fields after injection...`)

					// 准备模板处理选项
					const templateProcessOptions: LiquidTemplateProcessingOptions = {
						variables: {
							// 确保 user 和 char 变量可用
							user: userAvatarRole?.name || "用户",
							char: processedRole.name || "",
							name: processedRole.name || "",
							description: processedRole.description || "",
							personality: processedRole.personality || "",
							scenario: processedRole.scenario || "",
							first_mes: processedRole.first_mes || "",
							mes_example: processedRole.mes_example || "",
							isodate: new Date().toISOString().split("T")[0],
							isotime: new Date().toTimeString().split(" ")[0],
							// 添加所有用户定义的变量
							...anhTsProfileVariables,
						},
						strict: false,
						keepVariableDefinitions: false,
						removeUnprocessed: true,
						maxRecursionDepth: 10,
					}

					// 需要模板处理的描述性字段列表
					const descriptiveFields = [
						"description",
						"personality",
						"scenario",
						"first_mes",
						"mes_example",
						"creator_notes",
						"system_prompt",
						"post_history_instructions",
						// STProfile注入的字段
						"system_settings",
						"user_settings",
						"assistant_settings",
					]

					// 对每个描述性字段进行模板处理
					const processedTemplateData: any = {}
					for (const field of descriptiveFields) {
						if (processedRole[field] && typeof processedRole[field] === "string") {
							const originalContent = processedRole[field] as string
							const result = processLiquidTemplateVariables(originalContent, templateProcessOptions)
							processedTemplateData[field] = result.processedText

							if (result.processedText !== originalContent) {
								debugLog(`[STProfile] Template processed field ${field}:`, {
									original:
										originalContent.substring(0, 100) + (originalContent.length > 100 ? "..." : ""),
									processed:
										result.processedText.substring(0, 100) +
										(result.processedText.length > 100 ? "..." : ""),
								})
							}
						}
					}

					// 更新角色的模板处理字段
					Object.assign(processedRole, processedTemplateData)

					debugLog(`[STProfile] Template processing completed for ${profileName}:`, {
						processedFields: Object.keys(processedTemplateData),
					})
				} catch (error) {
					console.warn(`[STProfile] Template processing failed for ${profileName}:`, error)
					// 模板处理失败时继续使用原始内容，不影响整体流程
				}
			} else {
				debugLog(`STProfile injection skipped for ${profileName}:`, {
					anhTsProfileAutoInject,
					success: injectionResult.success,
					errors: injectionResult.errors,
				})
			}

			console.log(`[SystemPrompt] STProfile preprocessing applied for: ${profileName}`)
			console.log(
				`[SystemPrompt] - System settings length: ${injectionResult.role.system_settings?.length || 0} characters`,
			)
		}

		console.log(`[SystemPrompt] All TSProfile preprocessing applied successfully`)
		return processedRole
	} catch (error) {
		console.log(
			`[SystemPrompt] TSProfile preprocessing failed: ${error instanceof Error ? error.message : String(error)}`,
		)
		return role
	}
}

function buildRolePromptSection(
	rolePromptData?: RolePromptData,
	userAvatarRole?: Role,
	enableUserAvatar?: boolean,
	options: RolePromptSectionOptions = {},
): string {
	if (!rolePromptData || !rolePromptData.role) {
		return ""
	}

	const { summaryOnly, disableTemplateReplacement } = options

	// Apply template variable replacement to the role before processing
	const processedRole = disableTemplateReplacement
		? (JSON.parse(JSON.stringify(rolePromptData.role)) as Role)
		: applyTemplateVariablesToRole(rolePromptData.role, userAvatarRole, enableUserAvatar)
	const { storyline, memory } = rolePromptData
	const sections: string[] = []

	// 统一处理所有角色字段，不区分来源
	const { profile } = processedRole

	// Build character overview section
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

	// 优先使用顶层description，如果没有则使用profile.appearance的第一个元素（如果是数组）或字符串值
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

	sections.push(`### Character Overview\n${overviewItems.join("\n")}`)

	// 处理性格 - 优先使用SillyTavern的personality字段，然后是profile.personality
	const personalityText =
		processedRole.personality || (typeof profile?.personality === "string" ? profile.personality : "")
	const personalityArray = Array.isArray(profile?.personality) ? profile.personality : []

	if (personalityText) {
		sections.push(`### Personality\n${personalityText}`)
	} else if (personalityArray.length > 0) {
		sections.push(`### Personality\n${personalityArray.map((trait) => `- ${trait}`).join("\n")}`)
	}

	// 处理背景/世界观 - 优先使用scenario，然后是profile.background
	const backgroundText =
		processedRole.scenario ||
		processedRole.background ||
		(typeof profile?.background === "string" ? profile.background : "")
	if (backgroundText) {
		sections.push(`### Background\n${backgroundText}`)
	}

	// 处理初始消息/问候语
	const greeting = processedRole.first_mes || (typeof profile?.greeting === "string" ? profile.greeting : "")
	if (greeting) {
		sections.push(`### First Message\n${greeting}`)
	}

	// 处理示例对话
	if (processedRole.mes_example) {
		sections.push(`### Example Interactions\n${processedRole.mes_example}`)
	}

	// 处理备选问候语
	if (processedRole.alternate_greetings && processedRole.alternate_greetings.length > 0) {
		sections.push(
			`### Alternate Greetings\n${processedRole.alternate_greetings.map((greeting, index) => `${index + 1}. ${greeting}`).join("\n")}`,
		)
	}

	// 处理创作者备注
	if (processedRole.creator_notes) {
		sections.push(`### Creator Notes\n${processedRole.creator_notes}`)
	}

	// 处理系统提示词
	if (processedRole.system_prompt) {
		sections.push(`### System Instructions\n${processedRole.system_prompt}`)
	}

	// 处理STProfile注入的system_settings字段
	if (processedRole.system_settings) {
		sections.push(`### System Settings\n${processedRole.system_settings}`)
	}

	// 处理STProfile注入的user_settings字段
	if (processedRole.user_settings) {
		sections.push(`### User Settings\n${processedRole.user_settings}`)
	}

	// 处理STProfile注入的assistant_settings字段
	if (processedRole.assistant_settings) {
		sections.push(`### Assistant Settings\n${processedRole.assistant_settings}`)
	}

	// 处理历史后指令
	if (processedRole.post_history_instructions) {
		sections.push(`### Additional Instructions\n${processedRole.post_history_instructions}`)
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

	// 处理profile中的数组字段 - 只有当appearance不是字符串时才作为列表处理
	if (
		profile?.appearance &&
		Array.isArray(profile.appearance) &&
		!description?.includes(profile.appearance.join(", "))
	) {
		addListSection("### Appearance", profile.appearance)
	}
	addListSection("### Skills", profile?.skills)
	addListSection("### Titles", profile?.titles)
	addListSection("### Hobbies", profile?.hobbies)
	addListSection("### Relationships", profile?.relationships)
	addListSection("### Notes", profile?.notes)

	// 处理profile中的其他字段（动态处理任意字段名）
	if (profile) {
		Object.entries(profile).forEach(([key, value]) => {
			// 跳过已经处理过的标准字段
			const standardFields = [
				"appearance",
				"skills",
				"titles",
				"hobbies",
				"relationships",
				"notes",
				"personality",
				"background",
				"greeting",
			]
			if (standardFields.includes(key)) {
				return
			}

			// 处理数组类型的字段
			if (Array.isArray(value) && value.length > 0) {
				const stringValues = value.filter((v): v is string => typeof v === "string")
				if (stringValues.length > 0) {
					const titleCase = key.charAt(0).toUpperCase() + key.slice(1)
					sections.push(`### ${titleCase}\n${stringValues.map((v) => `- ${v}`).join("\n")}`)
				}
			}
			// 处理字符串类型的字段
			else if (typeof value === "string" && value.trim()) {
				const titleCase = key.charAt(0).toUpperCase() + key.slice(1)
				sections.push(`### ${titleCase}\n${value}`)
			}
		})
	}

	// 处理时间线
	if (processedRole.timeline && processedRole.timeline.length > 0) {
		const timelineEntries = processedRole.timeline.map((entry, index) => {
			if (typeof entry === "string") {
				return `${index + 1}. ${entry}`
			} else if (typeof entry === "object" && entry !== null) {
				const timelineEntry = entry as { date?: string; event: string; description?: string }
				const parts: string[] = []
				if (timelineEntry.date) {
					parts.push(`**${timelineEntry.date}**`)
				}
				parts.push(timelineEntry.event)
				if (timelineEntry.description) {
					parts.push(`- ${timelineEntry.description}`)
				}
				return `${index + 1}. ${parts.join(" ")}`
			}
			return `${index + 1}. ${String(entry)}`
		})
		sections.push(`### Timeline\n${timelineEntries.join("\n")}`)
	}

	// 处理标签
	if (processedRole.tags && processedRole.tags.length > 0) {
		sections.push(`### Tags\n${processedRole.tags.join(", ")}`)
	}

	// 处理根级 relationships
	if (Array.isArray((processedRole as any).relationships) && (processedRole as any).relationships.length > 0) {
		const relationshipItems: string[] = []

		;(processedRole as any).relationships.forEach((relation: unknown) => {
			if (typeof relation === "string") {
				// 字符串类型的关系
				relationshipItems.push(relation)
			} else if (relation && typeof relation === "object") {
				// 对象类型的关系，尝试提取有用信息
				const relationObj = relation as Record<string, unknown>

				// 尝试多种可能的字段名
				const name = relationObj.name || relationObj.character || relationObj.person
				const description = relationObj.description || relationObj.relation || relationObj.relationship
				const type = relationObj.type || relationObj.relationshipType

				if (typeof name === "string") {
					let relationText = name
					if (typeof type === "string") {
						relationText += ` (${type})`
					}
					if (typeof description === "string") {
						relationText += `: ${description}`
					}
					relationshipItems.push(relationText)
				} else if (typeof description === "string") {
					// 如果没有名字但有描述，直接使用描述
					relationshipItems.push(description)
				} else {
					// 如果是其他结构，尝试转换为字符串
					try {
						const stringified = JSON.stringify(relation)
						if (stringified !== "{}" && stringified !== "null") {
							relationshipItems.push(stringified)
						}
					} catch {
						// 忽略无法序列化的对象
					}
				}
			}
		})

		if (relationshipItems.length > 0) {
			sections.push(`### Relationships\n${relationshipItems.map((relation) => `- ${relation}`).join("\n")}`)
		}
	}

	// 处理根级 notes
	if (Array.isArray((processedRole as any).notes) && (processedRole as any).notes.length > 0) {
		const noteItems: string[] = []

		;(processedRole as any).notes.forEach((note: unknown) => {
			if (typeof note === "string") {
				// 字符串类型的笔记
				noteItems.push(note)
			} else if (note && typeof note === "object") {
				// 对象类型的笔记，尝试提取有用信息
				const noteObj = note as Record<string, unknown>

				// 尝试多种可能的字段名
				const title = noteObj.title || noteObj.name || noteObj.subject
				const content = noteObj.content || noteObj.description || noteObj.note || noteObj.text
				const category = noteObj.category || noteObj.type || noteObj.tag

				if (typeof title === "string" && typeof content === "string") {
					let noteText = `**${title}**: ${content}`
					if (typeof category === "string") {
						noteText = `[${category}] ${noteText}`
					}
					noteItems.push(noteText)
				} else if (typeof content === "string") {
					// 如果只有内容，直接使用
					let noteText = content
					if (typeof category === "string") {
						noteText = `[${category}] ${noteText}`
					}
					noteItems.push(noteText)
				} else if (typeof title === "string") {
					// 如果只有标题，直接使用
					let noteText = title
					if (typeof category === "string") {
						noteText = `[${category}] ${noteText}`
					}
					noteItems.push(noteText)
				} else {
					// 如果是其他结构，尝试转换为字符串
					try {
						const stringified = JSON.stringify(note)
						if (stringified !== "{}" && stringified !== "null") {
							noteItems.push(stringified)
						}
					} catch {
						// 忽略无法序列化的对象
					}
				}
			}
		})

		if (noteItems.length > 0) {
			sections.push(`### Notes\n${noteItems.map((note) => `- ${note}`).join("\n")}`)
		}
	}

	// 处理创作者信息
	if (processedRole.creator) {
		sections.push(`### Creator\n${processedRole.creator}`)
	}

	// 处理角色版本
	if (processedRole.character_version) {
		sections.push(`### Version\n${processedRole.character_version}`)
	}

	// 处理世界观词库 (Character Book)
	if (
		processedRole.character_book &&
		processedRole.character_book.entries &&
		processedRole.character_book.entries.length > 0
	) {
		const { character_book } = processedRole

		// 过滤并排序条目
		const sortedEntries = character_book.entries
			.filter((entry) => entry.enabled !== false) // 只包含启用的条目
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
			const bookEntries = sortedEntries.map((entry) => {
				const parts: string[] = []

				// 添加条目名称（如果有）
				if (entry.name) {
					parts.push(`**${entry.name}**`)
				}

				// 添加内容
				parts.push(entry.content)

				// 添加关键词信息
				const allKeys = [...(entry.keys || []), ...(entry.secondary_keys || [])].filter(Boolean)

				if (allKeys.length > 0) {
					parts.push(`(Keywords: ${allKeys.join(", ")})`)
				}

				// 添加特殊标记
				const flags: string[] = []
				if (entry.constant) flags.push("常驻")
				if (entry.selective) flags.push("选择性")
				if (entry.case_sensitive) flags.push("区分大小写")

				if (flags.length > 0) {
					parts.push(`[${flags.join(", ")}]`)
				}

				return `- ${parts.join(" ")}`
			})

			// 构建标题
			let title = "### World Information"
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
				metadata.push("递归扫描: 启用")
			}

			let content = bookEntries.join("\n")
			if (metadata.length > 0) {
				content = `*配置: ${metadata.join(", ")}*\n\n${content}`
			}

			sections.push(`${title}\n${content}`)
		}
	}

	// Handle extensions field (for TSProfile and STProfile injected content)
	if (processedRole.extensions && typeof processedRole.extensions === "object") {
		// Check for TSProfile specific fields
		const extensionEntries: string[] = []

		// Handle depth_prompt (TSProfile system prompts)
		if (processedRole.extensions.depth_prompt && typeof processedRole.extensions.depth_prompt === "object") {
			const depthPrompt = processedRole.extensions.depth_prompt as any
			if (depthPrompt.system && typeof depthPrompt.system === "string" && depthPrompt.system.trim()) {
				extensionEntries.push(`### System Instructions\n${depthPrompt.system.trim()}`)
			}
			if (depthPrompt.user && typeof depthPrompt.user === "string" && depthPrompt.user.trim()) {
				extensionEntries.push(`### User Instructions\n${depthPrompt.user.trim()}`)
			}
			if (depthPrompt.assistant && typeof depthPrompt.assistant === "string" && depthPrompt.assistant.trim()) {
				extensionEntries.push(`### Assistant Guidelines\n${depthPrompt.assistant.trim()}`)
			}
		}

		// Handle STProfile specific fields
		if (processedRole.extensions.stProfile && typeof processedRole.extensions.stProfile === "object") {
			const stProfile = processedRole.extensions.stProfile as any

			// Add system settings if available
			if (
				stProfile.system_settings &&
				typeof stProfile.system_settings === "string" &&
				stProfile.system_settings.trim()
			) {
				extensionEntries.push(`### System Settings\n${stProfile.system_settings.trim()}`)
			}

			// Add user settings if available
			if (
				stProfile.user_settings &&
				typeof stProfile.user_settings === "string" &&
				stProfile.user_settings.trim()
			) {
				extensionEntries.push(`### User Settings\n${stProfile.user_settings.trim()}`)
			}

			// Add assistant settings if available
			if (
				stProfile.assistant_settings &&
				typeof stProfile.assistant_settings === "string" &&
				stProfile.assistant_settings.trim()
			) {
				extensionEntries.push(`### Assistant Settings\n${stProfile.assistant_settings.trim()}`)
			}

			// Add compiled content if available
			if (stProfile.compiled && typeof stProfile.compiled === "object") {
				const compiled = stProfile.compiled
				if (compiled.system && typeof compiled.system === "string" && compiled.system.trim()) {
					extensionEntries.push(`### Compiled System\n${compiled.system.trim()}`)
				}
				if (compiled.user && typeof compiled.user === "string" && compiled.user.trim()) {
					extensionEntries.push(`### Compiled User\n${compiled.user.trim()}`)
				}
				if (compiled.assistant && typeof compiled.assistant === "string" && compiled.assistant.trim()) {
					extensionEntries.push(`### Compiled Assistant\n${compiled.assistant.trim()}`)
				}
			}
		}

		// Add other extension fields for debugging
		Object.entries(processedRole.extensions).forEach(([key, value]) => {
			if (key !== "depth_prompt" && key !== "stProfile" && value !== null && value !== undefined) {
				if (typeof value === "string" && value.trim()) {
					extensionEntries.push(`### ${key}\n${value.trim()}`)
				} else if (Array.isArray(value) && value.length > 0) {
					const stringValues = value.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
					if (stringValues.length > 0) {
						extensionEntries.push(`### ${key}\n${stringValues.map((v) => `- ${v.trim()}`).join("\n")}`)
					}
				} else if (typeof value === "object" && value !== null && Object.keys(value).length > 0) {
					try {
						const jsonString = JSON.stringify(value, null, 2)
						extensionEntries.push(`### ${key}\n\`\`\`json\n${jsonString}\n\`\`\``)
					} catch (error) {
						console.warn(`Failed to serialize extension ${key}:`, error)
					}
				}
			}
		})

		// Add extension entries to sections
		if (extensionEntries.length > 0) {
			sections.push(...extensionEntries)
		}
	}

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

	// Debug: Log all sections before filtering
	console.log("[DEBUG] buildRolePromptSection - All sections built:", {
		sectionCount: sections.length,
		sectionTitles: sections.map((s) => s.split("\n", 1)[0]?.trim()),
		hasSystemInstructions: sections.some((s) => s.includes("### System Instructions")),
		hasSystemSettings: sections.some((s) => s.includes("### System Settings")),
		hasUserSettings: sections.some((s) => s.includes("### User Settings")),
		hasAssistantSettings: sections.some((s) => s.includes("### Assistant Settings")),
		systemInstructionsContent: sections.find((s) => s.includes("### System Instructions")),
		systemSettingsContent: sections.find((s) => s.includes("### System Settings")),
		userSettingsContent: sections.find((s) => s.includes("### User Settings")),
		assistantSettingsContent: sections.find((s) => s.includes("### Assistant Settings")),
		// Log role fields for debugging
		roleFields: {
			hasSystemPrompt: !!processedRole.system_prompt,
			hasSystemSettings: !!processedRole.system_settings,
			hasUserSettings: !!processedRole.user_settings,
			hasAssistantSettings: !!processedRole.assistant_settings,
			systemPromptLength: processedRole.system_prompt?.length || 0,
			systemSettingsLength: processedRole.system_settings?.length || 0,
			userSettingsLength: processedRole.user_settings?.length || 0,
			assistantSettingsLength: processedRole.assistant_settings?.length || 0,
		},
	})

	const finalSections = summaryOnly
		? (() => {
				const preferred: string[] = []
				const usedIndices = new Set<number>()
				const maxSummarySections = 6
				const excludedHeadings = new Set([
					"### Example Interactions",
					"### Alternate Greetings",
					"### Creator Notes",
					"### System Instructions",
					"### Additional Instructions",
					"### Timeline",
					"### World Information",
					// 不排除STProfile的settings字段，因为它们通常包含重要指令
				])

				sections.forEach((section, index) => {
					if (preferred.length >= maxSummarySections) {
						return
					}

					const heading = section.split("\n", 1)[0]?.trim()
					if (heading && SUMMARY_SECTION_TITLES.has(heading)) {
						preferred.push(section)
						usedIndices.add(index)
					}
				})

				if (preferred.length < maxSummarySections) {
					sections.forEach((section, index) => {
						if (preferred.length >= maxSummarySections || usedIndices.has(index)) {
							return
						}

						const heading = section.split("\n", 1)[0]?.trim()
						if (heading && excludedHeadings.has(heading)) {
							return
						}

						preferred.push(section)
						usedIndices.add(index)
					})
				}

				if (preferred.length > 0) {
					return preferred
				}

				return sections.length > 0 ? [sections[0]] : []
			})()
		: sections

	const result = finalSections.filter(Boolean).join("\n\n")

	// Debug: Log final result
	console.log("[DEBUG] buildRolePromptSection - Final result:", {
		sectionCount: finalSections.length,
		finalSectionTitles: finalSections.map((s) => s.split("\n", 1)[0]?.trim()),
		resultLength: result.length,
		containsSystemInstructions: result.includes("### System Instructions"),
	})

	return result
}

function buildUserAvatarSectionBlock(
	enableUserAvatar: boolean | undefined,
	userAvatarRole: Role | undefined,
	visibility: UserAvatarVisibility = "full",
): string {
	if (!enableUserAvatar || !userAvatarRole) {
		return ""
	}

	const normalizedVisibility: UserAvatarVisibility = visibility ?? "full"

	console.log(
		"[ANH-Chat:SystemPrompt] Building user avatar section for role:",
		userAvatarRole.name,
		"visibility:",
		normalizedVisibility,
	)

	const userAvatarPromptData: RolePromptData = {
		role: userAvatarRole,
		storyline: { arcs: [] },
		memory: { traits: [], goals: [], episodic: [] },
	}

	if (normalizedVisibility === "hidden") {
		return `

USER AVATAR
用户选择隐藏所有角色信息。请仅以"用户"称呼，不要推断或假设任何背景、性格或身份细节。

`
	}

	if (normalizedVisibility === "name") {
		const roleName = userAvatarRole.name?.trim()
		const nameLine = roleName ? `当前用户对外使用的角色名是：${roleName}` : "用户未公开角色名称。"

		return `

USER AVATAR
${nameLine}
除角色名称外的所有信息均已隐藏。

`
	}

	const summaryOnly = normalizedVisibility === "summary"
	const section = buildRolePromptSection(userAvatarPromptData, undefined, undefined, {
		disableTemplateReplacement: true,
		summaryOnly,
	})

	if (!section) {
		return `

USER AVATAR
用户的角色信息不可用或已被隐藏。

`
	}

	if (summaryOnly) {
		return `

USER AVATAR SUMMARY
以下是用户角色的精简信息，详细内容已隐藏。
${section}

`
	}

	return `

USER AVATAR
这是用户当前使用的角色设定：
${section}

`
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
	userAvatarVisibility?: UserAvatarVisibility,
	extensionToolDescriptions?: string[],
	worldBookContent?: string,
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

	// Debug: Log role data before building sections
	console.log("[DEBUG] buildRolePromptSection - Input role data:", {
		roleName: rolePromptData?.role?.name,
		hasSystemPrompt: !!rolePromptData?.role?.system_prompt,
		systemPromptLength: rolePromptData?.role?.system_prompt?.length || 0,
		hasPostHistoryInstructions: !!rolePromptData?.role?.post_history_instructions,
		hasExtensions: !!rolePromptData?.role?.extensions,
		extensionsKeys: rolePromptData?.role?.extensions ? Object.keys(rolePromptData.role.extensions) : [],
		extensionsContent: rolePromptData?.role?.extensions,
		allRoleFields: rolePromptData?.role ? Object.keys(rolePromptData.role) : [],
	})

	// Build role sections for both AI role and user avatar role
	const aiRoleSection = buildRolePromptSection(rolePromptData, userAvatarRole, enableUserAvatar)
	const aiRoleSectionBlock = aiRoleSection
		? `${aiRoleSection}

	`
		: ""

	const userAvatarSectionBlock = buildUserAvatarSectionBlock(
		enableUserAvatar,
		userAvatarRole,
		userAvatarVisibility ?? "full",
	)

	const roleSectionBlock = aiRoleSectionBlock + userAvatarSectionBlock

	// Load worldset content if enabled
	let worldsetSectionBlock = ""
	if (enabledWorldsets && enabledWorldsets.length > 0) {
		try {
			const path = require("path")
			const fs = require("fs")
			const worldsetContents: string[] = []

			for (const worldsetName of enabledWorldsets) {
				const worldsetPath = path.join(cwd, "novel-helper", ".anh-chat", "worldset", worldsetName)

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

${worldsetContents.join("\n\n---\n\n")}

====

`
			}
		} catch (error) {
			console.error("[ANH-Chat:SystemPrompt] Error loading worldsets:", error)
		}
	}

	// Add worldbook content if available
	let worldBookSectionBlock = ""
	if (worldBookContent && worldBookContent.trim()) {
		worldBookSectionBlock = `

====

SILLY TAVERN WORLD BOOK

The following world book information is available and should be used to enhance responses with relevant context and details:

${worldBookContent}

====

`
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
		worldBookSectionBlock, // Add worldbook content here
		markdownFormattingSection(),
		"",
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
- You can ask questions to better understand the user or to continue the conversation
- Focus on building a good conversational experience
- If the user requests programming help, you can switch to a more technical mode${conversationGuidance}`

		promptSections = promptSections.concat([
			getSystemInfoSection(cwd),
			"",
			chatObjectiveSection,
			"",
			chatRulesSection,
			"",
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
				extensionToolDescriptions,
			),
			"",
			getToolUseGuidelinesSection(codeIndexManager),
			"",
			mcpServersSection,
			"",
			getCapabilitiesSection(
				cwd,
				supportsComputerUse,
				shouldIncludeMcp ? mcpHub : undefined,
				effectiveDiffStrategy,
				codeIndexManager,
			),
			"",
			modesSection,
			"",
			getRulesSection(cwd, supportsComputerUse, effectiveDiffStrategy, codeIndexManager, mode),
			"",
			// Add natural conversation guidance when ask tool is disabled
			anhUseAskTool === false
				? `
====

CONVERSATION GUIDANCE

- 尽量避免使用提问工具，直接与用户自然对话
- 如果需要澄清问题，直接在对话中询问，不要使用正式的提问工具
- 保持对话的流畅性和自然感，减少机械化的交互
- 像真人一样交流，而不是像机器人一样按流程操作
`
				: "",
			getSystemInfoSection(cwd),
			"",
			getObjectiveSection(codeIndexManager, experiments),
			"",
		])
	}

	// Add custom instructions at the end
	promptSections.push(
		await addCustomInstructions(baseInstructions, globalCustomInstructions || "", cwd, mode, {
			language: language ?? formatLanguage(vscode.env.language),
			rooIgnoreInstructions,
			settings,
		}),
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
	userAvatarVisibility?: UserAvatarVisibility,
	extensionToolDescriptions?: string[],
	worldBookContent?: string,
	// New parameters for STProfile processing
	enabledTSProfiles?: string[],
	anhTsProfileAutoInject?: boolean,
	anhTsProfileVariables?: Record<string, any>,
): Promise<string> => {
	if (!context) {
		throw new Error("Extension context is required for generating system prompt")
	}

	// Apply STProfile preprocessing at the very beginning if rolePromptData is available
	let processedRolePromptData = rolePromptData
	if (rolePromptData?.role && enabledTSProfiles && enabledTSProfiles.length > 0) {
		const processedRole = await applyTsProfilePreprocessing(
			rolePromptData.role,
			enabledTSProfiles,
			anhTsProfileAutoInject ?? true,
			anhTsProfileVariables ?? {},
			userAvatarRole,
		)

		// Update rolePromptData with the processed role
		processedRolePromptData = {
			...rolePromptData,
			role: processedRole,
		}

		console.log("[SystemPrompt] STProfile preprocessing applied at system prompt generation level")
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
		if (processedRolePromptData) {
			const overridden = applyRoleOverrides(
				{ roleDefinition, baseInstructions: baseInstructionsForFile, description: "" },
				processedRolePromptData,
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

		const aiRoleSection = buildRolePromptSection(processedRolePromptData, userAvatarRole, enableUserAvatar)
		const aiRoleSectionBlock = aiRoleSection ? `${aiRoleSection}\n\n` : ""

		const userAvatarSectionBlock = buildUserAvatarSectionBlock(
			enableUserAvatar,
			userAvatarRole,
			userAvatarVisibility ?? "full",
		)

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
		processedRolePromptData, // Use the processed role data with STProfile injections
		anhPersonaMode,
		anhToneStrict,
		anhUseAskTool,
		userAvatarRole,
		enableUserAvatar,
		enabledWorldsets,
		userAvatarVisibility ?? "full",
		extensionToolDescriptions,
		worldBookContent,
	)
}
