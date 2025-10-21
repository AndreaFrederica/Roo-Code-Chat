import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as path from "path"

import {
	processLiquidTemplateVariables,
	type LiquidTemplateProcessingOptions,
	type RolePromptData,
	type Role,
} from "@roo-code/types"

import type { Mode } from "../../../shared/modes"

export interface WorldBookOptions {
	worldsetPath?: string
	enabledWorldsets?: string[]
	format?: "markdown" | "json"
	maxLength?: number
}

export interface WorldBookContent {
	title: string
	content: string
	type: "worldbook" | "triggered"
	source: string
}

export interface WorldSectionsOptions {
	context?: vscode.ExtensionContext
	cwd: string
	mode: Mode
	enabledWorldsets?: string[]
	worldBookContent?: string
	rolePromptData?: RolePromptData
	userAvatarRole?: Role
}

export interface WorldSectionsResult {
	worldsetSection: string
	worldBookSection: string
}

/**
 * 世界观生成器
 * 负责加载和处理世界观设定内容
 */
export class WorldBookGenerator {
	/**
	 * 生成系统提示词中的世界观与世界书区块
	 */
	async generateWorldSections(options: WorldSectionsOptions): Promise<WorldSectionsResult> {
		const {
			context,
			cwd,
			mode,
			enabledWorldsets = [],
			worldBookContent,
			rolePromptData,
			userAvatarRole,
		} = options

		const templateVariables = this.buildTemplateVariables({
			cwd,
			mode,
			rolePromptData,
			userAvatarRole,
		})

		const worldsetSection = await this.buildWorldsetSection(
			{ context, cwd, enabledWorldsets },
			templateVariables,
		)

		const worldBookSection = this.buildWorldBookSection(worldBookContent, templateVariables)

		return {
			worldsetSection,
			worldBookSection,
		}
	}

	/**
	 * 加载启用的世界观内容（兼容旧接口）
	 */
	async loadWorldBookContent(options: WorldBookOptions = {}): Promise<string> {
		const { worldsetPath, enabledWorldsets = [], format = "markdown", maxLength = 50000 } = options

		if (enabledWorldsets.length === 0) {
			return ""
		}

		const basePath = worldsetPath || path.join(process.cwd(), ".anh-chat", "worldsets")
		const contents: string[] = []

		for (const worldsetName of enabledWorldsets) {
			try {
				const worldsetContent = await this.loadSingleWorldBook(worldsetName, basePath, format)
				if (worldsetContent) {
					contents.push(worldsetContent)
				}
			} catch (error) {
				console.warn(`Failed to load worldset ${worldsetName}:`, error)
			}
		}

		let combinedContent = contents.join("\n\n---\n\n")

		if (combinedContent.length > maxLength) {
			combinedContent = combinedContent.substring(0, maxLength) + "\n\n[内容已截断...]"
		}

		return combinedContent
	}

	/**
	 * 加载触发的世界观内容（预留扩展）
	 */
	async loadTriggeredWorldBookContent(_options: WorldBookOptions = {}): Promise<string> {
		return ""
	}

	/**
	 * 为增强导向模式生成世界观摘要
	 */
	generateWorldBookSummary(worldBookContent: string, maxLength: number = 1000): string {
		if (!worldBookContent || worldBookContent.trim() === "") {
			return ""
		}

		const lines = worldBookContent.split("\n")
		const summary: string[] = []

		for (const line of lines) {
			const trimmedLine = line.trim()

			if (trimmedLine.startsWith("#") || trimmedLine.startsWith("##") || trimmedLine.startsWith("###")) {
				summary.push(trimmedLine)
				continue
			}

			if (trimmedLine && summary.length < 20) {
				summary.push(trimmedLine)
			}

			if (summary.join("\n").length > maxLength) {
				break
			}
		}

		return summary.join("\n")
	}

	/**
	 * 验证世界观文件
	 */
	async validateWorldBook(worldsetName: string, basePath?: string): Promise<boolean> {
		const worldsetPath = basePath || path.join(process.cwd(), ".anh-chat", "worldsets")
		const worldsetDir = path.join(worldsetPath, worldsetName)

		try {
			await fs.access(worldsetDir)
			return true
		} catch {
			return false
		}
	}

	/**
	 * 获取可用的世界观列表
	 */
	async getAvailableWorldBooks(basePath?: string): Promise<string[]> {
		const worldsetPath = basePath || path.join(process.cwd(), ".anh-chat", "worldsets")

		try {
			const entries = await fs.readdir(worldsetPath, { withFileTypes: true })
			return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
		} catch (error) {
			console.warn("Failed to read worldset directory:", error)
			return []
		}
	}

