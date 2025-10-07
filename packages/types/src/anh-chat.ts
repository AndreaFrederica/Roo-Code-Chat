import { z } from "zod"

export const roleTypeSchema = z.enum(["主角", "配角", "联动角色", "NPC", "旁白"])

export type RoleType = z.infer<typeof roleTypeSchema>

export const rolePersonaSchema = z.enum(["hybrid", "chat"])

export type RolePersona = z.infer<typeof rolePersonaSchema>

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

// 角色元数据schema
export const roleMetadataSchema = z.object({
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
