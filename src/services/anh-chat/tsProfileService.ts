import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import { parseTavernPresetStrict, compilePresetChannels } from "@roo-code/types"

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
 * 加载可用的TSProfile文件列表
 */
export async function loadTsProfiles(): Promise<ProfileInfo[]> {
	try {
		const workspacePath = getWorkspacePath()
		if (!workspacePath) {
			console.log("[TSProfile] No workspace path found")
			return []
		}

		const profileDir = path.join(workspacePath, "novel-helper", ".anh-chat", "tsprofile")
		console.log(`[TSProfile] Profile directory: ${profileDir}`)

		// 检查profile目录是否存在
		try {
			await fs.access(profileDir)
			console.log(`[TSProfile] Directory exists: ${profileDir}`)
		} catch {
			// 目录不存在，创建它
			console.log(`[TSProfile] Creating directory: ${profileDir}`)
			await fs.mkdir(profileDir, { recursive: true })
			return []
		}

		const files = await fs.readdir(profileDir, { withFileTypes: true })
		console.log(`[TSProfile] Found ${files.length} files in directory`)
		const profiles: ProfileInfo[] = []

		for (const file of files) {
			if (file.isFile() && (file.name.endsWith('.json') || file.name.endsWith('.jsonc'))) {
				const filePath = path.join(profileDir, file.name)
				try {
					const stats = await fs.stat(filePath)
					const profileData = await fs.readFile(filePath, 'utf-8')
					const parsed = JSON.parse(profileData)

					const preset = parseTavernPresetStrict(parsed)
					const compiled = compilePresetChannels(preset, {
						onlyEnabled: true,
						characterId: 100001
					}, '\n\n')

					profiles.push({
						name: parsed.name || file.name,
						path: filePath,
						description: parsed.description || '',
						promptsCount: parsed.prompts?.length || 0,
						enabledCount: parsed.prompts?.filter((p: any) => p.enabled !== false).length || 0,
						lastModified: stats.mtime.getTime()
					})
				} catch (error) {
					console.warn(`Failed to load profile ${file.name}:`, error)
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
		const profileData = await fs.readFile(filePath, 'utf-8')
		const parsed = JSON.parse(profileData)

		const preset = parseTavernPresetStrict(parsed)
		const compiled = compilePresetChannels(preset, {
			onlyEnabled: true,
			characterId: 100001
		}, '\n\n')

		return {
			success: true,
			profileName: parsed.name || path.basename(filePath),
			path: filePath,
			promptsCount: preset.prompts?.length || 0
		}
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error)
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
			openLabel: 'Select TSProfile File',
			filters: {
				'JSON Files': ['json', 'jsonc'],
				'All Files': ['*']
			},
			defaultUri: vscode.Uri.file(profileDir)
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