	// ------------------------ 私有方法 ------------------------ //

	private async buildWorldsetSection(
		options: { context?: vscode.ExtensionContext; cwd: string; enabledWorldsets?: string[] },
		templateVariables: Record<string, any>,
	): Promise<string> {
		const { context, cwd, enabledWorldsets = [] } = options
		if (enabledWorldsets.length === 0) {
			return ""
		}

		const worldsetContents: string[] = []
		let globalStorageService: any = null

		const templateOptions: LiquidTemplateProcessingOptions = {
			variables: templateVariables,
			strict: false,
			keepVariableDefinitions: false,
			removeUnprocessed: true,
			maxRecursionDepth: 10,
		}

		for (const worldsetKey of enabledWorldsets) {
			const { name, scope } = this.parseWorldsetKey(worldsetKey)
			let worldsetContent = ""
			let source = ""

			if (scope !== "global") {
				worldsetContent = await this.loadWorldsetFromWorkspace(cwd, name)
				if (worldsetContent) {
					source = "workspace"
				}
			}

			if (!worldsetContent && context) {
				globalStorageService = globalStorageService ?? (await this.getGlobalStorageService(context))
				if (globalStorageService) {
					try {
						const globalWorldsetData = await globalStorageService.loadGlobalWorldset(name)
						if (globalWorldsetData) {
							worldsetContent = globalWorldsetData.content || JSON.stringify(globalWorldsetData)
							source = "global"
						}
					} catch (error) {
						console.warn(`[WorldBookGenerator] Failed to load global worldset ${name}:`, error)
					}
				}
			}

			if (worldsetContent) {
				const processed = processLiquidTemplateVariables(worldsetContent, templateOptions)
				const sourceLabel = source === "global" ? " (Global)" : " (Workspace)"
				worldsetContents.push(`## ${name}${sourceLabel}\n\n${processed.processedText}`)
			} else {
				console.warn(
					`[WorldBookGenerator] Worldset not found: ${name} (scope: ${scope}, original key: ${worldsetKey})`,
				)
			}
		}

		if (worldsetContents.length === 0) {
			return ""
		}

		return `

====

WORLDVIEW SETTING

The following worldview settings are currently active and should guide your responses:

${worldsetContents.join("\n\n---\n\n")}

====

`
	}

	private buildWorldBookSection(
		worldBookContent: string | undefined,
		templateVariables: Record<string, any>,
	): string {
		if (!worldBookContent || worldBookContent.trim() === "") {
			return ""
		}

		const templateOptions: LiquidTemplateProcessingOptions = {
			variables: templateVariables,
			strict: false,
			keepVariableDefinitions: false,
			removeUnprocessed: true,
			maxRecursionDepth: 10,
		}

		const processedWorldBookContent = processLiquidTemplateVariables(worldBookContent, templateOptions)

		return `

====

SILLY TAVERN WORLD BOOK

The following world book information is available and should be used to enhance responses with relevant context and details:

${processedWorldBookContent.processedText}

====

`
	}

