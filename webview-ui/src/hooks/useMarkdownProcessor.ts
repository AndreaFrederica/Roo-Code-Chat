/**
 * Markdown处理器 Hook - 基于真正的AST系统
 *
 * 正确的AST处理流程：
 * 1. 使用AST解析器提取完整的DOM/标签结构
 * 2. 根据配置的AST规则，决定每个节点的处理方式
 * 3. 从最深的节点开始逐层向外处理
 * 4. 支持各种AST action类型：fold、highlight、wrap、replace、hide、custom
 */

import { useMemo } from "react"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { useMixinRules } from "./useMixinRules"

// 规则类型定义（从后端获取）
interface RegexRule {
	id: string
	enabled: boolean
	pattern: string
	flags?: string
	description: string
	// 替换功能
	replacement?: string | ((match: string, ...groups: string[]) => string)
	// 支持函数式替换
	replacementFunction?: string // 函数名称，用于在预处理器中注册
	// 匹配分组信息 - 用于文档化
	groups?: Array<{
		name?: string
		description: string
		example?: string
	}>
	// 转换到AST类型（如果不为空，将创建AST节点）
	toType?: string
	// 默认折叠状态（如果转换为AST）
	defaultCollapsed?: boolean
	// 依赖关系
	dependsOn?: string[]
	// 执行阶段：pre-ast（AST前处理）, post-ast（AST后处理）, output（输出处理）
	stage?: "pre-ast" | "post-ast" | "output"
	// 优先级（数字越小越早执行）
	priority?: number
}

interface AstRule {
	id: string // 改为必需，与后端保持一致
	enabled: boolean
	description: string
	nodeType: string
	nodeAttributes?: Record<string, any>
	action: "fold" | "highlight" | "replace" | "wrap" | "hide" | "custom"
	priority?: number
	processor?: string
	params?: Record<string, any>
	recursive?: boolean
	dependsOn?: string[]
}
import { type Block } from "@/types/block"

// 导入真正的AST系统组件
import { ASTNode, TagRule, ASTNodeType, ProtectionRule } from "@/components/common/ast-fold-types"
import { parseTextToAST, ASTParser } from "@/components/common/ast-parser"
import { ASTLexer } from "@/components/common/ast-lexer"

type ReplaceRule = {
	re: RegExp
	replace: string | ((match: string) => string)
}

export type ProcessedBlock = {
	type: "text" | string
	content: string
	start: number
	end: number
	defaultCollapsed?: boolean
	// 唯一标识符，用于状态管理
	id: string
	// AST action类型相关的额外属性
	action?: AstRule["action"]
	params?: Record<string, any>
	processor?: string
	highlight?: boolean
	wrapperClass?: string
	hidden?: boolean
	// 嵌套支持
	children?: ProcessedBlock[]
	// AST系统特有的属性
	isComplete?: boolean
	rawTag?: string
	originalText?: string // 原始文本，用于某些action类型
}

const SLOT_RE = /\u0000__SLOT__([\s\S]*?)\u0000/g

/**
 * 应用正则替换规则（仅用于保护代码块等特殊内容）
 */
function applyRegexReplacements(text: string, rules: ReplaceRule[]): string {
	let result = text
	for (const rule of rules) {
		const replacement = rule.replace
		if (typeof replacement === "function") {
			result = result.replace(rule.re, replacement)
		} else {
			result = result.replace(rule.re, replacement as string)
		}
	}
	return result
}

// 前端替换函数注册表
const frontendReplacementFunctions = new Map<string, (match: string, ...groups: string[]) => string>()

