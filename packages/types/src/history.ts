import { z } from "zod"

/**
 * HistoryItem
 */

export const historyItemSchema = z.object({
	id: z.string(),
	rootTaskId: z.string().optional(),
	parentTaskId: z.string().optional(),
	number: z.number(),
	ts: z.number(),
	task: z.string(),
	tokensIn: z.number(),
	tokensOut: z.number(),
	cacheWrites: z.number().optional(),
	cacheReads: z.number().optional(),
	totalCost: z.number(),
	size: z.number().optional(),
	workspace: z.string().optional(),
	mode: z.string().optional(),
	// ANH (Advanced Novel Helper) role information
	anhRoleName: z.string().optional(),
	anhRoleUuid: z.string().optional(),
	// Chat mode display optimization
	anhFirstMessage: z.string().optional(),
	anhLastMessage: z.string().optional(),
	// Task scope - indicates if this is a global or workspace-specific task
	scope: z.enum(["global", "workspace"]).optional().default("workspace"),
	// Character Card V3 avatar support
	anhRoleAvatar: z.string().optional(),
})

export type HistoryItem = z.infer<typeof historyItemSchema>
