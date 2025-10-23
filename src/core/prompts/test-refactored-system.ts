/**
 * 测试重构后的系统提示词生成器
 */

import { PromptBuilder } from "./builders/prompt-builder"
import { RoleGenerator } from "./generators/role-generator"
import { PromptAssembler, type PromptSectionVariables } from "./types/prompt-sections"
import type { RolePromptData, Role } from "@roo-code/types"

/**
 * 测试角色字段变量生成
 */
export function testRoleSectionVariables() {
	console.log("🧪 Testing role section variables generation...")

	// 创建测试角色数据
	const testRole: Role = {
		uuid: "test-role-uuid",
		name: "测试角色",
		type: "助手",
		scope: "workspace",
		createdAt: Date.now(),
		updatedAt: Date.now(),
		description: "这是一个测试角色",
		personality: "友好、专业",
		first_mes: "你好！我是测试角色。",
		system_prompt: "You are a helpful assistant.",
		system_settings: "System settings content",
		user_settings: "User settings content",
		assistant_settings: "Assistant settings content",
	}

	const testRolePromptData: RolePromptData = {
		role: testRole,
		storyline: { arcs: [] },
		memory: { traits: [], goals: [], episodic: [] },
	}

	// 创建角色生成器
	const roleGenerator = new RoleGenerator()

	// 生成字段变量
	const variables = roleGenerator.generateRoleSectionVariables(testRolePromptData)

	// 输出结果
	console.log("Generated variables:")
	console.log(PromptAssembler.getFieldPreview(variables))

	// 测试组装
	const assembledContent = PromptAssembler.assemblePrompt(variables, {
		summaryOnly: false,
		includeUserAvatar: false,
		userAvatarInsertBefore: 'systemSettings',
	})

	console.log("\nAssembled content:")
	console.log(assembledContent)

	return variables
}

/**
 * 测试用户头像字段顺序
 */
export function testUserAvatarFieldOrder() {
	console.log("🧪 Testing user avatar field order...")

	// 创建测试角色数据
	const testRole: Role = {
		uuid: "test-ai-role-uuid",
		name: "AI角色",
		type: "助手",
		scope: "workspace",
		createdAt: Date.now(),
		updatedAt: Date.now(),
		description: "AI助手角色",
		personality: "智能、友好",
		first_mes: "你好！我是AI助手。",
		system_prompt: "You are an AI assistant.",
		system_settings: "System settings content",
		user_settings: "User settings content",
		assistant_settings: "Assistant settings content",
	}

	// 创建用户头像角色
	const userAvatarRole: Role = {
		uuid: "test-user-role-uuid",
		name: "用户",
		type: "用户",
		scope: "workspace",
		createdAt: Date.now(),
		updatedAt: Date.now(),
		description: "用户角色",
		personality: "好奇、友好",
		first_mes: "你好！我是用户。",
	}

	const testRolePromptData: RolePromptData = {
		role: testRole,
		storyline: { arcs: [] },
		memory: { traits: [], goals: [], episodic: [] },
	}

	// 创建角色生成器
	const roleGenerator = new RoleGenerator()

	// 生成字段变量
	const variables = roleGenerator.generateRoleSectionVariables(testRolePromptData, userAvatarRole, true)

	// 添加用户头像字段
	if (variables.dynamicFields && typeof variables.dynamicFields === 'object') {
		variables.dynamicFields.userAvatar = "用户角色信息内容"
	} else {
		variables.dynamicFields = {
			userAvatar: "用户角色信息内容"
		}
	}

	// 输出结果
	console.log("Generated variables with user avatar:")
	console.log(PromptAssembler.getFieldPreview(variables))

	// 测试组装，确保用户头像在 system settings 前面
	const assembledContent = PromptAssembler.assemblePrompt(variables, {
		summaryOnly: false,
		includeUserAvatar: true,
		userAvatarInsertBefore: 'systemSettings',
	})

	console.log("\nAssembled content (user avatar should be before system settings):")
	console.log(assembledContent)

	// 验证顺序
	const userAvatarIndex = assembledContent.indexOf("用户角色信息内容")
	const systemSettingsIndex = assembledContent.indexOf("### System Settings")

	console.log(`\nOrder verification:`)
	console.log(`- User avatar index: ${userAvatarIndex}`)
	console.log(`- System settings index: ${systemSettingsIndex}`)
	console.log(`- User avatar is before system settings: ${userAvatarIndex < systemSettingsIndex && userAvatarIndex !== -1}`)

	return variables
}

/**
 * 测试完整的系统提示词生成流程
 */
export async function testCompleteSystemPromptGeneration() {
	console.log("🧪 Testing complete system prompt generation...")

	// 创建测试角色数据
	const testRole: Role = {
		uuid: "test-ai-uuid",
		name: "测试AI",
		type: "助手",
		scope: "workspace",
		createdAt: Date.now(),
		updatedAt: Date.now(),
		description: "测试AI助手",
		personality: "专业、友好",
		first_mes: "你好！我是测试AI助手。",
		system_prompt: "You are a helpful test AI assistant.",
		system_settings: "Test system settings content",
		user_settings: "Test user settings content",
		assistant_settings: "Test assistant settings content",
	}

	// 创建用户头像角色
	const userAvatarRole: Role = {
		uuid: "test-user-uuid",
		name: "测试用户",
		type: "用户",
		scope: "workspace",
		createdAt: Date.now(),
		updatedAt: Date.now(),
		description: "测试用户角色",
		personality: "好奇、友好",
		first_mes: "你好！我是测试用户。",
	}

	const testRolePromptData: RolePromptData = {
		role: testRole,
		storyline: { arcs: [] },
		memory: { traits: [], goals: [], episodic: [] },
	}

	// 创建提示构建器
	const promptBuilder = new PromptBuilder()

	try {
		// 测试构建角色区块
		const roleSectionBlock = promptBuilder["buildRoleSectionBlock"](
			testRolePromptData,
			userAvatarRole,
			true,
			"full"
		)

		console.log("Generated role section block:")
		console.log(roleSectionBlock)

		// 验证用户头像在 system settings 前面
		const userAvatarIndex = roleSectionBlock.indexOf("USER AVATAR")
		const systemSettingsIndex = roleSectionBlock.indexOf("### System Settings")

		console.log(`\nOrder verification:`)
		console.log(`- User avatar index: ${userAvatarIndex}`)
		console.log(`- System settings index: ${systemSettingsIndex}`)
		console.log(`- User avatar is before system settings: ${userAvatarIndex < systemSettingsIndex && userAvatarIndex !== -1}`)

		return roleSectionBlock
	} catch (error) {
		console.error("Error in complete system prompt generation test:", error)
		return ""
	}
}

/**
 * 运行所有测试
 */
export function runAllTests() {
	console.log("🚀 Running all refactored system prompt tests...\n")

	testRoleSectionVariables()
	console.log("\n" + "=".repeat(50) + "\n")

	testUserAvatarFieldOrder()
	console.log("\n" + "=".repeat(50) + "\n")

	testCompleteSystemPromptGeneration()
	console.log("\n" + "=".repeat(50) + "\n")

	console.log("✅ All tests completed!")
}