// 注册内置替换函数
function registerFrontendFunctions() {
	// 时间戳注入
	frontendReplacementFunctions.set("timestamp", () => {
		return new Date().toISOString()
	})

	// 日期格式化
	frontendReplacementFunctions.set("dateformat", (match, format) => {
		try {
			return new Date().toLocaleDateString(undefined, {
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
				...(format ? { dateStyle: format as any } : {}),
			})
		} catch {
			return match
		}
	})

	// 表情符号转换
	frontendReplacementFunctions.set("emoji", (match, emojiName) => {
		const emojiMap: Record<string, string> = {
			smiley: "😊",
			thumbsup: "👍",
			warning: "⚠️",
			info: "ℹ️",
			check: "✅",
			x: "❌",
			tada: "🎉",
			heart: "❤️",
			fire: "🔥",
		}
		return emojiMap[emojiName.toLowerCase()] || match
	})

	// 智能引号转换
	frontendReplacementFunctions.set("smartQuotes", (match, content) => {
		return `"${content}"`
	})

	// 脚注引用
	frontendReplacementFunctions.set("footnoteRef", (match, footnoteNum) => {
		return `<sup>[${footnoteNum}]</sup>`
	})

	// 链接规范化
	frontendReplacementFunctions.set("normalizeLink", (match, text, url) => {
		const cleanUrl = url.trim()
		const cleanText = text.trim()

		if (!cleanUrl) {
			return match // 保留破损链接用于检测
		}

		return `[${cleanText}](${cleanUrl})`
	})

	// 变量替换（简单版本）
	frontendReplacementFunctions.set("variable", (match, varName) => {
		// 这里可以从context中获取变量值，暂时返回原值
		return match
	})
}

// 初始化函数
registerFrontendFunctions()

/**
 * 应用增强的正则处理（支持新的完整格式）
 */
function applyEnhancedRegexProcessing(text: string, regexMixins: Record<string, any>): string {
	let result = text

	// 如果有新的正则替换规则，应用它们
	Object.values(regexMixins).forEach((rule) => {
		if (!rule?.enabled) {
			return
		}

		// 检查是否有替换功能
		const hasReplacement = rule.replacement || rule.replacementFunction
		if (!hasReplacement) {
			return
		}

		try {
			const regex = new RegExp(rule.pattern ?? "", rule.flags || "g")

			if (rule.replacementFunction) {
				// 使用函数式替换
				const fn = frontendReplacementFunctions.get(rule.replacementFunction)
				if (fn) {
					result = result.replace(regex, fn)
				} else {
					console.warn(`Replacement function '${rule.replacementFunction}' not found in frontend`)
				}
			} else if (typeof rule.replacement === "function") {
				// 直接函数替换
				result = result.replace(regex, rule.replacement)
			} else if (typeof rule.replacement === "string") {
				// 字符串替换（支持分组）
				result = result.replace(regex, rule.replacement)
			}
		} catch (error) {
			console.warn(`Failed to apply regex rule ${rule.id || "unknown"}:`, error)
		}
	})

	return result
}

/**
 * 还原被保护的槽位
 */
function restoreSlots(text: string): string {
	return text.replace(SLOT_RE, (_m, raw) => raw)
}

/**
 * 将AstRule转换为TagRule（用于AST解析器）
 * 修复：确保所有预定义的标签类型都能被AST解析器识别，不管规则是否启用
 */
function convertAstRulesToTagRules(astRules: AstRule[]): TagRule[] {
	const tagRules: TagRule[] = []

	// 预定义的节点类型到标签名的映射 - 不管规则是否启用都要创建
	const nodeTypeToTagNames: Record<string, string[]> = {
		thinking: ["thinking", "思考", "think", "Think", "ThinkingProcess", "思索"],
		UpdateVariable: ["UpdateVariable"],
		variables: ["variables", "variable"],
		meta: ["meta", "Meta"],
		code: ["code"],
		tips: ["Tips", "Tip"],
	}

	// 首先为所有预定义的节点类型创建TagRule，确保AST解析器能识别这些标签
	for (const [nodeType, tagNames] of Object.entries(nodeTypeToTagNames)) {
		// 添加同名通用映射到别名列表中
		const allTagNames = [...new Set([...tagNames, nodeType.toLowerCase(), nodeType])]

		// 查找是否有对应的启用规则
		const matchingRule = astRules.find((rule) => rule.nodeType === nodeType && rule.enabled)

		tagRules.push({
			names: allTagNames,
			type: nodeType as ASTNodeType,
			defaultCollapsed:
				matchingRule?.params?.defaultCollapsed ??
				matchingRule?.params?.defaultFolded ??
				getDefaultCollapsedByType(nodeType),
			isBlockLevel: true,
		})
	}

	// 然后处理其他自定义的AST规则
	for (const rule of astRules) {
		if (!rule.nodeType) continue

		// 如果是预定义类型，跳过（已经处理过）
		if (nodeTypeToTagNames[rule.nodeType]) continue

		// 为每个节点类型添加同名通用映射 + 别名
		const tagNames = [rule.nodeType.toLowerCase(), rule.nodeType]

		// 如果rule中有额外的别名配置，也添加进来
		if (rule.params?.aliases && Array.isArray(rule.params.aliases)) {
			tagNames.push(...rule.params.aliases)
		}

		tagRules.push({
			names: [...new Set(tagNames)], // 去重
			type: rule.nodeType as ASTNodeType,
			defaultCollapsed: rule.params?.defaultCollapsed ?? rule.params?.defaultFolded,
			isBlockLevel: true,
		})
	}

	return tagRules
}

