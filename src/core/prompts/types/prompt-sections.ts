/**
 * 系统提示词字段变量结构
 * 用于在生成器中保存各个字段，方便最后调整顺序拼接
 */

export interface PromptSectionVariables {
	// 核心角色信息
	characterOverview?: string
	personality?: string
	background?: string
	appearance?: string
	skills?: string
	hobbies?: string
	
	// 对话相关
	firstMessage?: string
	exampleInteractions?: string
	alternateGreetings?: string
	scenario?: string
	
	// 系统指令（按优先级排序）
	systemInstructions?: string
	systemSettings?: string
	userSettings?: string
	assistantSettings?: string
	additionalInstructions?: string
	
	// 创作者信息
	creatorNotes?: string
	creator?: string
	version?: string
	
	// 扩展字段
	extensions?: string
	titles?: string
	relationships?: string
	tags?: string
	timeline?: string
	
	// 世界观信息
	worldInformation?: string
	
	// 记忆相关
	storylineHighlights?: string
	persistentTraits?: string
	goals?: string
	recentMemories?: string
	
	// 用户头像信息（重要：需要放在 system settings 前面）
	userAvatar?: string
	
	// 其他动态字段
	dynamicFields?: { [key: string]: string } | string
}

export interface PromptAssemblyOptions {
	// 字段顺序配置
	fieldOrder?: string[]
	// 是否包含用户头像
	includeUserAvatar?: boolean
	// 用户头像位置（插入到哪个字段前面）
	userAvatarInsertBefore?: string
	// 摘要模式
	summaryOnly?: boolean
	// 最大字段数量
	maxSections?: number
}

/**
 * 默认字段顺序（USER AVATAR 会在 system settings 前面插入）
 */
export const DEFAULT_FIELD_ORDER: string[] = [
	// 核心角色信息
	'characterOverview',
	'personality',
	'background',
	'appearance',
	'skills',
	'hobbies',
	
	// 对话相关
	'firstMessage',
	'scenario',
	'exampleInteractions',
	'alternateGreetings',
	
	// 用户头像（会在 system settings 前面插入）
	'userAvatar',
	
	// 系统指令（按优先级排序）
	'systemInstructions',
	'systemSettings',
	'userSettings',
	'assistantSettings',
	'additionalInstructions',
	
	// 创作者信息
	'creatorNotes',
	'creator',
	'version',
	
	// 扩展字段
	'extensions',
	'titles',
	'relationships',
	'tags',
	'timeline',
	
	// 世界观信息
	'worldInformation',
	
	// 记忆相关
	'storylineHighlights',
	'persistentTraits',
	'goals',
	'recentMemories',
]

/**
 * 摘要模式的字段顺序
 */
export const SUMMARY_FIELD_ORDER: string[] = [
	'characterOverview',
	'personality',
	'background',
	'appearance',
	'skills',
	'hobbies',
	'userAvatar',
	'systemInstructions',
	'firstMessage',
]

/**
 * 组装提示词段落
 */
export class PromptAssembler {
	/**
	 * 根据字段变量组装完整的提示词
	 */
	static assemblePrompt(
		variables: PromptSectionVariables,
		options: PromptAssemblyOptions = {}
	): string {
		const {
			fieldOrder = DEFAULT_FIELD_ORDER,
			includeUserAvatar = true,
			userAvatarInsertBefore = 'systemSettings',
			summaryOnly = false,
			maxSections
		} = options

		// 确定使用的字段顺序
		const effectiveFieldOrder = summaryOnly ? SUMMARY_FIELD_ORDER : fieldOrder
		
		// 过滤出存在的字段
		const availableFields = effectiveFieldOrder.filter(field => {
			if (field === 'userAvatar' && !includeUserAvatar) {
				return false
			}
			const content = variables[field as keyof PromptSectionVariables]
			return content && typeof content === 'string' && content.trim().length > 0
		})

		// 处理用户头像位置调整
		const finalFields = this.adjustUserAvatarPosition(
			availableFields,
			variables.userAvatar,
			userAvatarInsertBefore
		)

		// 限制字段数量
		const limitedFields = maxSections ? finalFields.slice(0, maxSections) : finalFields

		// 组装最终内容
		const sections = limitedFields.map(field => {
			const content = variables[field as keyof PromptSectionVariables]
			return content && typeof content === 'string' ? content.trim() : ''
		})
		
		return sections.join('\n\n')
	}

	/**
	 * 调整用户头像字段位置
	 */
	private static adjustUserAvatarPosition(
		fields: string[],
		userAvatarContent: string | undefined,
		insertBefore: string
	): string[] {
		if (!userAvatarContent || !fields.includes('userAvatar')) {
			return fields
		}

		const userAvatarIndex = fields.indexOf('userAvatar')
		const targetIndex = fields.indexOf(insertBefore)

		// 如果目标字段不存在，保持在原位置
		if (targetIndex === -1) {
			return fields
		}

		// 如果用户头像已经在目标位置前面，不需要调整
		if (userAvatarIndex < targetIndex) {
			return fields
		}

		// 重新排列字段
		const newFields = [...fields]
		newFields.splice(userAvatarIndex, 1) // 移除原位置
		newFields.splice(targetIndex, 0, 'userAvatar') // 插入到目标位置

		return newFields
	}

	/**
	 * 创建字段变量对象的辅助方法
	 */
	static createVariables(): PromptSectionVariables {
		return {}
	}

	/**
	 * 设置字段值
	 */
	static setField(
		segments: PromptSectionVariables,
		field: keyof PromptSectionVariables,
		content: string | undefined
	): void {
		if (content && content.trim().length > 0) {
			segments[field] = content.trim()
		}
	}

	/**
	 * 批量设置字段值
	 */
	static setFields(
		segments: PromptSectionVariables,
		newFields: Partial<PromptSectionVariables>
	): void {
		Object.entries(newFields).forEach(([field, content]) => {
			if (content && typeof content === 'string' && content.trim().length > 0) {
				segments[field as keyof PromptSectionVariables] = content.trim()
			}
		})
	}

	/**
	 * 获取字段预览（用于调试）
	 */
	static getFieldPreview(variables: PromptSectionVariables): string {
		const fields = Object.entries(variables)
			.filter(([_, content]) => {
				if (typeof content === 'string') {
					return content.trim().length > 0
				}
				if (typeof content === 'object' && content !== null) {
					return Object.keys(content).length > 0
				}
				return false
			})
			.map(([field, content]) => {
				let preview = ''
				if (typeof content === 'string') {
					preview = `${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`
				} else if (typeof content === 'object' && content !== null) {
					preview = `Object with ${Object.keys(content).length} keys`
				}
				return `${field}: ${preview}`
			})
			.join('\n')

		return `Available fields:\n${fields}`
	}
}
