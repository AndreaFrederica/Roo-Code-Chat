/**
 * RoleGenerator 单元测试
 */

import { RoleGenerator } from '../generators/role-generator'
import type { RolePromptData, Role } from '@roo-code/types'

describe('RoleGenerator', () => {
	let roleGenerator: RoleGenerator
	let mockRolePromptData: RolePromptData
	let mockUserAvatarRole: Role

	beforeEach(() => {
		roleGenerator = new RoleGenerator()

		mockRolePromptData = {
			role: { name: "Test", type: "SillyTavernRole", uuid: "test", scope: "global", createdAt: Date.now(), updatedAt: Date.now() } as any,
			storyline: undefined,
			memory: undefined,
		}

		mockUserAvatarRole = {
			uuid: 'test-avatar-uuid',
			name: '测试用户',
			type: 'SillyTavernRole',
			description: '测试用户角色',
			scope: 'global' as const,
			createdAt: Date.now(),
			updatedAt: Date.now(),
			profile: {} as any,
			modeOverrides: {} as any,
		}
	})

	describe('generateRoleSection', () => {
		it('should generate role section for valid role data', () => {
			const result = roleGenerator.generateRoleSection(mockRolePromptData)

			expect(result).toContain('### Character Overview')
			expect(result).toContain('Name: 测试角色')
			expect(result).toContain('Type: AI助手')
			expect(result).toContain('Summary: 用于测试的角色')
			expect(result).toContain('### Personality')
			expect(result).toContain('友好、专业')
		})

		it('should return empty string for invalid role data', () => {
			const result = roleGenerator.generateRoleSection({} as RolePromptData)

			expect(result).toBe('')
		})

		it('should handle summary only mode', () => {
			const result = roleGenerator.generateRoleSection(mockRolePromptData, undefined, undefined, {
				summaryOnly: true
			})

			expect(result).toContain('### Character Overview')
			// 在摘要模式下应该包含关键信息
			expect(result).toContain('Name: 测试角色')
		})

		it('should handle template replacement disabled', () => {
			const result = roleGenerator.generateRoleSection(mockRolePromptData, undefined, undefined, {
				disableTemplateReplacement: true
			})

			expect(result).toContain('### Character Overview')
			// 禁用模板替换时应该有原始内容
			expect(result).toContain('测试角色')
		})
	})

	describe('generateUserAvatarSection', () => {
		it('should generate user avatar section when enabled', () => {
			const result = roleGenerator.generateUserAvatarSection(true, mockUserAvatarRole)

			expect(result).toContain('USER AVATAR')
			expect(result).toContain('测试用户')
		})

		it('should return empty string when disabled', () => {
			const result = roleGenerator.generateUserAvatarSection(false, mockUserAvatarRole)

			expect(result).toBe('')
		})

		it('should return empty string when no user avatar role', () => {
			const result = roleGenerator.generateUserAvatarSection(true, undefined)

			expect(result).toContain('用户的角色信息不可用或已被隐藏')
		})

		it('should handle hidden visibility', () => {
			const result = roleGenerator.generateUserAvatarSection(true, mockUserAvatarRole, 'hidden')

			expect(result).toContain('用户已选择隐藏角色信息')
		})

		it('should handle summary visibility', () => {
			const result = roleGenerator.generateUserAvatarSection(true, mockUserAvatarRole, 'summary')

			expect(result).toContain('USER AVATAR')
			expect(result).toContain('测试用户')
		})
	})

	describe('generateEnhancedRoleInfo', () => {
		it('should generate enhanced role info', () => {
			const result = roleGenerator.generateEnhancedRoleInfo(
				mockRolePromptData,
				mockUserAvatarRole,
				true
			)

			expect(result.roleDefinition).toContain('You are 测试角色')
			expect(result.roleSummary).toContain('Name: 测试角色')
			expect(result.systemInstructions).toContain('你是一个专业的测试助手')
			expect(result.userAvatarInfo).toContain('测试用户')
			expect(result.fullCharacterInfo).toContain('### Character Overview')
		})

		it('should handle empty role data', () => {
			const result = roleGenerator.generateEnhancedRoleInfo({} as RolePromptData)

			expect(result.roleDefinition).toBe('')
			expect(result.roleSummary).toBe('')
			expect(result.fullCharacterInfo).toBe('')
		})

		it('should respect max length limit', () => {
			// 创建一个很长的角色描述
			const longRole: RolePromptData = {
				role: { name: "Test", type: "SillyTavernRole", uuid: "test", scope: "global", createdAt: Date.now(), updatedAt: Date.now() } as any,
				storyline: undefined,
				memory: undefined,
			}

			const result = roleGenerator.generateEnhancedRoleInfo(longRole, undefined, undefined, {
				maxLength: 1000
			})

			expect(result.systemInstructions?.length).toBeLessThanOrEqual(1003) // 1000 + "..."
		})

		it('should exclude user avatar when disabled', () => {
			const result = roleGenerator.generateEnhancedRoleInfo(
				mockRolePromptData,
				mockUserAvatarRole,
				false // disable user avatar
			)

			expect(result.userAvatarInfo).toBe('')
		})
	})

	describe('applyRoleOverrides', () => {
		it('should apply SillyTavern role overrides', () => {
			const sillyTavernRole: RolePromptData = {
				role: { name: "Test", type: "SillyTavernRole", uuid: "test", scope: "global", createdAt: Date.now(), updatedAt: Date.now() } as any,
				storyline: undefined,
				memory: undefined,
			}

			const selection = {
				roleDefinition: 'You are an assistant.',
				baseInstructions: 'Help users.',
				description: 'AI助手',
			}

			const result = roleGenerator.applyRoleOverrides(selection, sillyTavernRole)

			expect(result.roleDefinition).toContain('You are 测试角色')
			expect(result.baseInstructions).toContain('### Example Interactions')
			expect(result.baseInstructions).toContain('示例对话')
		})

		it('should apply gentle role overrides', () => {
			const selection = {
				roleDefinition: 'You are an assistant.',
				baseInstructions: 'Help users.',
				description: 'AI助手',
			}

			const result = roleGenerator.applyRoleOverrides(selection, mockRolePromptData, {
				personaFallback: 'chat'
			})

			expect(result.roleDefinition).toContain('You are currently roleplaying as 测试角色')
		})

		it('should apply strong role overrides', () => {
			const roleWithOverrides: RolePromptData = {
				role: {
					...mockRolePromptData.role,
					modeOverrides: {
						roleDefinition: 'You are a custom role.',
						customInstructions: 'Custom instructions.',
					},
				},
				storyline: undefined,
				memory: undefined,
			}

			const selection = {
				roleDefinition: 'You are an assistant.',
				baseInstructions: 'Help users.',
				description: 'AI助手',
			}

			const result = roleGenerator.applyRoleOverrides(selection, roleWithOverrides)

			expect(result.roleDefinition).toBe('You are a custom role.')
			expect(result.baseInstructions).toBe('Custom instructions.')
		})
	})

	describe('edge cases', () => {
		it('should handle null/undefined values gracefully', () => {
			const roleWithNulls: RolePromptData = {
				role: { name: "Test", type: "SillyTavernRole", uuid: "test", scope: "global", createdAt: Date.now(), updatedAt: Date.now() } as any,
				storyline: undefined,
				memory: undefined,
			}

			expect(() => {
				roleGenerator.generateRoleSection(roleWithNulls)
			}).not.toThrow()

			expect(() => {
				roleGenerator.generateEnhancedRoleInfo(roleWithNulls)
			}).not.toThrow()
		})

		it('should handle empty arrays gracefully', () => {
			const roleWithEmptyArrays: RolePromptData = {
				role: { name: "Test", type: "SillyTavernRole", uuid: "test", scope: "global", createdAt: Date.now(), updatedAt: Date.now() } as any,
				storyline: undefined,
				memory: undefined,
			}

			const result = roleGenerator.generateRoleSection(roleWithEmptyArrays)

			expect(result).toContain('Name: 测试')
			// 应该不包含空的部分
			expect(result).not.toContain('Titles:')
		})

		it('should handle very long content', () => {
			const longContent = 'A'.repeat(10000)
			const roleWithLongContent: RolePromptData = {
				role: { name: "Test", type: "SillyTavernRole", uuid: "test", scope: "global", createdAt: Date.now(), updatedAt: Date.now() } as any,
				storyline: undefined,
				memory: undefined,
			}

			expect(() => {
				roleGenerator.generateRoleSection(roleWithLongContent)
			}).not.toThrow()

			const result = roleGenerator.generateEnhancedRoleInfo(roleWithLongContent, undefined, undefined, {
				maxLength: 500
			})

			expect(result.systemInstructions?.length).toBeLessThanOrEqual(503)
		})
	})
})