	private buildTemplateVariables(options: {
		cwd: string
		mode: Mode
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

	private parseWorldsetKey(worldsetKey: string): { name: string; scope: "workspace" | "global" } {
		let worldsetName = worldsetKey
		let worldsetScope: "workspace" | "global" = "workspace"

		const lastDashIndex = worldsetKey.lastIndexOf("-")
		if (lastDashIndex > 0) {
			const possibleScope = worldsetKey.substring(lastDashIndex + 1)
			if (possibleScope === "workspace" || possibleScope === "global") {
				worldsetName = worldsetKey.substring(0, lastDashIndex)
				worldsetScope = possibleScope
			}
		}

		return { name: worldsetName, scope: worldsetScope }
	}

	private async loadWorldsetFromWorkspace(cwd: string, worldsetName: string): Promise<string> {
		const workspaceWorldsetPath = path.join(cwd, "novel-helper", ".anh-chat", "worldset", worldsetName)
		try {
			return await fs.readFile(workspaceWorldsetPath, "utf-8")
		} catch {
			return ""
		}
	}

	private async getGlobalStorageService(context: vscode.ExtensionContext): Promise<any | null> {
		try {
			const { getGlobalStorageService } = require("../../services/storage/GlobalStorageService")
			return await getGlobalStorageService(context)
		} catch (error) {
			console.warn("[WorldBookGenerator] Failed to resolve global storage service:", error)
			return null
		}
	}

	/**
	 * 加载单个世界观文件（兼容旧接口）
	 */
	private async loadSingleWorldBook(
		worldsetName: string,
		basePath: string,
		format: "markdown" | "json",
	): Promise<string> {
		const worldsetDir = path.join(basePath, worldsetName)

		try {
			const stats = await fs.stat(worldsetDir)

			if (stats.isFile()) {
				const content = await fs.readFile(worldsetDir, "utf-8")
				return this.formatWorldBookContent(worldsetName, content, format)
			}

			if (stats.isDirectory()) {
				const mainFile = path.join(worldsetDir, `main.${format}`)
				try {
					const content = await fs.readFile(mainFile, "utf-8")
					return this.formatWorldBookContent(worldsetName, content, format)
				} catch {
					const alternativeNames = ["content", "index", "intro", "overview", "setting"]
					for (const name of alternativeNames) {
						try {
							const altFile = path.join(worldsetDir, `${name}.${format}`)
							const content = await fs.readFile(altFile, "utf-8")
							return this.formatWorldBookContent(worldsetName, content, format)
						} catch {
							continue
						}
					}
				}

				return await this.combineMultipleFiles(worldsetDir, worldsetName, format)
			}

			throw new Error(`${worldsetDir} is neither a file nor a directory`)
		} catch (error) {
			throw new Error(`Failed to load worldbook ${worldsetName}: ${error}`)
		}
	}

	private async combineMultipleFiles(
		worldsetDir: string,
		worldsetName: string,
		format: "markdown" | "json",
	): Promise<string> {
		const contents: string[] = []

		try {
			const files = await fs.readdir(worldsetDir)

			const priorityFiles = ["main", "index", "intro", "overview", "setting", "character", "location"]
			const sortedFiles = [
				...priorityFiles.filter((name) => files.includes(`${name}.${format}`)).map((name) => `${name}.${format}`),
				...files.filter(
					(file) => file.endsWith(`.${format}`) && !priorityFiles.some((name) => file === `${name}.${format}`),
				),
			]

			for (const file of sortedFiles) {
				try {
					const filePath = path.join(worldsetDir, file)
					const content = await fs.readFile(filePath, "utf-8")
					const fileName = path.basename(file, `.${format}`)
					const formattedContent = this.formatWorldBookSection(fileName, content, format)
					contents.push(formattedContent)
				} catch {
					continue
				}
			}
		} catch (error) {
			console.warn(`Failed to combine files for ${worldsetName}:`, error)
		}

		if (contents.length === 0) {
			throw new Error(`No valid content files found for ${worldsetName}`)
		}

		return this.formatWorldBookContent(worldsetName, contents.join("\n\n---\n\n"), format)
	}

	private formatWorldBookContent(worldsetName: string, content: string, format: "markdown" | "json"): string {
		if (format === "json") {
			try {
				const jsonData = JSON.parse(content)
				return this.convertJsonToMarkdown(worldsetName, jsonData)
			} catch {
				// 如果不是有效的JSON，当作Markdown处理
			}
		}

		return `# 世界观设定: ${worldsetName}\n\n${content}`
	}

	private formatWorldBookSection(sectionName: string, content: string, format: "markdown" | "json"): string {
		const title = sectionName.charAt(0).toUpperCase() + sectionName.slice(1)

		if (format === "json") {
			try {
				const jsonData = JSON.parse(content)
				const markdownContent = this.convertJsonToMarkdown(sectionName, jsonData)
				return `## ${title}\n\n${markdownContent}`
			} catch {
				// 如果不是有效的JSON，当作Markdown处理
			}
		}

		return `## ${title}\n\n${content}`
	}

	private convertJsonToMarkdown(sectionName: string, jsonData: any): string {
		const lines: string[] = []

		if (typeof jsonData === "string") {
			return jsonData
		}

		if (typeof jsonData === "object" && jsonData !== null) {
			for (const [key, value] of Object.entries(jsonData)) {
				if (typeof value === "string") {
					lines.push(`**${key}:** ${value}`)
				} else if (Array.isArray(value)) {
					lines.push(`**${key}:**`)
					value.forEach((item) => {
						if (typeof item === "string") {
							lines.push(`- ${item}`)
						} else if (typeof item === "object" && item !== null) {
							lines.push(`- ${JSON.stringify(item)}`)
						}
					})
				} else if (typeof value === "object" && value !== null) {
					lines.push(`**${key}:** ${JSON.stringify(value, null, 2)}`)
				}
			}
		}

		return lines.join("\n")
	}
}
