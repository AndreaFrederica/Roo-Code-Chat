/**
 * 系统提示词段变量结构
 * 用于在生成器中保存各个段，方便最后调整顺序拼接
 * 包含所有系统提示词组件：角色、世界书、工具定义、规则等
 */

export interface PromptSegmentVariables {
	// === 核心角色信息 ===
	characterOverview?: string
	personality?: string
	background?: string
	appearance?: string
	skills?: string
	hobbies?: string
	
	// === 对话相关 ===
	firstMessage?: string
	exampleInteractions?: string
	alternateGreetings?: string
	scenario?: string
	
	// === 系统指令（按优先级排序） ===
	systemInstructions?: string
	systemSettings?: string
	userSettings?: string
	assistantSettings?: string
	additionalInstructions?: string
	
	// === 创作者信息 ===
	creatorNotes?: string
	creator?: string
	version?: string
	
	// === 扩展字段 ===
	extensions?: string
	titles?: string
	relationships?: string
	tags?: string
	timeline?: string
	
	// === 世界观信息 ===
	worldInformation?: string
	worldbookContent?: string
	worldsetSection?: string
	
	// === 记忆相关 ===
	storylineHighlights?: string
	persistentTraits?: string
	goals?: string
	recentMemories?: string
	memorySection?: string
	
	// === 用户头像信息（重要：需要放在 system settings 前面） ===
	userAvatar?: string
	
	// === 工具定义 ===
	toolDefinitions?: string
	toolDescriptions?: string
	toolUseGuidelines?: string
	sharedToolUse?: string
	
	// === MCP 相关 ===
	mcpServers?: string
	mcpSection?: string
	
	// === 能力和功能 ===
	capabilities?: string
	computerUse?: string
	
	// === 规则和约束 ===
	rules?: string
	constraints?: string
	
	// === 目标和目的 ===
	objectives?: string
	purpose?: string
	
	// === 模式配置 ===
	modes?: string
	modeSettings?: string
	
	// === 系统信息 ===
	systemInfo?: string
	environmentInfo?: string
	
	// === 自定义指令 ===
	customInstructions?: string
	globalInstructions?: string
	
	// === 变量状态 ===
	variableState?: string
	variableStateSection?: string
	
	// === 标记和分隔符 ===
	markdownFormatting?: string
	sectionSeparators?: string
	
	// === 其他动态字段 ===
	dynamicFields?: { [key: string]: string } | string
}

export interface PromptSegmentAssemblyOptions {
	// === 段顺序配置 ===
	segmentOrder?: string[]
	// === 是否包含特定段 ===
	includeUserAvatar?: boolean
	includeToolDefinitions?: boolean
	includeWorldbook?: boolean
	includeMCP?: boolean
	includeMemory?: boolean
	includeVariableState?: boolean
	// === 段位置配置 ===
	userAvatarInsertBefore?: string
	toolDefinitionsInsertAfter?: string
	worldbookInsertAfter?: string
	// === 显示选项 ===
	summaryOnly?: boolean
	maxSegments?: number
	// === 模式特定选项 ===
	chatMode?: boolean
	developerMode?: boolean
	debugMode?: boolean
}

/**
 * 默认段顺序（USER AVATAR 会在 system settings 前面插入）
 */
export const DEFAULT_SEGMENT_ORDER: string[] = [
	// === 核心角色信息 ===
	"characterOverview",
	"personality",
	"background",
	"appearance",
	"skills",
	"hobbies",
	
	// === 对话相关 ===
	"firstMessage",
	"scenario",
	"exampleInteractions",
	"alternateGreetings",
	
	// === 用户头像（会在 system settings 前面插入） ===
	"userAvatar",
	
	// === 系统指令（按优先级排序） ===
	"systemInstructions",
	"systemSettings",
	"userSettings",
	"assistantSettings",
	"additionalInstructions",
	
	// === 创作者信息 ===
	"creatorNotes",
	"creator",
	"version",
	
	// === 世界观信息 ===
	"worldInformation",
	"worldbookContent",
	"worldsetSection",
	
	// === 记忆相关 ===
	"memorySection",
	"storylineHighlights",
	"persistentTraits",
	"goals",
	"recentMemories",
	
	// === 工具定义 ===
	"toolDefinitions",
	"toolDescriptions",
	"toolUseGuidelines",
	"sharedToolUse",
	
	// === MCP 相关 ===
	"mcpServers",
	"mcpSection",
	
	// === 能力和功能 ===
	"capabilities",
	"computerUse",
	
	// === 规则和约束 ===
	"rules",
	"constraints",
	
	// === 目标和目的 ===
	"objectives",
	"purpose",
	
	// === 模式配置 ===
	"modes",
	"modeSettings",
	
	// === 系统信息 ===
	"systemInfo",
	"environmentInfo",
	
	// === 自定义指令 ===
	"customInstructions",
	"globalInstructions",
	
	// === 变量状态 ===
	"variableStateSection",
	"variableState",
	
	// === 标记和分隔符 ===
	"markdownFormatting",
	"sectionSeparators",
]

