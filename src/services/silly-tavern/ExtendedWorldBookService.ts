import * as vscode from "vscode"
import * as path from "path"
import { WorldBookConverter } from "../../../packages/types/src/silly-tavern-worldbook-converter"
import type { WorldBookInfo } from "../../../packages/types/src/silly-tavern-worldbook"
import type { WorldBookConfig } from "./sillyTavernWorldBookService"
import { getGlobalStorageService } from "../storage/GlobalStorageService"

export interface ExtendedWorldBookInfo extends WorldBookInfo {
	/** 是否为全局世界书 */
	isGlobal?: boolean
	/** 世界书类型：global 或 workspace */
	type?: "global" | "workspace"
	/** 配置信息 */
	config?: WorldBookConfig
}

/**
 * 扩展的世界书服务，支持全局和本地世界书管理
 */
export class ExtendedWorldBookService {
	private converter = new WorldBookConverter()
	private globalStorageService: Promise<any>

	constructor(context: vscode.ExtensionContext) {
		this.globalStorageService = getGlobalStorageService(context)
	}

	/**
	 * 获取所有可用的世界书（包括全局和工作区）
	 */
	async getAllWorldBooks(): Promise<ExtendedWorldBookInfo[]> {
		const worldBooks: ExtendedWorldBookInfo[] = []

		// 加载工作区世界书
		const workspaceWorldBooks = await this.loadWorkspaceWorldBooks()
		worldBooks.push(...workspaceWorldBooks.map(wb => ({ ...wb, type: "workspace" as const, isGlobal: false })))

		// 加载全局世界书
		const globalWorldBooks = await this.loadGlobalWorldBooks()
		worldBooks.push(...globalWorldBooks.map(wb => ({ ...wb, type: "global" as const, isGlobal: true })))

		return worldBooks
	}

	/**
	 * 加载工作区世界书
	 */
	async loadWorkspaceWorldBooks(): Promise<WorldBookInfo[]> {
		try {
			const workspacePath = this.getWorkspacePath()
			if (!workspacePath) {
				console.warn("No workspace path found for world books")
				return []
			}

			const worldBookDir = path.join(workspacePath, "novel-helper", ".anh-chat", "worldbook")
			return await this.scanWorldBookDirectory(worldBookDir)
		} catch (error) {
			console.error("Error loading workspace world books:", error)
			return []
		}
	}

	/**
	 * 加载全局世界书
	 */
	async loadGlobalWorldBooks(): Promise<WorldBookInfo[]> {
		try {
			const globalService = await this.globalStorageService
			const worldBookDir = globalService.getGlobalWorldBooksPath()
			return await this.scanWorldBookDirectory(worldBookDir)
		} catch (error) {
			console.error("Error loading global world books:", error)
			return []
		}
	}

	/**
	 * 扫描指定目录下的世界书文件
	 */
	private async scanWorldBookDirectory(dirPath: string): Promise<WorldBookInfo[]> {
		try {
			const fs = await import("fs/promises")
			const infos = await this.converter.scanDirectory(dirPath)

			// 确保所有路径都是绝对路径
			const infosWithAbsolutePaths = infos.map(info => ({
				...info,
				path: path.resolve(info.path)
			}))

			return infosWithAbsolutePaths
		} catch (error) {
			console.error(`Failed to scan world book directory ${dirPath}:`, error)
			return []
		}
	}

	/**
	 * 验证世界书文件
	 */
	async validateWorldBookFile(filePath: string): Promise<{ valid: boolean; info?: WorldBookInfo; error?: string }> {
		try {
			const info = await this.converter.getWorldBookInfo(filePath)

			if (info.loaded && info.entryCount > 0) {
				return { valid: true, info }
			} else {
				return {
					valid: false,
					error: info.error || '文件格式无效或没有找到词条'
				}
			}
		} catch (error) {
			return {
				valid: false,
				error: error instanceof Error ? error.message : String(error)
			}
		}
	}

	/**
	 * 保存世界书到指定位置（全局或工作区）
	 */
	async saveWorldBook(fileName: string, worldBookData: any, isGlobal: boolean = false): Promise<boolean> {
		try {
			if (isGlobal) {
				const globalService = await this.globalStorageService
				await globalService.saveGlobalWorldBook(fileName, worldBookData)
			} else {
				await this.saveWorkspaceWorldBook(fileName, worldBookData)
			}

			console.log(`WorldBook saved: ${fileName} (${isGlobal ? 'global' : 'workspace'})`)
			return true
		} catch (error) {
			console.error(`Failed to save world book ${fileName}:`, error)
			return false
		}
	}

	/**
	 * 保存工作区世界书
	 */
	private async saveWorkspaceWorldBook(fileName: string, worldBookData: any): Promise<void> {
		const workspacePath = this.getWorkspacePath()
		if (!workspacePath) {
			throw new Error("No workspace path available")
		}

		const worldBookDir = path.join(workspacePath, "novel-helper", ".anh-chat", "worldbook")
		const fs = await import("fs/promises")
		await fs.mkdir(worldBookDir, { recursive: true })

		const filePath = path.join(worldBookDir, fileName)
		await fs.writeFile(filePath, JSON.stringify(worldBookData, null, 2), "utf8")
	}

