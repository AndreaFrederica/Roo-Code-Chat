import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import * as os from "os"
import { v4 as uuidv4 } from "uuid"

import { Package } from "../../shared/package"
import { getStorageBasePath } from "../../utils/storage"
import { type HistoryItem, type Role, type RoleSummary } from "@roo-code/types"
import { safeWriteJson } from "../../utils/safeWriteJson"
import { fileExistsAtPath } from "../../utils/fs"
import { SillyTavernParser } from "../../utils/sillytavern-parser"
import { debugLog } from "../../utils/debug"

/**
 * 全局存储服务，用于存储不依赖工作区的数据
 * 包括全局角色、聊天记录和其他数据
 * 存储位置：用户目录下的 .anh-chat 文件夹
 */
export class GlobalStorageService {
	private readonly defaultGlobalPath: string
	private globalDataPath: string
	private globalRolesPath: string
	private globalHistoryPath: string
	private globalTsProfilesPath: string
	private globalWorldBooksPath: string
	private globalWorldsetsPath: string
	private globalExtensionsPath: string

	private initialized = false
	private globalHistoryCache: HistoryItem[] = []
	private globalRolesCache = new Map<string, Role>()

	constructor(context: vscode.ExtensionContext) {
		// 默认存储路径：用户主目录下的 .anh-chat
		this.defaultGlobalPath = path.join(os.homedir(), ".anh-chat")
		this.globalDataPath = this.defaultGlobalPath
		this.globalRolesPath = path.join(this.globalDataPath, "roles")
		this.globalHistoryPath = path.join(this.globalDataPath, "history", "global-history.json")
		this.globalTsProfilesPath = path.join(this.globalDataPath, "tsprofile")
		this.globalWorldBooksPath = path.join(this.globalDataPath, "worldbook")
		this.globalWorldsetsPath = path.join(this.globalDataPath, "worldset")
		this.globalExtensionsPath = path.join(this.globalDataPath, "extension")
	}

	async initialize(): Promise<void> {
		if (this.initialized) {
			return
		}

		try {
			// 获取用户配置的全局存储路径
			await this.updateStoragePath()

			// 创建全局数据目录
			await fs.mkdir(this.globalDataPath, { recursive: true })
			await fs.mkdir(this.globalRolesPath, { recursive: true })
			await fs.mkdir(this.globalTsProfilesPath, { recursive: true })
			await fs.mkdir(this.globalWorldBooksPath, { recursive: true })
			await fs.mkdir(this.globalWorldsetsPath, { recursive: true })
			await fs.mkdir(this.globalExtensionsPath, { recursive: true })

			// 创建历史记录目录
			const historyDir = path.dirname(this.globalHistoryPath)
			await fs.mkdir(historyDir, { recursive: true })

			// 加载全局历史记录
			await this.loadGlobalHistory()

			// 加载全局角色
			await this.loadGlobalRoles()

			this.initialized = true
			console.log(`GlobalStorageService initialized successfully at: ${this.globalDataPath}`)
		} catch (error) {
			console.error("Failed to initialize GlobalStorageService:", error)
			throw error
		}
	}

	/**
	 * 更新存储路径（当用户更改配置时调用）
	 */
	async updateStoragePath(): Promise<void> {
		try {
			const config = vscode.workspace.getConfiguration(Package.name)
			const customPath = config.get<string>("globalStoragePath", "")

			if (customPath && customPath.trim()) {
				// 使用用户自定义的路径
				this.globalDataPath = customPath.trim()
				this.globalRolesPath = path.join(this.globalDataPath, "roles")
				this.globalHistoryPath = path.join(this.globalDataPath, "history", "global-history.json")
				this.globalTsProfilesPath = path.join(this.globalDataPath, "tsprofile")
				this.globalWorldBooksPath = path.join(this.globalDataPath, "worldbook")
				this.globalWorldsetsPath = path.join(this.globalDataPath, "worldset")
				this.globalExtensionsPath = path.join(this.globalDataPath, "extension")
			} else {
				// 使用默认路径
				this.globalDataPath = this.defaultGlobalPath
				this.globalRolesPath = path.join(this.globalDataPath, "roles")
				this.globalHistoryPath = path.join(this.globalDataPath, "history", "global-history.json")
				this.globalTsProfilesPath = path.join(this.globalDataPath, "tsprofile")
				this.globalWorldBooksPath = path.join(this.globalDataPath, "worldbook")
				this.globalWorldsetsPath = path.join(this.globalDataPath, "worldset")
				this.globalExtensionsPath = path.join(this.globalDataPath, "extension")
			}
		} catch (error) {
			console.warn("Failed to get global storage path from settings, using default:", error)
			this.globalDataPath = this.defaultGlobalPath
			this.globalRolesPath = path.join(this.globalDataPath, "roles")
			this.globalHistoryPath = path.join(this.globalDataPath, "history", "global-history.json")
			this.globalTsProfilesPath = path.join(this.globalDataPath, "tsprofile")
			this.globalWorldBooksPath = path.join(this.globalDataPath, "worldbook")
			this.globalWorldsetsPath = path.join(this.globalDataPath, "worldset")
			this.globalExtensionsPath = path.join(this.globalDataPath, "extension")
		}
	}

