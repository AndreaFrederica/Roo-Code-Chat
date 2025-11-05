/**
 * 内置正则表达式规则配置
 *
 * 静态的内置规则配置，用于基本的文本处理
 */

export interface RegexRule {
	id: string
	name: string
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

export interface RegexRuleDefinition extends Omit<RegexRule, "id"> {
	id?: string
}

export interface RegexRulesConfig {
	[key: string]: RegexRule
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
		name: "whitespaceNormalization",
		enabled: false,
		pattern: "\\n{3,}",
		flags: "g",
		description: "多余空白行规范化",
	},
	tabNormalization: {
		id: "6aed7301-233e-4909-8db5-53b389207394",
		name: "tabNormalization",
		enabled: false,
		pattern: "\\t",
		flags: "g",
		description: "制表符转换为空格",
	},

	// 内容提取和替换
	linkNormalization: {
		id: "d5954e0a-90a0-4409-94d4-084a456156f0",
		name: "linkNormalization",
		enabled: false,
		pattern: "\\[([^\\]]+)\\]\\(([^)]+)\\)",
		flags: "g",
		description: "链接规范化处理",
	},
	imageAltText: {
		id: "fb977bd1-c0e8-429b-84bc-fbe1281b0047",
		name: "imageAltText",
		enabled: false,
		pattern: "!\\[([^\\]]*)\\]",
		flags: "g",
		description: "图片alt文本提取",
	},

	// 特殊标记处理
	htmlCommentRemoval: {
		id: "637a0608-bbd0-44a5-97d7-528e9d206b5a",
		name: "htmlCommentRemoval",
		enabled: false,
		pattern: "<!--[^>]*-->",
		flags: "g",
		description: "HTML注释移除",
	},
	htmlTagCleanup: {
		id: "ed28e802-b0ec-49e9-b285-219a0a214a16",
		name: "htmlTagCleanup",
		enabled: false,
		pattern: "<[^>]+>",
		flags: "g",
		description: "HTML标签清理",
	},

	// 内容注入相关
	timestampInjection: {
		id: "22dfbf00-5b8e-41ba-ac84-da70cbc8c065",
		name: "timestampInjection",
		enabled: false,
		pattern: "\\{\\{timestamp\\}\\}",
		flags: "g",
		replacementFunction: "timestamp",
		description: "时间戳注入",
		stage: "output",
		priority: 5,
		groups: [
			{
				name: "full",
				description: "完整时间戳",
				example: "{{timestamp}} → 2024-01-01T12:00:00.000Z",
			},
		],
	},
	variableInjection: {
		id: "64804429-f02d-454f-9848-283833682896",
		name: "variableInjection",
		enabled: false,
		pattern: "\\{\\{([^}]+)\\}\\}",
		flags: "g",
		replacementFunction: "variable",
		description: "变量注入",
		stage: "output",
		priority: 10,
		groups: [
			{
				name: "varName",
				description: "变量名称",
				example: "{{userName}} → [用户名变量值]",
			},
		],
	},
	dateFormat: {
		id: "036d5f14-bff3-474b-ba40-607ffdfdded8",
		name: "dateFormat",
		enabled: false,
		pattern: "\\{\\{date:\\s*([^}]+)\\}\\}",
		flags: "g",
		replacementFunction: "dateformat",
		description: "日期格式化",
		stage: "output",
		priority: 8,
		groups: [
			{
				name: "format",
				description: "日期格式",
				example: "{{date:short}} → 2024/01/01",
			},
		],
	},

	// 文本清理和优化
	trailingSpaces: {
		id: "ccff7964-6668-4ba0-bd17-9a19469ce31a",
		name: "trailingSpaces",
		enabled: false,
		pattern: "[ \\t]+$",
		flags: "gm",
		description: "行尾空白字符清理",
	},
	multipleSpaces: {
		id: "3e6be00f-82df-4990-8467-d0a8a902387e",
		name: "multipleSpaces",
		enabled: false,
		pattern: "  +",
		flags: "g",
		description: "多余空格清理",
	},
	// cspell:disable-next-line - zwnbsp: Zero Width Non-Breaking Space (Unicode character)
	zwnbspCleanup: {
		id: "a0a32c59-31c4-4109-9a9f-f7289c92708c",
		name: "zwnbspCleanup",
		enabled: false,
		pattern: "\\uFEFF",
		flags: "g",
		description: "零宽非断空格清理",
	},