	/**
	 * 删除世界书
	 */
	async deleteWorldBook(worldBookInfo: ExtendedWorldBookInfo): Promise<boolean> {
		try {
			if (worldBookInfo.isGlobal) {
				const globalService = await this.globalStorageService
				const fileName = path.basename(worldBookInfo.path)
				await globalService.deleteGlobalWorldBook(fileName)
			} else {
				const fs = await import("fs/promises")
				await fs.unlink(worldBookInfo.path)
			}

			console.log(`WorldBook deleted: ${worldBookInfo.name}`)
			return true
		} catch (error) {
			console.error(`Failed to delete world book ${worldBookInfo.name}:`, error)
			return false
		}
	}

	/**
	 * 复制世界书到全局或工作区
	 */
	async copyWorldBook(sourceWorldBook: ExtendedWorldBookInfo, targetIsGlobal: boolean): Promise<boolean> {
		try {
			const fs = await import("fs/promises")
			const worldBookData = await fs.readFile(sourceWorldBook.path, "utf8")
			const parsed = JSON.parse(worldBookData)

			// 生成新的文件名（如果目标位置已存在同名文件）
			let targetFileName = path.basename(sourceWorldBook.path)
			if (sourceWorldBook.isGlobal !== targetIsGlobal) {
				// 如果在不同位置之间复制，检查是否已存在同名文件
				const existingWorldBooks = targetIsGlobal
					? await this.loadGlobalWorldBooks()
					: await this.loadWorkspaceWorldBooks()

				const existingNames = existingWorldBooks.map(wb => path.basename(wb.path))
				let counter = 1
				let originalName = targetFileName
				while (existingNames.includes(targetFileName)) {
					const nameWithoutExt = originalName.replace(/\.(json|jsonl)$/, '')
					const ext = originalName.match(/\.(json|jsonl)$/)?.[1] || 'json'
					targetFileName = `${nameWithoutExt}_copy_${counter}.${ext}`
					counter++
				}
			}

			const success = await this.saveWorldBook(targetFileName, parsed, targetIsGlobal)
			if (success) {
				const location = targetIsGlobal ? "全局" : "工作区"
				vscode.window.showInformationMessage(`世界书已复制到${location}: ${targetFileName}`)
			}

			return success
		} catch (error) {
			console.error("Failed to copy world book:", error)
			vscode.window.showErrorMessage(`复制世界书失败: ${error instanceof Error ? error.message : String(error)}`)
			return false
		}
	}

	/**
	 * 浏览选择世界书文件
	 */
	async browseWorldBookFile(isGlobal: boolean = false): Promise<string | undefined> {
		try {
			const fs = await import("fs/promises")
			let defaultPath: string

			if (isGlobal) {
				const globalService = await this.globalStorageService
				defaultPath = globalService.getGlobalWorldBooksPath()
			} else {
				const workspacePath = this.getWorkspacePath()
				if (!workspacePath) {
					vscode.window.showErrorMessage("请先打开工作区")
					return undefined
				}
				defaultPath = path.join(workspacePath, "novel-helper", ".anh-chat", "worldbook")
			}

			// 确保目录存在
			await fs.mkdir(defaultPath, { recursive: true })

			const options: vscode.OpenDialogOptions = {
				canSelectMany: false,
				openLabel: "选择世界书文件",
				filters: {
					"JSON Files": ["json", "jsonl"],
					"All Files": ["*"]
				},
				defaultUri: vscode.Uri.file(defaultPath)
			}

			const fileUri = await vscode.window.showOpenDialog(options)
			if (fileUri && fileUri[0]) {
				return fileUri[0].fsPath
			}

			return undefined
		} catch (error) {
			console.error("Error browsing world book file:", error)
			vscode.window.showErrorMessage(`浏览世界书文件失败: ${error instanceof Error ? error.message : String(error)}`)
			return undefined
		}
	}

	/**
	 * 获取世界书的 Markdown 内容
	 */
	async getWorldBookMarkdown(worldBookInfo: ExtendedWorldBookInfo): Promise<string> {
		try {
			const result = await this.converter.loadFromFile(worldBookInfo.path)

			if (result.entryCount > 0) {
				const fileName = path.basename(worldBookInfo.path, path.extname(worldBookInfo.path))
				let markdown = `## ${fileName}\n\n`
				markdown += result.markdown

				console.log(`Loaded world book: ${fileName} (${result.entryCount} entries)`)
				return markdown
			}

			if (result.warnings.length > 0) {
				console.warn(`World book warnings: ${result.warnings.join(', ')}`)
			}

			return ""
		} catch (error) {
			console.error(`Failed to load world book ${worldBookInfo.name}:`, error)
			return ""
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
let extendedWorldBookServiceInstance: ExtendedWorldBookService | null = null

export async function getExtendedWorldBookService(context: vscode.ExtensionContext): Promise<ExtendedWorldBookService> {
	if (!extendedWorldBookServiceInstance) {
		extendedWorldBookServiceInstance = new ExtendedWorldBookService(context)
	}
	return extendedWorldBookServiceInstance
}