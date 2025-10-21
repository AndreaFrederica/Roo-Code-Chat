import * as fs from "fs/promises"
import * as path from "path"
import type { Role } from "@roo-code/types"

import {
	STProfileProcessor,
	processLiquidTemplateVariables,
	type STProcessOptions,
	type STProfileComplete,
	type LiquidTemplateProcessingOptions,
} from "@roo-code/types"
import { debugLog } from "../../../utils/debug"

export interface STProfileOptions {
	profileDir?: string
	scope?: "workspace" | "global"
	enabledProfiles?: string[]
	autoInject?: boolean
	templateVariables?: Record<string, any>
	userAvatarRole?: Role
	workspaceProfileDir?: string
	globalProfileDir?: string
}

export interface ValidationResult {
	success: boolean
	error?: string
}

export interface TSProfile {
	name: string
	originalName: string
	path: string
	description: string
	promptsCount: number
	enabledCount: number
	lastModified: number
	scope: "workspace" | "global"
	hasMixin?: boolean
	mixinPromptsCount?: number
	mixinPath?: string
	isOrphanMixin?: boolean
	expectedMainProfile?: string
}

/**
 * STProfile 处理器
 * 负责加载、验证和处理 STProfile 文件，执行模板变量注入
 */
export class STProfileGenerator {
	private processor: STProfileProcessor

	constructor() {
		this.processor = new STProfileProcessor()
	}

	/**
	 * 加载所有 TSProfile 文件
	 */
	async loadProfiles(scope: "workspace" | "global" = "global"): Promise<TSProfile[]> {
		const profileDir = this.getProfileDirectory(scope)
		return this.loadProfilesFromDirectory(profileDir, scope)
	}

