/**
 * 内置AST规则配置 (后端版本)
 * 基于节点类型匹配和处理方式的设计
 */

export interface AstRule {
	enabled: boolean
	description: string
	// 匹配的节点类型（必需）
	nodeType: string
	// 可选的节点属性匹配条件
	nodeAttributes?: Record<string, any>
	// 处理方式（必需）
	action: 'fold' | 'highlight' | 'replace' | 'wrap' | 'hide' | 'custom'
	// 处理优先级
	priority?: number
	// 自定义处理函数名称（当action为'custom'时使用）
	processor?: string
	// 处理参数
	params?: Record<string, any>
	// 是否应该递归处理子节点
	recursive?: boolean
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
		enabled: true,
		description: "思考块折叠处理",
		nodeType: "thinking",
		action: "fold",
		priority: 1,
		params: {
			defaultFolded: true,
			showIcon: true,
			iconText: "🤔",
			maxPreviewLength: 100
		},
		recursive: false
	},

	// 变量块处理 - 匹配variable节点类型，特殊渲染
	variable: {
		enabled: true,
		description: "变量块特殊处理",
		nodeType: "variable",
		action: "wrap",
		priority: 2,
		params: {
			wrapperClass: "variable-block",
			showType: true,
			editable: false
		},
		recursive: true
	},

	// 代码块处理 - 匹配code节点，折叠+语法高亮
	code: {
		enabled: true,
		description: "代码块折叠处理",
		nodeType: "code",
		action: "fold",
		priority: 3,
		params: {
			defaultFolded: false,
			showLanguage: true,
			maxHeight: "300px"
		},
		recursive: false
	},

	// 数学公式块处理 - 匹配math节点，特殊渲染
	math: {
		enabled: true,
		description: "数学公式块处理",
		nodeType: "math",
		action: "custom",
		processor: "mathRenderer",
		priority: 4,
		params: {
			renderEngine: "katex",
			displayMode: true
		},
		recursive: false
	},

	// 引用块处理 - 匹配blockquote节点，折叠
	blockquote: {
		enabled: true,
		description: "引用块折叠处理",
		nodeType: "blockquote",
		action: "fold",
		priority: 5,
		params: {
			defaultFolded: false,
			maxPreviewLines: 3,
			showIcon: true
		},
		recursive: true
	},

	// 列表处理 - 匹配list节点，可折叠长列表
	list: {
		enabled: true,
		description: "长列表折叠处理",
		nodeType: "list",
		action: "fold",
		nodeAttributes: {
			minItems: 5 // 只有5项以上的列表才折叠
		},
		priority: 6,
		params: {
			defaultFolded: false,
			threshold: 5,
			showCount: true
		},
		recursive: false
	},

	// 表格处理 - 匹配table节点，可折叠大表格
	table: {
		enabled: true,
		description: "大表格折叠处理",
		nodeType: "table",
		action: "fold",
		nodeAttributes: {
			minRows: 10 // 只有10行以上的表格才折叠
		},
		priority: 7,
		params: {
			defaultFolded: false,
			threshold: 10,
			showHeaders: true
		},
		recursive: false
	},

	// 标题处理 - 匹配heading节点，高亮但不折叠
	heading: {
		enabled: true,
		description: "标题高亮处理",
		nodeType: "heading",
		action: "highlight",
		priority: 8,
		params: {
			anchorLinks: true,
			tocLevel: 3 // 3级以下标题加入目录
		},
		recursive: false
	},

	// 链接处理 - 匹配link节点，特殊处理
	link: {
		enabled: true,
		description: "链接特殊处理",
		nodeType: "link",
		action: "custom",
		processor: "linkProcessor",
		priority: 9,
		params: {
			externalIcon: true,
			noFollow: false,
			targetBlank: true
		},
		recursive: false
	},

	// 图片处理 - 匹配image节点，优化加载
	image: {
		enabled: true,
		description: "图片优化处理",
		nodeType: "image",
		action: "custom",
		processor: "imageProcessor",
		priority: 10,
		params: {
			lazyLoad: true,
			maxWidth: "100%",
			addCaption: true
		},
		recursive: false
	},

	// 详情块处理 - 匹配details节点，原生折叠
	details: {
		enabled: true,
		description: "详情块处理",
		nodeType: "details",
		action: "fold",
		priority: 11,
		params: {
			defaultFolded: true,
			native: true // 使用HTML5原生details/summary
		},
		recursive: true
	},

	// 任务列表处理 - 匹配包含checkbox的listItem
	taskListItem: {
		enabled: true,
		description: "任务列表处理",
		nodeType: "listItem",
		action: "custom",
		nodeAttributes: {
			hasCheckbox: true
		},
		processor: "taskListProcessor",
		priority: 12,
		params: {
			interactive: true,
			showProgress: true
		},
		recursive: true
	},

	// 脚注处理 - 匹配footnote相关节点
	footnote: {
		enabled: true,
		description: "脚注处理",
		nodeType: "footnoteDefinition",
		action: "custom",
		processor: "footnoteProcessor",
		priority: 13,
		params: {
			backlinks: true,
			tooltip: true
		},
		recursive: false
	},

	// 前置元数据处理 - 匹配yaml/toml节点
	frontmatter: {
		enabled: true,
		description: "前置元数据处理",
		nodeType: "yaml",
		action: "fold",
		priority: 14,
		params: {
			defaultFolded: true,
			showType: true,
			parseMetadata: true
		},
		recursive: false
	},

	// 自定义容器处理 - 匹配container节点
	container: {
		enabled: true,
		description: "自定义容器处理",
		nodeType: "container",
		action: "custom",
		processor: "containerProcessor",
		priority: 15,
		params: {
			preserveType: true,
			allowNested: true
		},
		recursive: true
	},

	// 错误节点处理 - 匹配error节点
	error: {
		enabled: true,
		description: "错误节点处理",
		nodeType: "error",
		action: "highlight",
		priority: 99,
		params: {
			errorClass: "markdown-error",
			showMessage: true
		},
		recursive: false
	}
}