	/**
	 * 获取全局历史记录
	 */
	async getGlobalHistory(): Promise<HistoryItem[]> {
		await this.ensureInitialized()
		return [...this.globalHistoryCache]
	}

	/**
	 * 添加全局历史记录项
	 */
	async addGlobalHistoryItem(item: Omit<HistoryItem, "id" | "ts" | "number">): Promise<HistoryItem> {
		await this.ensureInitialized()

		const historyItem: HistoryItem = {
			...item,
			id: uuidv4(),
			ts: Date.now(),
			number: this.globalHistoryCache.length + 1,
			scope: "global", // 标记为全局记录
		}

		this.globalHistoryCache.push(historyItem)
		await this.persistGlobalHistory()

		return historyItem
	}

	/**
	 * 删除全局历史记录项
	 */
	async deleteGlobalHistoryItem(id: string): Promise<boolean> {
		await this.ensureInitialized()

		const index = this.globalHistoryCache.findIndex(item => item.id === id)
		if (index === -1) {
			return false
		}

		this.globalHistoryCache.splice(index, 1)
		await this.persistGlobalHistory()

		return true
	}

	/**
	 * 清空全局历史记录
	 */
	async clearGlobalHistory(): Promise<void> {
		await this.ensureInitialized()
		this.globalHistoryCache = []
		await this.persistGlobalHistory()
	}

	/**
	 * 获取全局角色列表
	 */
	async getGlobalRoles(): Promise<Role[]> {
		await this.ensureInitialized()
		return Array.from(this.globalRolesCache.values())
	}

	/**
	 * 获取全局角色摘要列表
	 */
	async getGlobalRoleSummaries(): Promise<RoleSummary[]> {
		await this.ensureInitialized()
		const summaries: RoleSummary[] = []

		for (const role of this.globalRolesCache.values()) {
			const summary: RoleSummary = {
				uuid: role.uuid,
				name: role.name,
				type: role.type,
				scope: "global" as const,
				packagePath: role.packagePath || "",
				lastUpdatedAt: role.updatedAt || Date.now()
			}
			summaries.push(summary)
		}

		return summaries
	}

	/**
	 * 根据UUID获取全局角色
	 */
	async getGlobalRole(uuid: string): Promise<Role | undefined> {
		await this.ensureInitialized()
		return this.globalRolesCache.get(uuid)
	}

	/**
	 * 保存全局角色（包括角色定义和记忆）
	 */
	async saveGlobalRole(role: Role): Promise<void> {
		await this.ensureInitialized()

		// 确保角色具有正确的scope字段
		const globalRole = {
			...role,
			scope: "global" as const,
			updatedAt: Date.now()
		}

		// 保存角色定义
		this.globalRolesCache.set(role.uuid, globalRole)
		const rolePath = path.join(this.globalRolesPath, `${role.uuid}.json`)
		await safeWriteJson(rolePath, globalRole)

		// 确保全局记忆目录存在
		await this.ensureGlobalMemoryDirectory()

		console.log(`Global role saved: ${globalRole.name} (${globalRole.uuid})`)
	}

	/**
	 * 删除全局角色（包括角色定义和记忆）
	 */
	async deleteGlobalRole(uuid: string): Promise<boolean> {
		await this.ensureInitialized()

		// 删除角色定义
		const deleted = this.globalRolesCache.delete(uuid)
		if (deleted) {
			const rolePath = path.join(this.globalRolesPath, `${uuid}.json`)
			try {
				await fs.unlink(rolePath)
			} catch (error) {
				console.warn(`Failed to delete global role file: ${rolePath}`, error)
			}

			// 删除角色记忆
			await this.deleteGlobalRoleMemory(uuid)
		}

		return deleted
	}

	/**
	 * 复制工作区角色到全局（包括记忆）
	 */
	async copyRoleToGlobal(workspaceRole: Role, workspaceMemoryService: any): Promise<boolean> {
		try {
			// 保存角色定义
			await this.saveGlobalRole(workspaceRole)

			// 复制记忆数据
			const workspaceMemory = await workspaceMemoryService.loadMemory(workspaceRole.uuid)
			await this.saveGlobalRoleMemory(workspaceRole.uuid, workspaceMemory)

			console.log(`Role copied to global: ${workspaceRole.name} (with memory)`)
			return true
		} catch (error) {
			console.error(`Failed to copy role to global: ${workspaceRole.name}`, error)
			return false
		}
	}