	// 内容验证和标记
	brokenLinkDetection: {
		id: "c6f709b4-0c35-4fa7-aeb5-b0eb5b71e6d0",
		name: "brokenLinkDetection",
		enabled: false,
		pattern: "\\[([^\\]]+)\\]\\(\\s*\\)",
		flags: "g",
		description: "破损链接检测",
	},
	emptyLinkDetection: {
		id: "f830146b-a61d-4828-83a4-189c629c3c57",
		name: "emptyLinkDetection",
		enabled: false,
		pattern: "\\[\\s*\\]\\([^)]+\\)",
		flags: "g",
		description: "空链接文本检测",
	},

	// 特殊内容处理
	citationFormat: {
		id: "e5f4833d-c1a1-459a-8394-bea55e837747",
		name: "citationFormat",
		enabled: false,
		pattern: "\\[@([^\\]]+)\\]",
		flags: "g",
		description: "引用格式标准化",
	},
	footnoteFormat: {
		id: "df27142d-4fa0-4f04-8aaa-0d4717c66f97",
		name: "footnoteFormat",
		enabled: false,
		pattern: "\\[^([^\\]]+)\\]",
		flags: "g",
		description: "脚注格式处理",
	},
	// Tips 提示预处理（将行内Tips转换为AST标签，默认关闭）
	tipsInlineWrap: {
		id: "c1ba7309-cbb3-4fe6-8a78-1289eb5a993e",
		name: "tipsInlineWrap",
		enabled: true,
		pattern: "^Tips\\s*:\\s*(?<content>.+)$",
		flags: "gim",
		replacement: "<Tips>$<content></Tips>",
		description: "Tips 提示转标签预处理",
		dependsOn: ["ast:tips"],
		stage: "pre-ast",
		priority: 10,
		groups: [
			{
				name: "content",
				description: "Tips内容",
				example: "Tips: 这是一个提示",
			},
		],
	},

	// 内容增强
	emojiShortcode: {
		id: "5cb1dc33-596f-4f93-ac8f-984dd79b3c5b",
		name: "emojiShortcode",
		enabled: false,
		pattern: ":([a-zA-Z0-9_+-]+):",
		flags: "g",
		replacementFunction: "emoji",
		description: "表情符号短代码转换",
		stage: "post-ast",
		priority: 30,
		groups: [
			{
				name: "emojiName",
				description: "表情符号名称",
				example: ":smiley: → 😊",
			},
		],
	},
	smartyPants: {
		id: "112fbab6-af7c-4f9f-b8fa-71ba02d8605f",
		name: "smartyPants",
		enabled: false,
		pattern: '"([^"]+)"',
		flags: "g",
		replacementFunction: "smartQuotes",
		description: "智能引号转换",
		stage: "post-ast",
		priority: 35,
		groups: [
			{
				name: "content",
				description: "引号内容",
				example: '"hello" → "hello"',
			},
		],
	},

	// 代码相关（仅用于预处理，不用于折叠）
	codeLanguageDetection: {
		id: "8b811b1c-3624-4b1a-a0f4-4a1e7c0a5bbb",
		name: "codeLanguageDetection",
		enabled: false,
		pattern: "```(\\w+)",
		flags: "g",
		description: "代码语言检测",
	},
	inlineCodeEscape: {
		id: "0bf8c5ca-2a3c-4560-be14-3e78f85d78f8",
		name: "inlineCodeEscape",
		enabled: false,
		pattern: "`([^`]+)`",
		flags: "g",
		description: "行内代码转义处理",
	},

	// 数学公式相关（仅用于预处理，不用于折叠）
	mathDelimiterCleanup: {
		id: "eec40548-3ffb-4c78-ab6e-cf145d702db2",
		name: "mathDelimiterCleanup",
		enabled: false,
		pattern: "\\$\\$\\s*",
		flags: "g",
		description: "数学公式分隔符清理",
	},
	inlineMathCleanup: {
		id: "2e5376dd-c22e-47bd-8c09-9a9cd327dc7f",
		name: "inlineMathCleanup",
		enabled: false,
		pattern: "\\s*\\$",
		flags: "g",
		description: "行内数学公式分隔符清理",
	},

	// 表格相关（仅用于预处理和格式化）
	tableAlignment: {
		id: "6d5be680-de34-4713-aa8a-4a0736f40278",
		name: "tableAlignment",
		enabled: false,
		pattern: "^\\|([^|]+)\\|$",
		flags: "gm",
		description: "表格对齐处理",
	},
	tableSeparatorFormat: {
		id: "a998115c-2e10-46a0-af67-c099bec9f676",
		name: "tableSeparatorFormat",
		enabled: false,
		pattern: "^\\|[-\\s|:]+\\|$",
		flags: "gm",
		description: "表格分隔符格式化",
	},