/**
 * 根据节点类型和标签名找到匹配的AST规则
 */
function findMatchingRule(nodeType: string, tagName: string, astRules: AstRule[]): AstRule | null {
	// 直接根据nodeType查找规则，因为AST解析器已经正确识别了节点类型
	for (const rule of astRules) {
		if (rule.nodeType === nodeType) {
			return rule
		}
	}

	return null
}

/**
 * 递归处理AST节点（从最深的节点开始）
 */
function processASTNode(
	node: ASTNode,
	originalText: string,
	astRules: AstRule[],
	processedNodes: Set<ASTNode> = new Set(),
): ProcessedBlock {
	// 避免重复处理
	if (processedNodes.has(node)) {
		return {
			type: "text",
			content: "",
			start: node.startPos,
			end: node.endPos,
			id: `text-${node.startPos}-${node.endPos}`,
		}
	}
	processedNodes.add(node)

	// 首先递归处理所有子节点（从最深的节点开始）
	const processedChildren: ProcessedBlock[] = []
	if (node.children && node.children.length > 0) {
		for (const child of node.children) {
			processedChildren.push(processASTNode(child, originalText, astRules, processedNodes))
		}
	}

	// 查找匹配的AST规则
	const matchingRule = findMatchingRule(node.type, node.rawTag || "", astRules)
	// console.log("Processing AST Node:", node.type, "Matching Rule:", matchingRule ? matchingRule.id : "None", node.content)
	if (!matchingRule) {
		// console.warn("找不到对应AST规则，降级为文本块，保留原始HTML标签:", node.type, node.rawTag)
		// 没有匹配的规则，降级为文本块，保留原始HTML标签
		const originalContent = originalText.slice(node.startPos, node.endPos)
		return {
			type: "text", // 降级为真正的文本类型
			content: originalContent, // 保留包含原始HTML标签的内容
			start: node.startPos,
			end: node.endPos,
			id: `text-${node.startPos}-${node.endPos}`,
			children: undefined, // 文本块不应该有子节点
		}
	}

	// 根据action类型处理节点
	const action = matchingRule.action || "fold"

	const baseBlock: ProcessedBlock = {
		type: node.type,
		content: node.content, // AST解析器已经提取了内容
		start: node.startPos,
		end: node.endPos,
		id: `${node.type}-${node.startPos}-${node.endPos}`,
		action,
		params: matchingRule.params,
		processor: matchingRule.processor,
		isComplete: node.isComplete,
		rawTag: node.rawTag,
		originalText: originalText.slice(node.startPos, node.endPos),
		children: processedChildren.length > 0 ? processedChildren : undefined,
	}

	// 根据不同的action类型设置额外的属性
	switch (action) {
		case "fold":
			baseBlock.defaultCollapsed =
				matchingRule.params?.defaultCollapsed ??
				matchingRule.params?.defaultFolded ??
				getDefaultCollapsedByType(node.type)
			break

		case "highlight":
			baseBlock.highlight = true
			break

		case "wrap":
			baseBlock.wrapperClass = matchingRule.params?.wrapperClass ?? `${node.type}-wrapper`
			break

		case "hide":
			baseBlock.hidden = true
			break

		case "replace":
			// replace action可能需要特殊处理
			if (matchingRule.params?.replacement) {
				if (typeof matchingRule.params.replacement === "function") {
					baseBlock.content = matchingRule.params.replacement(node.content)
				} else {
					baseBlock.content = matchingRule.params.replacement
				}
			}
			break

		case "custom":
			// custom需要processor函数名
			if (!matchingRule.processor) {
				console.warn(`Custom action requires processor for type: ${node.type}`)
			}
			break
	}

	return baseBlock
}