	/**
	 * 复制全局角色到工作区（包括记忆）
	 */
	async copyGlobalRoleToWorkspace(globalRoleUuid: string, workspaceMemoryService: any): Promise<boolean> {
		try {
			// 获取全局角色
			const globalRole = await this.getGlobalRole(globalRoleUuid)
			if (!globalRole) {
				throw new Error(`Global role not found: ${globalRoleUuid}`)
			}

			// 复制记忆数据
			const globalMemory = await this.loadGlobalRoleMemory(globalRoleUuid)
			await workspaceMemoryService.saveMemory(globalRoleUuid, globalMemory)

			console.log(`Global role copied to workspace: ${globalRole.name} (with memory)`)
			return true
		} catch (error) {
			console.error(`Failed to copy global role to workspace: ${globalRoleUuid}`, error)
			return false
		}
	}

	/**
	 * 搜索全局历史记录
	 */
	async searchGlobalHistory(query: string): Promise<HistoryItem[]> {
		await this.ensureInitialized()

		if (!query.trim()) {
			return [...this.globalHistoryCache]
		}

		const lowerQuery = query.toLowerCase()
		return this.globalHistoryCache.filter(item =>
			item.task?.toLowerCase().includes(lowerQuery) ||
			item.anhRoleName?.toLowerCase().includes(lowerQuery)
		)
	}

	/**
	 * 获取全局存储路径信息
	 */
	getStorageInfo(): {
		defaultGlobalPath: string
		globalDataPath: string
		globalRolesPath: string
		globalHistoryPath: string
		globalTsProfilesPath: string
		globalWorldBooksPath: string
		globalWorldsetsPath: string
		globalExtensionsPath: string
		historyDir: string
	} {
		const historyDir = path.dirname(this.globalHistoryPath)
		return {
			defaultGlobalPath: this.defaultGlobalPath,
			globalDataPath: this.globalDataPath,
			globalRolesPath: this.globalRolesPath,
			globalHistoryPath: this.globalHistoryPath,
			globalTsProfilesPath: this.globalTsProfilesPath,
			globalWorldBooksPath: this.globalWorldBooksPath,
			globalWorldsetsPath: this.globalWorldsetsPath,
			globalExtensionsPath: this.globalExtensionsPath,
			historyDir,
		}
	}

	/**
	 * 获取默认存储路径
	 */
	getDefaultStoragePath(): string {
		return this.defaultGlobalPath
	}

	/**
	 * 获取当前存储路径
	 */
	getCurrentStoragePath(): string {
		return this.globalDataPath
	}

	// ========== TSProfile 相关方法 ==========

	/**
	 * 获取全局 TSProfile 路径
	 */
	getGlobalTsProfilesPath(): string {
		return this.globalTsProfilesPath
	}

	/**
	 * 保存全局 TSProfile 文件
	 */
	async saveGlobalTsProfile(profileName: string, profileData: any): Promise<void> {
		await this.ensureInitialized()

		const fileName = profileName.endsWith('.json') || profileName.endsWith('.jsonc')
			? profileName
			: `${profileName}.json`
		const filePath = path.join(this.globalTsProfilesPath, fileName)

		await safeWriteJson(filePath, profileData)
		console.log(`Global TSProfile saved: ${fileName}`)
	}

	/**
	 * 获取全局 TSProfile 文件列表
	 */
	async getGlobalTsProfiles(): Promise<string[]> {
		await this.ensureInitialized()

		try {
			const files = await fs.readdir(this.globalTsProfilesPath)
			return files.filter(file =>
				file.endsWith('.json') || file.endsWith('.jsonc')
			)
		} catch (error) {
			console.error("Failed to read global TSProfiles directory:", error)
			return []
		}
	}

	/**
	 * 读取全局 TSProfile 文件
	 */
	async loadGlobalTsProfile(fileName: string): Promise<any | null> {
		await this.ensureInitialized()

		const filePath = path.join(this.globalTsProfilesPath, fileName)

		if (!(await fileExistsAtPath(filePath))) {
			return null
		}

		try {
			const data = await fs.readFile(filePath, "utf8")
			return JSON.parse(data)
		} catch (error) {
			console.error(`Failed to load global TSProfile ${fileName}:`, error)
			return null
		}
	}

	/**
	 * 删除全局 TSProfile 文件
	 */
	async deleteGlobalTsProfile(fileName: string): Promise<boolean> {
		await this.ensureInitialized()

		const filePath = path.join(this.globalTsProfilesPath, fileName)

		try {
			await fs.unlink(filePath)
			console.log(`Global TSProfile deleted: ${fileName}`)
			return true
		} catch (error) {
			console.error(`Failed to delete global TSProfile ${fileName}:`, error)
			return false
		}
	}

