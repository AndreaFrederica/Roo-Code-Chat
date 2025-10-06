import * as path from "path"
import * as fs from "fs/promises"

import type { EpisodicMemory, GoalMemory, RoleMemory, SemanticMemory, TraitMemory } from "../../types/anh-chat"
import { fileExistsAtPath } from "../../utils/fs"
import { safeWriteJson } from "../../utils/safeWriteJson"

import { ensureAnhChatRoot } from "./pathUtils"

export class RoleMemoryService {
	private readonly memoryDir: string

	private constructor(private readonly rootDir: string) {
		this.memoryDir = path.join(rootDir, "memory")
	}

	static async create(basePath: string) {
		const rootDir = await ensureAnhChatRoot(basePath)
		const service = new RoleMemoryService(rootDir)
		await fs.mkdir(service.memoryDir, { recursive: true })
		return service
	}

	async loadMemory(roleUuid: string): Promise<RoleMemory> {
		const filePath = this.getMemoryPath(roleUuid)
		if (!(await fileExistsAtPath(filePath))) {
			return this.createEmptyMemory(roleUuid)
		}

		const raw = await fs.readFile(filePath, "utf8")
		const parsed = JSON.parse(raw) as RoleMemory
		return {
			...this.createEmptyMemory(roleUuid),
			...parsed,
		}
	}

	async appendEpisodic(roleUuid: string, record: EpisodicMemory) {
		const memory = await this.loadMemory(roleUuid)
		memory.episodic.push(record)
		memory.lastSyncedAt = Date.now()
		await this.saveMemory(roleUuid, memory)
	}

	async upsertSemantic(roleUuid: string, record: SemanticMemory) {
		const memory = await this.loadMemory(roleUuid)
		const index = memory.semantic.findIndex((item) => item.id === record.id)
		if (index >= 0) {
			memory.semantic[index] = record
		} else {
			memory.semantic.push(record)
		}
		memory.lastSyncedAt = Date.now()
		await this.saveMemory(roleUuid, memory)
	}

	async updateTraits(roleUuid: string, traits: TraitMemory[]) {
		const memory = await this.loadMemory(roleUuid)
		memory.traits = traits
		memory.lastSyncedAt = Date.now()
		await this.saveMemory(roleUuid, memory)
	}

	async updateGoals(roleUuid: string, goals: GoalMemory[]) {
		const memory = await this.loadMemory(roleUuid)
		memory.goals = goals
		memory.lastSyncedAt = Date.now()
		await this.saveMemory(roleUuid, memory)
	}

	private async saveMemory(roleUuid: string, memory: RoleMemory) {
		const filePath = this.getMemoryPath(roleUuid)
		await fs.mkdir(path.dirname(filePath), { recursive: true })
		await safeWriteJson(filePath, memory)
	}

	private getMemoryPath(roleUuid: string) {
		return path.join(this.memoryDir, `${roleUuid}`, "memory.json")
	}

	private createEmptyMemory(roleUuid: string): RoleMemory {
		return {
			characterUuid: roleUuid,
			episodic: [],
			semantic: [],
			traits: [],
			goals: [],
		}
	}
}
