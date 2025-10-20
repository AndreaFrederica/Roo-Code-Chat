import * as path from "path"
import * as fs from "fs/promises"

import {
	type Role,
	type RoleSummary,
	DEFAULT_ASSISTANT_ROLE,
	DEFAULT_ASSISTANT_ROLE_SUMMARY,
	DEFAULT_ASSISTANT_ROLE_UUID,
} from "@roo-code/types"
import { fileExistsAtPath } from "../../utils/fs"
import { safeWriteJson } from "../../utils/safeWriteJson"
import { SillyTavernParser } from "../../utils/sillytavern-parser"
import { debugLog } from "../../utils/debug"

import { ensureAnhChatRoot } from "./pathUtils"

export class RoleRegistry {
	private readonly rolesDir: string
	private roleCache = new Map<string, Role>()
	private summaryCache = new Map<string, RoleSummary>()
	private initialized = false
	private readonly builtinRoles = new Map<string, Role>([
		[DEFAULT_ASSISTANT_ROLE_UUID, DEFAULT_ASSISTANT_ROLE],
	])
	private readonly builtinSummaries = new Map<string, RoleSummary>([
		[DEFAULT_ASSISTANT_ROLE_UUID, DEFAULT_ASSISTANT_ROLE_SUMMARY],
	])

	private constructor(private readonly rootDir: string) {
		this.rolesDir = path.join(rootDir, "roles")
	}

	getDefaultRoleUuid(): string | undefined {
		const builtinIterator = this.builtinSummaries.keys()
		const builtinFirst = builtinIterator.next()
		if (!builtinFirst.done) {
			return builtinFirst.value
		}

		const iterator = this.summaryCache.values()
		const first = iterator.next()
		return first.done ? undefined : first.value.uuid
	}

	static async create(basePath: string) {
		const rootDir = await ensureAnhChatRoot(basePath)
		const registry = new RoleRegistry(rootDir)
		await registry.initialize()
		return registry
	}

	private async initialize() {
		if (this.initialized) {
			return
		}

		await fs.mkdir(this.rolesDir, { recursive: true })

		// 加载现有的角色索引
		const indexPath = path.join(this.rolesDir, "index.json")
		if (await fileExistsAtPath(indexPath)) {
			try {
				const summaries: RoleSummary[] = JSON.parse(await fs.readFile(indexPath, "utf8"))
				summaries.forEach((summary) => {
					// Ensure scope is set for existing roles
					const summaryWithScope: RoleSummary = {
						...summary,
						scope: summary.scope || "workspace" as const
					}
					this.summaryCache.set(summary.uuid, summaryWithScope)
				})
			} catch (error) {
				console.error("Failed to parse role index", error)
			}
		}

		// 自动检测并导入同目录下的SillyTavern PNG卡片
		await this.autoDetectSillyTavernCards()

		this.initialized = true
	}

	listSummaries(): RoleSummary[] {
		const builtinSummaries = Array.from(this.builtinSummaries.values()).map(cloneSummary)
		const workspaceSummaries = Array.from(this.summaryCache.values()).map(cloneSummary).map(summary => ({
			...summary,
			scope: summary.scope || "workspace" as const // Ensure scope is set, default to workspace
		}))

		return [...builtinSummaries, ...workspaceSummaries]
	}

	getRole(uuid: string): Role | undefined {
		if (this.builtinRoles.has(uuid)) {
			return cloneRole(this.builtinRoles.get(uuid)!)
		}
		return this.roleCache.get(uuid)
	}

	async loadRole(uuid: string): Promise<Role | undefined> {
		if (this.builtinRoles.has(uuid)) {
			return cloneRole(this.builtinRoles.get(uuid)!)
		}

		const cached = this.roleCache.get(uuid)
		if (cached) {
			return cached
		}

		const rolePath = path.join(this.rolesDir, `${uuid}.json`)
		if (!(await fileExistsAtPath(rolePath))) {
			return undefined
		}

		const raw = await fs.readFile(rolePath, "utf8")
		const parsed: Role = JSON.parse(raw)
		
		// 确保加载的工作区角色具有正确的scope字段
		const roleWithScope: Role = {
			...parsed,
			scope: parsed.scope || "workspace" as const
		}
		
		this.roleCache.set(uuid, roleWithScope)
		return roleWithScope
	}