	// ========== WorldBook 相关方法 ==========

	/**
	 * 获取全局 WorldBook 路径
	 */
	getGlobalWorldBooksPath(): string {
		return this.globalWorldBooksPath
	}

	/**
	 * 获取全局 WorldBook 文件列表
	 */
	async getGlobalWorldBooks(): Promise<string[]> {
		await this.ensureInitialized()

		try {
			// 检查目录是否存在
			try {
				await fs.access(this.globalWorldBooksPath)
			} catch (error) {
				console.warn(`Global WorldBooks directory does not exist: ${this.globalWorldBooksPath}`)
				// 如果目录不存在，创建它
				await fs.mkdir(this.globalWorldBooksPath, { recursive: true })
				console.log(`Created Global WorldBooks directory: ${this.globalWorldBooksPath}`)
			}

			const files = await fs.readdir(this.globalWorldBooksPath)
			const filteredFiles = files.filter(file =>
				file.endsWith('.json') || file.endsWith('.jsonl')
			)

			console.log(`Found ${filteredFiles.length} global WorldBook files in ${this.globalWorldBooksPath}: ${filteredFiles.join(', ')}`)
			return filteredFiles
		} catch (error) {
			console.error("Failed to read global WorldBooks directory:", error)
			console.error("Directory path:", this.globalWorldBooksPath)
			return []
		}
	}

	/**
	 * 读取全局 WorldBook 文件
	 */
	async loadGlobalWorldBook(fileName: string): Promise<any | null> {
		await this.ensureInitialized()

		const filePath = path.join(this.globalWorldBooksPath, fileName)

		if (!(await fileExistsAtPath(filePath))) {
			return null
		}

		try {
			const data = await fs.readFile(filePath, "utf8")
			return JSON.parse(data)
		} catch (error) {
			console.error(`Failed to load global WorldBook ${fileName}:`, error)
			return null
		}
	}

	/**
	 * 保存全局 WorldBook 文件
	 */
	async saveGlobalWorldBook(fileName: string, worldBookData: any): Promise<void> {
		await this.ensureInitialized()

		const filePath = path.join(this.globalWorldBooksPath, fileName)
		await safeWriteJson(filePath, worldBookData)
		console.log(`Global WorldBook saved: ${fileName}`)
	}

	/**
	 * 删除全局 WorldBook 文件
	 */
	async deleteGlobalWorldBook(fileName: string): Promise<boolean> {
		await this.ensureInitialized()

		const filePath = path.join(this.globalWorldBooksPath, fileName)

		try {
			await fs.unlink(filePath)
			console.log(`Global WorldBook deleted: ${fileName}`)
			return true
		} catch (error) {
			console.error(`Failed to delete global WorldBook ${fileName}:`, error)
			return false
		}
	}

	// ========== Worldset 相关方法 ==========

	/**
	 * 获取全局 Worldset 路径
	 */
	getGlobalWorldsetsPath(): string {
		return this.globalWorldsetsPath
	}

	/**
	 * 获取全局 Worldset 文件列表
	 */
	async getGlobalWorldsets(): Promise<string[]> {
		await this.ensureInitialized()

		try {
			const files = await fs.readdir(this.globalWorldsetsPath)
			return files.filter(file =>
				file.endsWith('.md') || file.endsWith('.json') || file.endsWith('.jsonc')
			)
		} catch (error) {
			console.error("Failed to read global Worldsets directory:", error)
			return []
		}
	}

	/**
	 * 读取全局 Worldset 文件
	 */
	async loadGlobalWorldset(fileName: string): Promise<any | null> {
		await this.ensureInitialized()

		const filePath = path.join(this.globalWorldsetsPath, fileName)

		if (!(await fileExistsAtPath(filePath))) {
			return null
		}

		try {
			const data = await fs.readFile(filePath, "utf8")
			// 如果是.md文件，直接返回文本内容；如果是.json文件，解析JSON
			if (fileName.endsWith('.md')) {
				return { content: data, type: 'markdown' }
			} else {
				return JSON.parse(data)
			}
		} catch (error) {
			console.error(`Failed to load global Worldset ${fileName}:`, error)
			return null
		}
	}

	/**
	 * 保存全局 Worldset 文件
	 */
	async saveGlobalWorldset(fileName: string, worldsetData: any): Promise<void> {
		await this.ensureInitialized()

		const filePath = path.join(this.globalWorldsetsPath, fileName)
		await safeWriteJson(filePath, worldsetData)
		console.log(`Global Worldset saved: ${fileName}`)
	}

