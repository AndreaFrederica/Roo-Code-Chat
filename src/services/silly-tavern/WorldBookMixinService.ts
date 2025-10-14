/**
 * 世界书Mixin服务
 * 允许用户动态修改世界书条目的启用状态和内容，而不需要修改原始文件
 */

import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import { safeWriteJson } from "../../utils/safeWriteJson"
import { fileExistsAtPath } from "../../utils/fs"

/**
 * Safely reads JSON data from a file
 */
async function safeReadJson<T = any>(filePath: string): Promise<T | null> {
	try {
		if (!(await fileExistsAtPath(filePath))) {
			return null
		}

		const data = await fs.readFile(filePath, "utf8")
		return JSON.parse(data)
	} catch (error) {
		console.error(`Failed to read JSON file ${filePath}:`, error)
		return null
	}
}
import { getGlobalStorageService } from "../storage/GlobalStorageService"
import type {
	WorldBook,
	WorldEntry,
	WorldBookMixin,
	WorldBookMixinInfo,
	WorldBookEntryMixin
} from "../../../packages/types/src/silly-tavern-worldbook"

export interface WorldBookWithMixin {
	/** 世界书元数据 */
	meta?: any;
	/** 世界书文件路径 */
	originalPath?: string;
	/** 是否为全局世界书 */
	isGlobal?: boolean;
	/** 世界书Mixin配置 */
	mixin?: WorldBookMixin;
	/** 修改后的entries */
	entries: Record<string, WorldEntry> | WorldEntry[];
}

export interface MixinWorldEntry extends WorldEntry {
	/** 是否被Mixin修改 */
	isModified?: boolean;
	/** Mixin配置 */
	mixinConfig?: WorldBookEntryMixin;
	/** 是否启用（考虑Mixin后的最终状态） */
	isEnabled?: boolean;
}

/**
 * 世界书Mixin管理服务
 */
export class WorldBookMixinService {
	private globalStorageService: Promise<any>

	constructor(context: vscode.ExtensionContext) {
		this.globalStorageService = getGlobalStorageService(context)
	}

