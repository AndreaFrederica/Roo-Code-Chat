import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"

import type { ModeConfig, PromptComponent, CustomModePrompts, Role, UserAvatarVisibility } from "@roo-code/types"
import type { Mode } from "../../../shared/modes"
import type { RolePromptData } from "@roo-code/types"

import { defaultModeSlug, getFullModeDetails } from "../../../shared/modes"
import { formatLanguage } from "../../../shared/language"
import { arePathsEqual } from "../../../utils/path"
import { experiments as experimentsModule, EXPERIMENT_IDS } from "../../../shared/experiments"
import { debugLog } from "../../../utils/debug"

import { RoleGenerator, WorldBookGenerator, VariableInjector, type EnhancedRoleInfo } from "../generators"
import { ClineProvider } from "../../webview/ClineProvider"

export interface EnvironmentDetailsOptions {
	cline: ClineProvider
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
}

export interface EnhancedRoleEnvironmentOptions extends EnvironmentDetailsOptions {
	maxLength?: number
	includeSystemInstructions?: boolean
	includeWorldBookSummary?: boolean
	includeVariableSummary?: boolean
}

/**
 * 环境详情构建器
 * 负责构建环境上下文信息，为增强导向模式提供增强的角色信息
 */
export class EnvironmentBuilder {
	private roleGenerator: RoleGenerator
	private worldBookGenerator: WorldBookGenerator
	private variableInjector: VariableInjector

	constructor() {
		this.roleGenerator = new RoleGenerator()
		this.worldBookGenerator = new WorldBookGenerator()
		this.variableInjector = new VariableInjector()
	}

	/**
	 * 构建环境详情
	 */
	async buildEnvironmentDetails(options: EnvironmentDetailsOptions): Promise<string> {
		const {
			cline,
			mode,
			customModes,
			customModePrompts,
			globalCustomInstructions,
			language,
			experiments,
			state,
			rolePromptData,
			userAvatarRole,
			enableUserAvatar,
			userAvatarVisibility,
			extensionToolDescriptions,
			worldBookContent,
			enabledWorldsets,
		} = options

		let details = ""

		// 当前模式信息
		if (mode) {
			const currentMode = mode ?? defaultModeSlug

			const modeDetails = await getFullModeDetails(currentMode, customModes, customModePrompts, {
				cwd: cline.cwd,
				globalCustomInstructions,
				language: language ?? "en",
			})
			const { id: modelId } = { id: "test-model" } // cline.api.getModel()

			details += `\n\n# Current Mode\n`
			details += `<slug>${currentMode}</slug>\n`
			details += `<name>${modeDetails.name}</name>\n`
			details += `<model>${modelId}</model>\n`

			// 增强导向模式：添加角色强化信息
			if (experiments && experimentsModule.isEnabled(experiments, EXPERIMENT_IDS.POWER_STEERING)) {
				const enhancedRoleInfo = this.generateEnhancedRoleEnvironmentInfo({
					cline,
					mode,
					customModes,
					customModePrompts,
					globalCustomInstructions,
					language,
					experiments,
					state,
					rolePromptData,
					userAvatarRole,
					enableUserAvatar,
					userAvatarVisibility,
					extensionToolDescriptions,
					worldBookContent,
					enabledWorldsets,
					maxLength: 1500,
					includeSystemInstructions: true,
					includeWorldBookSummary: true,
					includeVariableSummary: true,
				})

				details += enhancedRoleInfo
			}
		}

		// 工作区文件信息
		const workspaceFiles = await this.getWorkspaceFilesInfo(cline, state)
		if (workspaceFiles) {
			details += workspaceFiles
		}

		// 工具信息
		const toolsInfo = this.getToolsInfo(cline, extensionToolDescriptions || [])
		if (toolsInfo) {
			details += toolsInfo
		}

		// 项目信息
		const projectInfo = await this.getProjectInfo(cline)
		if (projectInfo) {
			details += projectInfo
		}

		return details
	}

