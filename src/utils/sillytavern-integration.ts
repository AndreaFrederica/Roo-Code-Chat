import * as vscode from 'vscode'
import * as path from 'path'
import type { Role } from '@roo-code/types'
import { SillyTavernParser, type SillyTavernParseResult, type SillyTavernParseOptions } from './sillytavern-parser.js'

/**
 * SillyTavern 集成选项
 */
export interface SillyTavernIntegrationOptions extends SillyTavernParseOptions {
	/** 是否显示进度提示 */
	showProgress?: boolean
	/** 是否在导入后打开角色文件 */
	openAfterImport?: boolean
	/** 目标保存目录 */
	targetDirectory?: string
}

/**
 * SillyTavern 导入结果
 */
export interface SillyTavernImportResult {
	success: boolean
	role?: Role
	filePath?: string
	error?: string
}

/**
 * SillyTavern 集成工具
 */
export class SillyTavernIntegration {
	/**
	 * 从文件导入 SillyTavern 角色
	 */
	static async importFromFile(
		filePath: string,
		options: SillyTavernIntegrationOptions = {}
	): Promise<SillyTavernImportResult> {
		try {
			// 显示进度
			if (options.showProgress) {
				return vscode.window.withProgress(
					{
						location: vscode.ProgressLocation.Notification,
						title: 'Importing SillyTavern Character',
						cancellable: false
					},
					async (progress) => {
						progress.report({ message: 'Parsing character file...' })
						return this.doImportFromFile(filePath, options)
					}
				)
			} else {
				return this.doImportFromFile(filePath, options)
			}
		} catch (error) {
			return {
				success: false,
				error: `Import error: ${error instanceof Error ? error.message : String(error)}`
			}
		}
	}

	/**
	 * 通过文件选择器导入 SillyTavern 角色
	 */
	static async importWithFilePicker(
		options: SillyTavernIntegrationOptions = {}
	): Promise<SillyTavernImportResult> {
		try {
			// 显示文件选择器
			const fileUris = await vscode.window.showOpenDialog({
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: false,
				filters: {
					'SillyTavern Characters': ['png'],
					'JSON Files': ['json'],
					'All Files': ['*']
				},
				title: 'Select SillyTavern Character File'
			})

			if (!fileUris || fileUris.length === 0) {
				return {
					success: false,
					error: 'No file selected'
				}
			}

			const filePath = fileUris[0].fsPath
			return this.importFromFile(filePath, options)
		} catch (error) {
			return {
				success: false,
				error: `File picker error: ${error instanceof Error ? error.message : String(error)}`
			}
		}
	}

