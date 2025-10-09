import * as path from "path"
import * as fs from "fs/promises"

import type { MemoryEpisodicRecord, MemoryGoal, MemoryTrait } from "@roo-code/types"
import { fileExistsAtPath } from "../../utils/fs"
import { safeWriteJson } from "../../utils/safeWriteJson"

import { ensureAnhChatRoot } from "./pathUtils"

type EpisodicMemory = MemoryEpisodicRecord & {
	id?: string
	metadata?: Record<string, unknown>
}

type SemanticMemory = {
	id: string
	content: string
	updatedAt: number
	tags?: string[]
	source?: string
	metadata?: Record<string, unknown>
}

type TraitMemory = MemoryTrait & {
	id?: string
}

type GoalMemory = MemoryGoal & {
	id?: string
}

interface RoleMemory extends Record<string, unknown> {
	characterUuid: string
	episodic: EpisodicMemory[]
	semantic: SemanticMemory[]
	traits: TraitMemory[]
	goals: GoalMemory[]
	lastSyncedAt?: number
}

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