	/**
	 * 为增强导向模式生成增强的角色环境信息
	 */
	generateEnhancedRoleEnvironmentInfo(options: EnhancedRoleEnvironmentOptions): string {
		const {
			rolePromptData,
			userAvatarRole,
			enableUserAvatar,
			maxLength = 1500,
			includeSystemInstructions = true,
			includeWorldBookSummary = true,
			includeVariableSummary = true,
			worldBookContent,
			currentTask,
		} = options

		let enhancedInfo = ""

		if (rolePromptData) {
			// 生成增强的角色信息
			const enhancedRole = this.roleGenerator.generateEnhancedRoleInfo(
				rolePromptData,
				userAvatarRole,
				enableUserAvatar,
				{
					summaryOnly: true,
					includeSystemInstructions,
					includeUserAvatar: true,
					maxLength: maxLength / 2, // 分配一半长度给角色信息
				},
			)

			// 添加角色定义强化
			if (enhancedRole.roleDefinition) {
				enhancedInfo += `<enhanced_role_definition>${enhancedRole.roleDefinition}</enhanced_role_definition>\n`
			}

			// 添加角色摘要
			if (enhancedRole.roleSummary) {
				enhancedInfo += `<role_summary>${enhancedRole.roleSummary}</role_summary>\n`
			}

			// 添加系统指令强化
			if (includeSystemInstructions && enhancedRole.systemInstructions) {
				enhancedInfo += `<enhanced_system_instructions>${enhancedRole.systemInstructions}</enhanced_system_instructions>\n`
			}

			// 添加用户头像信息
			if (enhancedRole.userAvatarInfo) {
				enhancedInfo += `<user_avatar_context>${enhancedRole.userAvatarInfo}</user_avatar_context>\n`
			}

			// 添加世界观摘要
			if (includeWorldBookSummary && worldBookContent) {
				const worldBookSummary = this.worldBookGenerator.generateWorldBookSummary(
					worldBookContent,
					200, // 限制世界观摘要长度
				)
				if (worldBookSummary) {
					enhancedInfo += `<world_book_summary>${worldBookSummary}</world_book_summary>\n`
				}
			}

			// 添加变量状态摘要
			if (includeVariableSummary && currentTask) {
				const variableState = currentTask.getLatestVariableState?.() || {}
				if (Object.keys(variableState).length > 0) {
					const variableSummary = this.variableInjector.generateVariableSummary(variableState, 200)
					if (variableSummary) {
						enhancedInfo += `<variable_state_summary>${variableSummary}</variable_state_summary>\n`
					}
				}
			}

			// 添加角色特征关键词（用于快速检索）
			const roleKeywords = this.extractRoleKeywords(enhancedRole)
			if (roleKeywords.length > 0) {
				enhancedInfo += `<role_keywords>${roleKeywords.join(", ")}</role_keywords>\n`
			}
		}

		return enhancedInfo
	}

	/**
	 * 获取工作区文件信息
	 */
	private async getWorkspaceFilesInfo(cline: ClineProvider, state?: any): Promise<string> {
		const isContextEnabled = (key: string): boolean => {
			const workspaceContextSettings = state?.workspaceContextSettings || {}
			return workspaceContextSettings[key] ?? true
		}

		if (!isContextEnabled("workspaceFiles")) {
			return ""
		}

		let details = ""
		const isDesktop = arePathsEqual(cline.cwd, path.join(os.homedir(), "Desktop"))

		details += `\n\n# Current Workspace Directory (${cline.cwd.toPosix()}) Files\n`

		if (isDesktop) {
			details += "You're working on your desktop directory. This is likely where you'll find files for the current task, and it may be convenient to create new files here for quick access.\n\n"
		}

		try {
			const files = await fs.readdir(cline.cwd.toPosix(), { withFileTypes: true })

			// Group files by type and prioritize
			const directories: string[] = []
			const importantFiles: string[] = []
			const otherFiles: string[] = []

			const importantExtensions = [".md", ".txt", ".json", ".yml", ".yaml", ".toml", ".env", ".gitignore"]
			const ignoredDirs = [".git", "node_modules", ".vscode", ".idea", "dist", "build", "target"]

			files.forEach((file) => {
				const fileName = file.name

				// Skip hidden and ignored files/directories
				if (fileName.startsWith(".") && !fileName.startsWith(".")) {
					return
				}

				if (ignoredDirs.some((ignored) => fileName.includes(ignored))) {
					return
				}

				if (file.isDirectory()) {
					directories.push(fileName)
				} else if (importantExtensions.some((ext) => fileName.endsWith(ext))) {
					importantFiles.push(fileName)
				} else {
					otherFiles.push(fileName)
				}
			})

			// Format output
			if (directories.length > 0) {
				details += "**Directories:**\n"
				directories.slice(0, 20).forEach((dir) => {
					details += `- ${dir}/\n`
				})
				if (directories.length > 20) {
					details += `... and ${directories.length - 20} more directories\n`
				}
				details += "\n"
			}

			if (importantFiles.length > 0) {
				details += "**Important Files:**\n"
				importantFiles.slice(0, 20).forEach((file) => {
					details += `- ${file}\n`
				})
				if (importantFiles.length > 20) {
					details += `... and ${importantFiles.length - 20} more files\n`
				}
				details += "\n"
			}

			if (otherFiles.length > 0 && directories.length === 0 && importantFiles.length === 0) {
				details += "**Files:**\n"
				otherFiles.slice(0, 20).forEach((file) => {
					details += `- ${file}\n`
				})
				if (otherFiles.length > 20) {
					details += `... and ${otherFiles.length - 20} more files\n`
				}
			}

			if (files.length === 0) {
				details += "This directory is empty.\n"
			}
		} catch (error) {
			details += `Unable to list directory contents: ${error instanceof Error ? error.message : "Unknown error"}\n`
		}

		return details
	}