	// 列表相关（仅用于预处理）
	listIndentation: {
		id: "ec385d7c-affb-4c1a-b795-81321ed6ddd6",
		name: "listIndentation",
		enabled: false,
		pattern: "^(\\s*)([-*+])\\s+",
		flags: "gm",
		description: "列表缩进规范化",
	},
	orderedListNumbering: {
		id: "580a5577-fcae-4edb-84f4-9a933ced11bc",
		name: "orderedListNumbering",
		enabled: false,
		pattern: "^(\\s*)\\d+\\.\\s+",
		flags: "gm",
		description: "有序列表编号规范化",
	},

	// 引用相关（仅用于预处理）
	blockquoteCleanup: {
		id: "b3d6a250-5144-4ca7-ab95-0615bf910490",
		name: "blockquoteCleanup",
		enabled: false,
		pattern: "^>(>\\s*)?",
		flags: "gm",
		description: "引用块清理",
	},

	// 标题相关（仅用于预处理）
	headingCleanup: {
		id: "85e2ccf4-36cd-4166-aa89-d2c18e92c0ab",
		name: "headingCleanup",
		enabled: false,
		pattern: "#{1,6}\\s*(.+)",
		flags: "gm",
		description: "标题格式清理",
	},
	headingIdGeneration: {
		id: "f62f3fad-5e17-4d04-900f-28821a169946",
		name: "headingIdGeneration",
		enabled: false,
		pattern: "^(#{1,6})\\s+(.+)$",
		flags: "gm",
		description: "标题ID生成",
	},

	// 链接和图片
	link: {
		id: "c94184d6-33f7-47e3-b1fa-e5aeb8b7dc52",
		name: "link",
		enabled: false,
		pattern: "\\[([^\\]]+)\\]\\(([^)]+)\\)",
		flags: "g",
		description: "Markdown链接",
	},
	image: {
		id: "1e2a23c4-f71c-4562-a86f-ba9245a44f6b",
		name: "image",
		enabled: false,
		pattern: "!\\[([^\\]]*)\\]\\(([^)]+)\\)",
		flags: "g",
		description: "Markdown图片",
	},
	autolink: {
		id: "52224fd1-33e8-490f-ae67-6e52dccda804",
		name: "autolink",
		enabled: false,
		pattern: "<(https?://[^>]+)>",
		flags: "g",
		description: "自动链接",
	},

	// 格式化相关
	bold: {
		id: "a5248d4e-e879-4186-8558-695b48018fe4",
		name: "bold",
		enabled: false,
		pattern: "\\*\\*([^*]+)\\*\\*",
		flags: "g",
		description: "粗体文本",
	},
	italic: {
		id: "dcb070ec-b7d1-4e41-b485-76d762a433d8",
		name: "italic",
		enabled: false,
		pattern: "\\*([^*]+)\\*",
		flags: "g",
		description: "斜体文本",
	},
	strikethrough: {
		id: "5fcd421c-1352-48a6-b014-47acf4804a34",
		name: "strikethrough",
		enabled: false,
		pattern: "~~([^~]+)~~",
		flags: "g",
		description: "删除线文本",
	},

	// 代码相关
	htmlTag: {
		id: "42950923-dc27-42d5-a7f5-8358ee4ebc74",
		name: "htmlTag",
		enabled: false,
		pattern: "<[^>]+>",
		flags: "g",
		description: "HTML标签",
	},
	htmlComment: {
		id: "f63f82a9-2abc-47a2-8538-569828d75f13",
		name: "htmlComment",
		enabled: false,
		pattern: "<!--[^>]*-->",
		flags: "g",
		description: "HTML注释",
	},

	// 分割线
	horizontalRule: {
		id: "a2480bda-e5f5-4f98-88aa-abf3ba344f7a",
		name: "horizontalRule",
		enabled: false,
		pattern: "^[-*_]{3,}\\s*$",
		flags: "gm",
		description: "水平分割线",
	},

	// 脚注
	footnote: {
		id: "f3cebdba-ffe3-49c9-ad44-f165047378c7",
		name: "footnote",
		enabled: false,
		pattern: "\\[^\\d+\\]:",
		flags: "g",
		description: "脚注定义",
	},
	footnoteRef: {
		id: "81d3fe17-a483-4760-a479-d4ea0471a32a",
		name: "footnoteRef",
		enabled: false,
		pattern: "\\[(\\d+)\\]",
		flags: "g",
		replacementFunction: "footnoteRef",
		description: "脚注引用转换",
		stage: "post-ast",
		priority: 40,
		groups: [
			{
				name: "footnoteNum",
				description: "脚注编号",
				example: "[1] → <sup>[1]</sup>",
			},
		],
	},