	/**
	 * 删除全局 Worldset 文件
	 */
	async deleteGlobalWorldset(fileName: string): Promise<boolean> {
		await this.ensureInitialized()

		const filePath = path.join(this.globalWorldsetsPath, fileName)

		try {
			await fs.unlink(filePath)
			console.log(`Global Worldset deleted: ${fileName}`)
			return true
		} catch (error) {
			console.error(`Failed to delete global Worldset ${fileName}:`, error)
			return false
		}
	}

	// ========== WorldBook Mixin 相关方法 ==========

	/**
	 * 获取全局世界书Mixin路径
	 */
	getGlobalWorldBookMixinsPath(): string {
		return path.join(this.globalWorldBooksPath, "mixins")
	}

	/**
	 * 获取全局世界书Mixin路径（别名方法，用于兼容）
	 */
	async getGlobalWorldBookMixinPath(): Promise<string> {
		await this.ensureInitialized()
		return this.getGlobalWorldBookMixinsPath()
	}

	/**
	 * 确保全局世界书Mixin目录存在
	 */
	async ensureGlobalWorldBookMixinsDirectory(): Promise<string> {
		await this.ensureInitialized()
		const mixinsPath = this.getGlobalWorldBookMixinsPath()
		await fs.mkdir(mixinsPath, { recursive: true })
		return mixinsPath
	}

	/**
	 * 保存全局世界书Mixin配置
	 */
	async saveGlobalWorldBookMixin(worldBookPath: string, mixinData: any): Promise<void> {
		await this.ensureInitialized()
		await this.ensureGlobalWorldBookMixinsDirectory()

		const fileName = `${path.basename(worldBookPath, path.extname(worldBookPath))}.mixin.json`
		const mixinPath = path.join(this.getGlobalWorldBookMixinsPath(), fileName)

		await safeWriteJson(mixinPath, mixinData)
		console.log(`Global world book mixin saved: ${fileName}`)
	}

	/**
	 * 加载全局世界书Mixin配置
	 */
	async loadGlobalWorldBookMixin(worldBookPath: string): Promise<any | null> {
		await this.ensureInitialized()
		await this.ensureGlobalWorldBookMixinsDirectory()

		const fileName = `${path.basename(worldBookPath, path.extname(worldBookPath))}.mixin.json`
		const mixinPath = path.join(this.getGlobalWorldBookMixinsPath(), fileName)

		if (!(await fileExistsAtPath(mixinPath))) {
			return null
		}

		try {
			const data = await fs.readFile(mixinPath, "utf8")
			return JSON.parse(data)
		} catch (error) {
			console.error(`Failed to load global world book mixin ${fileName}:`, error)
			return null
		}
	}

	/**
	 * 删除全局世界书Mixin配置
	 */
	async deleteGlobalWorldBookMixin(worldBookPath: string): Promise<boolean> {
		await this.ensureInitialized()

		const fileName = `${path.basename(worldBookPath, path.extname(worldBookPath))}.mixin.json`
		const mixinPath = path.join(this.getGlobalWorldBookMixinsPath(), fileName)

		try {
			if (await fileExistsAtPath(mixinPath)) {
				await fs.unlink(mixinPath)
				console.log(`Global world book mixin deleted: ${fileName}`)
				return true
			}
			return false
		} catch (error) {
			console.error(`Failed to delete global world book mixin ${fileName}:`, error)
			return false
		}
	}

	/**
	 * 获取全局世界书Mixin列表
	 */
	async getGlobalWorldBookMixins(): Promise<string[]> {
		await this.ensureInitialized()
		await this.ensureGlobalWorldBookMixinsDirectory()

		try {
			const files = await fs.readdir(this.getGlobalWorldBookMixinsPath())
			return files.filter(file => file.endsWith('.mixin.json'))
		} catch (error) {
			console.error("Failed to read global world book mixins directory:", error)
			return []
		}
	}

	// ========== Extension 相关方法 ==========

	/**
	 * 获取全局扩展路径
	 */
	getGlobalExtensionsPath(): string {
		return this.globalExtensionsPath
	}

	/**
	 * 获取全局扩展目录信息
	 */
	async getGlobalExtensionsInfo(): Promise<{
		exists: boolean
		path: string
		extensions: string[]
	}> {
		await this.ensureInitialized()

		try {
			await fs.access(this.globalExtensionsPath)

			const entries = await fs.readdir(this.globalExtensionsPath, { withFileTypes: true })
			const extensions = entries
				.filter(entry => entry.isDirectory())
				.map(entry => entry.name)

			return {
				exists: true,
				path: this.globalExtensionsPath,
				extensions
			}
		} catch (error) {
			return {
				exists: false,
				path: this.globalExtensionsPath,
				extensions: []
			}
		}
	}

