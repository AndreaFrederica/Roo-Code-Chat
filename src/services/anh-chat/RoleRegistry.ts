import * as path from "path"
import * as fs from "fs/promises"

import type { Role, RoleSummary } from "@roo-code/types"
import { fileExistsAtPath } from "../../utils/fs"
import { safeWriteJson } from "../../utils/safeWriteJson"

import { ensureAnhChatRoot } from "./pathUtils"

export class RoleRegistry {
	private readonly rolesDir: string
	private roleCache = new Map<string, Role>()
	private summaryCache = new Map<string, RoleSummary>()
	private initialized = false

	private constructor(private readonly rootDir: string) {
		this.rolesDir = path.join(rootDir, "roles")
	}

	getDefaultRoleUuid(): string | undefined {
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

		const indexPath = path.join(this.rolesDir, "index.json")
		if (await fileExistsAtPath(indexPath)) {
			try {
				const summaries: RoleSummary[] = JSON.parse(await fs.readFile(indexPath, "utf8"))
				summaries.forEach((summary) => this.summaryCache.set(summary.uuid, summary))
			} catch (error) {
				console.error("Failed to parse role index", error)
			}
		}

		this.initialized = true
	}

	listSummaries(): RoleSummary[] {
		return Array.from(this.summaryCache.values())
	}

	getRole(uuid: string): Role | undefined {
		return this.roleCache.get(uuid)
	}

	async loadRole(uuid: string): Promise<Role | undefined> {
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
		await fs.mkdir(this.rolesDir, { recursive: true })
		const rolePath = path.join(this.rolesDir, `${uuid}.json`)
		await safeWriteJson(rolePath, role)
		this.roleCache.set(uuid, role)
		this.summaryCache.set(uuid, summary)
		await this.persistIndex()
	}

	private async persistIndex() {
		const indexPath = path.join(this.rolesDir, "index.json")
		await safeWriteJson(indexPath, this.listSummaries())
	}
}
