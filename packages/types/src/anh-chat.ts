import { z } from "zod"
import * as crypto from "crypto"
import type { CharaCardV2, CardData, Extensions, CharacterBook as STCharacterBook, CharacterBookEntry as STCharacterBookEntry } from "./silly-tavern-card.js"
import { HashUuidGenerator } from "./hash-uuid.js"

export const roleTypeSchema = z.enum(["主角", "配角", "联动角色", "NPC", "旁白", "SillyTavernRole"])

export type RoleType = z.infer<typeof roleTypeSchema>

export const rolePersonaSchema = z.enum(["hybrid", "chat"])

export type RolePersona = z.infer<typeof rolePersonaSchema>

// SillyTavern兼容的扩展字段schema
export const sillyTavernExtensionsSchema = z.object({
	fav: z.boolean().optional(),
	chub: z.object({
		expressions: z.unknown().optional(),
		alt_expressions: z.record(z.string(), z.unknown()).optional(),
		id: z.union([z.number(), z.string()]).optional(),
		full_path: z.string().optional(),
		related_lorebooks: z.array(z.union([z.number(), z.string()])).optional(),
		background_image: z.string().optional(),
		preset: z.string().nullable().optional(),
		extensions: z.array(z.unknown()).optional(),
	}).optional(),
	world: z.string().optional(),
	depth_prompt: z.object({
		role: z.union([z.literal("system"), z.literal("assistant"), z.literal("user"), z.number(), z.string()]).optional(),
		depth: z.number().optional(),
		prompt: z.string(),
	}).optional(),
	talkativeness: z.union([z.string(), z.number()]).optional(),
}).catchall(z.unknown()).optional()

export type SillyTavernExtensions = z.infer<typeof sillyTavernExtensionsSchema>

// CharacterBook条目schema - 重命名以避免冲突
export const anhCharacterBookEntrySchema = z.object({
	name: z.string().optional(),
	keys: z.array(z.string()),
	secondary_keys: z.array(z.string()).optional(),
	content: z.string(),
	enabled: z.boolean().optional(),
	insertion_order: z.number().optional(),
	case_sensitive: z.boolean().nullable().optional(),
	priority: z.number().optional(),
	id: z.union([z.number(), z.string()]).optional(),
	comment: z.string().optional(),
	selective: z.boolean().optional(),
	constant: z.boolean().optional(),
	position: z.string().optional(),
	extensions: z.object({
		role: z.union([z.number(), z.string()]).optional(),
		delay: z.number().optional(),
		depth: z.number().optional(),
		group: z.string().optional(),
		linked: z.boolean().optional(),
		sticky: z.number().optional(),
		weight: z.number().optional(),
		addMemo: z.boolean().optional(),
		cooldown: z.number().optional(),
		embedded: z.boolean().optional(),
		position: z.number().optional(),
		scan_depth: z.number().nullable().optional(),
		vectorized: z.boolean().optional(),
		probability: z.number().optional(),
		displayIndex: z.number().optional(),
		group_weight: z.number().optional(),
		automation_id: z.string().optional(),
		display_index: z.number().optional(),
		case_sensitive: z.boolean().optional(),
		group_override: z.boolean().optional(),
		selectiveLogic: z.number().optional(),
		useProbability: z.boolean().optional(),
		characterFilter: z.unknown().optional(),
		excludeRecursion: z.boolean().optional(),
		exclude_recursion: z.boolean().optional(),
		match_whole_words: z.boolean().nullable().optional(),
		prevent_recursion: z.boolean().optional(),
		use_group_scoring: z.boolean().optional(),
		delay_until_recursion: z.boolean().optional(),
	}).catchall(z.unknown()).optional(),
	probability: z.number().optional(),
	selectiveLogic: z.number().optional(),
}).catchall(z.unknown())

export type AnhCharacterBookEntry = z.infer<typeof anhCharacterBookEntrySchema>

// CharacterBook schema - 重命名以避免冲突
export const anhCharacterBookSchema = z.object({
	name: z.string(),
	description: z.string().optional(),
	scan_depth: z.number().optional(),
	token_budget: z.number().optional(),
	recursive_scanning: z.boolean().optional(),
	extensions: z.record(z.string(), z.unknown()).optional(),
	entries: z.array(anhCharacterBookEntrySchema),
}).catchall(z.unknown()).optional()

export type AnhCharacterBook = z.infer<typeof anhCharacterBookSchema>

