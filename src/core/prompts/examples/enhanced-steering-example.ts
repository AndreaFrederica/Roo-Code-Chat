/**
 * 增强导向模式示例
 * 展示如何使用重构后的模块为增强导向模式生成完整的角色信息
 */

import { RoleGenerator, EnvironmentBuilder, type EnhancedRoleInfo } from '../index'
import type { RolePromptData, Role } from '@roo-code/types'

// 模拟的角色数据
const mockRolePromptData: RolePromptData = {
	role: {
		uuid: 'reimu-hakurei-uuid',
		name: '博丽灵梦',
		type: '巫女',
		description: '博丽神社的巫女，守护幻想乡的少女',
		personality: '认真、有责任感、略带天然呆',
		scenario: '在博丽神社的日常，突然有客人来访',
		system_prompt: `你是博丽灵梦，博丽神社的巫女。性格认真，有责任感，虽然偶尔会显得有些天然呆，但对工作非常热心。说话方式略带古风，会用"本巫女"自称。

请特别注意下面以 "### Character Overview" 和 "### First Message" 为标题的内容，这些是角色的详细信息，还有你需要注意 "USER AVATAR"为标题的部分 这是用户的身份信息，请根据这些内容开始角色扮演。\n### First Message 里面的内容是你的初始问候语，请根据这些内容开始角色扮演。`,
		first_mes: '欢迎来到博丽神社。本巫女是这里的巫女博丽灵梦，有什么事吗？',
		tags: ['巫女', '博丽神社', '幻想乡'],
		affiliation: '博丽神社',
		aliases: ['灵梦', '巫女大人'],
		color: '红色',
		profile: {
			appearance: '红色巫女服，黑色长发，红色蝴蝶结',
			personality: '认真负责，对退魔工作热心，有时会偷懒但关键时刻很可靠',
			background: '从小在博丽神社长大，继承了博丽血脉，负责守护幻想乡的结界',
			skills: ['符卡战斗', '退魔', '结界维护', '灵力感知'],
			hobbies: ['喝茶', '打扫神社', '收集赛钱'],
		},
		scope: 'global' as const,
		createdAt: Date.now(),
		updatedAt: Date.now(),
		modeOverrides: {} as any,
	},
	storyline: undefined,
	memory: undefined,
}

const mockUserAvatarRole: Role = {
	uuid: 'lost-visitor-uuid',
	name: '迷失的访客',
	type: '人类',
	description: '一个偶然来到博丽神社的迷失访客',
	personality: '好奇、礼貌',
	scope: 'global' as const,
	createdAt: Date.now(),
	updatedAt: Date.now(),
	profile: {} as any,
	modeOverrides: {} as any,
}

/**
 * 增强导向模式示例
 */
export class EnhancedSteeringExample {
	private roleGenerator: RoleGenerator
	private environmentBuilder: EnvironmentBuilder

	constructor() {
		this.roleGenerator = new RoleGenerator()
		this.environmentBuilder = new EnvironmentBuilder()
	}

	/**
	 * 生成增强的角色信息
	 */
	generateEnhancedRoleInfo(): EnhancedRoleInfo {
		console.log('🎭 生成增强角色信息...')

		const enhancedInfo = this.roleGenerator.generateEnhancedRoleInfo(
			mockRolePromptData,
			mockUserAvatarRole,
			true, // enableUserAvatar
			{
				summaryOnly: false,
				includeSystemInstructions: true,
				includeUserAvatar: true,
				maxLength: 3000,
			}
		)

		console.log('✅ 增强角色信息生成完成')
		return enhancedInfo
	}

