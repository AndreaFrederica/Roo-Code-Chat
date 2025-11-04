/**
 * 内置正则表达式规则配置 (后端版本)
 * 专注于预处理、查找替换、简单文本处理，不包含折叠功能
 * 折叠功能由AST规则负责
 */

export interface RegexRule {
	enabled: boolean
	pattern: string
	flags?: string
	description: string
}

export interface RegexRulesConfig {
	[key: string]: RegexRule
}

/**
 * 默认的正则表达式规则
 * 专注于预处理、查找替换、简单文本处理
 */
export const DEFAULT_REGEX_RULES: RegexRulesConfig = {
	// 文本预处理相关
	whitespaceNormalization: {
		enabled: true,
		pattern: "\\n{3,}",
		flags: "g",
		description: "多余空白行规范化"
	},
	tabNormalization: {
		enabled: true,
		pattern: "\\t",
		flags: "g",
		description: "制表符转换为空格"
	},

	// 内容提取和替换
	linkNormalization: {
		enabled: true,
		pattern: "\\[([^\\]]+)\\]\\(([^)]+)\\)",
		flags: "g",
		description: "链接规范化处理"
	},
	imageAltText: {
		enabled: true,
		pattern: "!\\[([^\\]]*)\\]",
		flags: "g",
		description: "图片alt文本提取"
	},

	// 特殊标记处理
	htmlCommentRemoval: {
		enabled: true,
		pattern: "<!--[^>]*-->",
		flags: "g",
		description: "HTML注释移除"
	},
	htmlTagCleanup: {
		enabled: true,
		pattern: "<[^>]+>",
		flags: "g",
		description: "HTML标签清理"
	},

	// 内容注入相关
	timestampInjection: {
		enabled: true,
		pattern: "\\{\\{timestamp\\}\\}",
		flags: "g",
		description: "时间戳注入"
	},
	variableInjection: {
		enabled: true,
		pattern: "\\{\\{([^}]+)\\}\\}",
		flags: "g",
		description: "变量注入"
	},
	dateFormat: {
		enabled: true,
		pattern: "\\{\\{date:\\s*([^}]+)\\}\\}",
		flags: "g",
		description: "日期格式化"
	},

	// 文本清理和优化
	trailingSpaces: {
		enabled: true,
		pattern: "[ \\t]+$",
		flags: "gm",
		description: "行尾空白字符清理"
	},
	multipleSpaces: {
		enabled: true,
		pattern: "  +",
		flags: "g",
		description: "多余空格清理"
	},
	zwnbspCleanup: {
		enabled: true,
		pattern: "\\uFEFF",
		flags: "g",
		description: "零宽非断空格清理"
	},

	// 内容验证和标记
	brokenLinkDetection: {
		enabled: true,
		pattern: "\\[([^\\]]+)\\]\\(\\s*\\)",
		flags: "g",
		description: "破损链接检测"
	},
	emptyLinkDetection: {
		enabled: true,
		pattern: "\\[\\s*\\]\\([^)]+\\)",
		flags: "g",
		description: "空链接文本检测"
	},

	// 特殊内容处理
	citationFormat: {
		enabled: true,
		pattern: "\\[@([^\\]]+)\\]",
		flags: "g",
		description: "引用格式标准化"
	},
	footnoteFormat: {
		enabled: true,
		pattern: "\\[^([^\\]]+)\\]",
		flags: "g",
		description: "脚注格式处理"
	},

	// 内容增强
	emojiShortcode: {
		enabled: true,
		pattern: ":([a-zA-Z0-9_+-]+):",
		flags: "g",
		description: "表情符号短代码"
	},
	smartyPants: {
		enabled: true,
		pattern: '"([^"]+)"',
		flags: "g",
		description: "智能引号转换"
	},

	// 代码相关（仅用于预处理，不用于折叠）
	codeLanguageDetection: {
		enabled: true,
		pattern: "```(\\w+)",
		flags: "g",
		description: "代码语言检测"
	},
	inlineCodeEscape: {
		enabled: true,
		pattern: "`([^`]+)`",
		flags: "g",
		description: "行内代码转义处理"
	},

	// 数学公式相关（仅用于预处理，不用于折叠）
	mathDelimiterCleanup: {
		enabled: true,
		pattern: "\\$\\$\\s*",
		flags: "g",
		description: "数学公式分隔符清理"
	},
	inlineMathCleanup: {
		enabled: true,
		pattern: "\\s*\\$",
		flags: "g",
		description: "行内数学公式分隔符清理"
	},

	// 表格相关（仅用于预处理和格式化）
	tableAlignment: {
		enabled: true,
		pattern: "^\\|([^|]+)\\|$",
		flags: "gm",
		description: "表格对齐处理"
	},
	tableSeparatorFormat: {
		enabled: true,
		pattern: "^\\|[-\\s|:]+\\|$",
		flags: "gm",
		description: "表格分隔符格式化"
	},

	// 列表相关（仅用于预处理）
	listIndentation: {
		enabled: true,
		pattern: "^(\\s*)([-*+])\\s+",
		flags: "gm",
		description: "列表缩进规范化"
	},
	orderedListNumbering: {
		enabled: true,
		pattern: "^(\\s*)\\d+\\.\\s+",
		flags: "gm",
		description: "有序列表编号规范化"
	},

	// 引用相关（仅用于预处理）
	blockquoteCleanup: {
		enabled: true,
		pattern: "^>(>\\s*)?",
		flags: "gm",
		description: "引用块清理"
	},

	// 标题相关（仅用于预处理）
	headingCleanup: {
		enabled: true,
		pattern: "#{1,6}\\s*(.+)",
		flags: "gm",
		description: "标题格式清理"
	},
	headingIdGeneration: {
		enabled: true,
		pattern: "^(#{1,6})\\s+(.+)$",
		flags: "gm",
		description: "标题ID生成"
	},

	// 内容验证
	brokenImageDetection: {
		enabled: true,
		pattern: "!\\[\\s*\\]\\([^)]*\\)",
		flags: "g",
		description: "破损图片检测"
	},
	orphanedFormatting: {
		enabled: true,
		pattern: "\\*\\s*\\*|^\\*\\s*$",
		flags: "gm",
		description: "孤立格式化标记检测"
	},

	// 特殊字符处理
	smartQuotes: {
		enabled: true,
		pattern: "\"([^\"]+)\"",
		flags: "g",
		description: "智能引号转换"
	},
	smartApostrophes: {
		enabled: true,
		pattern: "'([^']+)'",
		flags: "g",
		description: "智能撇号转换"
	},
	emDashConversion: {
		enabled: true,
		pattern: "--",
		flags: "g",
		description: "短破折号转换"
	},
	enDashConversion: {
		enabled: true,
		pattern: " - ",
		flags: "g",
		description: "长破折号转换"
	},

	// 分割线处理
	horizontalRuleDetection: {
		enabled: true,
		pattern: "^[-*_]{3,}\\s*$",
		flags: "gm",
		description: "水平分割线检测"
	},

	// 内容分类标记
	codeBlockDetection: {
		enabled: true,
		pattern: "```[\\w\\s]*\\n[\\s\\S]*?```",
		flags: "g",
		description: "代码块区域标记"
	},
	mathBlockDetection: {
		enabled: true,
		pattern: "\\$\\$[\\s\\S]*?\\$\\$",
		flags: "g",
		description: "数学公式块区域标记"
	},
	tableDetection: {
		enabled: true,
		pattern: "\\|.*\\|",
		flags: "g",
		description: "表格区域标记"
	}
}

