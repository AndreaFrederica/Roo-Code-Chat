import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import { parseTavernPresetStrict, compilePresetChannels } from "@roo-code/types"
import { STProfileProcessor } from "@roo-code/types"
import { debugLog } from "../../utils/debug"

export interface ProfileInfo {
	name: string
	path: string
	description?: string
	promptsCount?: number
	enabledCount?: number
	lastModified?: number
}

export interface ValidationResult {
	success: boolean
	profileName?: string
	path?: string
	promptsCount?: number
	error?: string
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
 * 加载可用的TSProfile文件列表
 */
export async function loadTsProfiles(): Promise<ProfileInfo[]> {
	try {
		const workspacePath = getWorkspacePath()
		if (!workspacePath) {
			debugLog("TSProfile: No workspace path found")
			return []
		}

		const profileDir = path.join(workspacePath, "novel-helper", ".anh-chat", "tsprofile")
		debugLog(`TSProfile: Profile directory: ${profileDir}`)

		// 检查profile目录是否存在
		try {
			await fs.access(profileDir)
			debugLog(`TSProfile: Directory exists: ${profileDir}`)
		} catch {
			// 目录不存在，创建它
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

		const profiles: ProfileInfo[] = []

		// 处理主 profile 文件
		for (const fileName of mainProfileFiles) {
			const filePath = path.join(profileDir, fileName)
			try {
				const stats = await fs.stat(filePath)
				const profileData = await fs.readFile(filePath, "utf-8")
				const parsed = JSON.parse(profileData)

				// Create STProfileProcessor instance
				const processor = new STProfileProcessor()

				// Parse the profile
				const preset = parseTavernPresetStrict(parsed)

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
				} as ProfileInfo & { hasMixin?: boolean; mixinPromptsCount?: number; mixinPath?: string })
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
					} as ProfileInfo & { isOrphanMixin?: boolean; expectedMainProfile?: string })
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
 * 验证TSProfile文件
 */
export async function validateTsProfile(filePath: string): Promise<ValidationResult> {
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

		// Get prompt count from validation
		const promptsCount = validation.prompts?.length || 0

		return {
			success: true,
			profileName: parsed.name || path.basename(filePath),
			path: filePath,
			promptsCount,
		}
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		}
	}
}

/**
 * 浏览选择TSProfile文件
 */
export async function browseTsProfile(): Promise<string | undefined> {
	try {
		const workspacePath = getWorkspacePath()
		if (!workspacePath) {
			return undefined
		}

		const profileDir = path.join(workspacePath, "novel-helper", ".anh-chat", "tsprofile")

		// 确保目录存在
		await fs.mkdir(profileDir, { recursive: true })

		const options: vscode.OpenDialogOptions = {
			canSelectMany: false,
			openLabel: "Select TSProfile File",
			filters: {
				"JSON Files": ["json", "jsonc"],
				"All Files": ["*"],
			},
			defaultUri: vscode.Uri.file(profileDir),
		}

		const fileUri = await vscode.window.showOpenDialog(options)
		return fileUri?.[0]?.fsPath
	} catch (error) {
		console.error("Error browsing TSProfile:", error)
		vscode.window.showErrorMessage(`Failed to browse TSProfile: ${error}`)
		return undefined
	}
}

/**
 * 获取工作区路径
 */
function getWorkspacePath(): string | undefined {
	const workspaceFolders = vscode.workspace.workspaceFolders
	if (workspaceFolders && workspaceFolders.length > 0) {
		return workspaceFolders[0].uri.fsPath
	}
	return undefined
}