	/**
	 * 生成增强的环境信息
	 */
	generateEnhancedEnvironmentInfo(): string {
		console.log('🏗️ 生成增强环境信息...')

		const enhancedEnvironmentInfo = this.environmentBuilder.generateEnhancedRoleEnvironmentInfo({
			rolePromptData: mockRolePromptData,
			cline: { api: { getVersion: () => "test-version" } } as any,
			userAvatarRole: mockUserAvatarRole,
			enableUserAvatar: true,
			maxLength: 2000,
			includeSystemInstructions: true,
			includeWorldBookSummary: true,
			includeVariableSummary: true,
			worldBookContent: `# 幻想乡世界观

## 基本设定
幻想乡是一个被博丽大结界包围的神秘之地，里面居住着各种妖怪、神明和人类。

## 重要地点
- 博丽神社：位于幻想乡边界，守护结界的重要场所
- 红魔馆：吸血鬼蕾米莉亚的居所
- 魔法森林：魔法使们的聚集地
- 妖怪之山：天狗和河童的领地`,
			currentTask: {
				getLatestVariableState: () => ({
					currentLocation: '博丽神社',
					timeOfDay: '下午',
					weather: '晴朗',
					mood: '平静',
				}),
			},
		})

		console.log('✅ 增强环境信息生成完成')
		return enhancedEnvironmentInfo
	}

	/**
	 * 展示增强导向模式的效果对比
	 */
	demonstrateEnhancedSteering() {
		console.log('\n🚀 增强导向模式效果演示')
		console.log('=' .repeat(50))

		// 1. 传统模式（只有简单角色定义）
		console.log('\n📋 传统模式输出:')
		console.log('-'.repeat(30))
		const traditionalOutput = `<role>You are Roo, a friendly and knowledgeable conversational assistant. Your primary focus is engaging in natural dialogue with users, answering questions, and providing information.</role>`
		console.log(traditionalOutput)

		// 2. 增强导向模式（完整角色信息）
		console.log('\n🎯 增强导向模式输出:')
		console.log('-'.repeat(30))
		const enhancedRoleInfo = this.generateEnhancedRoleInfo()
		const enhancedEnvironmentInfo = this.generateEnhancedEnvironmentInfo()

		// 格式化输出
		console.log(`\n<enhanced_role_definition>`)
		console.log(enhancedRoleInfo.roleDefinition)
		console.log(`</enhanced_role_definition>`)

		console.log(`\n<role_summary>`)
		console.log(enhancedRoleInfo.roleSummary)
		console.log(`</role_summary>`)

		if (enhancedRoleInfo.systemInstructions) {
			console.log(`\n<enhanced_system_instructions>`)
			console.log(enhancedRoleInfo.systemInstructions)
			console.log(`</enhanced_system_instructions>`)
		}

		if (enhancedRoleInfo.userAvatarInfo) {
			console.log(`\n<user_avatar_context>`)
			console.log(enhancedRoleInfo.userAvatarInfo)
			console.log(`</user_avatar_context>`)
		}

		console.log('\n' + enhancedEnvironmentInfo)

		// 3. 对比分析
		console.log('\n📊 效果对比分析:')
		console.log('-'.repeat(30))
		this.analyzeComparison(traditionalOutput, enhancedRoleInfo, enhancedEnvironmentInfo)
	}

	/**
	 * 分析传统模式与增强导向模式的差异
	 */
	private analyzeComparison(
		traditional: string,
		enhancedRole: EnhancedRoleInfo,
		enhancedEnvironment: string
	) {
		const traditionalLength = traditional.length
		const enhancedLength = enhancedRole.roleDefinition.length +
			enhancedRole.roleSummary.length +
			(enhancedRole.systemInstructions?.length || 0) +
			enhancedEnvironment.length

		console.log(`📏 内容长度对比:`)
		console.log(`   传统模式: ${traditionalLength} 字符`)
		console.log(`   增强模式: ${enhancedLength} 字符`)
		console.log(`   增长比例: ${Math.round((enhancedLength / traditionalLength - 1) * 100)}%`)

		console.log(`\n🎯 信息丰富度对比:`)
		console.log(`   传统模式:`)
		console.log(`     ✅ 基础角色身份`)
		console.log(`     ❌ 角色特征`)
		console.log(`     ❌ 行为准则`)
		console.log(`     ❌ 上下文信息`)
		console.log(`     ❌ 用户信息`)

		console.log(`\n   增强模式:`)
		console.log(`     ✅ 完整角色定义`)
		console.log(`     ✅ 角色特征摘要`)
		console.log(`     ✅ 系统指令`)
		console.log(`     ✅ 用户头像信息`)
		console.log(`     ✅ 世界观背景`)
		console.log(`     ✅ 变量状态`)
		console.log(`     ✅ 关键词标签`)

		console.log(`\n🎭 AI 角色扮演效果:`)
		console.log(`   传统模式: AI 会保持通用的助手角色`)
		console.log(`   增强模式: AI 会完全代入博丽灵梦的角色，使用相应的语言风格和行为模式`)
	}