/**
 * 获取所有启用的正则规则
 */
export function getEnabledRegexRules(customRules?: RegexRulesConfig): RegexRulesConfig {
	const rules = { ...DEFAULT_REGEX_RULES, ...customRules }
	const enabled: RegexRulesConfig = {}

	for (const [key, rule] of Object.entries(rules)) {
		if (rule.enabled) {
			enabled[key] = rule
		}
	}

	return enabled
}

/**
 * 根据分类获取正则规则
 */
export function getRegexRulesByCategory(customRules?: RegexRulesConfig): Record<string, RegexRulesConfig> {
	const rules = { ...DEFAULT_REGEX_RULES, ...customRules }

	return {
		preprocessing: {
			whitespaceNormalization: rules.whitespaceNormalization,
			tabNormalization: rules.tabNormalization,
			trailingSpaces: rules.trailingSpaces,
			multipleSpaces: rules.multipleSpaces,
			zwnbspCleanup: rules.zwnbspCleanup
		},
		contentExtraction: {
			linkNormalization: rules.linkNormalization,
			imageAltText: rules.imageAltText,
			timestampInjection: rules.timestampInjection,
			variableInjection: rules.variableInjection,
			dateFormat: rules.dateFormat
		},
		cleanup: {
			htmlCommentRemoval: rules.htmlCommentRemoval,
			htmlTagCleanup: rules.htmlTagCleanup,
			brokenLinkDetection: rules.brokenLinkDetection,
			emptyLinkDetection: rules.emptyLinkDetection,
			brokenImageDetection: rules.brokenImageDetection,
			orphanedFormatting: rules.orphanedFormatting
		},
		formatting: {
			citationFormat: rules.citationFormat,
			footnoteFormat: rules.footnoteFormat,
			emojiShortcode: rules.emojiShortcode,
			smartyPants: rules.smartyPants,
			smartQuotes: rules.smartQuotes,
			smartApostrophes: rules.smartApostrophes,
			emDashConversion: rules.emDashConversion,
			enDashConversion: rules.enDashConversion
		},
		code: {
			codeLanguageDetection: rules.codeLanguageDetection,
			inlineCodeEscape: rules.inlineCodeEscape,
			codeBlockDetection: rules.codeBlockDetection
		},
		math: {
			mathDelimiterCleanup: rules.mathDelimiterCleanup,
			inlineMathCleanup: rules.inlineMathCleanup,
			mathBlockDetection: rules.mathBlockDetection
		},
		structure: {
			tableAlignment: rules.tableAlignment,
			tableSeparatorFormat: rules.tableSeparatorFormat,
			listIndentation: rules.listIndentation,
			orderedListNumbering: rules.orderedListNumbering,
			blockquoteCleanup: rules.blockquoteCleanup,
			headingCleanup: rules.headingCleanup,
			headingIdGeneration: rules.headingIdGeneration,
			horizontalRuleDetection: rules.horizontalRuleDetection,
			tableDetection: rules.tableDetection
		}
	}
}

/**
 * 验证正则规则
 */
export function validateRegexRule(rule: RegexRule): boolean {
	try {
		new RegExp(rule.pattern, rule.flags)
		return true
	} catch {
		return false
	}
}

/**
 * 创建新的正则规则
 */
export function createRegexRule(
	key: string,
	pattern: string,
	description: string,
	enabled: boolean = true,
	flags?: string
): RegexRule {
	return {
		enabled,
		pattern,
		flags: flags || '',
		description
	}
}