import * as vscode from "vscode"
import * as path from "path"
import { STProfileProcessor } from "@roo-code/types"
import { parseTavernPresetStrict, compilePresetChannels } from "@roo-code/types"
import { debugLog } from "../../utils/debug"
import { getGlobalStorageService } from "../storage/GlobalStorageService"
import type { ProfileInfo, ValidationResult } from "./tsProfileService"

export interface ExtendedProfileInfo extends ProfileInfo {
	/** 是否为全局 profile */
	isGlobal?: boolean
	/** profile 类型：global 或 workspace */
	type?: "global" | "workspace"
}

/**
 * 扩展的 TSProfile 服务，支持全局和本地 profile 管理
 */
export class ExtendedTSProfileService {
	private globalStorageService: Promise<any>

	constructor(context: vscode.ExtensionContext) {
		this.globalStorageService = getGlobalStorageService(context)
	}

	/**
	 * 加载所有可用的 TSProfile 文件（包括全局和工作区）
	 */
	async loadAllTsProfiles(): Promise<ExtendedProfileInfo[]> {
		const profiles: ExtendedProfileInfo[] = []

		// 加载工作区 profiles
		const workspaceProfiles = await this.loadWorkspaceProfiles()
		profiles.push(...workspaceProfiles.map(p => ({ ...p, type: "workspace" as const, isGlobal: false })))

		// 加载全局 profiles
		const globalProfiles = await this.loadGlobalProfiles()
		profiles.push(...globalProfiles.map(p => ({ ...p, type: "global" as const, isGlobal: true })))

		// 按最后修改时间排序
		return profiles.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0))
	}

	/**
	 * 加载工作区 profiles
	 */
	async loadWorkspaceProfiles(): Promise<ProfileInfo[]> {
		try {
			const workspacePath = this.getWorkspacePath()
			if (!workspacePath) {
				debugLog("TSProfile: No workspace path found")
				return []
			}

			const profileDir = path.join(workspacePath, "novel-helper", ".anh-chat", "tsprofile")
			debugLog(`TSProfile: Workspace profile directory: ${profileDir}`)

			return await this.scanProfileDirectory(profileDir)
		} catch (error) {
			console.error("Error loading workspace TSProfiles:", error)
			return []
		}
	}

	/**
	 * 加载全局 profiles
	 */
	async loadGlobalProfiles(): Promise<ProfileInfo[]> {
		try {
			const globalService = await this.globalStorageService
			const profileDir = globalService.getGlobalTsProfilesPath()
			debugLog(`TSProfile: Global profile directory: ${profileDir}`)

			return await this.scanProfileDirectory(profileDir)
		} catch (error) {
			console.error("Error loading global TSProfiles:", error)
			return []
		}
	}

	/**
	 * 扫描指定目录下的 profile 文件
	 */
	private async scanProfileDirectory(profileDir: string): Promise<ProfileInfo[]> {
		const fs = await import("fs/promises")

		try {
			// 检查目录是否存在
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

		const profiles: ProfileInfo[] = []

		// 处理 profile 文件
		for (const file of files) {
			if (file.isFile() &&
				(file.name.endsWith(".json") || file.name.endsWith(".jsonc")) &&
				!file.name.includes(".mixin.json")) { // 排除 mixin 文件
				const profileInfo = await this.processProfileFile(profileDir, file.name)
				if (profileInfo) {
					profiles.push(profileInfo)
				}
			}
		}

		return profiles
	}

	/**
	 * 处理单个 profile 文件
	 */
	private async processProfileFile(profileDir: string, fileName: string): Promise<ProfileInfo | null> {
		try {
			const fs = await import("fs/promises")
			const filePath = path.join(profileDir, fileName)
			const stats = await fs.stat(filePath)
			const profileData = await fs.readFile(filePath, "utf8")
			const parsed = JSON.parse(profileData)

			// Create STProfileProcessor instance
			const processor = new STProfileProcessor()

			// Parse and validate the profile
			const validation = processor.parse(parsed)
			if (!validation) {
				throw new Error("Invalid STProfile format")
			}

			// Get prompt counts from validation
			const promptsCount = validation.prompts?.length || 0
			const enabledCount = validation.prompts?.filter((p: any) => p.enabled !== false).length || 0

			return {
				name: parsed.name || fileName,
				path: filePath,
				description: parsed.description || "",
				promptsCount,
				enabledCount,
				lastModified: stats.mtime.getTime(),
			}
		} catch (error) {
			console.warn(`Failed to load profile ${fileName}:`, error)
			return null
		}
	}

	/**
	 * 保存 profile 到指定位置（全局或工作区）
	 */
	async saveProfile(profileName: string, profileData: any, isGlobal: boolean = false): Promise<boolean> {
		try {
			if (isGlobal) {
				const globalService = await this.globalStorageService
				await globalService.saveGlobalTsProfile(profileName, profileData)
			} else {
				await this.saveWorkspaceProfile(profileName, profileData)
			}

			console.log(`Profile saved: ${profileName} (${isGlobal ? 'global' : 'workspace'})`)
			return true
		} catch (error) {
			console.error(`Failed to save profile ${profileName}:`, error)
			return false
		}
	}

	/**
	 * 保存工作区 profile
	 */
	private async saveWorkspaceProfile(profileName: string, profileData: any): Promise<void> {
		const workspacePath = this.getWorkspacePath()
		if (!workspacePath) {
			throw new Error("No workspace path available")
		}

		const profileDir = path.join(workspacePath, "novel-helper", ".anh-chat", "tsprofile")
		const fs = await import("fs/promises")
		await fs.mkdir(profileDir, { recursive: true })

		const fileName = profileName.endsWith('.json') || profileName.endsWith('.jsonc')
			? profileName
			: `${profileName}.json`
		const filePath = path.join(profileDir, fileName)

		await fs.writeFile(filePath, JSON.stringify(profileData, null, 2), "utf8")
	}

	/**
	 * 删除 profile
	 */
	async deleteProfile(profileInfo: ExtendedProfileInfo): Promise<boolean> {
		try {
			if (profileInfo.isGlobal) {
				const globalService = await this.globalStorageService
				const fileName = path.basename(profileInfo.path)
				await globalService.deleteGlobalTsProfile(fileName)
			} else {
				const fs = await import("fs/promises")
				await fs.unlink(profileInfo.path)
			}

			console.log(`Profile deleted: ${profileInfo.name}`)
			return true
		} catch (error) {
			console.error(`Failed to delete profile ${profileInfo.name}:`, error)
			return false
		}
	}

	/**
	 * 验证 profile 文件
	 */
	async validateProfile(filePath: string): Promise<ValidationResult> {
		try {
			const fs = await import("fs/promises")
			const profileData = await fs.readFile(filePath, "utf8")
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
	 * 浏览选择 TSProfile 文件
	 */
	async browseTsProfile(isGlobal: boolean = false): Promise<string | undefined> {
		try {
			const fs = await import("fs/promises")
			let defaultPath: string

			if (isGlobal) {
				const globalService = await this.globalStorageService
				defaultPath = globalService.getGlobalTsProfilesPath()
			} else {
				const workspacePath = this.getWorkspacePath()
				if (!workspacePath) {
					vscode.window.showErrorMessage("请先打开工作区")
					return undefined
				}
				defaultPath = path.join(workspacePath, "novel-helper", ".anh-chat", "tsprofile")
			}

			// 确保目录存在
			await fs.mkdir(defaultPath, { recursive: true })

			const options: vscode.OpenDialogOptions = {
				canSelectMany: false,
				openLabel: "Select TSProfile File",
				filters: {
					"JSON Files": ["json", "jsonc"],
					"All Files": ["*"],
				},
				defaultUri: vscode.Uri.file(defaultPath),
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
	 * 复制 profile 到全局或工作区
	 */
	async copyProfile(sourceProfile: ExtendedProfileInfo, targetIsGlobal: boolean): Promise<boolean> {
		try {
			const fs = await import("fs/promises")
			const profileData = await fs.readFile(sourceProfile.path, "utf8")
			const parsed = JSON.parse(profileData)

			// 生成新的文件名（如果目标位置已存在同名文件）
			let targetFileName = path.basename(sourceProfile.path)
			if (sourceProfile.isGlobal !== targetIsGlobal) {
				// 如果在不同位置之间复制，检查是否已存在同名文件
				const existingProfiles = targetIsGlobal
					? await this.loadGlobalProfiles()
					: await this.loadWorkspaceProfiles()

				const existingNames = existingProfiles.map(p => path.basename(p.path))
				let counter = 1
				let originalName = targetFileName
				while (existingNames.includes(targetFileName)) {
					const nameWithoutExt = originalName.replace(/\.(json|jsonc)$/, '')
					const ext = originalName.match(/\.(json|jsonc)$/)?.[1] || 'json'
					targetFileName = `${nameWithoutExt}_copy_${counter}.${ext}`
					counter++
				}
			}

			const success = await this.saveProfile(targetFileName, parsed, targetIsGlobal)
			if (success) {
				const location = targetIsGlobal ? "全局" : "工作区"
				vscode.window.showInformationMessage(`Profile 已复制到${location}: ${targetFileName}`)
			}

			return success
		} catch (error) {
			console.error("Failed to copy profile:", error)
			vscode.window.showErrorMessage(`复制 Profile 失败: ${error instanceof Error ? error.message : String(error)}`)
			return false
		}
	}

	/**
	 * 获取工作区路径
	 */
	private getWorkspacePath(): string | undefined {
		const workspaceFolders = vscode.workspace.workspaceFolders
		if (workspaceFolders && workspaceFolders.length > 0) {
			return workspaceFolders[0].uri.fsPath
		}
		return undefined
	}
}

// 单例实例
let extendedTSProfileServiceInstance: ExtendedTSProfileService | null = null

export async function getExtendedTSProfileService(context: vscode.ExtensionContext): Promise<ExtendedTSProfileService> {
	if (!extendedTSProfileServiceInstance) {
		extendedTSProfileServiceInstance = new ExtendedTSProfileService(context)
	}
	return extendedTSProfileServiceInstance
}