// 支持完全灵活的profile结构，任何字段都可以是字符串、数组或嵌套对象
export const roleProfileSchema = z.record(
	z.string(),
	z.union([
		z.string(),
		z.array(z.string()),
		z.array(z.record(z.string(), z.unknown())),
		z.record(z.string(), z.unknown()),
		z.unknown()
	]).optional()
).optional()

export type RoleProfile = z.infer<typeof roleProfileSchema>

export const roleModeOverridesSchema = z.object({
	roleDefinition: z.string().optional(),
	customInstructions: z.string().optional(),
	defaultMode: z.string().optional(),
	persona: rolePersonaSchema.optional(),
	toneStrictByDefault: z.boolean().optional(),
}).optional()

export type RoleModeOverrides = z.infer<typeof roleModeOverridesSchema>

// 角色元数据schema - 扩展为SillyTavern超集
export const roleMetadataSchema = z.object({
	// anh-chat原有字段
	uuid: z.string(),
	name: z.string(),
	type: roleTypeSchema,
	aliases: z.array(z.string()).optional(),
	description: z.string().optional(),
	affiliation: z.string().optional(),
	color: z.string().optional(),
	profile: roleProfileSchema,
	modeOverrides: roleModeOverridesSchema,
	timeline: z.array(z.union([
		z.string(),
		z.object({
			date: z.string().optional(),
			event: z.string(),
			description: z.string().optional(),
		}).catchall(z.unknown()),
		z.unknown()
	])).optional(),
	tags: z.array(z.string()).optional(),
	packagePath: z.string().optional(),
	createdAt: z.number().optional(),
	updatedAt: z.number().optional(),
	
	// SillyTavern兼容字段
	personality: z.string().optional(),
	first_mes: z.string().optional(),
	avatar: z.string().nullable().optional(),
	mes_example: z.string().optional(),
	scenario: z.string().optional(),
	creator_notes: z.string().optional(),
	system_prompt: z.string().optional(),
	post_history_instructions: z.string().optional(),
	alternate_greetings: z.array(z.string()).optional(),
	creator: z.string().optional(),
	character_version: z.string().optional(),
	extensions: sillyTavernExtensionsSchema,
	character_book: anhCharacterBookSchema,
	
	// SillyTavern卡片元数据
	spec: z.union([z.literal("chara_card_v2"), z.string()]).optional(),
	spec_version: z.string().optional(),
}).catchall(z.unknown()) // 允许任意额外字段

// 向后兼容的Role schema，使用更严格的类型
export const roleSchema = roleMetadataSchema.extend({
	createdAt: z.number(),
	updatedAt: z.number(),
})

export type Role = z.infer<typeof roleSchema>

export const roleSummarySchema = z.object({
	uuid: z.string(),
	name: z.string(),
	type: roleTypeSchema,
	packagePath: z.string().optional(),
	lastUpdatedAt: z.number(),
})

export type RoleSummary = z.infer<typeof roleSummarySchema>

// Storyline arc schema
export const storylineArcSchema = z.object({
	id: z.string(),
	title: z.string(),
	summary: z.string().optional(),
	tags: z.array(z.string()).optional(),
}).catchall(z.unknown())

export type StorylineArc = z.infer<typeof storylineArcSchema>

// Storyline file schema
export const storylineFileSchema = z.object({
	roleUuid: z.string(),
	updatedAt: z.number(),
	arcs: z.array(storylineArcSchema),
}).catchall(z.unknown())

export type StorylineFile = z.infer<typeof storylineFileSchema>

// Memory trait schema
export const memoryTraitSchema = z.object({
	name: z.string(),
	value: z.string(),
	confidence: z.number().optional(),
}).catchall(z.unknown())

export type MemoryTrait = z.infer<typeof memoryTraitSchema>

// Memory goal schema
export const memoryGoalSchema = z.object({
	value: z.string(),
	priority: z.number().optional(),
}).catchall(z.unknown())

export type MemoryGoal = z.infer<typeof memoryGoalSchema>

// Memory episodic record schema
export const memoryEpisodicRecordSchema = z.object({
	timestamp: z.number(),
	content: z.string(),
}).catchall(z.unknown())

export type MemoryEpisodicRecord = z.infer<typeof memoryEpisodicRecordSchema>

// Memory schema
export const memorySchema = z.object({
	traits: z.array(memoryTraitSchema).optional(),
	goals: z.array(memoryGoalSchema).optional(),
	episodic: z.array(memoryEpisodicRecordSchema).optional(),
}).catchall(z.unknown()).optional()