/**
 * 聊天模式的段顺序
 */
export const CHAT_MODE_SEGMENT_ORDER: string[] = [
	"characterOverview",
	"personality",
	"background",
	"firstMessage",
	"userAvatar",
	"systemInstructions",
	"toolDefinitions",
	"rules",
	"markdownFormatting",
]

/**
 * 开发者模式的段顺序
 */
export const DEVELOPER_MODE_SEGMENT_ORDER: string[] = [
	"characterOverview",
	"systemInfo",
	"environmentInfo",
	"toolDefinitions",
	"capabilities",
	"rules",
	"customInstructions",
	"markdownFormatting",
]

/**
 * 系统提示词段组装器
 */
export class PromptSegmentAssembler {
	/**
	 * 根据段变量组装完整的系统提示词
	 */
	static assemblePrompt(
		segments: PromptSegmentVariables,
		options: PromptSegmentAssemblyOptions = {}
	): string {
		const {
			segmentOrder = DEFAULT_SEGMENT_ORDER,
			includeUserAvatar = true,
			includeToolDefinitions = true,
			includeWorldbook = true,
			includeMCP = true,
			includeMemory = true,
			includeVariableState = true,
			userAvatarInsertBefore = 'systemSettings',
			toolDefinitionsInsertAfter = 'systemInstructions',
			worldbookInsertAfter = 'personality',
			summaryOnly = false,
			maxSegments,
			chatMode = false,
			developerMode = false,
			debugMode = false,
		} = options

		// 根据模式选择段顺序
		let effectiveSegmentOrder = segmentOrder
		if (chatMode) {
			effectiveSegmentOrder = CHAT_MODE_SEGMENT_ORDER
		} else if (developerMode) {
			effectiveSegmentOrder = DEVELOPER_MODE_SEGMENT_ORDER
		}

		// 过滤出存在的段
		const availableSegments = this.filterAvailableSegments(
			effectiveSegmentOrder,
			segments,
			{
				includeUserAvatar,
				includeToolDefinitions,
				includeWorldbook,
				includeMCP,
				includeMemory,
				includeVariableState,
			}
		)

		// 处理段位置调整
		const finalSegments = this.adjustSegmentPositions(
			availableSegments,
			segments,
			{
				userAvatarInsertBefore,
				toolDefinitionsInsertAfter,
				worldbookInsertAfter,
			}
		)

		// 限制段数量
		const limitedSegments = maxSegments ? finalSegments.slice(0, maxSegments) : finalSegments

		// 组装最终内容
		const content = this.assembleSegmentContent(limitedSegments, segments, {
			summaryOnly,
			debugMode,
		})

		return content
	}