	/**
	 * 创建全局扩展目录
	 */
	async ensureGlobalExtensionsDirectory(): Promise<string> {
		await this.ensureInitialized()
		await fs.mkdir(this.globalExtensionsPath, { recursive: true })
		return this.globalExtensionsPath
	}

	/**
	 * 复制扩展到全局目录
	 */
	async copyExtensionToGlobal(sourceExtensionPath: string, extensionName: string): Promise<boolean> {
		await this.ensureInitialized()

		try {
			const targetPath = path.join(this.globalExtensionsPath, extensionName)

			// 如果目标目录已存在，先删除
			if (await fileExistsAtPath(targetPath)) {
				await fs.rm(targetPath, { recursive: true, force: true })
			}

			// 复制整个扩展目录
			await this.copyDirectory(sourceExtensionPath, targetPath)

			console.log(`Extension copied to global: ${extensionName}`)
			return true
		} catch (error) {
			console.error(`Failed to copy extension ${extensionName} to global:`, error)
			return false
		}
	}

	/**
	 * 从全局目录删除扩展
	 */
	async deleteGlobalExtension(extensionName: string): Promise<boolean> {
		await this.ensureInitialized()

		try {
			const extensionPath = path.join(this.globalExtensionsPath, extensionName)

			if (await fileExistsAtPath(extensionPath)) {
				await fs.rm(extensionPath, { recursive: true, force: true })
				console.log(`Global extension deleted: ${extensionName}`)
				return true
			}

			return false
		} catch (error) {
			console.error(`Failed to delete global extension ${extensionName}:`, error)
			return false
		}
	}

	/**
	 * 递归复制目录
	 */
	private async copyDirectory(source: string, target: string): Promise<void> {
		await fs.mkdir(target, { recursive: true })
		const entries = await fs.readdir(source, { withFileTypes: true })

		for (const entry of entries) {
			const sourcePath = path.join(source, entry.name)
			const targetPath = path.join(target, entry.name)

			if (entry.isDirectory()) {
				await this.copyDirectory(sourcePath, targetPath)
			} else {
				await fs.copyFile(sourcePath, targetPath)
			}
		}
	}

	// ========== 全局记忆系统相关方法 ==========

	/**
	 * 获取全局记忆目录路径
	 */
	getGlobalMemoryPath(): string {
		return path.join(this.globalDataPath, "memory")
	}

	/**
	 * 获取角色记忆文件路径
	 */
	getRoleMemoryPath(roleUuid: string): string {
		return path.join(this.getGlobalMemoryPath(), roleUuid, "memory.json")
	}

	/**
	 * 确保全局记忆目录存在
	 */
	async ensureGlobalMemoryDirectory(): Promise<string> {
		await this.ensureInitialized()
		const memoryPath = this.getGlobalMemoryPath()
		await fs.mkdir(memoryPath, { recursive: true })
		return memoryPath
	}

	/**
	 * 加载全局角色记忆
	 */
	async loadGlobalRoleMemory(roleUuid: string): Promise<any> {
		await this.ensureInitialized()
		await this.ensureGlobalMemoryDirectory()

		const filePath = this.getRoleMemoryPath(roleUuid)

		if (!(await fileExistsAtPath(filePath))) {
			return this.createEmptyMemory(roleUuid)
		}

		try {
			const raw = await fs.readFile(filePath, "utf8")
			const parsed = JSON.parse(raw)
			return {
				...this.createEmptyMemory(roleUuid),
				...parsed,
			}
		} catch (error) {
			console.error(`Failed to load global memory for role ${roleUuid}:`, error)
			return this.createEmptyMemory(roleUuid)
		}
	}

	/**
	 * 保存全局角色记忆
	 */
	async saveGlobalRoleMemory(roleUuid: string, memory: any): Promise<void> {
		await this.ensureInitialized()
		await this.ensureGlobalMemoryDirectory()

		const filePath = this.getRoleMemoryPath(roleUuid)
		await fs.mkdir(path.dirname(filePath), { recursive: true })
		await safeWriteJson(filePath, memory)
	}

	/**
	 * 添加情景记忆
	 */
	async appendGlobalEpisodicMemory(roleUuid: string, record: any): Promise<void> {
		const memory = await this.loadGlobalRoleMemory(roleUuid)
		memory.episodic = memory.episodic || []
		memory.episodic.push(record)
		memory.lastSyncedAt = Date.now()
		await this.saveGlobalRoleMemory(roleUuid, memory)
	}

