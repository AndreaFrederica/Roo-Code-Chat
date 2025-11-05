/**
 * 内置AST规则配置
 *
 * 静态的内置AST规则配置，用于基本的AST节点处理
 */

export interface AstRule {
	id: string
	name: string
	enabled: boolean
	description: string
	// 匹配的节点类型（必需）
	nodeType: string
	// 可选的节点属性匹配条件
	nodeAttributes?: Record<string, any>
	// 处理方式（必需）
	action: "fold" | "highlight" | "replace" | "wrap" | "hide" | "custom"
	// 处理优先级
	priority?: number
	// 自定义处理函数名称（当action为'custom'时使用）
	processor?: string
	// 处理参数
	params?: Record<string, any>
	// 是否应该递归处理子节点
	recursive?: boolean
	dependsOn?: string[]
}

export interface AstRulesConfig {
	[key: string]: AstRule
}

/**
 * 默认的AST解析规则
 * 基于节点类型匹配和处理方式的设计
 */
export const DEFAULT_AST_RULES: AstRulesConfig = {
	// 思考块处理 - 匹配thinking节点类型，默认折叠
	thinking: {
		id: "52206560-5c47-4697-ae30-be5ca8d60dac",
		name: "thinking",
		enabled: true,
		description: "思考块折叠处理",
		nodeType: "thinking",
		action: "fold",
		priority: 1,
		params: {
			defaultFolded: true,
			showIcon: true,
			iconText: "🤔",
			maxPreviewLength: 100,
		},
		recursive: false,
	},

	// Tips块处理 - 匹配tips节点类型，默认展开
	tips: {
		id: "d3ec857c-78a3-4ad5-8c76-4af07b866c7f",
		name: "tips",
		enabled: true,
		description: "提示块折叠处理",
		nodeType: "tips",
		action: "fold",
		priority: 2,
		params: {
			defaultFolded: false,
			showIcon: true,
			iconName: "Info",
			maxPreviewLength: 120,
		},
		recursive: false,
	},

	// 变量块处理 - 匹配variable节点类型，特殊渲染
	variable: {
		id: "db27da82-8057-4f0b-bf96-b67f95eb1707",
		name: "variable",
		enabled: true,
		description: "变量块特殊处理",
		nodeType: "variable",
		action: "wrap",
		priority: 2,
		params: {
			defaultFolded: true,
			wrapperClass: "variable-block",
			showType: true,
			editable: false,
		},
		recursive: true,
	},

	// UpdateVariable块处理 - 匹配XML标签形式的变量更新块
	updateVariable: {
		id: "db27da82-8057-4f0b-bf96-b67f95eb1707",
		name: "updateVariable",
		enabled: true,
		description: "UpdateVariable块折叠处理",
		nodeType: "UpdateVariable",
		action: "fold",
		priority: 2,
		params: {
			defaultFolded: true,
			showIcon: true,
			iconName: "Database",
			pattern: "<\\s*UpdateVariable\\b[^>]*>(?<content>[\\s\\S]*?)(?:<\\s*/\\s*UpdateVariable\\b[^>]*>|$)",
			flags: "gi",
		},
		recursive: true, // 改为true以支持内部嵌套的ThinkingProcess等块
	},

	// 变量命令处理 - 用于特殊渲染_.set, _.insert等变量命令
	variableCommand: {
		id: "af91e8c4-1a2d-4c3f-9e5a-7d8b9c0e1f2a",
		name: "variableCommand",
		enabled: true,
		description: "变量命令特殊渲染",
		nodeType: "code",
		action: "custom",
		processor: "variableCommandRenderer",
		priority: 1,
		params: {
			pattern: "^\\s*_\\.(add|set|insert|delete|update|push|pop|clear)\\(",
			highlightCommand: true,
			showComments: true,
		},
		recursive: false,
	},

	// Thinking块处理 - 英文thinking标签
	thinkingEnglish: {
		id: "52206560-5c47-4697-ae30-be5ca8d60dac",
		name: "thinkingEnglish",
		enabled: true,
		description: "英文thinking块折叠处理",
		nodeType: "thinking",
		action: "fold",
		priority: 1,
		params: {
			defaultFolded: true,
			showIcon: true,
			iconText: "🤔",
			pattern: "<thinking>(?<content>[\\s\\S]*?)</thinking>",
			flags: "gi",
		},
		recursive: false,
	},

	// Thinking块处理 - 简短英文think标签
	thinkEnglish: {
		id: "52206560-5c47-4697-ae30-be5ca8d60dac",
		name: "thinkEnglish",
		enabled: true,
		description: "简短英文think块折叠处理",
		nodeType: "thinking",
		action: "fold",
		priority: 1,
		params: {
			defaultFolded: true,
			showIcon: true,
			iconText: "🤔",
			pattern: "```think(?<content>[\\s\\S]*?)```",
			flags: "gi",
		},
		recursive: false,
	},

	// Thinking块处理 - 中文思考标签
	thinkingChinese: {
		id: "52206560-5c47-4697-ae30-be5ca8d60dac",
		name: "thinkingChinese",
		enabled: true,
		description: "中文思考块折叠处理",
		nodeType: "thinking",
		action: "fold",
		priority: 1,
		params: {
			defaultFolded: true,
			showIcon: true,
			iconText: "🤔",
			pattern: "<思考>(?<content>[\\s\\S]*?)</思考>",
			flags: "gi",
		},
		recursive: false,
	},

	// ThinkingProcess块处理
	thinkingProcess: {
		id: "52206560-5c47-4697-ae30-be5ca8d60dac",
		name: "thinkingProcess",
		enabled: true,
		description: "ThinkingProcess块折叠处理",
		nodeType: "thinking",
		action: "fold",
		priority: 1,
		params: {
			defaultFolded: true,
			showIcon: true,
			iconText: "🤔",
			pattern: "<ThinkingProcess>(?<content>[\\s\\S]*?)</ThinkingProcess>",
			flags: "gi",
		},
		recursive: false,
	},

	// 代码块处理 - 匹配code节点，折叠+语法高亮
	code: {
		id: "04bbe25b-b390-41f0-b9b4-a5ba72df5446",
		name: "code",
		enabled: true,
		description: "代码块折叠处理",
		nodeType: "code",
		action: "fold",
		priority: 3,
		params: {
			defaultFolded: false,
			showLanguage: true,
			maxHeight: "300px",
		},
		recursive: false,
	},

	// 数学公式块处理 - 匹配math节点，特殊渲染
	math: {
		id: "d1c10aaa-cab4-4b44-ad18-bb444a0363d7",
		name: "math",
		enabled: true,
		description: "数学公式块处理",
		nodeType: "math",
		action: "custom",
		processor: "mathRenderer",
		priority: 4,
		params: {
			renderEngine: "katex",
			displayMode: true,
		},
		recursive: false,
	},

	// 引用块处理 - 匹配blockquote节点，折叠
	blockquote: {
		id: "b0061d27-aa88-4908-a8d1-c66789f6f684",
		name: "blockquote",
		enabled: true,
		description: "引用块折叠处理",
		nodeType: "blockquote",
		action: "fold",
		priority: 5,
		params: {
			defaultFolded: false,
			maxPreviewLines: 3,
			showIcon: true,
		},
		recursive: true,
	},

	// 列表处理 - 匹配list节点，可折叠长列表
	list: {
		id: "fed8fa15-6475-44c0-b1a2-eca803e0727d",
		name: "list",
		enabled: true,
		description: "长列表折叠处理",
		nodeType: "list",
		action: "fold",
		nodeAttributes: {
			minItems: 5, // 只有5项以上的列表才折叠
		},
		priority: 6,
		params: {
			defaultFolded: false,
			threshold: 5,
			showCount: true,
		},
		recursive: false,
	},

	// 表格处理 - 匹配table节点，可折叠大表格
	table: {
		id: "c1729420-c0ed-4289-ab22-febc455afaf8",
		name: "table",
		enabled: true,
		description: "大表格折叠处理",
		nodeType: "table",
		action: "fold",
		nodeAttributes: {
			minRows: 10, // 只有10行以上的表格才折叠
		},
		priority: 7,
		params: {
			defaultFolded: false,
			threshold: 10,
			showHeaders: true,
		},
		recursive: false,
	},

	// 标题处理 - 匹配heading节点，高亮但不折叠
	heading: {
		id: "31f7750a-76f2-48c3-b1d7-1807ad6e1ac9",
		name: "heading",
		enabled: true,
		description: "标题高亮处理",
		nodeType: "heading",
		action: "highlight",
		priority: 8,
		params: {
			anchorLinks: true,
			tocLevel: 3, // 3级以下标题加入目录
		},
		recursive: false,
	},

	// 链接处理 - 匹配link节点，特殊处理
	link: {
		id: "35a0acd8-9e9f-44ce-b7d5-d5aeb096d032",
		name: "link",
		enabled: true,
		description: "链接特殊处理",
		nodeType: "link",
		action: "custom",
		processor: "linkProcessor",
		priority: 9,
		params: {
			externalIcon: true,
			noFollow: false,
			targetBlank: true,
		},
		recursive: false,
	},

	// 图片处理 - 匹配image节点，优化加载
	image: {
		id: "50e4c996-81b7-412c-a0df-65d5f3ca4305",
		name: "image",
		enabled: true,
		description: "图片优化处理",
		nodeType: "image",
		action: "custom",
		processor: "imageProcessor",
		priority: 10,
		params: {
			lazyLoad: true,
			maxWidth: "100%",
			addCaption: true,
		},
		recursive: false,
	},

	// 详情块处理 - 匹配details节点，原生折叠
	details: {
		id: "2f63dfaa-629c-4e14-8eb0-c5c0121bffc3",
		name: "details",
		enabled: true,
		description: "详情块处理",
		nodeType: "details",
		action: "fold",
		priority: 11,
		params: {
			defaultFolded: true,
			native: true, // 使用HTML5原生details/summary
		},
		recursive: true,
	},

	// 任务列表处理 - 匹配包含checkbox的listItem
	taskListItem: {
		id: "2986f986-0cb4-474b-bc80-88af2a8d874b",
		name: "taskListItem",
		enabled: true,
		description: "任务列表处理",
		nodeType: "listItem",
		action: "custom",
		nodeAttributes: {
			hasCheckbox: true,
		},
		processor: "taskListProcessor",
		priority: 12,
		params: {
			interactive: true,
			showProgress: true,
		},
		recursive: true,
	},

	// 脚注处理 - 匹配footnote相关节点
	footnote: {
		id: "9720b775-8366-4304-83f6-a458eba04542",
		name: "footnote",
		enabled: true,
		description: "脚注处理",
		nodeType: "footnoteDefinition",
		action: "custom",
		processor: "footnoteProcessor",
		priority: 13,
		params: {
			backlinks: true,
			tooltip: true,
		},
		recursive: false,
	},

	// 前置元数据处理 - 匹配yaml/toml节点
	frontmatter: {
		id: "c27cffdd-07e3-4301-8304-73f944c9138b",
		name: "frontmatter",
		enabled: true,
		description: "前置元数据处理",
		nodeType: "yaml",
		action: "fold",
		priority: 14,
		params: {
			defaultFolded: true,
			showType: true,
			parseMetadata: true,
		},
		recursive: false,
	},

	// 自定义容器处理 - 匹配container节点
	container: {
		id: "e56b2d80-8efc-440e-b149-44a4617b8e0e",
		name: "container",
		enabled: true,
		description: "自定义容器处理",
		nodeType: "container",
		action: "custom",
		processor: "containerProcessor",
		priority: 15,
		params: {
			preserveType: true,
			allowNested: true,
		},
		recursive: true,
	},

	// 错误节点处理 - 匹配error节点
	error: {
		id: "5b2b38b4-07a8-4b58-9504-05ccd904020e",
		name: "error",
		enabled: true,
		description: "错误节点处理",
		nodeType: "error",
		action: "highlight",
		priority: 99,
		params: {
			errorClass: "markdown-error",
			showMessage: true,
		},
		recursive: false,
	},
}
