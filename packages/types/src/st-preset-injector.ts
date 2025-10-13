// src/services/st-preset-injector.ts
import { z } from "zod"
import { STPreset, stPresetSchema, STPresetSelect, STPresetCompiled } from "./silly-tavern-preset.js"
import { Role, roleSchema } from "./anh-chat.js"
import {
	LiquidTemplateProcessor,
	processLiquidTemplateVariables,
	type LiquidTemplateProcessingOptions,
	type LiquidTemplateProcessingResult,
} from "./liquid-template-system.js"

/** 判定：是不是"酒馆预设"对象（通过关键字段） */
export function looksLikeTavernPreset(obj: any): obj is STPreset {
	if (!obj || typeof obj !== "object") return false
	// 以 prompts + prompt_order 的组合作为强信号
	return Array.isArray(obj?.prompts) && Array.isArray(obj?.prompt_order)
}

/** 直接按 Zod 严格解析（不做净化、不过滤字段），失败抛错 */
export function parseTavernPresetStrict(raw: unknown): STPreset {
	const parsed = stPresetSchema.parse(raw)
	return parsed
}

/** 从 STPreset 中挑出一个有效的 characterId（若未显式指定） */
function pickCharacterId(preset: STPreset, preferId?: number): number {
	if (typeof preferId === "number") {
		const hit = preset.prompt_order.find((x) => x.character_id === preferId)
		if (hit) return preferId
	}
	// 回落：用第一个
	if (preset.prompt_order.length > 0 && preset.prompt_order[0]) return preset.prompt_order[0].character_id
	// 再回落：通道全部扁平化使用（无需 order）——我们虚构一个 -1
	return -1
}

/** 把某个 characterId 的 order 映射成启用的 identifier 列表（保序） */
function resolveOrderIdentifiers(preset: STPreset, characterId: number, onlyEnabled: boolean): string[] | null {
	const entry = preset.prompt_order.find((x) => x.character_id === characterId)
	if (!entry) return null
	const seq: string[] = []
	for (const it of entry.order) {
		if (onlyEnabled && it.enabled === false) continue
		seq.push(it.identifier)
	}
	return seq
}

/** 模板处理选项扩展 */
export interface CompilePresetOptions extends STPresetSelect {
	/** 模板变量处理选项 */
	templateOptions?: LiquidTemplateProcessingOptions
	/** 是否启用模板变量处理 */
	enableTemplateProcessing?: boolean
}

/** 把 preset 扁平化为三个通道字符串（**不做任何净化**）。 */
export function compilePresetChannels(
	preset: STPreset,
	opt: CompilePresetOptions = {},
	joiner = "\n\n",
): STPresetCompiled {
	const characterId = pickCharacterId(preset, opt.characterId)
	const onlyEnabled = opt.onlyEnabled ?? true

	// 先做一个可索引表
	const byId = new Map<string, (typeof preset.prompts)[number]>()
	for (const p of preset.prompts) byId.set(p.identifier, p)

	// 如果该 characterId 有 order，就按顺序挑；否则，就用所有 prompts 的天然顺序
	const order = characterId !== -1 ? resolveOrderIdentifiers(preset, characterId, onlyEnabled) : null

	const picked: typeof preset.prompts = []

	if (order && order.length) {
		for (const id of order) {
			const p = byId.get(id)
			if (!p) continue
			if (onlyEnabled && p.enabled === false) continue
			picked.push(p)
		}
	} else {
		// 无 prompt_order：直接全量 prompts
		for (const p of preset.prompts) {
			if (onlyEnabled && p.enabled === false) continue
			picked.push(p)
		}
	}

	// 按 role 聚合
	const sys: string[] = []
	const usr: string[] = []
	const asst: string[] = []
	const seq: string[] = []

	// 初始化 LiquidJS 模板处理器
	const enableTemplateProcessing = opt.enableTemplateProcessing ?? true

	for (const p of picked) {
		const role = p.role ?? "system" // 未声明 role 默认按 system 处理（和不少卡片作者习惯一致）
		let content = p.content ?? ""
		seq.push(p.identifier)

		// 处理模板变量
		if (enableTemplateProcessing && content) {
			// 确保模板选项正确设置，优先使用外部变量
			const templateOptions = {
				...opt.templateOptions,
				keepVariableDefinitions: false, // 对于预设内容，不保留变量定义
				removeUnprocessed: true, // 移除未处理的模板
				variables: {
					...opt.templateOptions?.variables,
					// 确保外部传入的变量有正确的优先级
				},
			}

			const templateResult = processLiquidTemplateVariables(content, templateOptions)

			// 如果有错误或警告，可以在这里处理
			if (templateResult.errors.length > 0) {
				console.warn(`Template processing errors for ${p.identifier}:`, templateResult.errors)
			}
			if (templateResult.warnings.length > 0) {
				console.warn(`Template processing warnings for ${p.identifier}:`, templateResult.warnings)
			}

			content = templateResult.processedText
		}

		if (role === "system") sys.push(content)
		else if (role === "user") usr.push(content)
		else asst.push(content) // assistant
	}

	return {
		characterId,
		system: sys.join(joiner),
		user: usr.join(joiner),
		assistant: asst.join(joiner),
		sequence: seq,
	}
}