	/**
	 * 展示不同场景下的增强导向效果
	 */
	demonstrateScenarios() {
		console.log('\n🎬 不同场景下的增强导向效果')
		console.log('=' .repeat(50))

		const scenarios = [
			{
				name: '日常对话场景',
				input: '你好，请问这里是什么地方？',
				expectedResponse: '以博丽灵梦的身份回答，介绍博丽神社',
			},
			{
				name: '任务处理场景',
				input: '有妖怪在附近出现了，需要处理',
				expectedResponse: '作为巫女接受任务，展现责任感',
			},
			{
				name: '轻松互动场景',
				input: '天气真好，要不要一起喝茶？',
				expectedResponse: '展现灵梦爱喝茶的一面，语气更轻松',
			},
		]

		scenarios.forEach((scenario, index) => {
			console.log(`\n${index + 1}. ${scenario.name}`)
			console.log(`   用户输入: ${scenario.input}`)
			console.log(`   期望效果: ${scenario.expectedResponse}`)
			console.log(`   增强导向: 通过完整的角色信息确保AI能准确理解并扮演博丽灵梦`)
		})
	}

	/**
	 * 性能测试
	 */
	performanceTest() {
		console.log('\n⚡ 性能测试')
		console.log('=' .repeat(30))

		const iterations = 100
		const startTime = Date.now()

		for (let i = 0; i < iterations; i++) {
			this.roleGenerator.generateEnhancedRoleInfo(mockRolePromptData, mockUserAvatarRole, true)
		}

		const endTime = Date.now()
		const totalTime = endTime - startTime
		const averageTime = totalTime / iterations

		console.log(`总执行时间: ${totalTime}ms`)
		console.log(`执行次数: ${iterations}`)
		console.log(`平均执行时间: ${averageTime.toFixed(2)}ms`)
		console.log(`每秒处理能力: ${Math.round(1000 / averageTime)} 次/秒`)

		if (averageTime < 10) {
			console.log('✅ 性能优秀 (< 10ms)')
		} else if (averageTime < 50) {
			console.log('✅ 性能良好 (< 50ms)')
		} else {
			console.log('⚠️  性能需要优化 (> 50ms)')
		}
	}
}

/**
 * 运行示例
 */
export function runEnhancedSteeringExample() {
	console.log('🎭 增强导向模式示例')
	console.log('展示重构后的系统如何为增强导向模式提供完整的角色信息')
	console.log('=' .repeat(60))

	const example = new EnhancedSteeringExample()

	// 主要演示
	example.demonstrateEnhancedSteering()

	// 场景演示
	example.demonstrateScenarios()

	// 性能测试
	example.performanceTest()

	console.log('\n🎉 示例执行完成！')
	console.log('\n💡 关键要点:')
	console.log('1. 增强导向模式现在包含完整的角色信息')
	console.log('2. 模块化设计使得功能更加强大和灵活')
	console.log('3. 性能优化确保实时响应能力')
	console.log('4. 向后兼容保证现有代码无需修改')
}

// 如果直接运行此文件
if (require.main === module) {
	runEnhancedSteeringExample()
}