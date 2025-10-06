import * as path from "path"
import * as fs from "fs/promises"

import type { StorylineFile } from "@roo-code/types"
import { fileExistsAtPath } from "../../utils/fs"
import { safeWriteJson } from "../../utils/safeWriteJson"

import { ensureAnhChatRoot } from "./pathUtils"

export class StorylineRepository {
	private readonly storiesDir: string

	private constructor(private readonly rootDir: string) {
		this.storiesDir = path.join(rootDir, "storylines")
	}

	static async create(basePath: string) {
		const rootDir = await ensureAnhChatRoot(basePath)
		const repo = new StorylineRepository(rootDir)
		await fs.mkdir(repo.storiesDir, { recursive: true })
		return repo
	}

	async getStoryline(roleUuid: string): Promise<StorylineFile | undefined> {
		const filePath = this.getStorylinePath(roleUuid)
		if (!(await fileExistsAtPath(filePath))) {
			return undefined
		}

		const raw = await fs.readFile(filePath, "utf8")
		return JSON.parse(raw)
	}

	async saveStoryline(roleUuid: string, storyline: StorylineFile) {
		const filePath = this.getStorylinePath(roleUuid)
		await fs.mkdir(path.dirname(filePath), { recursive: true })
		await safeWriteJson(filePath, storyline)
	}

	private getStorylinePath(roleUuid: string) {
		return path.join(this.storiesDir, roleUuid, "timeline.json")
	}
}