	/**
	 * 过滤出可用的段
	 */
	private static filterAvailableSegments(
		segmentOrder: string[],
		segments: PromptSegmentVariables,
		options: {
			includeUserAvatar?: boolean
			includeToolDefinitions?: boolean
			includeWorldbook?: boolean
			includeMCP?: boolean
			includeMemory?: boolean
			includeVariableState?: boolean
		}
	): string[] {
		const {
			includeUserAvatar = true,
			includeToolDefinitions = true,
			includeWorldbook = true,
			includeMCP = true,
			includeMemory = true,
			includeVariableState = true,
		} = options

		return segmentOrder.filter(segment => {
			// 检查段是否存在
			const segmentExists = segments[segment as keyof PromptSegmentVariables]
			if (!segmentExists) {
				return false
			}

			// 检查特定段的包含选项
			if (segment === 'userAvatar' && !includeUserAvatar) {
				return false
			}
			if (segment === 'toolDefinitions' && !includeToolDefinitions) {
				return false
			}
			if (segment === 'worldbookContent' && !includeWorldbook) {
				return false
			}
			if (segment === 'mcpSection' && !includeMCP) {
				return false
			}
			if ((segment === 'memorySection' || segment === 'storylineHighlights') && !includeMemory) {
				return false
			}
			if (segment === 'variableState' && !includeVariableState) {
				return false
			}

			return true
		})
	}

	/**
	 * 调整段位置
	 */
	private static adjustSegmentPositions(
		segmentOrder: string[],
		segments: PromptSegmentVariables,
		options: {
			userAvatarInsertBefore?: string
			toolDefinitionsInsertAfter?: string
			worldbookInsertAfter?: string
		}
	): string[] {
		const {
			userAvatarInsertBefore = 'systemSettings',
			toolDefinitionsInsertAfter = 'systemInstructions',
			worldbookInsertAfter = 'personality',
		} = options

		let finalSegments = [...segmentOrder]

		// 调整用户头像位置
		if (segments.userAvatar && finalSegments.includes('userAvatar')) {
			finalSegments = this.adjustSegmentPosition(
				finalSegments,
				'userAvatar',
				userAvatarInsertBefore
			)
		}

		// 调整工具定义位置
		if (segments.toolDefinitions && finalSegments.includes('toolDefinitions')) {
			finalSegments = this.adjustSegmentPosition(
				finalSegments,
				'toolDefinitions',
				toolDefinitionsInsertAfter,
				true // 插入在指定段之后
			)
		}

		// 调整世界书位置
		if (segments.worldbookContent && finalSegments.includes('worldbookContent')) {
			finalSegments = this.adjustSegmentPosition(
				finalSegments,
				'worldbookContent',
				worldbookInsertAfter,
				true // 插入在指定段之后
			)
		}

		return finalSegments
	}

	/**
	 * 调整单个段的位置
	 */
	private static adjustSegmentPosition(
		segments: string[],
		segmentName: string,
		targetSegment: string,
		insertAfter: boolean = false
	): string[] {
		const segmentIndex = segments.indexOf(segmentName)
		const targetIndex = segments.indexOf(targetSegment)

		if (segmentIndex === -1 || targetIndex === -1) {
			return segments
		}

		if (insertAfter) {
			// 插入在目标段之后
			if (segmentIndex < targetIndex) {
				// 需要移动到目标段后面
				segments.splice(segmentIndex, 1)
				segments.splice(targetIndex + 1, 0, segmentName)
			}
		} else {
			// 插入在目标段前面
			if (segmentIndex > targetIndex) {
				// 需要移动到目标段前面
				segments.splice(segmentIndex, 1)
				segments.splice(targetIndex, 0, segmentName)
			}
		}

		return segments
	}

	/**
	 * 组装段内容
	 */
	private static assembleSegmentContent(
		segmentOrder: string[],
		segments: PromptSegmentVariables,
		options: {
			summaryOnly?: boolean
			debugMode?: boolean
		}
	): string {
		const { summaryOnly = false, debugMode = false } = options

		const contentParts: string[] = []

		for (const segmentName of segmentOrder) {
			const segmentContent = segments[segmentName as keyof PromptSegmentVariables]
			if (!segmentContent) {
				continue
			}

			if (typeof segmentContent === 'string') {
				// 如果是字符串，直接使用
				if (segmentContent.trim().length > 0) {
					contentParts.push(segmentContent.trim())
				}
			} else if (typeof segmentContent === 'object' && segmentContent !== null) {
				// 如果是对象，处理动态字段
				const objectContent = this.processDynamicSegment(segmentContent, segmentName, summaryOnly)
				if (objectContent) {
					contentParts.push(objectContent)
				}
			}
		}

		if (debugMode) {
			// 添加调试信息
			contentParts.push(`\n\n<!-- DEBUG: Processed ${contentParts.length} segments -->\n`)
		}

		return contentParts.join('\n\n')
	}