	/**
	 * 更新语义记忆
	 */
	async upsertGlobalSemanticMemory(roleUuid: string, record: any): Promise<void> {
		const memory = await this.loadGlobalRoleMemory(roleUuid)
		memory.semantic = memory.semantic || []
		const index = memory.semantic.findIndex((item: any) => item.id === record.id)
		if (index >= 0) {
			memory.semantic[index] = record
		} else {
			memory.semantic.push(record)
		}
		memory.lastSyncedAt = Date.now()
		await this.saveGlobalRoleMemory(roleUuid, memory)
	}

	/**
	 * 更新角色特征
	 */
	async updateGlobalRoleTraits(roleUuid: string, traits: any[]): Promise<void> {
		const memory = await this.loadGlobalRoleMemory(roleUuid)
		memory.traits = traits
		memory.lastSyncedAt = Date.now()
		await this.saveGlobalRoleMemory(roleUuid, memory)
	}

	/**
	 * 更新角色目标
	 */
	async updateGlobalRoleGoals(roleUuid: string, goals: any[]): Promise<void> {
		const memory = await this.loadGlobalRoleMemory(roleUuid)
		memory.goals = goals
		memory.lastSyncedAt = Date.now()
		await this.saveGlobalRoleMemory(roleUuid, memory)
	}

	/**
	 * 获取全局角色记忆统计
	 */
	async getGlobalRoleMemoryStats(roleUuid: string): Promise<{
		episodicCount: number
		semanticCount: number
		traitsCount: number
		goalsCount: number
		lastSyncedAt?: number
	}> {
		const memory = await this.loadGlobalRoleMemory(roleUuid)
		return {
			episodicCount: memory.episodic?.length || 0,
			semanticCount: memory.semantic?.length || 0,
			traitsCount: memory.traits?.length || 0,
			goalsCount: memory.goals?.length || 0,
			lastSyncedAt: memory.lastSyncedAt,
		}
	}

	/**
	 * 删除全局角色记忆
	 */
	async deleteGlobalRoleMemory(roleUuid: string): Promise<boolean> {
		await this.ensureInitialized()
		const roleMemoryPath = path.join(this.getGlobalMemoryPath(), roleUuid)

		try {
			if (await fileExistsAtPath(roleMemoryPath)) {
				await fs.rm(roleMemoryPath, { recursive: true, force: true })
				console.log(`Global role memory deleted: ${roleUuid}`)
				return true
			}
			return false
		} catch (error) {
			console.error(`Failed to delete global role memory ${roleUuid}:`, error)
			return false
		}
	}

	/**
	 * 获取所有全局角色记忆列表
	 */
	async listGlobalRoleMemories(): Promise<string[]> {
		await this.ensureInitialized()
		await this.ensureGlobalMemoryDirectory()

		try {
			const entries = await fs.readdir(this.getGlobalMemoryPath(), { withFileTypes: true })
			return entries
				.filter(entry => entry.isDirectory())
				.map(entry => entry.name)
		} catch (error) {
			console.error("Failed to list global role memories:", error)
			return []
		}
	}

	/**
	 * 创建空记忆结构
	 */
	private createEmptyMemory(roleUuid: string): any {
		return {
			characterUuid: roleUuid,
			episodic: [],
			semantic: [],
			traits: [],
			goals: [],
		}
	}

	private async ensureInitialized(): Promise<void> {
		if (!this.initialized) {
			await this.initialize()
		}
	}

	private async loadGlobalHistory(): Promise<void> {
		try {
			if (await fileExistsAtPath(this.globalHistoryPath)) {
				const data = await fs.readFile(this.globalHistoryPath, "utf8")
				const history: HistoryItem[] = JSON.parse(data)
				this.globalHistoryCache = history.map(item => ({
					...item,
					scope: "global" // 确保所有记录都标记为全局
				}))
				console.log(`Loaded ${this.globalHistoryCache.length} global history items`)
			} else {
				this.globalHistoryCache = []
				console.log("Global history file not found, starting with empty history")
			}
		} catch (error) {
			console.error("Failed to load global history:", error)
			this.globalHistoryCache = []
		}
	}

	private async loadGlobalRoles(): Promise<void> {
		try {
			const files = await fs.readdir(this.globalRolesPath)
			const roleFiles = files.filter(file => file.endsWith('.json'))

			for (const file of roleFiles) {
				const filePath = path.join(this.globalRolesPath, file)
				try {
					const data = await fs.readFile(filePath, "utf8")
					const role: Role = JSON.parse(data)
					// 确保加载的全局角色具有正确的scope字段
					const globalRole = {
						...role,
						scope: "global" as const
					}
					this.globalRolesCache.set(role.uuid, globalRole)
				} catch (error) {
					console.error(`Failed to load global role from ${file}:`, error)
				}
			}

			// 自动检测并导入同目录下的SillyTavern PNG卡片
			await this.autoDetectGlobalSillyTavernCards()

			console.log(`Loaded ${this.globalRolesCache.size} global roles`)
		} catch (error) {
			console.error("Failed to load global roles:", error)
		}
	}

