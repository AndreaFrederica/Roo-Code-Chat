// src/types/silly-tavern-preset.ts
import { z } from "zod"

/** Prompt 条目（与你样例结构对齐，保留核心字段；其余用 catchall 兜底） */
export const stPresetPromptSchema = z.object({
  identifier: z.string().min(1),
  name: z.string().optional(),
  role: z.enum(["system", "user", "assistant"]).optional(), // 允许缺省
  content: z.string().default(""),
  system_prompt: z.boolean().optional().default(false),
  enabled: z.boolean().optional().default(true),
  marker: z.boolean().optional(),
  injection_position: z.number().optional(),
  injection_depth: z.number().optional(),
  injection_order: z.number().optional(),
  forbid_overrides: z.boolean().optional(),
}).catchall(z.unknown())

export type STPresetPrompt = z.infer<typeof stPresetPromptSchema>

/** prompt_order 里的一个角色视角（选择使用哪组 prompts） */
export const stPresetOrderEntrySchema = z.object({
  character_id: z.number(),
  order: z.array(z.object({
    identifier: z.string(),
    enabled: z.boolean().optional().default(true),
  })),
})

export type STPresetOrderEntry = z.infer<typeof stPresetOrderEntrySchema>

/** "酒馆预设"总体 schema（与你的样例字段一致；未知字段保留） */
export const stPresetSchema = z.object({
  // 采样与采参（可选，保留数值，不在此处做含义校验）
  temperature: z.number().optional(),
  frequency_penalty: z.number().optional(),
  presence_penalty: z.number().optional(),
  top_p: z.number().optional(),
  top_k: z.number().optional(),
  top_a: z.number().optional(),
  min_p: z.number().optional(),
  repetition_penalty: z.number().optional(),
  openai_max_context: z.number().optional(),
  openai_max_tokens: z.number().optional(),

  // 运行控制/行为控制
  wrap_in_quotes: z.boolean().optional(),
  names_behavior: z.number().optional(),
  send_if_empty: z.string().optional(),
  impersonation_prompt: z.string().optional(),
  new_chat_prompt: z.string().optional(),
  new_group_chat_prompt: z.string().optional(),
  new_example_chat_prompt: z.string().optional(),
  continue_nudge_prompt: z.string().optional(),

  bias_preset_selected: z.string().optional(),
  max_context_unlocked: z.boolean().optional(),
  wi_format: z.string().optional(),
  scenario_format: z.string().optional(),
  personality_format: z.string().optional(),
  group_nudge_prompt: z.string().optional(),

  stream_openai: z.boolean().optional(),
  prompts: z.array(stPresetPromptSchema).default([]),

  prompt_order: z.array(stPresetOrderEntrySchema).default([]),

  // 其他开关
  claude_use_sysprompt: z.boolean().optional(),
  use_makersuite_sysprompt: z.boolean().optional(),
  squash_system_messages: z.boolean().optional(),
  image_inlining: z.boolean().optional(),
  inline_image_quality: z.string().optional(),
  video_inlining: z.boolean().optional(),
  continue_prefill: z.boolean().optional(),
  continue_postfix: z.string().optional(),
  function_calling: z.boolean().optional(),
  show_thoughts: z.boolean().optional(),
  reasoning_effort: z.string().optional(),
  enable_web_search: z.boolean().optional(),
  request_images: z.boolean().optional(),
  seed: z.number().optional(),
  n: z.number().optional(),

  assistant_prefill: z.string().optional(),
  assistant_impersonation: z.string().optional(),
}).catchall(z.unknown())

export type STPreset = z.infer<typeof stPresetSchema>

/** 选择哪一个 character_id 的顺序（如果你会外部指定） */
export interface STPresetSelect {
  /** 优先选用的 character_id；不传则取 prompt_order[0] */
  characterId?: number
  /** 只取 enabled=true 的条目；默认 true */
  onlyEnabled?: boolean
}

/** 预编译/扁平化结果（把多条 prompts 按 order 联结） */
export interface STPresetCompiled {
  characterId: number
  /** 串接后：system 通道文本 */
  system: string
  /** 串接后：user 通道文本 */
  user: string
  /** 串接后：assistant 通道文本 */
  assistant: string
  /** 拼接顺序用到的 identifier 列表（便于追踪/调试） */
  sequence: string[]
}