	/**
	 * 获取工具信息
	 */
	private getToolsInfo(cline: ClineProvider, extensionToolDescriptions: string[]): string {
		let details = ""

		// Extension tools
		if (extensionToolDescriptions.length > 0) {
			details += `\n\n# Available Extension Tools\n`
			extensionToolDescriptions.forEach((description) => {
				details += `${description}\n\n`
			})
		}

		return details
	}

	/**
	 * 获取项目信息
	 */
	private async getProjectInfo(cline: ClineProvider): Promise<string> {
		let details = ""

		try {
			// 检查是否有 package.json
			const packageJsonPath = path.join(cline.cwd.toPosix(), "package.json")
			try {
				await fs.access(packageJsonPath)
				const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8")
				const packageJson = JSON.parse(packageJsonContent)

				details += `\n\n# Project Information\n`
				if (packageJson.name) {
					details += `**Project Name:** ${packageJson.name}\n`
				}
				if (packageJson.version) {
					details += `**Version:** ${packageJson.version}\n`
				}
				if (packageJson.description) {
					details += `**Description:** ${packageJson.description}\n`
				}
				if (packageJson.scripts && Object.keys(packageJson.scripts).length > 0) {
					details += `**Available Scripts:** ${Object.keys(packageJson.scripts).join(", ")}\n`
				}
			} catch {
				// No package.json or invalid JSON
			}

			// 检查是否有 README
			const readmeFiles = ["README.md", "README.txt", "README"]
			for (const readmeFile of readmeFiles) {
				const readmePath = path.join(cline.cwd.toPosix(), readmeFile)
				try {
					await fs.access(readmePath)
					if (!details.includes("# Project Information")) {
						details += `\n\n# Project Information\n`
					}
					details += `**README:** ${readmeFile} found in project root\n`
					break
				} catch {
					continue
				}
			}
		} catch (error) {
			debugLog("Error getting project info:", error)
		}

		return details
	}

	/**
	 * 提取角色关键词
	 */
	private extractRoleKeywords(enhancedRole: EnhancedRoleInfo): string[] {
		const keywords: string[] = []

		// 从角色名称和描述中提取关键词
		const text = `${enhancedRole.roleDefinition} ${enhancedRole.roleSummary} ${enhancedRole.systemInstructions || ""}`

		// 简单的关键词提取逻辑
		const keywordPatterns = [
			/(\w+ assistant)/gi,
			/(\w+ developer)/gi,
			/(\w+ engineer)/gi,
			/(\w+ expert)/gi,
			/(\w+ specialist)/gi,
			/(programming|coding|debugging|designing|planning)/gi,
			/(friendly|professional|helpful|knowledgeable)/gi,
		]

		keywordPatterns.forEach((pattern) => {
			const matches = text.match(pattern)
			if (matches) {
				keywords.push(...matches.map((match) => match.toLowerCase()))
			}
		})

		// 去重并限制数量
		const uniqueKeywords = [...new Set(keywords)].slice(0, 10)
		return uniqueKeywords
	}
}