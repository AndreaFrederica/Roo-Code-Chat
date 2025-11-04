/**
 * 内置正则表达式规则配置
 *
 * 静态的内置规则配置，用于基本的文本处理
 */

export interface RegexRule {
	id: string
	enabled: boolean
	pattern: string
	flags?: string
	description: string
	replacement?: string
	toType?: string
	defaultCollapsed?: boolean
	dependsOn?: string[]
}

export interface RegexRuleDefinition extends Omit<RegexRule, "id"> {
	id?: string
}

export interface RegexRulesConfig {
	[key: string]: RegexRuleDefinition
}

/**
 * 默认的正则表达式规则
 * 专注于预处理、查找替换、简单文本处理，不包含折叠功能
 * 折叠功能由AST规则负责
 */
export const DEFAULT_REGEX_RULES: RegexRulesConfig = {
	// 文本预处理相关
	whitespaceNormalization: {
		id: "be5b88ef-f86a-47c6-b588-a8e2bd585261",
		enabled: true,
		pattern: "\\n{3,}",
		flags: "g",
		description: "多余空白行规范化"
	},
	tabNormalization: {
		id: "6aed7301-233e-4909-8db5-53b389207394",
		enabled: true,
		pattern: "\\t",
		flags: "g",
		description: "制表符转换为空格"
	},

	// 内容提取和替换
	linkNormalization: {
		id: "d5954e0a-90a0-4409-94d4-084a456156f0",
		enabled: true,
		pattern: "\\[([^\\]]+)\\]\\(([^)]+)\\)",
		flags: "g",
		description: "链接规范化处理"
	},
	imageAltText: {
		id: "fb977bd1-c0e8-429b-84bc-fbe1281b0047",
		enabled: true,
		pattern: "!\\[([^\\]]*)\\]",
		flags: "g",
		description: "图片alt文本提取"
	},

	// 特殊标记处理
	htmlCommentRemoval: {
		id: "637a0608-bbd0-44a5-97d7-528e9d206b5a",
		enabled: true,
		pattern: "<!--[^>]*-->",
		flags: "g",
		description: "HTML注释移除"
	},
	htmlTagCleanup: {
		id: "ed28e802-b0ec-49e9-b285-219a0a214a16",
		enabled: true,
		pattern: "<[^>]+>",
		flags: "g",
		description: "HTML标签清理"
	},

	// 内容注入相关
	timestampInjection: {
		id: "22dfbf00-5b8e-41ba-ac84-da70cbc8c065",
		enabled: true,
		pattern: "\\{\\{timestamp\\}\\}",
		flags: "g",
		description: "时间戳注入"
	},
	variableInjection: {
		id: "64804429-f02d-454f-9848-283833682896",
		enabled: true,
		pattern: "\\{\\{([^}]+)\\}\\}",
		flags: "g",
		description: "变量注入"
	},
	dateFormat: {
		id: "036d5f14-bff3-474b-ba40-607ffdfdded8",
		enabled: true,
		pattern: "\\{\\{date:\\s*([^}]+)\\}\\}",
		flags: "g",
		description: "日期格式化"
	},

	// 文本清理和优化
	trailingSpaces: {
		id: "ccff7964-6668-4ba0-bd17-9a19469ce31a",
		enabled: true,
		pattern: "[ \\t]+$",
		flags: "gm",
		description: "行尾空白字符清理"
	},
	multipleSpaces: {
		id: "3e6be00f-82df-4990-8467-d0a8a902387e",
		enabled: true,
		pattern: "  +",
		flags: "g",
		description: "多余空格清理"
	},
	// cspell:disable-next-line - zwnbsp: Zero Width Non-Breaking Space (Unicode character)
	zwnbspCleanup: {
		id: "a0a32c59-31c4-4109-9a9f-f7289c92708c",
		enabled: true,
		pattern: "\\uFEFF",
		flags: "g",
		description: "零宽非断空格清理"
	},

	// 内容验证和标记
	brokenLinkDetection: {
		id: "c6f709b4-0c35-4fa7-aeb5-b0eb5b71e6d0",
		enabled: true,
		pattern: "\\[([^\\]]+)\\]\\(\\s*\\)",
		flags: "g",
		description: "破损链接检测"
	},
	emptyLinkDetection: {
		id: "f830146b-a61d-4828-83a4-189c629c3c57",
		enabled: true,
		pattern: "\\[\\s*\\]\\([^)]+\\)",
		flags: "g",
		description: "空链接文本检测"
	},

	// 特殊内容处理
	citationFormat: {
		id: "e5f4833d-c1a1-459a-8394-bea55e837747",
		enabled: true,
		pattern: "\\[@([^\\]]+)\\]",
		flags: "g",
		description: "引用格式标准化"
	},
	footnoteFormat: {
		id: "df27142d-4fa0-4f04-8aaa-0d4717c66f97",
		enabled: true,
		pattern: "\\[^([^\\]]+)\\]",
		flags: "g",
		description: "脚注格式处理"
	},
	// Tips 提示预处理（将行内Tips转换为AST标签，默认关闭）
	tipsInlineWrap: {
		id: "c1ba7309-cbb3-4fe6-8a78-1289eb5a993e",
		enabled: false,
		pattern: "^Tips\\s*:\\s*(?<content>.+)$",
		flags: "gim",
		replacement: "<Tips>$<content></Tips>",
		description: "Tips 提示转标签预处理",
		dependsOn: ["ast:tips"]
	},

	// 内容增强
	emojiShortcode: {
		id: "5cb1dc33-596f-4f93-ac8f-984dd79b3c5b",
		enabled: true,
		pattern: ":([a-zA-Z0-9_+-]+):",
		flags: "g",
		description: "表情符号短代码"
	},
	smartyPants: {
		id: "112fbab6-af7c-4f9f-b8fa-71ba02d8605f",
		enabled: true,
		pattern: '"([^"]+)"',
		flags: "g",
		description: "智能引号转换"
	},

	// 代码相关（仅用于预处理，不用于折叠）
	codeLanguageDetection: {
		id: "8b811b1c-3624-4b1a-a0f4-4a1e7c0a5bbb",
		enabled: true,
		pattern: "```(\\w+)",
		flags: "g",
		description: "代码语言检测"
	},
	inlineCodeEscape: {
		id: "0bf8c5ca-2a3c-4560-be14-3e78f85d78f8",
		enabled: true,
		pattern: "`([^`]+)`",
		flags: "g",
		description: "行内代码转义处理"
	},

	// 数学公式相关（仅用于预处理，不用于折叠）
	mathDelimiterCleanup: {
		id: "eec40548-3ffb-4c78-ab6e-cf145d702db2",
		enabled: true,
		pattern: "\\$\\$\\s*",
		flags: "g",
		description: "数学公式分隔符清理"
	},
	inlineMathCleanup: {
		id: "2e5376dd-c22e-47bd-8c09-9a9cd327dc7f",
		enabled: true,
		pattern: "\\s*\\$",
		flags: "g",
		description: "行内数学公式分隔符清理"
	},

	// 表格相关（仅用于预处理和格式化）
	tableAlignment: {
		id: "6d5be680-de34-4713-aa8a-4a0736f40278",
		enabled: true,
		pattern: "^\\|([^|]+)\\|$",
		flags: "gm",
		description: "表格对齐处理"
	},
	tableSeparatorFormat: {
		id: "a998115c-2e10-46a0-af67-c099bec9f676",
		enabled: true,
		pattern: "^\\|[-\\s|:]+\\|$",
		flags: "gm",
		description: "表格分隔符格式化"
	},

	// 列表相关（仅用于预处理）
	listIndentation: {
		id: "ec385d7c-affb-4c1a-b795-81321ed6ddd6",
		enabled: true,
		pattern: "^(\\s*)([-*+])\\s+",
		flags: "gm",
		description: "列表缩进规范化"
	},
	orderedListNumbering: {
		id: "580a5577-fcae-4edb-84f4-9a933ced11bc",
		enabled: true,
		pattern: "^(\\s*)\\d+\\.\\s+",
		flags: "gm",
		description: "有序列表编号规范化"
	},

	// 引用相关（仅用于预处理）
	blockquoteCleanup: {
		id: "b3d6a250-5144-4ca7-ab95-0615bf910490",
		enabled: true,
		pattern: "^>(>\\s*)?",
		flags: "gm",
		description: "引用块清理"
	},

	// 标题相关（仅用于预处理）
	headingCleanup: {
		id: "85e2ccf4-36cd-4166-aa89-d2c18e92c0ab",
		enabled: true,
		pattern: "#{1,6}\\s*(.+)",
		flags: "gm",
		description: "标题格式清理"
	},
	headingIdGeneration: {
		id: "f62f3fad-5e17-4d04-900f-28821a169946",
		enabled: true,
		pattern: "^(#{1,6})\\s+(.+)$",
		flags: "gm",
		description: "标题ID生成"
	},

	// 链接和图片
	link: {
		id: "c94184d6-33f7-47e3-b1fa-e5aeb8b7dc52",
		enabled: true,
		pattern: "\\[([^\\]]+)\\]\\(([^)]+)\\)",
		flags: "g",
		description: "Markdown链接"
	},
	image: {
		id: "1e2a23c4-f71c-4562-a86f-ba9245a44f6b",
		enabled: true,
		pattern: "!\\[([^\\]]*)\\]\\(([^)]+)\\)",
		flags: "g",
		description: "Markdown图片"
	},
	autolink: {
		id: "52224fd1-33e8-490f-ae67-6e52dccda804",
		enabled: true,
		pattern: "<(https?://[^>]+)>",
		flags: "g",
		description: "自动链接"
	},

	// 格式化相关
	bold: {
		id: "a5248d4e-e879-4186-8558-695b48018fe4",
		enabled: true,
		pattern: "\\*\\*([^*]+)\\*\\*",
		flags: "g",
		description: "粗体文本"
	},
	italic: {
		id: "dcb070ec-b7d1-4e41-b485-76d762a433d8",
		enabled: true,
		pattern: "\\*([^*]+)\\*",
		flags: "g",
		description: "斜体文本"
	},
	strikethrough: {
		id: "5fcd421c-1352-48a6-b014-47acf4804a34",
		enabled: true,
		pattern: "~~([^~]+)~~",
		flags: "g",
		description: "删除线文本"
	},

	// 代码相关
	htmlTag: {
		id: "42950923-dc27-42d5-a7f5-8358ee4ebc74",
		enabled: true,
		pattern: "<[^>]+>",
		flags: "g",
		description: "HTML标签"
	},
	htmlComment: {
		id: "f63f82a9-2abc-47a2-8538-569828d75f13",
		enabled: true,
		pattern: "<!--[^>]*-->",
		flags: "g",
		description: "HTML注释"
	},

	// 分割线
	horizontalRule: {
		id: "a2480bda-e5f5-4f98-88aa-abf3ba344f7a",
		enabled: true,
		pattern: "^[-*_]{3,}\\s*$",
		flags: "gm",
		description: "水平分割线"
	},

	// 脚注
	footnote: {
		id: "f3cebdba-ffe3-49c9-ad44-f165047378c7",
		enabled: true,
		pattern: "\\[^\\d+\\]:",
		flags: "g",
		description: "脚注定义"
	},
	footnoteRef: {
		id: "81d3fe17-a483-4760-a479-d4ea0471a32a",
		enabled: true,
		pattern: "\\[^\\d+\\]",
		flags: "g",
		description: "脚注引用"
	},

	// 任务列表
	taskList: {
		id: "4e9ae920-3cdf-4f8d-b02d-9fbc4bd03385",
		enabled: true,
		pattern: "^\\s*[-*+]\\s+\\[([ x])\\]\\s+",
		flags: "gm",
		description: "任务列表"
	},

	// 定义列表
	definitionList: {
		id: "7103d8eb-995b-4ca6-9b3d-12462c6ef0a6",
		enabled: true,
		pattern: "^([^:\\n]+):\\s*(.+)$",
		flags: "gm",
		description: "定义列表"
	},

	// 元数据
	frontMatter: {
		id: "4dbdab71-5d1c-4335-b093-5ddaf42cbe72",
		enabled: true,
		pattern: "^---\\n([\\s\\S]*?)\\n---",
		flags: "gm",
		description: "前置元数据"
	},

	// 特殊内容
	citation: {
		id: "9fd46a09-736a-4875-abe0-c5368c554d01",
		enabled: true,
		pattern: "\\[@([^\\]]+)\\]",
		flags: "g",
		description: "引用标记"
	},
	abbreviation: {
		id: "28c9e817-08ab-4bd2-900d-79ad0ae31087",
		enabled: true,
		pattern: "\\*\\[([^\\]]+)\\]:",
		flags: "g",
		description: "缩写定义"
	},

	// 高级语法
	subscript: {
		id: "e72b57d2-2718-4556-af2e-5a516673c65f",
		enabled: true,
		pattern: "~([^{\\s}]+)~",
		flags: "g",
		description: "下标"
	},
	superscript: {
		id: "284f07c6-a09f-4392-a041-eddcaf790a67",
		enabled: true,
		pattern: "\\^([^{\\s}]+)\\^",
		flags: "g",
		description: "上标"
	},
	highlight: {
		id: "9ac3b276-261b-4b54-a66c-82be07b0bccd",
		enabled: true,
		pattern: "==([^=]+)==",
		flags: "g",
		description: "高亮文本"
	},

	// 注入内容
	timestamp: {
		id: "913cd406-6ad6-49af-a05c-efff27b17818",
		enabled: true,
		pattern: "\\{\\{timestamp\\}\\}",
		flags: "g",
		description: "时间戳注入"
	},
	variable: {
		id: "4668c95e-b9e2-47e4-ba42-2a93a8c23894",
		enabled: true,
		pattern: "\\{\\{([^}]+)\\}\\}",
		flags: "g",
		description: "变量注入"
	},

	// 特殊标记
	callout: {
		id: "3c003ea1-5cd5-49f0-8c27-eb5317f1851b",
		enabled: true,
		pattern: "^>\\s*\\[!([^\\]]+)\\]",
		flags: "gm",
		description: "标注块"
	},
	details: {
		id: "8dd3278d-702c-4016-a26f-8acb4b8259bc",
		enabled: true,
		pattern: "<details\\b[^>]*>([\\s\\S]*?)</details>",
		flags: "g",
		description: "折叠详情块"
	},

	// 代码语法高亮
	codeHighlight: {
		id: "801c4b28-6345-499f-8343-b3867ff19c42",
		enabled: true,
		pattern: "```(\\w+)\\n([\\s\\S]*?)```",
		flags: "g",
		description: "语法高亮代码块"
	},

	// 表情符号
	emoji: {
		id: "d78718d6-aaae-4734-8f4c-9655e5b1a353",
		enabled: true,
		pattern: ":[a-zA-Z0-9_+-]+:",
		flags: "g",
		description: "表情符号"
	},

	// 智能引号
	smartQuotes: {
		id: "c371a18b-8faa-4298-8508-cfa20e20c774",
		enabled: true,
		pattern: '"([^"]+)"',
		flags: "g",
		description: "智能引号"
	},
	smartApostrophes: {
		id: "42cf99f7-d078-4a7c-98ce-42747d3236c4",
		enabled: true,
		pattern: "'([^']+)'",
		flags: "g",
		description: "智能撇号"
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
		code: {
			codeBlock: rules.codeBlock,
			inlineCode: rules.inlineCode,
			codeHighlight: rules.codeHighlight
		},
		math: {
			mathBlock: rules.mathBlock,
			inlineMath: rules.inlineMath
		},
		table: {
			table: rules.table,
			tableRow: rules.tableRow,
			tableSeparator: rules.tableSeparator
		},
		list: {
			unorderedList: rules.unorderedList,
			orderedList: rules.orderedList,
			nestedList: rules.nestedList,
			taskList: rules.taskList
		},
		heading: {
			atxHeading: rules.atxHeading,
			// cspell:disable-next-line - setext: Setext-style headings (underline-style Markdown headers)
			setextHeading: rules.setextHeading
		},
		blockquote: {
			blockquote: rules.blockquote,
			nestedBlockquote: rules.nestedBlockquote,
			callout: rules.callout
		},
		link: {
			link: rules.link,
			image: rules.image,
			autolink: rules.autolink
		},
		formatting: {
			bold: rules.bold,
			italic: rules.italic,
			strikethrough: rules.strikethrough,
			highlight: rules.highlight,
			subscript: rules.subscript,
			superscript: rules.superscript
		},
		html: {
			htmlTag: rules.htmlTag,
			htmlComment: rules.htmlComment,
			details: rules.details
		},
		structure: {
			horizontalRule: rules.horizontalRule,
			frontMatter: rules.frontMatter
		},
		reference: {
			footnote: rules.footnote,
			footnoteRef: rules.footnoteRef,
			citation: rules.citation,
			abbreviation: rules.abbreviation
		},
		injection: {
			timestamp: rules.timestamp,
			variable: rules.variable
		},
		advanced: {
			definitionList: rules.definitionList,
			emoji: rules.emoji,
			smartQuotes: rules.smartQuotes,
			smartApostrophes: rules.smartApostrophes
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
		id: key,
		enabled,
		pattern,
		flags: flags || '',
		description
	}
}