	async saveRole(uuid: string, role: Role, summary: RoleSummary) {
		if (this.builtinRoles.has(uuid)) {
			throw new Error("Built-in roles cannot be overwritten")
		}

		// 确保工作区角色具有正确的scope字段
		const workspaceRole = {
			...role,
			scope: "workspace" as const,
			updatedAt: Date.now()
		}

		const workspaceSummary = {
			...summary,
			scope: "workspace" as const,
			lastUpdatedAt: Date.now()
		}

		await fs.mkdir(this.rolesDir, { recursive: true })
		const rolePath = path.join(this.rolesDir, `${uuid}.json`)
		await safeWriteJson(rolePath, workspaceRole)
		this.roleCache.set(uuid, workspaceRole)
		this.summaryCache.set(uuid, workspaceSummary)
		await this.persistIndex()
	}

	public async reload() {
		this.initialized = false
		this.roleCache.clear()
		this.summaryCache.clear()
		await this.initialize()
	}

	private async persistIndex() {
		const indexPath = path.join(this.rolesDir, "index.json")
		await safeWriteJson(indexPath, Array.from(this.summaryCache.values()))
	}

	/**
	 * 自动检测并导入同目录下的SillyTavern卡片（PNG和JSON）
	 */
	private async autoDetectSillyTavernCards() {
		try {
			debugLog(`Scanning for SillyTavern files in: ${this.rolesDir}`)

			// 扫描角色目录下的文件
			const files = await fs.readdir(this.rolesDir)
			const supportedFiles = files.filter(file => {
				const ext = file.toLowerCase().split('.').pop()
				return ext === 'png' || ext === 'json'
			})

			debugLog(`Found ${supportedFiles.length} supported files: ${supportedFiles.join(', ')}`)

			for (const file of supportedFiles) {
				const filePath = path.join(this.rolesDir, file)
				const ext = file.toLowerCase().split('.').pop()
				
				if (!ext) continue // 跳过没有扩展名的文件
				
				debugLog(`Processing ${ext.toUpperCase()} file: ${filePath}`)
				
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
					
					debugLog(`Parse result for ${file}:`, parseResult.success ? 'SUCCESS' : 'FAILED', parseResult.error || '', parseResult.cardVersion || '')
					
					if (parseResult.success && parseResult.role) {
						const role = parseResult.role
						
						// 检查是否已经存在相同名称的角色
						const existingRole = Array.from(this.summaryCache.values())
							.find(summary => summary.name === role.name)
						
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
								createdAt: role.createdAt || fileModifiedTime,
								updatedAt: role.updatedAt || fileModifiedTime
							}
							
							// 创建角色摘要
							const summary: RoleSummary = {
								uuid: anhRole.uuid,
								name: anhRole.name,
								type: "SillyTavernRole", // 标记为SillyTavern类型
								scope: "workspace", // 工作区角色
								packagePath: filePath, // 使用文件的完整路径作为packagePath
								lastUpdatedAt: fileModifiedTime
							}

							// 直接添加到内存缓存，不写入文件
							this.summaryCache.set(anhRole.uuid, summary)
							this.roleCache.set(anhRole.uuid, anhRole)
							
							debugLog(`Auto-imported SillyTavern card: ${anhRole.name} from ${file} (${parseResult.cardVersion || 'unknown'} version, memory only, converted to anh format)`)
						} else {
							debugLog(`Skipped ${file}: role ${role.name} already exists`)
						}
					}
				} catch (parseError) {
					// 如果解析失败，可能不是有效的SillyTavern文件，跳过
					debugLog(`Skipped ${file}: parsing failed -`, parseError)
				}
			}
		} catch (error) {
			console.error("Error during SillyTavern card auto-detection:", error)
		}
	}
}

const cloneRole = (role: Role): Role => JSON.parse(JSON.stringify(role)) as Role
const cloneSummary = (summary: RoleSummary): RoleSummary => ({ ...summary })
