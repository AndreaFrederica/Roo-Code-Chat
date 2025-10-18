// STProfile 正则表达式处理器测试

import {
	STProfileProcessor,
	RegexRunStage,
	RegexTargetSource,
	STRegexProcessor,
	AIOutputProcessor,
	PostProcessor,
	createRegexProcessor,
	createAIOutputProcessor,
	createPostProcessor
} from './st-profile-processor.js'

describe('STProfile 正则表达式处理器', () => {
	// 测试用的 TSProfile 数据
	const mockProfile = {
		temperature: 1.0,
		prompts: [
			{
				identifier: 'test-prompt',
				name: '测试提示词',
				role: 'system' as const,
				content: '这是一个测试提示词，包含"中文引号"和「日文引号」',
				enabled: true,
				system_prompt: false,
				marker: false,
				injection_position: 0,
				injection_depth: 4,
				injection_order: 100,
				forbid_overrides: false
			}
		],
		extensions: {
			SPreset: {
				RegexBinding: [
					{
						id: 'format-quotes',
						scriptName: '格式化引号',
						findRegex: '"([^"]*)"',
						replaceString: '「$1」',
						trimStrings: [],
						placement: [1],
						disabled: false,
						markdownOnly: false,
						promptOnly: false,
						runOnEdit: false,
						substituteRegex: 1,
						runStages: [RegexRunStage.PRE_PROCESSING],
						targetSource: RegexTargetSource.PROMPT_CONTENT,
						priority: 100
					},
					{
						id: 'ai-output-format',
						scriptName: 'AI输出格式化',
						findRegex: '\\*\\*(.*?)\\*\\*',
						replaceString: '$1',
						trimStrings: [],
						placement: [1],
						disabled: false,
						markdownOnly: false,
						promptOnly: false,
						runOnEdit: false,
						substituteRegex: 1,
						runStages: [RegexRunStage.AI_OUTPUT],
						targetSource: RegexTargetSource.AI_RESPONSE,
						priority: 200
					},
					{
						id: 'post-format',
						scriptName: '后处理格式化',
						findRegex: '```([\\s\\S]*?)```',
						replaceString: '代码：$1',
						trimStrings: [],
						placement: [1],
						disabled: false,
						markdownOnly: false,
						promptOnly: false,
						runOnEdit: false,
						substituteRegex: 1,
						runStages: [RegexRunStage.POST_PROCESSING],
						targetSource: RegexTargetSource.ALL_CONTENT,
						priority: 50
					}
				]
			}
		}
	}

	describe('STRegexProcessor', () => {
		let processor: STRegexProcessor

		beforeEach(() => {
			processor = new STRegexProcessor(mockProfile.extensions.SPreset.RegexBinding)
		})

		test('应该正确创建处理器', () => {
			expect(processor).toBeInstanceOf(STRegexProcessor)
			expect(processor.getBindings()).toHaveLength(3)
		})

		test('应该按阶段过滤绑定', () => {
			const preProcessingBindings = processor.getBindingsForStage(RegexRunStage.PRE_PROCESSING)
			const aiOutputBindings = processor.getBindingsForStage(RegexRunStage.AI_OUTPUT)
			const postProcessingBindings = processor.getBindingsForStage(RegexRunStage.POST_PROCESSING)

			expect(preProcessingBindings).toHaveLength(1)
			expect(aiOutputBindings).toHaveLength(1)
			expect(postProcessingBindings).toHaveLength(1)
		})

		test('应该正确处理预处理阶段的内容', () => {
			const input = '这是"中文引号"内容'
			const result = processor.processContent(
				input,
				RegexRunStage.PRE_PROCESSING,
				RegexTargetSource.PROMPT_CONTENT
			)

			expect(result).toBe('这是「中文引号」内容')
		})

		test('应该正确处理AI输出阶段的内容', () => {
			const input = '这是**粗体**内容'
			const result = processor.processContent(
				input,
				RegexRunStage.AI_OUTPUT,
				RegexTargetSource.AI_RESPONSE
			)

			expect(result).toBe('这是粗体内容')
		})

		test('应该正确处理后处理阶段的内容', () => {
			const input = '这是```代码块```内容'
			const result = processor.processContent(
				input,
				RegexRunStage.POST_PROCESSING,
				RegexTargetSource.ALL_CONTENT
			)

			expect(result).toBe('这是代码：代码块内容')
		})

		test('应该按优先级排序处理', () => {
			// 添加一个高优先级的绑定
			const bindings = [
				...mockProfile.extensions.SPreset.RegexBinding,
				{
					id: 'high-priority',
					scriptName: '高优先级',
					findRegex: '测试',
					replaceString: '高优先级测试',
					trimStrings: [],
					placement: [1],
					disabled: false,
					markdownOnly: false,
					promptOnly: false,
					runOnEdit: false,
					substituteRegex: 1,
					runStages: [RegexRunStage.PRE_PROCESSING],
					targetSource: RegexTargetSource.PROMPT_CONTENT,
					priority: 300
				}
			]

			const highPriorityProcessor = new STRegexProcessor(bindings)
			const result = highPriorityProcessor.processContent(
				'这是测试内容',
				RegexRunStage.PRE_PROCESSING,
				RegexTargetSource.PROMPT_CONTENT
			)

			expect(result).toBe('这是高优先级测试内容')
		})

		test('应该支持变量替换', () => {
			const bindings = [
				{
					id: 'variable-replace',
					scriptName: '变量替换',
					findRegex: 'hello',
					replaceString: '你好，{{name}}',
					trimStrings: [],
					placement: [1],
					disabled: false,
					markdownOnly: false,
					promptOnly: false,
					runOnEdit: false,
					substituteRegex: 1,
					runStages: [RegexRunStage.PRE_PROCESSING],
					targetSource: RegexTargetSource.PROMPT_CONTENT,
					priority: 100
				}
			]

			const variableProcessor = new STRegexProcessor(bindings)
			const result = variableProcessor.processContent(
				'hello world',
				RegexRunStage.PRE_PROCESSING,
				RegexTargetSource.PROMPT_CONTENT,
				{
					variables: {
						name: '用户'
					}
				}
			)

			expect(result).toBe('你好，用户 world')
		})
	})

	describe('AIOutputProcessor', () => {
		let processor: AIOutputProcessor

		beforeEach(() => {
			processor = new AIOutputProcessor(mockProfile.extensions.SPreset.RegexBinding)
		})

		test('应该正确处理AI输出', () => {
			const input = '这是**粗体**文本'
			const result = processor.processAIOutput(input)

			expect(result).toBe('这是粗体文本')
		})

		test('应该支持上下文变量', () => {
			const input = '这是**粗体**文本'
			const result = processor.processAIOutput(input, {
				variables: {
					user: '测试用户'
				}
			})

			expect(result).toBe('这是粗体文本')
		})
	})

	describe('PostProcessor', () => {
		let processor: PostProcessor

		beforeEach(() => {
			processor = new PostProcessor(mockProfile.extensions.SPreset.RegexBinding)
		})

		test('应该正确处理最终内容', () => {
			const input = '这是```代码块```内容'
			const result = processor.processFinalContent(
				input,
				RegexTargetSource.ALL_CONTENT
			)

			expect(result).toBe('这是代码：代码块内容')
		})

		test('应该正确处理提示词内容', () => {
			const mockPrompt = {
				identifier: 'test',
				role: 'system' as const,
				content: '测试',
				enabled: true,
				system_prompt: false,
				marker: false,
				injection: {
					position: 0,
					depth: 4,
					order: 100
				},
				forbid_overrides: false,
				variables: [],
				processedContent: '这是```代码块```内容',
				dependencies: [],
				renderHints: {
					priority: 100,
					conditional: false,
					hasVariables: false,
					templateComplexity: 0
				}
			}

			const result = processor.processPromptContent(
				'这是```代码块```内容',
				mockPrompt
			)

			expect(result).toBe('这是代码：代码块内容')
		})
	})

	describe('便捷函数', () => {
		test('createRegexProcessor 应该创建正确的处理器', () => {
			const processor = createRegexProcessor(mockProfile)
			expect(processor).toBeInstanceOf(STRegexProcessor)
			expect(processor.getBindings()).toHaveLength(3)
		})

		test('createAIOutputProcessor 应该创建正确的处理器', () => {
			const processor = createAIOutputProcessor(mockProfile)
			expect(processor).toBeInstanceOf(AIOutputProcessor)
		})

		test('createPostProcessor 应该创建正确的处理器', () => {
			const processor = createPostProcessor(mockProfile)
			expect(processor).toBeInstanceOf(PostProcessor)
		})
	})

	describe('STProfileProcessor 集成测试', () => {
		let processor: STProfileProcessor

		beforeEach(() => {
			processor = new STProfileProcessor()
		})

		test('应该正确处理完整的流程', async () => {
			const mockRole = {
				name: '测试角色',
				type: '主角' as const,
				uuid: 'test-role-uuid',
				scope: 'global' as const,
				description: '',
				personality: '',
				scenario: '',
				first_mes: '',
				mes_example: '',
				system_prompt: '',
				system_settings: '',
				user_settings: '',
				assistant_settings: '',
				creator_notes: '',
				post_history_instructions: '',
				alternate_greetings: [],
				tags: [],
				createdAt: Date.now(),
				updatedAt: Date.now(),
				extensions: {}
			}

			const result = await processor.process(mockRole, mockProfile)

			expect(result.success).toBe(true)
			expect(result.processors).toBeDefined()
			expect(result.processors!.aiOutput).toBeInstanceOf(AIOutputProcessor)
			expect(result.processors!.postProcess).toBeInstanceOf(PostProcessor)
		})

		test('应该正确应用预处理正则', async () => {
			const mockRole = {
				name: '测试角色',
				type: '主角' as const,
				uuid: 'test-role-uuid',
				scope: 'global' as const,
				description: '',
				personality: '',
				scenario: '',
				first_mes: '',
				mes_example: '',
				system_prompt: '',
				system_settings: '',
				user_settings: '',
				assistant_settings: '',
				creator_notes: '',
				post_history_instructions: '',
				alternate_greetings: [],
				tags: [],
				createdAt: Date.now(),
				updatedAt: Date.now(),
				extensions: {}
			}

			const result = await processor.process(mockRole, mockProfile)

			// 检查系统设置中是否包含格式化后的内容
			expect(result.role.system_settings).toContain('这是「中文引号」内容')
		})
	})

	describe('错误处理', () => {
		test('应该处理无效的正则表达式', () => {
			const invalidBindings = [
				{
					id: 'invalid-regex',
					scriptName: '无效正则',
					findRegex: '[invalid regex',
					replaceString: 'test',
					trimStrings: [],
					placement: [1],
					disabled: false,
					markdownOnly: false,
					promptOnly: false,
					runOnEdit: false,
					substituteRegex: 1,
					runStages: [RegexRunStage.PRE_PROCESSING],
					targetSource: RegexTargetSource.PROMPT_CONTENT,
					priority: 100
				}
			]

			const processor = new STRegexProcessor(invalidBindings)

			// 应该不抛出错误，而是返回原内容
			expect(() => {
				const result = processor.processContent(
					'test content',
					RegexRunStage.PRE_PROCESSING,
					RegexTargetSource.PROMPT_CONTENT
				)
				expect(result).toBe('test content')
			}).not.toThrow()
		})

		test('应该跳过禁用的绑定', () => {
			const disabledBindings = [
				{
					id: 'disabled-binding',
					scriptName: '禁用的绑定',
					findRegex: 'test',
					replaceString: 'replaced',
					trimStrings: [],
					placement: [1],
					disabled: true, // 禁用
					markdownOnly: false,
					promptOnly: false,
					runOnEdit: false,
					substituteRegex: 1,
					runStages: [RegexRunStage.PRE_PROCESSING],
					targetSource: RegexTargetSource.PROMPT_CONTENT,
					priority: 100
				}
			]

			const processor = new STRegexProcessor(disabledBindings)
			const result = processor.processContent(
				'test content',
				RegexRunStage.PRE_PROCESSING,
				RegexTargetSource.PROMPT_CONTENT
			)

			// 应该保持原内容，因为绑定被禁用
			expect(result).toBe('test content')
		})
	})
})