/** 注入目标字段映射（可按需改） */
export interface InjectMapping {
	/** system 通道注入到哪个 Role 字段 */
	systemTo?: "system_prompt" | "creator_notes" | "post_history_instructions" | "description"
	/** user 通道注入到哪个 Role 字段 */
	userTo?: "scenario" | "description" | "creator_notes" | "post_history_instructions"
	/** assistant 通道注入到哪个 Role 字段 */
	assistantTo?: "mes_example" | "creator_notes" | "post_history_instructions" | "description"
	/** 字符串拼接分隔符（用于与已有字段拼接） */
	joiner?: string
	/** 是否把原始 preset 与编译结果挂在 extensions 上 */
	keepRawInExtensions?: boolean
	keepCompiledInExtensions?: boolean
}

/** 默认映射：system→system_prompt，user→scenario，assistant→mes_example */
export const DEFAULT_INJECT_MAPPING: Required<InjectMapping> = {
	systemTo: "system_prompt",
	userTo: "scenario",
	assistantTo: "mes_example",
	joiner: "\n\n----\n\n",
	keepRawInExtensions: true,
	keepCompiledInExtensions: true,
}

/** 简单拼接函数（不做净化） */
function concatText(a?: string, b?: string, sep = "\n\n") {
	if (!a && !b) return undefined
	if (!a) return b
	if (!b) return a
	return `${a}${sep}${b}`
}

/**
 * 将"编译后的 preset 通道文本"注入到 Role。
 * - 不做任何净化；
 * - 可选择把原始/编译结果塞到 extensions.anh.stPreset，便于追踪/溯源；
 * - 返回新的 Role（已校验）；校验失败也直接返回 best-effort。
 */
export function injectCompiledPresetIntoRole(
	role: Role,
	compiled: STPresetCompiled,
	mapping: InjectMapping = {},
): Role {
	const cfg = { ...DEFAULT_INJECT_MAPPING, ...mapping }
	const copy: any = JSON.parse(JSON.stringify(role))

	// system
	if (compiled.system && cfg.systemTo) {
		copy[cfg.systemTo] = concatText(copy[cfg.systemTo], compiled.system, cfg.joiner)
	}
	// user
	if (compiled.user && cfg.userTo) {
		copy[cfg.userTo] = concatText(copy[cfg.userTo], compiled.user, cfg.joiner)
	}
	// assistant
	if (compiled.assistant && cfg.assistantTo) {
		copy[cfg.assistantTo] = concatText(copy[cfg.assistantTo], compiled.assistant, cfg.joiner)
	}

	// 记录扩展（原始 & 编译）
	copy.extensions = copy.extensions || {}
	copy.extensions.anh = copy.extensions.anh || {}
	copy.extensions.anh.stPreset = copy.extensions.anh.stPreset || {}

	if (cfg.keepRawInExtensions) {
		// 只记录来源特征（角色 id 与顺序），原始 preset 你也可外部存仓；如需也可全部放进来
		copy.extensions.anh.stPreset.characterId = compiled.characterId
		copy.extensions.anh.stPreset.sequence = compiled.sequence
	}
	if (cfg.keepCompiledInExtensions) {
		copy.extensions.anh.stPreset.compiled = {
			system: compiled.system,
			user: compiled.user,
			assistant: compiled.assistant,
		}
	}

	// 更新时间戳
	copy.updatedAt = Date.now()

	const ok = roleSchema.safeParse(copy)
	return ok.success ? ok.data : (copy as Role)
}

/**
 * 一步到位：解析 preset → 扁平化 → 注入到 Role
 * - raw：预处理后的 JSON（你保证合法性，这里只做 Zod 校验）
 * - select：选择 characterId / 仅启用项 + 模板处理选项
 * - mapping：注入目标字段配置
 * - joiner：扁平化时的通道拼接符
 */
export function parseCompileAndInjectPreset(
	role: Role,
	raw: unknown,
	select?: CompilePresetOptions,
	mapping?: InjectMapping,
	joiner?: string,
): Role {
	const preset = parseTavernPresetStrict(raw)
	const compiled = compilePresetChannels(preset, select, joiner ?? "\n\n")
	return injectCompiledPresetIntoRole(role, compiled, mapping)
}

/**
 * 便捷函数：使用模板变量处理的一步到位注入
 * - role：目标角色
 * - raw：原始预设数据
 * - templateVars：预定义的模板变量
 * - options：其他选项
 */
