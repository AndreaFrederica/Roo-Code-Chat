import { z } from "zod"

export const roleTypeSchema = z.enum(["主角", "配角", "联动角色", "NPC", "旁白"])

export type RoleType = z.infer<typeof roleTypeSchema>

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