	/**
	 * 处理动态段内容
	 */
	private static processDynamicSegment(
		dynamicContent: { [key: string]: string } | string,
		segmentName: string,
		summaryOnly: boolean
	): string {
		if (typeof dynamicContent === 'string') {
			return dynamicContent
		}

		const entries = Object.entries(dynamicContent)
		if (entries.length === 0) {
			return ''
		}

		if (summaryOnly) {
			// 摘要模式：只返回前几个条目
			const summaryEntries = entries.slice(0, 3)
			return summaryEntries
				.map(([key, value]) => `- ${key}: ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`)
				.join('\n')
		} else {
			// 完整模式：返回所有条目
			return entries
				.map(([key, value]) => `### ${key.charAt(0).toUpperCase() + key.slice(1)}\n${value}`)
				.join('\n\n')
		}
	}

	/**
	 * 创建段变量对象的辅助方法
	 */
	static createSegments(): PromptSegmentVariables {
		return {}
	}

	/**
	 * 设置段值
	 */
	static setSegment(
		segments: PromptSegmentVariables,
		segment: keyof PromptSegmentVariables,
		content: string | undefined
	): void {
		if (content && content.trim().length > 0) {
			segments[segment] = content.trim()
		}
	}

	/**
	 * 批量设置字段值
	 */
	static setFields(
		segments: PromptSegmentVariables,
		newFields: Partial<PromptSegmentVariables>
	): void {
		Object.entries(newFields).forEach(([field, content]) => {
			if (content && typeof content === 'string' && content.trim().length > 0) {
				segments[field as keyof PromptSegmentVariables] = content.trim()
			}
		})
	}

	/**
	 * 批量设置段值
	 */
	static setSegments(
		segments: PromptSegmentVariables,
		newSegments: Partial<PromptSegmentVariables>
	): void {
		Object.entries(newSegments).forEach(([segment, content]) => {
			if (content && typeof content === 'string' && content.trim().length > 0) {
				segments[segment as keyof PromptSegmentVariables] = content.trim()
			}
		})
	}

	/**
	 * 合并段变量
	 */
	static mergeSegments(
		target: PromptSegmentVariables,
		...sources: Partial<PromptSegmentVariables>[]
	): PromptSegmentVariables {
		const merged = { ...target }
		
		for (const source of sources) {
			this.setFields(merged, source)
		}
		
		return merged
	}

	/**
	 * 获取段预览（用于调试）
	 */
	static getSegmentPreview(segments: PromptSegmentVariables): string {
		const segmentList = Object.entries(segments)
			.filter(([_, content]) => {
				if (typeof content === 'string') {
					return content.trim().length > 0
				}
				if (typeof content === 'object' && content !== null) {
					return Object.keys(content).length > 0
				}
				return false
			})
			.map(([segment, content]) => {
				let preview = ''
				if (typeof content === 'string') {
					preview = `${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`
				} else if (typeof content === 'object' && content !== null) {
					const keys = Object.keys(content)
					preview = `Object with ${keys.length} keys: ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}`
				}
				return `${segment}: ${preview}`
			})
			.join('\n')

		return `Available segments:\n${segmentList}`
	}

	/**
	 * 验证段完整性
	 */
	static validateSegments(segments: PromptSegmentVariables): {
		valid: boolean
		errors: string[]
		warnings: string[]
	} {
		const validation: {
			valid: boolean
			errors: string[]
			warnings: string[]
		} = {
			valid: true,
			errors: [],
			warnings: [],
		}

		// 检查必需的段
		const requiredSegments = ['characterOverview']
		for (const required of requiredSegments) {
			if (!segments[required as keyof PromptSegmentVariables]) {
				validation.valid = false
				validation.errors.push(`Missing required segment: ${required}`)
			}
		}

		// 检查段内容
		Object.entries(segments).forEach(([segment, content]) => {
			if (!content) {
				validation.warnings.push(`Empty segment: ${segment}`)
			} else if (typeof content === 'string' && content.trim().length === 0) {
				validation.warnings.push(`Empty content in segment: ${segment}`)
			}
		})

		return validation
	}
}