	/**
	 * 自动检测并导入全局目录下的SillyTavern卡片（PNG和JSON）
	 */
	private async autoDetectGlobalSillyTavernCards() {
		try {
			debugLog(`Scanning for SillyTavern files in global roles directory: ${this.globalRolesPath}`)

			// 扫描全局角色目录下的文件
			const files = await fs.readdir(this.globalRolesPath)
			const supportedFiles = files.filter(file => {
				const ext = file.toLowerCase().split('.').pop()
				return ext === 'png' || ext === 'json'
			})

			debugLog(`Found ${supportedFiles.length} supported files in global directory: ${supportedFiles.join(', ')}`)

			for (const file of supportedFiles) {
				const filePath = path.join(this.globalRolesPath, file)
				const ext = file.toLowerCase().split('.').pop()
				
				if (!ext) continue // 跳过没有扩展名的文件
				
				debugLog(`Processing global ${ext.toUpperCase()} file: ${filePath}`)
				
				try {
					// 获取文件的修改时间
					const fileStats = await fs.stat(filePath)
					const fileModifiedTime = fileStats.mtime.getTime()
					
					let parseResult: any
					
					// 根据文件扩展名选择解析方法
					if (ext === 'png') {
						parseResult = await SillyTavernParser.parseFromPngFile(filePath)
					} else if (ext === 'json') {
						// 读取JSON文件内容
						const jsonContent = await fs.readFile(filePath, 'utf8')
						parseResult = SillyTavernParser.parseFromJson(jsonContent)
					}
					
					debugLog(`Parse result for global ${file}:`, parseResult.success ? 'SUCCESS' : 'FAILED', parseResult.error || '', parseResult.cardVersion || '')
					
					if (parseResult.success && parseResult.role) {
						const role = parseResult.role
						
						// 检查是否已经存在相同名称的角色
						const existingRole = Array.from(this.globalRolesCache.values())
							.find(existing => existing.name === role.name)
						
						if (!existingRole) {
							// parseResult.role 已经是通过 SillyTavernParser 完全转换后的 anh 角色
							// 不需要再次转换，只需要确保字段完整性
							const anhRole: Role = {
								...role,
								// 标记为SillyTavern类型
								type: "SillyTavernRole",
								// 确保必要的anh字段存在（如果转换器没有提供的话）
								profile: role.profile || {
									greeting: role.first_mes || `Hello, I'm ${role.name}.`,
									appearance: role.description || "",
									personality: role.personality || "",
									background: role.scenario || "",
									relationships: [],
									skills: [],
									equipment: []
								},
								modeOverrides: role.modeOverrides || {},
								scope: "global" as const, // 标记为全局角色
								createdAt: role.createdAt || fileModifiedTime,
								updatedAt: role.updatedAt || fileModifiedTime
							}

							// 将角色添加到全局缓存（内存中，不写入文件）
							this.globalRolesCache.set(anhRole.uuid, anhRole)
							
							debugLog(`Auto-imported global SillyTavern card: ${anhRole.name} from ${file} (${parseResult.cardVersion || 'unknown'} version, memory only, converted to anh format)`)
						} else {
							debugLog(`Skipped global ${file}: role ${role.name} already exists`)
						}
					}
				} catch (parseError) {
					// 如果解析失败，可能不是有效的SillyTavern文件，跳过
					debugLog(`Skipped global ${file}: parsing failed -`, parseError)
				}
			}
		} catch (error) {
			console.error("Error during global SillyTavern card auto-detection:", error)
		}
	}

	private async persistGlobalHistory(): Promise<void> {
		try {
			await safeWriteJson(this.globalHistoryPath, this.globalHistoryCache)
		} catch (error) {
			console.error("Failed to persist global history:", error)
			throw error
		}
	}

	/**
	 * 重新初始化服务（当存储路径变更时使用）
	 */
	async reinitialize(): Promise<void> {
		this.initialized = false
		this.globalHistoryCache = []
		this.globalRolesCache.clear()
		await this.initialize()
	}
}

// 单例实例
let globalStorageInstance: GlobalStorageService | null = null

export async function getGlobalStorageService(context: vscode.ExtensionContext): Promise<GlobalStorageService> {
	if (!globalStorageInstance) {
		globalStorageInstance = new GlobalStorageService(context)
		await globalStorageInstance.initialize()
	}
	return globalStorageInstance
}

/**
 * 获取全局存储服务实例（不自动初始化）
 */
export function getGlobalStorageServiceInstance(): GlobalStorageService | null {
	return globalStorageInstance
}
