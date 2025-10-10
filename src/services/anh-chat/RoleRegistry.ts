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
				summaries.forEach((summary) => this.summaryCache.set(summary.uuid, summary))
			} catch (error) {
				console.error("Failed to parse role index", error)
			}
		}

		// 自动检测并导入同目录下的SillyTavern PNG卡片
		await this.autoDetectSillyTavernCards()

		this.initialized = true
	}

	listSummaries(): RoleSummary[] {
		return [
			...Array.from(this.builtinSummaries.values()).map(cloneSummary),
			...Array.from(this.summaryCache.values()).map(cloneSummary),
		]
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
		this.roleCache.set(uuid, parsed)
		return parsed
	}

	async saveRole(uuid: string, role: Role, summary: RoleSummary) {
		if (this.builtinRoles.has(uuid)) {
			throw new Error("Built-in roles cannot be overwritten")
		}

		await fs.mkdir(this.rolesDir, { recursive: true })
		const rolePath = path.join(this.rolesDir, `${uuid}.json`)
		await safeWriteJson(rolePath, role)
		this.roleCache.set(uuid, role)
		this.summaryCache.set(uuid, summary)
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
	 * 自动检测并导入同目录下的SillyTavern PNG卡片
	 */
	private async autoDetectSillyTavernCards() {
		try {
			console.log(`Scanning for SillyTavern PNG files in: ${this.rolesDir}`)
			
			// 扫描角色目录下的PNG文件
			const files = await fs.readdir(this.rolesDir)
			const pngFiles = files.filter(file => file.toLowerCase().endsWith('.png'))
			
			console.log(`Found ${pngFiles.length} PNG files: ${pngFiles.join(', ')}`)

			for (const pngFile of pngFiles) {
				const pngPath = path.join(this.rolesDir, pngFile)
				console.log(`Processing PNG file: ${pngPath}`)
				
				try {
					// 获取PNG文件的修改时间
					const pngStats = await fs.stat(pngPath)
					const pngModifiedTime = pngStats.mtime.getTime()
					
					// 尝试解析PNG文件
					const parseResult = await SillyTavernParser.parseFromPngFile(pngPath)
					console.log(`Parse result for ${pngFile}:`, parseResult.success ? 'SUCCESS' : 'FAILED', parseResult.error || '')
					
					if (parseResult.success && parseResult.role) {
						const role = parseResult.role
						
						// 检查是否已经存在相同名称的角色
						const existingRole = Array.from(this.summaryCache.values())
							.find(summary => summary.name === role.name)
						
						if (!existingRole) {
							// 使用转换器将SillyTavern角色转换为完整的anh格式
							// parseResult.role 已经是通过 SillyTavernParser.convertToRole 转换后的完整anh角色
							const anhRole: Role = {
								...role,
								// 标记为SillyTavern类型
								type: "SillyTavernRole",
								// 确保必要的anh字段存在
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
								createdAt: role.createdAt || pngModifiedTime,
								updatedAt: role.updatedAt || pngModifiedTime
							}
							
							// 创建角色摘要
							const summary: RoleSummary = {
								uuid: anhRole.uuid,
								name: anhRole.name,
								type: "SillyTavernRole", // 标记为SillyTavern类型
								packagePath: pngPath, // 使用PNG文件的完整路径作为packagePath
								lastUpdatedAt: pngModifiedTime
							}

							// 直接添加到内存缓存，不写入文件
							this.summaryCache.set(anhRole.uuid, summary)
							this.roleCache.set(anhRole.uuid, anhRole)
							
							console.log(`Auto-imported SillyTavern card: ${anhRole.name} from ${pngFile} (memory only, converted to anh format)`)
						} else {
							console.log(`Skipped ${pngFile}: role ${role.name} already exists`)
						}
					}
				} catch (parseError) {
					// 如果解析失败，可能不是有效的SillyTavern PNG，跳过
					console.log(`Skipped ${pngFile}: parsing failed -`, parseError)
				}
			}
		} catch (error) {
			console.error("Error during SillyTavern card auto-detection:", error)
		}
	}
}

const cloneRole = (role: Role): Role => JSON.parse(JSON.stringify(role)) as Role
const cloneSummary = (summary: RoleSummary): RoleSummary => ({ ...summary })
