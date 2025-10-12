import { describe, test, expect } from 'vitest'
import {
  parseCompileAndInjectPresetWithLiquidTemplates,
  processTextWithLiquidTemplates,
  createRoleWithLiquidTemplates
} from '../st-preset-injector.js'
import { Role } from '../anh-chat.js'

// 辅助函数：创建测试 Role 对象
function createTestRole(overrides: Partial<Role> = {}): Role {
  const now = Date.now()
  return {
    uuid: 'test-uuid-' + Math.random().toString(36).substr(2, 9),
    name: 'Test Role',
    type: 'SillyTavernRole',
    aliases: [],
    description: 'Test role description',
    affiliation: '',
    color: '',
    profile: {},
    modeOverrides: {},
    timeline: [],
    tags: [],
    createdAt: now,
    updatedAt: now,
    personality: '',
    first_mes: '',
    avatar: null,
    mes_example: '',
    scenario: '',
    creator_notes: '',
    system_prompt: '',
    post_history_instructions: '',
    alternate_greetings: [],
    creator: '',
    character_version: '',
    extensions: {},
    character_book: { name: "", entries: [] },
    spec: 'chara_card_v2',
    spec_version: '2.0',
    ...overrides
  }
}

describe('ST Preset LiquidJS Integration', () => {
  // 模拟一个简单的 ST Preset
  const mockPreset = {
    prompts: [
      {
        identifier: 'system_prompt',
        display_name: 'System Prompt',
        prompt_content: '你是一个AI助手，{{ user }}。今天是 {{ isodate }}。',
        role: 'system'
      },
      {
        identifier: 'greeting',
        display_name: 'Greeting',
        prompt_content: '{% assign greeting = "你好" %}{{ greeting }}，{{ user }}！',
        role: 'user'
      }
    ],
    prompt_order: [
      { identifier: 'system_prompt', role: 'system', enabled: true, character_id: 1, order: { "": 1 } },
      { identifier: 'greeting', role: 'user', enabled: true, character_id: 1, order: { "": 2 } }
    ]
  }

  describe('processTextWithLiquidTemplates', () => {
    test('should process simple LiquidJS templates', () => {
      const text = '你好，{{ user }}！今天是 {{ isodate }}。'
      const result = processTextWithLiquidTemplates(text, {
        user: 'Alice'
      })

      expect(result).toBe('你好，Alice！今天是 2025-10-10。')
    })

    test('should handle complex LiquidJS syntax', () => {
      const text = '{% assign greeting = "欢迎" %}{% if user %}{{ greeting }}，{{ user }}！{% else %}{{ greeting }}，访客！{% endif %}'

      const result1 = processTextWithLiquidTemplates(text, { user: 'Bob' })
      const result2 = processTextWithLiquidTemplates(text, { user: null })

      expect(result1).toBe('欢迎，Bob！')
      expect(result2).toBe('欢迎，访客！')
    })

    test('should handle loops and filters', () => {
      const text = '用户列表：{% for user in users %}{{ user | append: " " }}{% endfor %}'
      const result = processTextWithLiquidTemplates(text, {
        users: ['Alice', 'Bob', 'Charlie']
      })

      expect(result).toBe('用户列表：Alice Bob Charlie ')
    })
  })

  describe('createRoleWithLiquidTemplates', () => {
    test('should create role with processed template', () => {
      const roleBase = {
        name: 'Test Role',
        description: 'Test role description',
        type: 'SillyTavernRole' as const
      }

      const promptTemplate = '你好，{{ user }}！今天是 {{ isodate }}。'
      const role = createRoleWithLiquidTemplates(roleBase, promptTemplate, {
        user: 'David'
      })

      expect(role.name).toBe('Test Role')
      expect(role.system_prompt).toBe('你好，David！今天是 2025-10-10。')
    })

    test('should handle template errors gracefully', () => {
      const roleBase = {
        name: 'Test Role',
        description: 'Test role description',
        type: 'SillyTavernRole' as const
      }

      const promptTemplate = '你好，{{ unknown_variable }}！'
      const role = createRoleWithLiquidTemplates(roleBase, promptTemplate)

      expect(role.system_prompt).toBe('你好，！')
    })
  })

  describe('parseCompileAndInjectPresetWithLiquidTemplates', () => {
    test('should process ST preset with LiquidJS templates', () => {
      const role = createTestRole()

      const result = parseCompileAndInjectPresetWithLiquidTemplates(
        role,
        mockPreset,
        {
          user: 'Emma',
          isodate: '2025-12-25'
        }
      )

      expect(result.name).toBe('Test Role')
      expect(result.prompt).toContain('你是一个AI助手，Emma。')
      expect(result.prompt).toContain('你好，Emma！')
      expect(result.prompt).toContain('2025-12-25')
    })

    test('should handle conditional logic in presets', () => {
      const conditionalPreset = {
        prompts: [
          {
            identifier: 'conditional_message',
            display_name: 'Conditional Message',
            prompt_content: '{% if user == "admin" %}管理员模式已激活{% else %}普通用户模式{% endif %}',
            role: 'system'
          }
        ],
        prompt_order: [
          { identifier: 'conditional_message', role: 'system', enabled: true, character_id: 1, order: { "": 1 } }
        ]
      }

      const role = createTestRole({ name: 'Admin Test' })

      const adminResult = parseCompileAndInjectPresetWithLiquidTemplates(
        createTestRole(),
        conditionalPreset,
        { user: 'admin' }
      )

      const userResult = parseCompileAndInjectPresetWithLiquidTemplates(
        createTestRole(),
        conditionalPreset,
        { user: 'guest' }
      )

      expect(adminResult.prompt).toContain('管理员模式已激活')
      expect(userResult.prompt).toContain('普通用户模式')
    })

    test('should support custom LiquidJS filters', () => {
      const filterPreset = {
        prompts: [
          {
            identifier: 'filtered_content',
            display_name: 'Filtered Content',
            prompt_content: '格式化日期：{{ "2023-12-25" | date }}',
            role: 'system'
          }
        ],
        prompt_order: [
          { identifier: 'filtered_content', role: 'system', enabled: true, character_id: 1, order: { "": 1 } }
        ]
      }

      const role = createTestRole({ name: 'Filter Test' })

      const result = parseCompileAndInjectPresetWithLiquidTemplates(
        role,
        filterPreset,
        {}
      )

      expect(result.prompt).toContain('格式化日期：2023-12-25')
    })
  })

  describe('Backward Compatibility', () => {
    test('should work with existing {{user}} syntax', () => {
      const text = '你好，{{user}}！'
      const result = processTextWithLiquidTemplates(text)

      expect(result).toBe('你好，用户！')
    })

    test('should support variable overriding', () => {
      const text = '你好，{{user}}！'
      const result = processTextWithLiquidTemplates(text, {
        user: 'Frank'
      })

      expect(result).toBe('你好，Frank！')
    })
  })

  describe('Error Handling', () => {
    test('should handle invalid LiquidJS syntax gracefully', () => {
      const text = '你好，{{ user ！' // 语法错误
      const result = processTextWithLiquidTemplates(text, {
        user: 'Grace'
      })

      // 应该返回原始文本或错误处理后的文本
      expect(typeof result).toBe('string')
    })

    test('should handle missing variables in strict mode', () => {
      const text = '你好，{{ unknown_user }}！'

      expect(() => {
        processTextWithLiquidTemplates(text, {}, {
          strict: true,
          removeUnprocessed: true
        })
      }).not.toThrow()
    })
  })
})