	/**
	 * 应用 STProfile 预处理到角色
	 */
	async applyPreprocessing(role: Role, enabledProfiles: string[], options: STProfileOptions = {}): Promise<Role> {
		const {
			profileDir,
			scope = "global",
			autoInject = true,
			templateVariables = {},
			userAvatarRole,
			workspaceProfileDir,
			globalProfileDir,
		} = options

		let processedRole = { ...role }

		// If role doesn't have system_prompt, generate basic "You are..." introduction first
		if (!processedRole.system_prompt && processedRole.name) {
			const name = processedRole.name || "Assistant"
			const description = processedRole.description || ""
			const personality = processedRole.personality || ""

			processedRole.system_prompt = `You are ${name}${description ? `. ${description}` : ""}${personality ? ` Your personality: ${personality}` : ""}.

请特别注意下面以 "### Character Overview" 和 "### First Message" 为标题的内容，这些是角色的详细信息，还有你需要注意 "USER AVATAR"为标题的部分 这是用户的身份信息，请根据这些内容开始角色扮演。\n### First Message 里面的内容是你的初始问候语，请根据这些内容开始角色扮演。`

			debugLog("applyTsProfilePreprocessing - Generated basic role definition:", {
				roleName: processedRole.name,
				generatedSystemPrompt: processedRole.system_prompt,
				length: processedRole.system_prompt.length,
			})
		}

		// Load all profiles from relevant directories (workspace + global + custom)
		const profileDirectories: Array<{ dir: string; scope: "workspace" | "global" }> = []
		const uniqueDirs = new Set<string>()

		const addProfileDir = (dir: string | undefined, dirScope: "workspace" | "global") => {
			if (!dir) {
				return
			}
			const normalized = path.resolve(dir)
			const key = `${dirScope}:${normalized}`
			if (!uniqueDirs.has(key)) {
				uniqueDirs.add(key)
				profileDirectories.push({ dir: normalized, scope: dirScope })
			}
		}

		// Explicit workspace/global directories passed in options
		addProfileDir(workspaceProfileDir, "workspace")
		addProfileDir(globalProfileDir, "global")

		// profileDir option (legacy) – treat according to scope parameter
		addProfileDir(profileDir, scope)

		// Fallback to default directories when not provided
		if (!workspaceProfileDir && !profileDir) {
			addProfileDir(this.getProfileDirectory("workspace"), "workspace")
		}
		if (!globalProfileDir && scope !== "workspace") {
			addProfileDir(this.getProfileDirectory("global"), "global")
		}

		const allProfiles: TSProfile[] = []
		for (const { dir: directoryPath, scope: dirScope } of profileDirectories) {
			try {
				const profiles = await this.loadProfilesFromDirectory(directoryPath, dirScope)
				allProfiles.push(...profiles)
			} catch (error) {
				console.warn(`[STProfile] Failed to load profiles from ${directoryPath}:`, error)
			}
		}

		// Process each enabled profile
		for (const profileKey of enabledProfiles) {
			// Parse profile key format: "name|:|scope" (e.g., "myProfile|:|workspace", "myProfile|:|global")
			let profileName: string
			let targetScope: string | undefined

			if (profileKey.includes("|:|")) {
				const parts = profileKey.split("|:|")
				// The format is always "name|:|scope" where scope is workspace/global
				if (parts.length === 2 && (parts[1] === "workspace" || parts[1] === "global")) {
					profileName = parts[0]
					targetScope = parts[1]
				} else {
					// Fallback: treat entire key as profile name
					profileName = profileKey
					targetScope = undefined
				}
			} else {
				profileName = profileKey
				targetScope = undefined
			}

			debugLog(`TSProfile lookup for key: ${profileKey}`, {
				parsedName: profileName,
				parsedScope: targetScope,
				availableProfiles: allProfiles.map((p) => ({
					name: p.name,
					originalName: p.originalName,
					scope: p.scope,
				})),
			})

			// Find matching profile
			const matchingProfile = allProfiles.find(
				(p) =>
					p.originalName === profileName &&
					(targetScope ? p.scope === targetScope : true), // Only match scope if specified
			)

			if (!matchingProfile) {
				debugLog(`STProfile: No profile found for key: ${profileKey}`)
				continue
			}

			try {
				// Load and parse the profile
				const profileData = await fs.readFile(matchingProfile.path, "utf-8")
				const parsed = JSON.parse(profileData)
				const profileNameFromData = parsed.name || path.basename(matchingProfile.path, ".json").replace(".jsonc", "")

				// Create STProfileProcessor instance
				const processor = new STProfileProcessor()

				// Validate the profile using STProfileProcessor
				const validation = processor.parse(parsed)
				if (!validation) {
					throw new Error("Invalid STProfile format")
				}

				// Prepare template variables
				const variables = {
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
					...templateVariables,
				}

				// Process STProfile with template variables
				const stProfileOptions: STProcessOptions = {
					variables,
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
					const profileDir = path.dirname(matchingProfile.path)
					const profileBaseName = path.basename(matchingProfile.path, ".json").replace(".jsonc", "")
					const mixinFileName = `${profileBaseName}.mixin.json`
					mixinPath = path.join(profileDir, mixinFileName)

					// 检查 mixin 文件是否存在
					await fs.access(mixinPath)
					debugLog(`[STProfile] Found and loading mixin for ${profileNameFromData}: ${mixinFileName}`)

					// 将 mixin 路径添加到处理选项中
					stProfileOptions.mixin = mixinPath
				} catch (error) {
					// 没有找到 mixin 文件，这是正常情况
					debugLog(`[STProfile] No mixin found for ${profileNameFromData}`)
				}

				// Process the profile (with or without mixin)
				const injectionResult = await processor.process(processedRole, parsed, stProfileOptions)

				// Debug: Log injection results
				debugLog(`STProfile injection for ${profileNameFromData}:`, {
					autoInject,
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
				if (injectionResult.success && autoInject) {
					processedRole = injectionResult.role

					debugLog(`STProfile injection completed for ${profileNameFromData}:`, {
						hasSystemPrompt: !!processedRole.system_prompt,
						hasExtensions: !!processedRole.extensions,
						extensionsKeys: processedRole.extensions ? Object.keys(processedRole.extensions) : [],
					})

					// 对注入后的角色的描述性字段进行模板处理
					try {
						debugLog(`[STProfile] Processing template variables for role fields after injection...`)

						// 准备模板处理选项
						const templateProcessOptions: LiquidTemplateProcessingOptions = {
							variables,
							strict: false,
							keepVariableDefinitions: false,
							removeUnprocessed: true,
							maxRecursionDepth: 10,
						}

						const descriptiveFields = [
							"name",
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
											originalContent.substring(0, 100) +
											(originalContent.length > 100 ? "..." : ""),
										processed:
											result.processedText.substring(0, 100) +
											(result.processedText.length > 100 ? "..." : ""),
									})
								}
							}
						}

						// 更新角色的模板处理字段
						Object.assign(processedRole, processedTemplateData)

						debugLog(`[STProfile] Template processing completed for ${profileNameFromData}`)
					} catch (templateError) {
						console.warn(`[STProfile] Template processing failed for ${profileNameFromData}:`, templateError)
						// 继续使用未处理的内容，不中断流程
					}
				}
			} catch (error) {
				console.error(`STProfile: Failed to process profile ${matchingProfile.path}:`, error)
				continue
			}
		}

		return processedRole
	}

	/**
	 * 验证 STProfile 文件
	 */
	async validateProfile(filePath: string): Promise<ValidationResult> {
		try {
			const content = await fs.readFile(filePath, "utf-8")
			const parsed = JSON.parse(content)

			// Create STProfileProcessor instance
			const processor = new STProfileProcessor()

			// Validate the profile using STProfileProcessor
			const validation = processor.parse(parsed)
			if (!validation) {
				return {
					success: false,
					error: "Invalid STProfile format",
				}
			}

			return {
				success: true,
			}
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			}
		}
	}

	/**
	 * 检测文件是否为 mixin 文件
	 */
	private isMixinFile(fileName: string): boolean {
		return fileName.includes(".mixin.json") || fileName.endsWith(".mixin.jsonc")
	}

	/**
	 * 从 mixin 文件名提取主 profile 名称
	 */
	private extractMainProfileName(mixinFileName: string): string {
		// 移除 .mixin.json 或 .mixin.jsonc 后缀
		return mixinFileName.replace(/\.mixin\.jsonc?$/, "")
	}

	/**
	 * 获取 Profile 目录
	 */
	private getProfileDirectory(scope: "workspace" | "global"): string {
		const profileFolder = ".anh-chat"
		const profileName = "tsprofile"

		if (scope === "workspace") {
			return path.join(process.cwd(), profileFolder, profileName)
		}

		return path.join(process.env.HOME || process.env.USERPROFILE || "", profileFolder, profileName)
	}

	/**
	 * 从指定目录加载 Profile 文件
	 */
	private async loadProfilesFromDirectory(profileDir: string, scope: "workspace" | "global"): Promise<TSProfile[]> {
		const profiles: TSProfile[] = []

		try {
			try {
				await fs.access(profileDir)
				debugLog(`TSProfile: Directory exists: ${profileDir} (${scope})`)
			} catch {
				await fs.mkdir(profileDir, { recursive: true })
				debugLog(`TSProfile: Created directory: ${profileDir} (${scope})`)
				return []
			}

			const files = await fs.readdir(profileDir)
			const mainProfileFiles: string[] = []
			const mixinFiles: string[] = []

			// 分类文件
			for (const file of files) {
				const filePath = path.join(profileDir, file)
				const stat = await fs.stat(filePath)

				if (stat.isFile() && (file.endsWith(".json") || file.endsWith(".jsonc"))) {
					if (this.isMixinFile(file)) {
						mixinFiles.push(file)
					} else {
						mainProfileFiles.push(file)
					}
				}
			}

			// 处理主 profile 文件
			for (const fileName of mainProfileFiles) {
				const filePath = path.join(profileDir, fileName)
				try {
					const content = await fs.readFile(filePath, "utf-8")
					const parsed = JSON.parse(content)
					const stats = await fs.stat(filePath)
					const profileName = parsed.name || fileName
					const uniqueName = scope === "global" ? `[Global] ${profileName}` : profileName

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
						debugLog(`TSProfile: ${scope} - Found mixin for ${fileName}: ${mixinFileName}`)
					} catch {
						// 没有找到 mixin 文件或 mixin 文件无效，这是正常情况
					}

					// Get prompt counts from validation
					const validation = this.processor.parse(parsed)
					const promptsCount = validation?.prompts?.length || 0
					const enabledCount = validation?.prompts?.filter((p: any) => p.enabled !== false).length || 0

					profiles.push({
						name: uniqueName,
						originalName: profileName,
						path: filePath,
						description: parsed.description || "",
						promptsCount,
						enabledCount,
						lastModified: stats.mtime.getTime(),
						scope,
						hasMixin,
						mixinPromptsCount,
						mixinPath: hasMixin ? mixinFilePath : undefined,
					})
				} catch (error) {
					console.warn(`Failed to load ${scope} profile ${fileName}:`, error)
				}
			}

			// 处理孤立的 mixin 文件（没有对应主 profile 的 mixin 文件）
			for (const mixinFileName of mixinFiles) {
				const mainProfileName = this.extractMainProfileName(mixinFileName)

				// 检查是否有对应的主 profile 文件
				if (!mainProfileFiles.includes(mainProfileName)) {
					const filePath = path.join(profileDir, mixinFileName)
					try {
						const stats = await fs.stat(filePath)
						const mixinData = await fs.readFile(filePath, "utf-8")
						const parsed = JSON.parse(mixinData)

						debugLog(`TSProfile: ${scope} - Found orphan mixin file: ${mixinFileName}`)

						const mixinName = `${mixinFileName} (孤立mixin)`
						const uniqueMixinName = scope === "global" ? `[Global] ${mixinName}` : mixinName

						profiles.push({
							name: uniqueMixinName,
							originalName: mixinName,
							path: filePath,
							description: `Mixin文件，缺少对应的主profile: ${mainProfileName}`,
							promptsCount: parsed.prompts?.length || 0,
							enabledCount: parsed.prompts?.filter((p: any) => p.enabled !== false).length || 0,
							lastModified: stats.mtime.getTime(),
							scope,
							isOrphanMixin: true,
							expectedMainProfile: mainProfileName,
						})
					} catch (error) {
						console.warn(`Failed to load ${scope} orphan mixin ${mixinFileName}:`, error)
					}
				}
			}

			return profiles
		} catch (error) {
			console.error(`Error loading TSProfiles from ${profileDir}:`, error)
			return []
		}
	}
}