/**
 * 根据类型获取默认折叠状态
 */
function getDefaultCollapsedByType(type: ASTNodeType): boolean {
	const collapsedTypes = new Set(["thinking", "meta"])
	return collapsedTypes.has(type)
}

/**
 * 使用真正的AST系统处理文本
 *
 * 处理流程：
 * 1. 使用AST解析器提取完整的DOM结构
 * 2. 根据配置的AST规则处理每个节点
 * 3. 从最深的节点开始递归处理
 */
function processWithRealAST(
	originalText: string,
	astRules: AstRule[],
	regexRules: ReplaceRule[],
	regexMixins: Record<string, any> = {},
): ProcessedBlock[] {
	if (!originalText) {
		return [{ type: "text", content: originalText, start: 0, end: originalText.length, id: "text-empty" }]
	}

	try {
		// 第一阶段：应用保护性正则替换（保护代码块等特殊内容）
		const protectedText = applyRegexReplacements(originalText, regexRules)

		// 第二阶段：应用增强的正则处理（用户自定义替换规则）
		const processedText = applyEnhancedRegexProcessing(protectedText, regexMixins)

		// 第二阶段：AST解析 - 提取完整的DOM结构
		const tagRules = convertAstRulesToTagRules(astRules)

		if (tagRules.length === 0) {
			// 没有AST规则，返回还原后的文本
			return [
				{
					type: "text",
					content: restoreSlots(protectedText),
					start: 0,
					end: protectedText.length,
					id: "text-no-rules",
				},
			]
		}

		// 使用AST解析器解析文本，获取完整的DOM结构
		const astNodes = parseTextToAST(processedText, tagRules)

		if (astNodes.length === 0) {
			// 没有找到AST节点，返回还原后的文本
			return [
				{
					type: "text",
					content: restoreSlots(protectedText),
					start: 0,
					end: protectedText.length,
					id: "text-no-ast-nodes",
				},
			]
		}
		// console.log("[ALL Nodes]", astNodes)
		// 第三阶段：根据AST规则处理节点（从最深的节点开始）
		const processedBlocks: ProcessedBlock[] = []
		const processedNodes = new Set<ASTNode>()

		for (const node of astNodes) {
			const processedBlock = processASTNode(node, processedText, astRules, processedNodes)

			// 对于hide action，不添加到结果中
			if (processedBlock.hidden) {
				console.log("[Hiding block]:", processedBlock)
				continue
			}

			processedBlocks.push(processedBlock)
		}

		return processedBlocks.length > 0
			? processedBlocks
			: [
					{
						type: "text",
						content: restoreSlots(processedText),
						start: 0,
						end: processedText.length,
						id: "text-fallback",
					},
				]
	} catch (error) {
		console.warn("AST处理失败，回退到简单文本处理:", error)
		return [
			{
				type: "text",
				content: originalText,
				start: 0,
				end: originalText.length,
				id: "text-error-fallback",
			},
		]
	}
}

/**
 * Markdown处理器Hook - 基于真正的AST系统
 *
 * @param markdown 要处理的markdown文本
 * @returns 处理后的blocks数组
 */
