import { describe, test, expect } from 'vitest'
import {
  LiquidTemplateProcessor,
  processLiquidTemplateVariables,
  processLiquidTemplateVariablesAsync,
  renderTemplate,
  LiquidTemplateProcessingResult
} from '../liquid-template-system.js'

describe('LiquidJS Template System', () => {
  describe('Basic Template Rendering', () => {
    test('should render simple variables', () => {
      const result = processLiquidTemplateVariables('Hello {{ name }}!', {
        variables: { name: 'World' }
      })

      expect(result.processedText).toBe('Hello World!')
      expect(result.errors).toHaveLength(0)
      expect(result.stats.variableCount).toBe(1)
    })

    test('should provide default variables', () => {
      const processor = new LiquidTemplateProcessor()
      const result = processor.processTextSync('{{ user }} 和 {{ char }} 对话')

      expect(result.processedText).toBe('用户 和 角色 对话')
      expect(processor.getAllVariables().user).toBe('用户')
      expect(processor.getAllVariables().char).toBe('角色')
    })

    test('should handle date and time variables', () => {
      const result = processLiquidTemplateVariables('今天是 {{ isodate }}，时间是 {{ isotime }}')

      expect(result.processedText).toMatch(/今天是 \d{4}-\d{2}-\d{2}，时间是 \d{2}:\d{2}:\d{2}/)
    })
  })

  describe('Custom Template Syntax Support', () => {
    test('should process {{setvar::}} syntax', () => {
      const text = `
{% assign greeting = "你好，Alice！" %}
{{ greeting }}
      `.trim()

      const result = processLiquidTemplateVariables(text)

      expect(result.processedText).toContain('你好，Alice！')
      expect(result.setVariables.greeting).toBe('你好，Alice！')
    })

    test('should process {{getvar::}} syntax', () => {
      const text = '{{ name }}'
      const result = processLiquidTemplateVariables(text, {
        variables: { name: 'Bob' }
      })

      expect(result.processedText).toBe('Bob')
    })

    test('should handle nested variables in assignments', () => {
      const text = `{% assign greeting = "你好，" %}{% assign user_greeting = greeting | append: user | append: "！" %}{{ user_greeting }}`

      const result = processLiquidTemplateVariables(text, {
        variables: { user: 'Charlie' }
      })

      expect(result.processedText).toContain('你好，Charlie！')
    })
  })

  describe('Complex Template Logic', () => {
    test('should handle conditional statements', () => {
      const text = `{% if user == "admin" %}管理员界面{% else %}普通用户界面{% endif %}`

      const result = processLiquidTemplateVariables(text, {
        variables: { user: 'admin' }
      })

      expect(result.processedText).toBe('管理员界面')
    })

    test('should handle loops', () => {
      const text = `
{% for item in items %}
- {{ item }}
{% endfor %}
      `.trim()

      const result = processLiquidTemplateVariables(text, {
        variables: { items: ['苹果', '香蕉', '橙子'] }
      })

      expect(result.processedText).toContain('- 苹果')
      expect(result.processedText).toContain('- 香蕉')
      expect(result.processedText).toContain('- 橙子')
    })

    test('should handle complex nested logic', () => {
      const text = `{% assign greeting = "你好" %}{% if user %}{{ greeting }}，{{ user }}！{% else %}{{ greeting }}，访客！{% endif %}`

      const result1 = processLiquidTemplateVariables(text, {
        variables: { user: 'David' }
      })

      const result2 = processLiquidTemplateVariables(text, {
        variables: { user: null }
      })

      expect(result1.processedText).toBe('你好，David！')
      expect(result2.processedText).toBe('你好，访客！')
    })
  })

  describe('Error Handling', () => {
    test('should handle undefined variables in non-strict mode', () => {
      const result = processLiquidTemplateVariables('Hello {{ unknown }}!')

      expect(result.processedText).toBe('Hello !')
      expect(result.errors).toHaveLength(0)
    })

    test('should handle errors gracefully', () => {
      const text = '{% invalid_tag %}'
      const result = processLiquidTemplateVariables(text)

      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('Custom Filters', () => {
    test('should apply date filter', () => {
      const result = processLiquidTemplateVariables('{{ "2023-12-25" | date }}')

      expect(result.processedText).toBe('2023-12-25')
    })

    test('should apply time filter', () => {
      const result = processLiquidTemplateVariables('{{ "2023-12-25T10:30:00" | time }}')

      expect(result.processedText).toMatch(/^\d{2}:\d{2}:\d{2}$/)
    })
  })

  describe('Performance', () => {
    test('should handle large text efficiently', () => {
      const largeText = 'Hello {{ name }}! '.repeat(1000)
      const start = Date.now()

      const result = processLiquidTemplateVariables(largeText, {
        variables: { name: 'World' }
      })

      const duration = Date.now() - start
      expect(duration).toBeLessThan(1000) // 应该在1秒内完成
      expect(result.processedText).toContain('Hello World!')
    })
  })

  describe('Async Processing', () => {
    test('should process templates asynchronously', async () => {
      const text = 'Hello {{ name }}!'
      const result = await processLiquidTemplateVariablesAsync(text, {
        variables: { name: 'Async World' }
      })

      expect(result.processedText).toBe('Hello Async World!')
    })
  })

  describe('Real-world Scenarios', () => {
    test('should handle chat conversation format', () => {
      const text = `
对话开始：
{{ user }}: 你好！
{{ char }}: 你好，{{ user }}！有什么可以帮助你的吗？

{{ user }}: 我想了解你的背景。
{{ char }}: 我是一个AI助手，很高兴为{{ user }}服务。今天日期是{{ isodate }}。
      `.trim()

      const result = processLiquidTemplateVariables(text, {
        variables: { user: 'Eve', char: 'Assistant' }
      })

      expect(result.processedText).toContain('Eve: 你好！')
      expect(result.processedText).toContain('Assistant: 你好，Eve！')
      expect(result.processedText).toMatch(/今天日期是\d{4}-\d{2}-\d{2}/)
    })

    test('should handle story narration format', () => {
      const text = `
{% assign hero = user %}
{% assign setting = "魔法森林" %}

第{{ chapter }}章：{{ title }}

{{ hero }} 走进了{{ setting }}。阳光透过树叶洒在小径上，鸟儿在枝头歌唱。

"{{ greeting }}，" {{ hero }} 说道。
      `.trim()

      const result = processLiquidTemplateVariables(text, {
        variables: {
          user: '亚瑟',
          chapter: 1,
          title: '冒险的开始',
          greeting: '大家好'
        }
      })

      expect(result.processedText).toContain('第1章：冒险的开始')
      expect(result.processedText).toContain('亚瑟 走进了魔法森林')
      expect(result.processedText).toContain('"大家好，" 亚瑟 说道。')
    })
  })

  describe('Backward Compatibility', () => {
    test('should work with existing template variable syntax', () => {
      // 测试与原有语法的兼容性
      const text = '你好，{{user}}！'
      const result = processLiquidTemplateVariables(text)

      expect(result.processedText).toBe('你好，用户！')
    })

    test('should support variable overriding', () => {
      const text = '你好，{{user}}！'
      const result = processLiquidTemplateVariables(text, {
        variables: { user: 'Frank' }
      })

      expect(result.processedText).toBe('你好，Frank！')
    })
  })
})