	/**
	 * 获取世界书的Mixin文件路径
	 */
	private getMixinFilePath(worldBookPath: string, isGlobal: boolean): string {
		const fileName = `${path.basename(worldBookPath, path.extname(worldBookPath))}.mixin.json`
		if (isGlobal) {
			return path.join(path.dirname(worldBookPath), "mixins", fileName)
		} else {
			const workspacePath = this.getWorkspacePath()
			if (!workspacePath) {
				throw new Error("No workspace path available")
			}
			return path.join(workspacePath, "novel-helper", ".anh-chat", "worldbook-mixins", fileName)
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

	/**
	 * 加载世界书的Mixin配置
	 */
	async loadWorldBookMixin(worldBookPath: string, isGlobal: boolean): Promise<WorldBookMixin | null> {
		try {
			const mixinPath = this.getMixinFilePath(worldBookPath, isGlobal)
			console.log(`[WorldBookMixinService] Loading mixin from path: ${mixinPath}`)

			const mixinData = await safeReadJson<WorldBookMixin>(mixinPath)
			console.log(`[WorldBookMixinService] Raw mixin data:`, mixinData)

			if (mixinData) {
				console.log(`[WorldBookMixinService] Loaded mixin for ${path.basename(worldBookPath)}: ${mixinData.entries.length} entries modified`)
				return mixinData
			} else {
				console.log(`[WorldBookMixinService] No mixin data found at ${mixinPath}`)
			}
		} catch (error) {
			console.error(`[WorldBookMixinService] Error loading mixin for ${worldBookPath}:`, error)
		}

		return null
	}

	/**
	 * 保存世界书的Mixin配置
	 */
	async saveWorldBookMixin(mixin: WorldBookMixin): Promise<void> {
		try {
			const mixinPath = this.getMixinFilePath(mixin.worldBookPath, mixin.isGlobal)
			console.log(`[WorldBookMixinService] Saving mixin to path: ${mixinPath}`)

			// 确保目录存在
			const mixinDir = path.dirname(mixinPath)
			console.log(`[WorldBookMixinService] Ensuring directory exists: ${mixinDir}`)
			await fs.mkdir(mixinDir, { recursive: true })

			// 更新时间戳
			mixin.updatedAt = Date.now()

			// 保存配置
			await safeWriteJson(mixinPath, mixin)

			console.log(`[WorldBookMixinService] Saved mixin for ${path.basename(mixin.worldBookPath)}: ${mixin.entries.length} entries modified`)
		} catch (error) {
			console.error(`[WorldBookMixinService] Error saving mixin for ${mixin.worldBookPath}:`, error)
			throw error
		}
	}

	/**
	 * 删除世界书的Mixin配置
	 */
	async deleteWorldBookMixin(worldBookPath: string, isGlobal: boolean): Promise<boolean> {
		try {
			const mixinPath = this.getMixinFilePath(worldBookPath, isGlobal)

			// 检查文件是否存在
			try {
				await fs.access(mixinPath)
			} catch {
				return false // 文件不存在
			}

			// 删除文件
			await fs.unlink(mixinPath)

			console.log(`[WorldBookMixinService] Deleted mixin for ${path.basename(worldBookPath)}`)
			return true
		} catch (error) {
			console.error(`[WorldBookMixinService] Error deleting mixin for ${worldBookPath}:`, error)
			return false
		}
	}

	/**
	 * 应用Mixin到世界书条目
	 */
	async applyMixinToWorldBook(worldBook: WorldBook, mixin: WorldBookMixin): Promise<WorldBookWithMixin> {
		// 确保世界书有entries字段
		if (!('entries' in worldBook)) {
			throw new Error("Invalid world book format: no entries found")
		}

		let entries: Record<string, WorldEntry> | WorldEntry[]

		// 处理不同的entries格式
		if (Array.isArray(worldBook.entries)) {
			entries = worldBook.entries.map(entry => this.applyMixinToEntry(entry, mixin))
		} else {
			const modifiedEntries: Record<string, WorldEntry> = {}
			const entriesObj = worldBook.entries as Record<string, WorldEntry>
			for (const [key, entry] of Object.entries(entriesObj)) {
				modifiedEntries[key] = this.applyMixinToEntry(entry, mixin)
			}
			entries = modifiedEntries
		}

		const finalResult: WorldBookWithMixin = {
			meta: (worldBook as any).meta,
			mixin,
			entries
		}
		return finalResult
	}

	/**
	 * 应用Mixin到单个世界书条目
	 */
	private applyMixinToEntry(entry: WorldEntry, mixin: WorldBookMixin): MixinWorldEntry {
		const mixinEntry = mixin.entries.find(m => m.uid === entry.uid)

		if (!mixinEntry) {
			return { ...entry, isModified: false, isEnabled: !entry.disable }
		}

		const modifiedEntry: MixinWorldEntry = {
			...entry,
			isModified: true,
			mixinConfig: mixinEntry,
			isEnabled: mixinEntry.enabled !== undefined ? !mixinEntry.enabled : !mixinEntry.disabled
		}

		// 应用Mixin修改
		if (mixinEntry.keys !== undefined) {
			modifiedEntry.key = mixinEntry.keys
		}

		if (mixinEntry.secondaryKeys !== undefined) {
			modifiedEntry.keysecondary = mixinEntry.secondaryKeys
		}

		if (mixinEntry.content !== undefined) {
			modifiedEntry.content = mixinEntry.content
		}

		if (mixinEntry.comment !== undefined) {
			modifiedEntry.comment = mixinEntry.comment
		}

		if (mixinEntry.order !== undefined) {
			modifiedEntry.order = mixinEntry.order
		}

		if (mixinEntry.constant !== undefined) {
			modifiedEntry.constant = mixinEntry.constant
		}

		if (mixinEntry.group !== undefined) {
			modifiedEntry.group = mixinEntry.group
		}

		if (mixinEntry.probability !== undefined) {
			modifiedEntry.probability = mixinEntry.probability
		}

		// 应用启用/禁用状态
		if (mixinEntry.enabled !== undefined) {
			modifiedEntry.disable = !mixinEntry.enabled
		} else if (mixinEntry.disabled !== undefined) {
			modifiedEntry.disable = mixinEntry.disabled
		}

		return modifiedEntry
	}

	/**
	 * 创建或更新世界书条目的Mixin
	 */
	async updateEntryMixin(
		worldBookPath: string,
		isGlobal: boolean,
		entryUid: number | string,
		updates: Partial<WorldBookEntryMixin>
	): Promise<void> {
		// 加载现有的Mixin配置
		let mixin = await this.loadWorldBookMixin(worldBookPath, isGlobal)

		if (!mixin) {
			// 创建新的Mixin配置
			const worldBookName = path.basename(worldBookPath, path.extname(worldBookPath))
			mixin = {
				worldBookPath,
				worldBookName,
				isGlobal,
				entries: [],
				createdAt: Date.now(),
				updatedAt: Date.now(),
				enabled: true
			}
		}

		// 查找现有条目
		const existingEntryIndex = mixin.entries.findIndex(e => e.uid === entryUid)

		if (existingEntryIndex >= 0) {
			// 更新现有条目
			mixin.entries[existingEntryIndex] = {
				...mixin.entries[existingEntryIndex],
				...updates,
				updatedAt: Date.now()
			}
		} else {
			// 添加新条目
			const newEntry: WorldBookEntryMixin = {
				uid: entryUid,
				createdAt: Date.now(),
				updatedAt: Date.now(),
				...updates
			}
			mixin.entries.push(newEntry)
		}

		// 保存Mixin配置
		await this.saveWorldBookMixin(mixin)
	}

	/**
	 * 删除世界书条目的Mixin
	 */
	async removeEntryMixin(worldBookPath: string, isGlobal: boolean, entryUid: number | string): Promise<void> {
		const mixin = await this.loadWorldBookMixin(worldBookPath, isGlobal)

		if (!mixin) {
			return // 没有Mixin配置
		}

		// 删除条目
		const originalLength = mixin.entries.length
		mixin.entries = mixin.entries.filter(e => e.uid !== entryUid)

		if (mixin.entries.length === 0) {
			// 如果没有条目了，删除整个Mixin文件
			await this.deleteWorldBookMixin(worldBookPath, isGlobal)
		} else if (mixin.entries.length < originalLength) {
			// 保存更新后的Mixin配置
			await this.saveWorldBookMixin(mixin)
		}
	}

	/**
	 * 获取世界书的Mixin信息
	 */
	async getWorldBookMixinInfo(worldBookPath: string, isGlobal: boolean): Promise<WorldBookMixinInfo | null> {
		const mixin = await this.loadWorldBookMixin(worldBookPath, isGlobal)

		if (!mixin) {
			return null
		}

		const mixinPath = this.getMixinFilePath(worldBookPath, isGlobal)
		const modifiedEntryCount = mixin.entries.length
		const enabledEntryCount = mixin.entries.filter((e: WorldBookEntryMixin) => e.enabled !== false && e.disabled !== true).length
		const disabledEntryCount = modifiedEntryCount - enabledEntryCount

		return {
			worldBookPath,
			worldBookName: mixin.worldBookName,
			isGlobal,
			mixinPath,
			modifiedEntryCount,
			enabledEntryCount,
			disabledEntryCount,
			lastModified: mixin.updatedAt,
			enabled: mixin.enabled
		}
	}

	/**
	 * 列出所有世界书的Mixin信息
	 */
	async listAllWorldBookMixins(): Promise<WorldBookMixinInfo[]> {
		const mixinInfos: WorldBookMixinInfo[] = []

		// 扫描工作区Mixin目录
		const workspacePath = this.getWorkspacePath()
		if (workspacePath) {
			const workspaceMixinDir = path.join(workspacePath, "novel-helper", ".anh-chat", "worldbook-mixins")
			await this.scanMixinDirectory(workspaceMixinDir, false, mixinInfos)
		}

		// 扫描全局Mixin目录
		const globalService = await this.globalStorageService
		const globalMixinDir = path.join(globalService.getGlobalWorldBooksPath(), "mixins")
		await this.scanMixinDirectory(globalMixinDir, true, mixinInfos)

		return mixinInfos
	}

	/**
	 * 扫描Mixin目录
	 */
	private async scanMixinDirectory(mixinDir: string, isGlobal: boolean, mixinInfos: WorldBookMixinInfo[]): Promise<void> {
		try {
			const files = await fs.readdir(mixinDir)

			for (const file of files) {
				if (file.endsWith('.mixin.json')) {
					try {
						const mixinPath = path.join(mixinDir, file)
						const mixin = await safeReadJson<WorldBookMixin>(mixinPath)

						if (mixin) {
							const modifiedEntryCount = mixin.entries.length
							const enabledEntryCount = mixin.entries.filter((e: WorldBookEntryMixin) => e.enabled !== false && e.disabled !== true).length
							const disabledEntryCount = modifiedEntryCount - enabledEntryCount

							mixinInfos.push({
								worldBookPath: mixin.worldBookPath,
								worldBookName: mixin.worldBookName,
								isGlobal,
								mixinPath,
								modifiedEntryCount,
								enabledEntryCount,
								disabledEntryCount,
								lastModified: mixin.updatedAt,
								enabled: mixin.enabled
							})
						}
					} catch (error) {
						console.error(`[WorldBookMixinService] Error reading mixin file ${file}:`, error)
					}
				}
			}
		} catch (error) {
			// 目录不存在，忽略
		}
	}
}