	// 任务列表
	taskList: {
		id: "4e9ae920-3cdf-4f8d-b02d-9fbc4bd03385",
		name: "taskList",
		enabled: false,
		pattern: "^\\s*[-*+]\\s+\\[([ x])\\]\\s+",
		flags: "gm",
		description: "任务列表",
	},

	// 定义列表
	definitionList: {
		id: "7103d8eb-995b-4ca6-9b3d-12462c6ef0a6",
		name: "definitionList",
		enabled: false,
		pattern: "^([^:\\n]+):\\s*(.+)$",
		flags: "gm",
		description: "定义列表",
	},

	// 元数据
	frontMatter: {
		id: "4dbdab71-5d1c-4335-b093-5ddaf42cbe72",
		name: "frontMatter",
		enabled: false,
		pattern: "^---\\n([\\s\\S]*?)\\n---",
		flags: "gm",
		description: "前置元数据",
	},

	// 特殊内容
	citation: {
		id: "9fd46a09-736a-4875-abe0-c5368c554d01",
		name: "citation",
		enabled: false,
		pattern: "\\[@([^\\]]+)\\]",
		flags: "g",
		description: "引用标记",
	},
	abbreviation: {
		id: "28c9e817-08ab-4bd2-900d-79ad0ae31087",
		name: "abbreviation",
		enabled: false,
		pattern: "\\*\\[([^\\]]+)\\]:",
		flags: "g",
		description: "缩写定义",
	},

	// 高级语法
	subscript: {
		id: "e72b57d2-2718-4556-af2e-5a516673c65f",
		name: "subscript",
		enabled: false,
		pattern: "~([^{\\s}]+)~",
		flags: "g",
		description: "下标",
	},
	superscript: {
		id: "284f07c6-a09f-4392-a041-eddcaf790a67",
		name: "superscript",
		enabled: false,
		pattern: "\\^([^{\\s}]+)\\^",
		flags: "g",
		description: "上标",
	},
	highlight: {
		id: "9ac3b276-261b-4b54-a66c-82be07b0bccd",
		name: "highlight",
		enabled: false,
		pattern: "==([^=]+)==",
		flags: "g",
		description: "高亮文本",
	},

	// 注入内容
	timestamp: {
		id: "913cd406-6ad6-49af-a05c-efff27b17818",
		name: "timestamp",
		enabled: false,
		pattern: "\\{\\{timestamp\\}\\}",
		flags: "g",
		description: "时间戳注入",
	},
	variable: {
		id: "4668c95e-b9e2-47e4-ba42-2a93a8c23894",
		name: "variable",
		enabled: false,
		pattern: "\\{\\{([^}]+)\\}\\}",
		flags: "g",
		description: "变量注入",
	},

	// 特殊标记
	callout: {
		id: "3c003ea1-5cd5-49f0-8c27-eb5317f1851b",
		name: "callout",
		enabled: false,
		pattern: "^>\\s*\\[!([^\\]]+)\\]",
		flags: "gm",
		description: "标注块",
	},
	details: {
		id: "8dd3278d-702c-4016-a26f-8acb4b8259bc",
		name: "details",
		enabled: false,
		pattern: "<details\\b[^>]*>([\\s\\S]*?)</details>",
		flags: "g",
		description: "折叠详情块",
	},

	// 代码语法高亮
	codeHighlight: {
		id: "801c4b28-6345-499f-8343-b3867ff19c42",
		name: "codeHighlight",
		enabled: false,
		pattern: "```(\\w+)\\n([\\s\\S]*?)```",
		flags: "g",
		description: "语法高亮代码块",
	},

	// 表情符号
	emoji: {
		id: "d78718d6-aaae-4734-8f4c-9655e5b1a353",
		name: "emoji",
		enabled: false,
		pattern: ":[a-zA-Z0-9_+-]+:",
		flags: "g",
		description: "表情符号",
	},

	// 智能引号
	smartQuotes: {
		id: "c371a18b-8faa-4298-8508-cfa20e20c774",
		name: "smartQuotes",
		enabled: false,
		pattern: '"([^"]+)"',
		flags: "g",
		description: "智能引号",
	},
	smartApostrophes: {
		id: "42cf99f7-d078-4a7c-98ce-42747d3236c4",
		name: "smartApostrophes",
		enabled: false,
		pattern: "'([^']+)'",
		flags: "g",
		description: "智能撇号",
	},
}