	/**
	 * 批量导入 SillyTavern 角色
	 */
	static async importBatch(
		filePaths: string[],
		options: SillyTavernIntegrationOptions = {}
	): Promise<SillyTavernImportResult[]> {
		const results: SillyTavernImportResult[] = []

		if (options.showProgress) {
			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: 'Batch Importing SillyTavern Characters',
					cancellable: false
				},
				async (progress) => {
					for (let i = 0; i < filePaths.length; i++) {
						const filePath = filePaths[i]
						const fileName = path.basename(filePath)
						
						progress.report({
							message: `Processing ${fileName} (${i + 1}/${filePaths.length})`,
							increment: (100 / filePaths.length)
						})

						const result = await this.doImportFromFile(filePath, {
							...options,
							showProgress: false // 避免嵌套进度条
						})
						results.push(result)
					}
				}
			)
		} else {
			for (const filePath of filePaths) {
				const result = await this.doImportFromFile(filePath, options)
				results.push(result)
			}
		}

		return results
	}

	/**
	 * 执行实际的导入操作
	 */
	private static async doImportFromFile(
		filePath: string,
		options: SillyTavernIntegrationOptions
	): Promise<SillyTavernImportResult> {
		try {
			// 解析 SillyTavern 文件
			const parseResult = await SillyTavernParser.parseFromPngFile(filePath, options)
			
			if (!parseResult.success || !parseResult.role) {
				return {
					success: false,
					error: parseResult.error || 'Failed to parse SillyTavern file'
				}
			}

			// 保存角色文件
			const saveResult = await this.saveRole(parseResult.role, options)
			
			if (!saveResult.success) {
				return {
					success: false,
					error: saveResult.error || 'Failed to save role file'
				}
			}

			// 打开文件（如果需要）
			if (options.openAfterImport && saveResult.filePath) {
				await this.openRoleFile(saveResult.filePath)
			}

			return {
				success: true,
				role: parseResult.role,
				filePath: saveResult.filePath
			}
		} catch (error) {
			return {
				success: false,
				error: `Import error: ${error instanceof Error ? error.message : String(error)}`
			}
		}
	}

	/**
	 * 保存角色到文件系统
	 */
	private static async saveRole(
		role: Role,
		options: SillyTavernIntegrationOptions
	): Promise<{ success: boolean; filePath?: string; error?: string }> {
		try {
			// 确定保存目录
			const targetDir = options.targetDirectory || await this.getDefaultRoleDirectory()
			
			if (!targetDir) {
				return {
					success: false,
					error: 'No target directory specified and unable to determine default directory'
				}
			}

			// 生成文件名
			const fileName = this.generateRoleFileName(role)
			const filePath = path.join(targetDir, fileName)

			// 确保目录存在
			await this.ensureDirectoryExists(targetDir)

			// 保存角色数据
			const roleJson = JSON.stringify(role, null, 2)
			await vscode.workspace.fs.writeFile(
				vscode.Uri.file(filePath),
				Buffer.from(roleJson, 'utf-8')
			)

			return {
				success: true,
				filePath
			}
		} catch (error) {
			return {
				success: false,
				error: `Save error: ${error instanceof Error ? error.message : String(error)}`
			}
		}
	}

	/**
	 * 获取默认角色保存目录
	 */
	private static async getDefaultRoleDirectory(): Promise<string | null> {
		try {
			// 尝试从工作区配置获取
			const workspaceFolders = vscode.workspace.workspaceFolders
			if (workspaceFolders && workspaceFolders.length > 0) {
				const workspaceRoot = workspaceFolders[0].uri.fsPath
				return path.join(workspaceRoot, 'roles')
			}

			return null
		} catch {
			return null
		}
	}

	/**
	 * 生成角色文件名
	 */
	private static generateRoleFileName(role: Role): string {
		// 清理角色名，移除不安全的文件名字符
		const safeName = role.name
			.replace(/[<>:"/\\|?*]/g, '_')
			.replace(/\s+/g, '_')
			.toLowerCase()

		return `${safeName}_${role.uuid.slice(0, 8)}.json`
	}

	/**
	 * 确保目录存在
	 */
	private static async ensureDirectoryExists(dirPath: string): Promise<void> {
		try {
			await vscode.workspace.fs.stat(vscode.Uri.file(dirPath))
		} catch {
			// 目录不存在，创建它
			await vscode.workspace.fs.createDirectory(vscode.Uri.file(dirPath))
		}
	}

	/**
	 * 打开角色文件
	 */
	private static async openRoleFile(filePath: string): Promise<void> {
		try {
			const document = await vscode.workspace.openTextDocument(filePath)
			await vscode.window.showTextDocument(document)
		} catch (error) {
			// 静默失败，不影响主要功能
			console.warn('Failed to open role file:', error)
		}
	}

	/**
	 * 显示导入结果摘要
	 */
	static async showImportSummary(results: SillyTavernImportResult[]): Promise<void> {
		const successful = results.filter(r => r.success)
		const failed = results.filter(r => !r.success)

		let message = `Import completed: ${successful.length} successful`
		if (failed.length > 0) {
			message += `, ${failed.length} failed`
		}

		if (failed.length > 0) {
			const failedDetails = failed.map(r => r.error).join('\n')
			await vscode.window.showWarningMessage(message, 'Show Details').then(selection => {
				if (selection === 'Show Details') {
					vscode.window.showErrorMessage(`Import errors:\n${failedDetails}`)
				}
			})
		} else {
			await vscode.window.showInformationMessage(message)
		}
	}

	/**
	 * 注册 VS Code 命令
	 */
	static registerCommands(context: vscode.ExtensionContext): void {
		// 导入单个文件命令
		const importCommand = vscode.commands.registerCommand(
			'roo-code.importSillyTavernCharacter',
			async () => {
				const result = await this.importWithFilePicker({
					showProgress: true,
					openAfterImport: true
				})

				if (result.success) {
					vscode.window.showInformationMessage(
						`Successfully imported character: ${result.role?.name}`
					)
				} else {
					vscode.window.showErrorMessage(
						`Failed to import character: ${result.error}`
					)
				}
			}
		)

		// 批量导入命令
		const batchImportCommand = vscode.commands.registerCommand(
			'roo-code.batchImportSillyTavernCharacters',
			async () => {
				const fileUris = await vscode.window.showOpenDialog({
					canSelectFiles: true,
					canSelectFolders: false,
					canSelectMany: true,
					filters: {
						'SillyTavern Characters': ['png'],
						'JSON Files': ['json']
					},
					title: 'Select SillyTavern Character Files'
				})

				if (!fileUris || fileUris.length === 0) {
					return
				}

				const filePaths = fileUris.map(uri => uri.fsPath)
				const results = await this.importBatch(filePaths, {
					showProgress: true
				})

				await this.showImportSummary(results)
			}
		)

		context.subscriptions.push(importCommand, batchImportCommand)
	}
}

/**
 * 便捷函数：导入 SillyTavern 角色
 */
export async function importSillyTavernCharacter(
	filePath: string,
	options?: SillyTavernIntegrationOptions
): Promise<SillyTavernImportResult> {
	return SillyTavernIntegration.importFromFile(filePath, options)
}

/**
 * 便捷函数：通过文件选择器导入角色
 */
export async function importSillyTavernWithPicker(
	options?: SillyTavernIntegrationOptions
): Promise<SillyTavernImportResult> {
	return SillyTavernIntegration.importWithFilePicker(options)
}