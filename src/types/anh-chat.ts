/*
 * Local types for the anh-chat subsystem.
 */

export type RoleType = "主角" | "配角" | "联动角色" | "敏感词" | "词汇" | "正则表达式" | (string & {})

export interface RoleProfile {
	background?: string
	appearance?: string[]
	personality?: string[]
	skills?: string[]
	titles?: string[]
	hobbies?: string[]
	relationships?: string[]
	notes?: string[]
}

export interface Role {
	name: string
	type: RoleType
	profile?: RoleProfile
	uuid?: string
	affiliation?: string
	aliases?: string[]
	description?: string
	color?: string
	wordSegmentFilter?: boolean
	packagePath?: string
	sourcePath?: string
	regex?: string
	regexFlags?: string
	priority?: number
	fixes?: string[]
}

export interface RoleSummary {
	uuid: string
	name: string
	type: RoleType
	packagePath?: string
	lastUpdatedAt: number
}

export interface EpisodicMemory {
	id: string
	timestamp: number
	source: "chat" | "manual" | (string & {})
	content: string
	conversationId?: string
	metadata?: Record<string, unknown>
}

export interface SemanticMemory {
	id: string
	content: string
	confidence?: number
	tags?: string[]
	updatedAt: number
}

export interface TraitMemory {
	name: string
	value: string
	confidence?: number
	updatedAt: number
}

export interface GoalMemory {
	value: string
	priority?: number
	updatedAt: number
}

export interface RoleMemory {
	characterUuid: string
	lastSyncedAt?: number
	episodic: EpisodicMemory[]
	semantic: SemanticMemory[]
	traits?: TraitMemory[]
	goals?: GoalMemory[]
}

export interface ConversationMessage {
	id: string
	conversationId: string
	senderType: "character" | "user" | "system" | (string & {})
	senderName: string
	roleUuid?: string
	model?: string
	timestamp: number
	content: string
}

export interface ConversationSummary {
	conversationId: string
	roleUuid?: string
	title?: string
	startedAt: number
	endedAt?: number
	lastMessagePreview?: string
	metadata?: Record<string, unknown>
}

export interface StoryArc {
	id: string
	title: string
	summary: string
	era?: string
	triggers?: string[]
	relatedRoles?: string[]
	tags?: string[]
}

export interface StorylineFile {
	roleUuid: string
	arcs: StoryArc[]
	updatedAt: number
}

export interface RolePromptData {
	role: Role
	storyline?: StorylineFile
	memory?: RoleMemory
}