export function useMarkdownProcessor(markdown?: string): ProcessedBlock[] {
	const { outputStreamProcessorConfig } = useExtensionState()

	// 加载mixin规则
	const customRulesFiles = useMemo(
		() => outputStreamProcessorConfig?.customRulesFiles || { regexMixins: [], astMixins: [] },
		[outputStreamProcessorConfig?.customRulesFiles],
	)

	const { regexMixins } = useMixinRules(customRulesFiles)

	const processedBlocks = useMemo(() => {
		if (!markdown) {
			return []
		}

		const enabledRules = outputStreamProcessorConfig?.enabledRules || { regex: {}, ast: {} }
		const rulesConfig = outputStreamProcessorConfig?.builtinRulesConfig || {}

		// // DEBUG: Log the rules we received for rendering
		// console.log("[useMarkdownProcessor] Rules received for rendering:", {
		//     outputStreamProcessorConfigExists: !!outputStreamProcessorConfig,
		//     enabledRulesCount: {
		//         total: Object.keys(enabledRules).length,
		//         regex: Object.keys(enabledRules.regex || {}).length,
		//         ast: Object.keys(enabledRules.ast || {}).length
		//     },
		//     enabledRulesKeys: {
		//         regex: Object.keys(enabledRules.regex || {}),
		//         ast: Object.keys(enabledRules.ast || {})
		//     },
		//     enabledRulesSample: {
		//         regex: Object.values(enabledRules.regex || {}).slice(0, 2).map(r => ({ id: r.id, name: r.name, enabled: r.enabled, pattern: r.pattern?.substring(0, 50) })),
		//         ast: Object.values(enabledRules.ast || {}).slice(0, 2).map(r => ({ id: r.id, name: r.name, enabled: r.enabled, nodeType: r.nodeType, action: r.action }))
		//     }
		// })
		// console.log("[useMarkdownProcessor]AAA ",outputStreamProcessorConfig)

		// ========== 阶段1：收集正则替换规则（仅用于保护代码块等） ==========

		const regexReplacements: ReplaceRule[] = [
			// 保护代码块 ```...``` 或 ~~~...~~~
			{
				re: /(^|[\r\n])(```|~~~)[^\r\n]*[\r\n][\s\S]*?\2(?=[\r\n]|$)/g,
				replace: (m: string) => (m.startsWith("\n") ? "\n" : "") + `\u0000__SLOT__${m}\u0000`,
			},
			// 保护行内代码 `...`
			{
				re: /`[^`\r\n]+`/g,
				replace: (m: string) => `\u0000__SLOT__${m}\u0000`,
			},
		]

		// 添加所有启用的正则规则（包括内建和自定义，已通过source标记区分）
		const appliedRegexCount = regexReplacements.length
		Object.values(enabledRules.regex as any).forEach((rule: any) => {
			if (rule?.enabled && rule.replacement) {
				regexReplacements.push({
					re: new RegExp(rule.pattern ?? "", rule.flags || "g"),
					replace: rule.replacement,
				})
			}
		})
		// console.log(`[useMarkdownProcessor] Applied regex rules: ${regexReplacements.length - appliedRegexCount} additional rules, total: ${regexReplacements.length}`)

		// ========== 阶段2：收集AST规则 ==========

		const astRulesToApply: AstRule[] = []

		// 添加所有启用的AST规则（包括内建和自定义，已通过source标记区分）
		Object.values(enabledRules.ast as any).forEach((rule: any) => {
			if (rule?.enabled) {
				astRulesToApply.push({
					id: rule.id,
					enabled: rule.enabled,
					description: rule.description,
					nodeType: rule.nodeType,
					nodeAttributes: rule.nodeAttributes,
					action: rule.action,
					priority: rule.priority,
					processor: rule.processor,
					params: rule.params || {},
					recursive: rule.recursive,
					dependsOn: rule.dependsOn || [],
				})
			}
		})

		// console.log(`[useMarkdownProcessor] Applied AST rules: ${astRulesToApply.length} rules`, {
		//     astRulesSample: astRulesToApply.slice(0, 3).map(r => ({
		//         id: r.id,
		//         nodeType: r.nodeType,
		//         action: r.action,
		//         enabled: r.enabled,
		//         description: r.description?.substring(0, 50)
		//     }))
		// })

		// ========== 阶段3：使用真正的AST系统处理 ==========

		const blocks = processWithRealAST(markdown, astRulesToApply, regexReplacements, regexMixins)

		// console.log(`[useMarkdownProcessor] Final processing result: ${blocks.length} blocks`, {
		//     blocksSample: blocks.slice(0, 3).map(b => ({
		//         type: b.type,
		//         id: b.id,
		//         hasChildren: !!b.children && b.children.length > 0,
		//         action: b.action,
		//         defaultCollapsed: b.defaultCollapsed
		//     }))
		// })

		return blocks
	}, [markdown, outputStreamProcessorConfig, regexMixins])

	return processedBlocks
}