export function parseCompileAndInjectPresetWithTemplates(
	role: Role,
	raw: unknown,
	templateVars?: Record<string, string>,
	options: {
		select?: Omit<CompilePresetOptions, "templateOptions">
		mapping?: InjectMapping
		joiner?: string
		strictMode?: boolean
		removeUnprocessed?: boolean
	} = {},
): Role {
	const templateOptions: LiquidTemplateProcessingOptions = {
		strict: options.strictMode ?? false,
		removeUnprocessed: options.removeUnprocessed ?? false,
		variables: templateVars ?? {},
		keepVariableDefinitions: false,
		maxRecursionDepth: 10,
	}

	const compileOptions: CompilePresetOptions = {
		...options.select,
		templateOptions,
		enableTemplateProcessing: true,
	}

	return parseCompileAndInjectPreset(role, raw, compileOptions, options.mapping, options.joiner)
}

/**
 * 便捷函数：使用 LiquidJS 模板处理的一步到位注入
 * - role：目标角色
 * - raw：原始预设数据
 * - templateVars：预定义的模板变量
 * - options：其他选项
 */
export function parseCompileAndInjectPresetWithLiquidTemplates(
	role: Role,
	raw: unknown,
	templateVars?: Record<string, any>,
	options: {
		select?: Omit<CompilePresetOptions, "templateOptions">
		mapping?: InjectMapping
		joiner?: string
		strictMode?: boolean
		removeUnprocessed?: boolean
		liquidOptions?: {
			strict?: boolean
			filters?: Record<string, (...args: any[]) => any>
			tags?: Record<string, (...args: any[]) => any>
		}
	} = {},
): Role {
	const templateOptions: LiquidTemplateProcessingOptions = {
		strict: options.strictMode ?? false,
		removeUnprocessed: options.removeUnprocessed ?? false,
		variables: templateVars ?? {},
		keepVariableDefinitions: false,
		maxRecursionDepth: 10,
		liquidOptions: options.liquidOptions ?? {},
	}

	const compileOptions: CompilePresetOptions = {
		...options.select,
		templateOptions: templateOptions as any, // 类型兼容
		enableTemplateProcessing: true,
	}

	const mapping = {
		...options.mapping,
		keepCompiledInExtensions: false, // 默认关闭冗余存储
		keepRawInExtensions: false, // 默认关闭冗余存储
	}

	return parseCompileAndInjectPreset(role, raw, compileOptions, mapping, options.joiner)
}

/**
 * 使用 LiquidJS 处理文本模板的便捷函数
 */
export function processTextWithLiquidTemplates(
	text: string,
	variables?: Record<string, any>,
	options: LiquidTemplateProcessingOptions = {},
): string {
	const result = processLiquidTemplateVariables(text, {
		variables,
		...options,
	})
	return result.processedText
}

/**
 * 创建带有 LiquidJS 模板处理的角色
 */
export function createRoleWithLiquidTemplates(
	role: Partial<Role>,
	promptTemplate: string,
	variables?: Record<string, any>,
	options: LiquidTemplateProcessingOptions = {},
): Role {
	const processedPrompt = processTextWithLiquidTemplates(promptTemplate, variables, options)

	// 确保必需字段存在
	const now = Date.now()
	const defaultRole: Partial<Role> = {
		uuid: role.uuid || "generated-uuid-" + Math.random().toString(36).substr(2, 9),
		name: role.name || "Generated Role",
		type: role.type || "SillyTavernRole",
		aliases: role.aliases || [],
		description: role.description || "",
		affiliation: role.affiliation || "",
		color: role.color || "",
		profile: role.profile || {},
		modeOverrides: role.modeOverrides || {},
		timeline: role.timeline || [],
		tags: role.tags || [],
		createdAt: role.createdAt || now,
		updatedAt: role.updatedAt || now,
		personality: role.personality || "",
		first_mes: role.first_mes || "",
		avatar: role.avatar || null,
		mes_example: role.mes_example || "",
		scenario: role.scenario || "",
		creator_notes: role.creator_notes || "",
		system_prompt: role.system_prompt || processedPrompt, // 使用处理后的模板作为系统提示
		post_history_instructions: role.post_history_instructions || "",
		alternate_greetings: role.alternate_greetings || [],
		creator: role.creator || "",
		character_version: role.character_version || "",
		extensions: role.extensions || {},
		character_book: role.character_book || {
			name: "",
			entries: [],
			scan_depth: 4,
			token_budget: 200,
			recursive_scanning: false,
			extensions: {},
		},
		spec: role.spec || "chara_card_v2",
		spec_version: role.spec_version || "2.0",
	}

	return {
		...defaultRole,
		...role,
	} as Role
}

// Re-export STPresetSelect for external use
export type { STPresetSelect } from "./silly-tavern-preset.js"