export type Memory = z.infer<typeof memorySchema>

// Storyline data schema
export const storylineDataSchema = z.object({
	arcs: z.array(storylineArcSchema).optional(),
}).catchall(z.unknown()).optional()

export type StorylineData = z.infer<typeof storylineDataSchema>

// RolePromptData schema - used when generating prompts
export const rolePromptDataSchema = z.object({
	role: roleSchema,
	storyline: storylineDataSchema,
	memory: memorySchema,
}).catchall(z.unknown())

export type RolePromptData = z.infer<typeof rolePromptDataSchema>

// SillyTavern兼容性工具函数类型
export interface SillyTavernCompatibility {
	/** 将anh-chat角色转换为SillyTavern格式 */
	toSillyTavern(role: Role): CharaCardV2
	
	/** 将SillyTavern角色转换为anh-chat格式 */
	fromSillyTavern(card: CharaCardV2, uuid?: string): Role
	
	/** 检查角色是否包含SillyTavern字段 */
	hasSillyTavernFields(role: Role): boolean
	
	/** 提取SillyTavern基本信息 */
	extractSillyTavernInfo(role: Role): {
		name: string
		description?: string
		personality?: string
		scenario?: string
		first_mes?: string
		mes_example?: string
		system_prompt?: string
		post_history_instructions?: string
		creator_notes?: string
		alternate_greetings?: string[]
		tags?: string[]
		creator?: string
		character_version?: string
	}
}

// 转换工具函数
export const createSillyTavernCompatibility = (): SillyTavernCompatibility => ({
	toSillyTavern: (role: Role): CharaCardV2 => ({
		spec: role.spec || "chara_card_v2",
		spec_version: role.spec_version || "2.0",
		data: {
			name: role.name,
			description: role.description || "",
			personality: role.personality || "",
			first_mes: role.first_mes || "",
			avatar: role.avatar || null,
			mes_example: role.mes_example || "",
			scenario: role.scenario || "",
			creator_notes: role.creator_notes || "",
			system_prompt: role.system_prompt || "",
			post_history_instructions: role.post_history_instructions || "",
			alternate_greetings: role.alternate_greetings || [],
			tags: role.tags || [],
			creator: role.creator || "",
			character_version: role.character_version || "",
			extensions: role.extensions || {},
			character_book: role.character_book || undefined,
		}
	}),
	
	fromSillyTavern: (card: CharaCardV2, uuid?: string): Role => {
		// 如果没有提供UUID，则基于卡片内容生成确定性UUID
		const generatedUuid = uuid || (() => {
			// 使用HashUuidGenerator生成确定性UUID
			return HashUuidGenerator.fromSillyTavernCard(card)
		})()

		return {
		uuid: generatedUuid,
		name: card.data.name,
		type: "SillyTavernRole" as RoleType, // 默认类型
		description: card.data.description,
		personality: card.data.personality,
		first_mes: card.data.first_mes,
		avatar: card.data.avatar,
		mes_example: card.data.mes_example,
		scenario: card.data.scenario,
		creator_notes: card.data.creator_notes,
		system_prompt: card.data.system_prompt,
		post_history_instructions: card.data.post_history_instructions,
		alternate_greetings: card.data.alternate_greetings,
		tags: card.data.tags,
		creator: card.data.creator,
		character_version: card.data.character_version,
		extensions: card.data.extensions,
		character_book: card.data.character_book,
		spec: card.spec,
		spec_version: card.spec_version,
		createdAt: Date.now(),
		updatedAt: Date.now(),
	}},
	
	hasSillyTavernFields: (role: Role): boolean => {
		return !!(
			role.personality ||
			role.first_mes ||
			role.avatar ||
			role.mes_example ||
			role.scenario ||
			role.creator_notes ||
			role.system_prompt ||
			role.post_history_instructions ||
			role.alternate_greetings ||
			role.creator ||
			role.character_version ||
			role.extensions ||
			role.character_book ||
			role.spec ||
			role.spec_version
		)
	},
	
	extractSillyTavernInfo: (role: Role) => ({
		name: role.name,
		description: role.description,
		personality: role.personality,
		scenario: role.scenario,
		first_mes: role.first_mes,
		mes_example: role.mes_example,
		system_prompt: role.system_prompt,
		post_history_instructions: role.post_history_instructions,
		creator_notes: role.creator_notes,
		alternate_greetings: role.alternate_greetings,
		tags: role.tags,
		creator: role.creator,
		character_version: role.character_version,
	})
})
