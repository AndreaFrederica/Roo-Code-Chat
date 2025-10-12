import { z } from "zod"

import { rooCodeSettingsSchema } from "@roo-code/types"

/**
 * CreateRun
 */

export const MODEL_DEFAULT = "anthropic/claude-sonnet-4"

export const CONCURRENCY_MIN = 1
export const CONCURRENCY_MAX = 25
export const CONCURRENCY_DEFAULT = 1

export const TIMEOUT_MIN = 5
export const TIMEOUT_MAX = 10
export const TIMEOUT_DEFAULT = 5

const _createRunSchema = z
	.object({
		model: z.string().min(1, { message: "Model is required." }),
		description: z.string().optional(),
		suite: z.enum(["full", "partial"]),
		exercises: z.array(z.string()).optional(),
		settings: rooCodeSettingsSchema.optional(),
		concurrency: z.number().int().min(CONCURRENCY_MIN).max(CONCURRENCY_MAX),
		timeout: z.number().int().min(TIMEOUT_MIN).max(TIMEOUT_MAX),
		systemPrompt: z.string().optional(),
	})
	.refine((data) => data.suite === "full" || (data.exercises || []).length > 0, {
		message: "Exercises are required when running a partial suite.",
		path: ["exercises"],
	})

export const createRunSchema: z.ZodEffects<
	z.ZodObject<{
		model: z.ZodString
		description: z.ZodOptional<z.ZodString>
		suite: z.ZodEnum<["full", "partial"]>
		exercises: z.ZodOptional<z.ZodArray<z.ZodString, "many">>
		settings: z.ZodOptional<any>
		concurrency: z.ZodNumber
		timeout: z.ZodNumber
		systemPrompt: z.ZodOptional<z.ZodString>
	}>,
	any,
	any
> = _createRunSchema

export type CreateRun = z.infer<typeof createRunSchema>
