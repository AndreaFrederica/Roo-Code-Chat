import * as path from "path"
import * as fs from "fs/promises"
import crypto from "crypto"

import type { ConversationMessage, ConversationSummary } from "../../types/anh-chat"
import { fileExistsAtPath } from "../../utils/fs"
import { safeWriteJson } from "../../utils/safeWriteJson"

import { ensureAnhChatRoot } from "./pathUtils"

export class ConversationLogService {
	private readonly conversationsDir: string
	private readonly indexPath: string
	private summaries = new Map<string, ConversationSummary>()

	private constructor(private readonly rootDir: string) {
		this.conversationsDir = path.join(rootDir, "conversations")
		this.indexPath = path.join(this.conversationsDir, "index.json")
	}

	static async create(basePath: string) {
		const rootDir = await ensureAnhChatRoot(basePath)
		const service = new ConversationLogService(rootDir)
		await service.initialize()
		return service
	}

	private async initialize() {
		await fs.mkdir(this.conversationsDir, { recursive: true })
		if (await fileExistsAtPath(this.indexPath)) {
			try {
				const summaries: ConversationSummary[] = JSON.parse(await fs.readFile(this.indexPath, "utf8"))
				summaries.forEach((summary) => this.summaries.set(summary.conversationId, summary))
			} catch (error) {
				console.error("Failed to parse conversation index", error)
			}
		}
	}

	listSummaries(): ConversationSummary[] {
		return Array.from(this.summaries.values())
	}

	async createConversation(
		options: {
			roleUuid?: string
			title?: string
			metadata?: Record<string, unknown>
		} = {},
	): Promise<ConversationSummary> {
		const conversationId = crypto.randomUUID()
		const startedAt = Date.now()
		const summary: ConversationSummary = {
			conversationId,
			roleUuid: options.roleUuid,
			title: options.title,
			startedAt,
			metadata: options.metadata,
		}
		this.summaries.set(conversationId, summary)
		await this.persistIndex()
		return summary
	}

	async appendMessage(message: ConversationMessage) {
		const filePath = this.getConversationPath(message.conversationId)
		await fs.mkdir(path.dirname(filePath), { recursive: true })
		const line = `${JSON.stringify(message)}\n`
		await fs.appendFile(filePath, line, "utf8")
		const summary = this.summaries.get(message.conversationId)
		if (summary) {
			summary.endedAt = message.timestamp
			summary.lastMessagePreview = message.content.slice(0, 120)
			this.summaries.set(message.conversationId, summary)
			await this.persistIndex()
		}
	}

	async readConversation(conversationId: string): Promise<ConversationMessage[]> {
		const filePath = this.getConversationPath(conversationId)
		if (!(await fileExistsAtPath(filePath))) {
			return []
		}
		const raw = await fs.readFile(filePath, "utf8")
		return raw
			.split(/\r?\n/)
			.filter(Boolean)
			.map((line) => JSON.parse(line) as ConversationMessage)
	}

	private async persistIndex() {
		await safeWriteJson(this.indexPath, this.listSummaries())
	}

	private getConversationPath(conversationId: string) {
		return path.join(this.conversationsDir, `${conversationId}.jsonl`)
	}
}