/**
 * 获取所有启用的AST规则
 */
export function getEnabledAstRules(customRules?: AstRulesConfig): AstRulesConfig {
	const rules = { ...DEFAULT_AST_RULES, ...customRules }
	const enabled: AstRulesConfig = {}

	for (const [key, rule] of Object.entries(rules)) {
		if (rule.enabled) {
			enabled[key] = rule
		}
	}

	return enabled
}

/**
 * 根据分类获取AST规则
 */
export function getAstRulesByCategory(customRules?: AstRulesConfig): Record<string, AstRulesConfig> {
	const rules = { ...DEFAULT_AST_RULES, ...customRules }

	return {
		folding: {
			thinking: rules.thinking,
			code: rules.code,
			blockquote: rules.blockquote,
			list: rules.list,
			table: rules.table,
			details: rules.details,
			frontmatter: rules.frontmatter
		},
		content: {
			variable: rules.variable,
			math: rules.math,
			footnote: rules.footnote
		},
		enhancement: {
			heading: rules.heading,
			link: rules.link,
			image: rules.image,
			taskListItem: rules.taskListItem,
			container: rules.container
		},
		processing: {
			error: rules.error
		}
	}
}

/**
 * 根据节点类型获取AST规则
 */
export function getAstRulesByNodeType(nodeType: string, customRules?: AstRulesConfig): AstRulesConfig {
	const rules = { ...DEFAULT_AST_RULES, ...customRules }
	const matchingRules: AstRulesConfig = {}

	for (const [key, rule] of Object.entries(rules)) {
		if (!rule.enabled) continue

		// 检查节点类型是否匹配
		if (rule.nodeType === nodeType) {
			matchingRules[key] = rule
		}
	}

	return matchingRules
}

/**
 * 根据节点类型和属性获取匹配的AST规则
 */
export function getMatchingAstRules(nodeType: string, nodeAttributes?: Record<string, any>, customRules?: AstRulesConfig): AstRule[] {
	const rules = { ...DEFAULT_AST_RULES, ...customRules }
	const matchingRules: AstRule[] = []

	for (const rule of Object.values(rules)) {
		if (!rule.enabled) continue

		// 检查节点类型是否匹配
		if (rule.nodeType !== nodeType) continue

		// 检查节点属性是否匹配条件
		if (rule.nodeAttributes) {
			let attributesMatch = true
			for (const [attrKey, attrValue] of Object.entries(rule.nodeAttributes)) {
				if (nodeAttributes?.[attrKey] !== attrValue) {
					attributesMatch = false
					break
				}
			}
			if (!attributesMatch) continue
		}

		matchingRules.push(rule)
	}

	// 按优先级排序
	return matchingRules.sort((a, b) => (a.priority || 50) - (b.priority || 50))
}

/**
 * 根据优先级排序AST规则
 */
export function sortAstRulesByPriority(rules: AstRulesConfig): Array<{ key: string; rule: AstRule }> {
	return Object.entries(rules)
		.map(([key, rule]) => ({ key, rule }))
		.sort((a, b) => (a.rule.priority || 50) - (b.rule.priority || 50))
}

/**
 * 创建新的AST规则
 */
export function createAstRule(
	key: string,
	description: string,
	nodeType: string,
	action: AstRule['action'],
	enabled: boolean = true,
	options?: {
		nodeAttributes?: Record<string, any>
		priority?: number
		processor?: string
		params?: Record<string, any>
		recursive?: boolean
	}
): AstRule {
	return {
		enabled,
		description,
		nodeType,
		action,
		nodeAttributes: options?.nodeAttributes,
		priority: options?.priority || 50,
		processor: options?.processor,
		params: options?.params,
		recursive: options?.recursive ?? false
	}
}