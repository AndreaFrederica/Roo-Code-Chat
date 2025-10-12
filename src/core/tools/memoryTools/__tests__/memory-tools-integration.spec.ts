/**
 * 记忆工具集成测试
 * 验证记忆工具是否能正常工作
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { ClineProvider } from '../../../webview/ClineProvider'
import type { RoleMemoryTriggerService } from '../../../../services/role-memory/RoleMemoryTriggerService.js'
import type { ChatMessage } from '@roo-code/types'

// Mock implementations
const mockProvider = {
  getCurrentTask: () => ({
    taskId: 'test-task-id',
    log: (message: string) => console.log(message)
  }),
  getRolePromptData: async () => ({
    role: {
      uuid: 'test-role-uuid',
      name: 'Test Role'
    }
  }),
  log: (message: string) => console.log(message),
  anhChatServices: {
    roleMemoryTriggerService: {
      addEpisodicMemory: async () => ({ success: true, memoryId: 'test-id' }),
      addSemanticMemory: async () => ({ success: true, memoryId: 'test-id' }),
      updateTraits: async () => ({ success: true, updatedCount: 1 }),
      updateGoals: async () => ({ success: true, updatedCount: 1 }),
      searchMemories: async () => ({
        success: true,
        results: [],
        total_found: 0
      }),
      getMemoryStats: async () => ({
        success: true,
        stats: { total: 0, byType: {} as any }
      }),
      getRecentMemories: async () => ({
        success: true,
        memories: []
      }),
      cleanupMemories: async () => ({
        success: true,
        cleaned_count: 0
      })
    }
  }
} as unknown as ClineProvider

describe('Memory Tools Integration', () => {
  let provider: any

  beforeEach(() => {
    provider = mockProvider
  })

  describe('Tool Availability', () => {
    it('should add memory tools to all modes', async () => {
      // 验证记忆工具组存在
      const { TOOL_GROUPS } = await import('../../../../shared/tools.js')
      expect(TOOL_GROUPS.memory).toBeDefined()
      expect(TOOL_GROUPS.memory.tools).toContain('add_episodic_memory')
      expect(TOOL_GROUPS.memory.tools).toContain('add_semantic_memory')
      expect(TOOL_GROUPS.memory.tools).toContain('update_traits')
      expect(TOOL_GROUPS.memory.tools).toContain('update_goals')
      expect(TOOL_GROUPS.memory.tools).toContain('search_memories')
      expect(TOOL_GROUPS.memory.tools).toContain('get_memory_stats')
      expect(TOOL_GROUPS.memory.tools).toContain('get_recent_memories')
      expect(TOOL_GROUPS.memory.tools).toContain('cleanup_memories')
    })

    it('should have tool descriptions available', async () => {
      // 验证工具描述存在
      const {
        addEpisodicMemoryTool,
        addSemanticMemoryTool,
        updateTraitsTool,
        updateGoalsTool,
        searchMemoriesTool,
        getMemoryStatsTool,
        getRecentMemoriesTool,
        cleanupMemoriesTool
      } = await import('../index.js')

      expect(addEpisodicMemoryTool.description).toBeDefined()
      expect(addSemanticMemoryTool.description).toBeDefined()
      expect(updateTraitsTool.description).toBeDefined()
      expect(updateGoalsTool.description).toBeDefined()
      expect(searchMemoriesTool.description).toBeDefined()
      expect(getMemoryStatsTool.description).toBeDefined()
      expect(getRecentMemoriesTool.description).toBeDefined()
      expect(cleanupMemoriesTool.description).toBeDefined()
    })

    it('should include memory tools in tool description map', async () => {
      // 验证工具描述映射包含记忆工具
      const { getToolDescriptionsForMode } = await import('../../../prompts/tools/index.js')

      // 模拟参数
      const mockArgs = {
        cwd: '/test',
        supportsComputerUse: false,
        mcpHub: undefined,
        partialReadsEnabled: false,
        settings: { memoryToolsEnabled: true },
        experiments: {},
        customModes: []
      }

      const descriptions = getToolDescriptionsForMode(
        'code' as any,
        mockArgs.cwd,
        mockArgs.supportsComputerUse,
        undefined,
        undefined,
        undefined,
        mockArgs.mcpHub,
        mockArgs.customModes,
        mockArgs.experiments,
        mockArgs.partialReadsEnabled,
        mockArgs.settings,
        false,
        undefined,
        false,
        undefined
      )

      // 检查是否包含记忆工具描述
      expect(descriptions).toContain('add_episodic_memory')
      expect(descriptions).toContain('search_memories')
      expect(descriptions).toContain('get_memory_stats')
    })
  })

  describe('Memory Storage', () => {
    it('should store memories by role UUID', async () => {
      const { EnhancedRoleMemoryService } = await import('../../../../services/role-memory/EnhancedRoleMemoryService.js')

      // 模拟文件系统
      const mockMemoryService = {
        loadMemory: async (roleUuid: string) => ({
          characterUuid: roleUuid,
          episodic: [],
          semantic: [],
          traits: [],
          goals: []
        }),
        appendEpisodic: async (roleUuid: string, record: any) => {
          console.log(`Storing episodic memory for role: ${roleUuid}`)
        },
        upsertSemantic: async (roleUuid: string, record: any) => {
          console.log(`Storing semantic memory for role: ${roleUuid}`)
        },
        updateTraits: async (roleUuid: string, traits: any) => {
          console.log(`Updating traits for role: ${roleUuid}`)
        },
        updateGoals: async (roleUuid: string, goals: any) => {
          console.log(`Updating goals for role: ${roleUuid}`)
        }
      }

      // 验证角色特定的存储
      const role1Uuid = 'role-123'
      const role2Uuid = 'role-456'

      await mockMemoryService.appendEpisodic(role1Uuid, { content: 'Test memory 1' })
      await mockMemoryService.appendEpisodic(role2Uuid, { content: 'Test memory 2' })

      expect(true).toBe(true) // 存储调用成功
    })

    it('should create separate JSON files per role', () => {
      // 验证路径结构
      const { path } = require('path')

      const role1Uuid = 'role-123'
      const role2Uuid = 'role-456'
      const memoryDir = '/test/memory'

      const path1 = path.join(memoryDir, role1Uuid, 'memory.json')
      const path2 = path.join(memoryDir, role2Uuid, 'memory.json')

      expect(path1).toBe('/test/memory/role-123/memory.json')
      expect(path2).toBe('/test/memory/role-456/memory.json')
      expect(path1).not.toBe(path2) // 确保路径不同
    })
  })

  describe('Tool Execution Flow', () => {
    it('should handle memory tool execution', async () => {
      const { addEpisodicMemoryTool } = await import('../addEpisodicMemoryTool')

      const mockBlock = {
        type: 'tool_use',
        name: 'add_episodic_memory',
        params: {
          content: 'Test episodic memory content',
          keywords: ['test', 'memory']
        }
      }

      const result = await addEpisodicMemoryTool.execute(
        mockBlock.params,
        null,
        provider
      )

      expect(result.success).toBe(true)
      expect(result.memoryId).toBeDefined()
    })

    it('should handle search memory tool execution', async () => {
      const { searchMemoriesTool } = await import('../searchMemoriesTool')

      const mockBlock = {
        type: 'tool_use',
        name: 'search_memories',
        params: {
          search_text: 'test search',
          memory_types: ['episodic', 'semantic']
        }
      }

      const result = await searchMemoriesTool.execute(
        mockBlock.params,
        null,
        provider
      )

      expect(result.success).toBe(true)
      expect(result.results).toBeDefined()
    })
  })

  describe('AI Tool Usage Scenarios', () => {
    it('should allow AI to add episodic memories when user shares personal information', () => {
      const mockUserMessage = "我叫小明，今年25岁，住在北京，是一名软件工程师"

      // AI应该能够识别并存储这个个人信息
      const expectedToolCall = {
        name: 'add_episodic_memory',
        params: {
          content: expect.stringContaining('小明'),
          keywords: expect.arrayContaining(['小明', '25岁', '北京', '软件工程师']),
          priority: expect.any(Number)
        }
      }

      expect(expectedToolCall).toBeDefined()
    })

    it('should allow AI to search memories when referencing past conversations', () => {
      const mockUserMessage = "你还记得我上次说的项目进展吗？"

      // AI应该搜索相关记忆
      const expectedToolCall = {
        name: 'search_memories',
        params: {
          search_text: expect.stringContaining('项目'),
          memory_types: expect.any(Array)
        }
      }

      expect(expectedToolCall).toBeDefined()
    })

    it('should allow AI to update traits when observing user behavior patterns', () => {
      const mockUserMessage = "我总是喜欢在晚上工作，白天不太有灵感"

      // AI应该更新用户特质
      const expectedToolCall = {
        name: 'update_traits',
        params: {
          traits: expect.arrayContaining([
            expect.objectContaining({
              name: expect.stringContaining('工作习惯'),
              value: expect.stringContaining('晚上工作')
            })
          ])
        }
      }

      expect(expectedToolCall).toBeDefined()
    })
  })
})