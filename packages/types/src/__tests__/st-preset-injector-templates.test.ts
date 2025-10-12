/**
 * ST预设注入器模板处理功能测试
 * 测试模板变量处理与ST预设注入的集成
 */

import { describe, test, expect } from "vitest"
import {
  parseTavernPresetStrict,
  compilePresetChannels,
  parseCompileAndInjectPreset,
  parseCompileAndInjectPresetWithTemplates,
  DEFAULT_INJECT_MAPPING,
  type CompilePresetOptions
} from "../st-preset-injector.js"
import { DEFAULT_ASSISTANT_ROLE } from "../anh-chat.js"

describe("ST Preset Injector with Template Processing", () => {
  const baseRole = {
    ...DEFAULT_ASSISTANT_ROLE,
    uuid: "test-template-role",
    name: "Test Template Role",
    system_prompt: "Original system prompt",
    scenario: "Original scenario",
    mes_example: "Original example"
  }

  describe("Template Processing Integration", () => {
    test("should process templates in preset prompts", () => {
      const presetWithTemplates = {
        name: "Template Test Preset",
        prompts: [
          {
            identifier: "system-with-vars",
            role: "system" as const,
            content: "{{setvar::greeting::Hello}} {{setvar::name::World}} {{greeting}} {{name}}!",
            enabled: true,
            system_prompt: true
          },
          {
            identifier: "user-with-vars",
            role: "user" as const,
            content: "User request: {{getvar::greeting}} {{getvar::name}}",
            enabled: true,
            system_prompt: false
          },
          {
            identifier: "assistant-with-vars",
            role: "assistant" as const,
            content: "Response: {{name}} says {{greeting}}",
            enabled: true,
            system_prompt: false
          }
        ],
        prompt_order: [
          {
            character_id: 1,
            order: [
              { identifier: "system-with-vars", enabled: true },
              { identifier: "user-with-vars", enabled: true },
              { identifier: "assistant-with-vars", enabled: true }
            ]
          }
        ]
      }

      const options: CompilePresetOptions = {
        characterId: 1,
        enableTemplateProcessing: true,
        templateOptions: {
          keepVariableDefinitions: false,
          removeUnprocessed: false
        }
      }

      const compiled = compilePresetChannels(presetWithTemplates, options)

      expect(compiled.system).toContain("Hello World!")
      expect(compiled.user).toContain("User request: Hello World")
      expect(compiled.assistant).toContain("Response: World says Hello")
      expect(compiled.system).not.toContain("{{setvar::")
      expect(compiled.user).not.toContain("{{getvar::")
    })

    test("should handle complex GrayWill-style templates", () => {
      const grayWillPreset = {
        name: "GrayWill Template Test",
        prompts: [
          {
            identifier: "graywill-system",
            role: "system" as const,
            content: `{{setvar::min字数::1000}}{{setvar::max字数::6000}}{{setvar::本体附加::勇敢的冒险者}}
{{setvar::思维链1::分析用户输入}}
{{setvar::思维链2::制定响应策略}}

角色设定：
- 最小字数：{{min字数}}
- 最大字数：{{max字数}}
- 角色附加：{{getvar::本体附加}}
- 思维模式：{{思维链1}} → {{思维链2}}

请根据{{user}}的要求进行响应。`,
            enabled: true,
            system_prompt: true
          }
        ],
        prompt_order: [
          {
            character_id: 1,
            order: [{ identifier: "graywill-system", enabled: true }]
          }
        ]
      }

      const options: CompilePresetOptions = {
        characterId: 1,
        enableTemplateProcessing: true,
        templateOptions: {
          keepVariableDefinitions: false
        }
      }

      const compiled = compilePresetChannels(grayWillPreset, options)

      expect(compiled.system).toContain("最小字数：1000")
      expect(compiled.system).toContain("最大字数：6000")
      expect(compiled.system).toContain("角色附加：勇敢的冒险者")
      expect(compiled.system).toContain("思维模式：分析用户输入 → 制定响应策略")
      expect(compiled.system).not.toContain("{{setvar::")
    })

    test("should preserve unprocessed templates when configured", () => {
      const presetWithMissingVars = {
        name: "Missing Variables Test",
        prompts: [
          {
            identifier: "missing-vars",
            role: "system" as const,
            content: "Hello {{missingVar}} {{setvar::defined::value}} {{defined}}",
            enabled: true,
            system_prompt: true
          }
        ],
        prompt_order: [
          {
            character_id: 1,
            order: [{ identifier: "missing-vars", enabled: true }]
          }
        ]
      }

      // Test with removeUnprocessed = false (default)
      const options1: CompilePresetOptions = {
        characterId: 1,
        enableTemplateProcessing: true,
        templateOptions: {
          removeUnprocessed: false,
          keepVariableDefinitions: false
        }
      }

      const compiled1 = compilePresetChannels(presetWithMissingVars, options1)

      expect(compiled1.system).toContain("Hello {{missingVar}} value")
      expect(compiled1.system).not.toContain("{{setvar::defined::value}}")

      // Test with removeUnprocessed = true
      const options2: CompilePresetOptions = {
        characterId: 1,
        enableTemplateProcessing: true,
        templateOptions: {
          removeUnprocessed: true,
          keepVariableDefinitions: false
        }
      }

      const compiled2 = compilePresetChannels(presetWithMissingVars, options2)

      expect(compiled2.system).toBe("Hello  value")
    })

    test("should handle template processing disabled", () => {
      const presetWithTemplates = {
        name: "No Processing Test",
        prompts: [
          {
            identifier: "raw-templates",
            role: "system" as const,
            content: "{{setvar::test::value}} {{test}} {{raw}}",
            enabled: true,
            system_prompt: true
          }
        ],
        prompt_order: [
          {
            character_id: 1,
            order: [{ identifier: "raw-templates", enabled: true }]
          }
        ]
      }

      const options: CompilePresetOptions = {
        characterId: 1,
        enableTemplateProcessing: false // Disable processing
      }

      const compiled = compilePresetChannels(presetWithTemplates, options)

      expect(compiled.system).toBe("{{setvar::test::value}} {{test}} {{raw}}")
    })
  })

  describe("End-to-End Integration with Role Injection", () => {
    test("should inject processed templates into role", () => {
      const presetForInjection = {
        name: "Injection Test",
        prompts: [
          {
            identifier: "enhanced-system",
            role: "system" as const,
            content: `{{setvar::personality::friendly and helpful}}
{{setvar::expertise::programming and writing}}

You are an AI assistant with the following traits:
- Personality: {{personality}}
- Expertise: {{expertise}}
- Enhanced response quality: {{getvar::personality}} responses in {{getvar::expertise}} topics

Original prompt preserved: {{original_prompt}}`,
            enabled: true,
            system_prompt: true
          }
        ],
        prompt_order: [
          {
            character_id: 1,
            order: [{ identifier: "enhanced-system", enabled: true }]
          }
        ]
      }

      const options: CompilePresetOptions = {
        characterId: 1,
        enableTemplateProcessing: true,
        templateOptions: {
          variables: {
            original_prompt: baseRole.system_prompt || ""
          },
          keepVariableDefinitions: false
        }
      }

      const injectedRole = parseCompileAndInjectPreset(
        baseRole,
        presetForInjection,
        options,
        DEFAULT_INJECT_MAPPING
      )

      expect(injectedRole.system_prompt).toContain("Personality: friendly and helpful")
      expect(injectedRole.system_prompt).toContain("Expertise: programming and writing")
      expect(injectedRole.system_prompt).toContain("Original prompt preserved")
      expect(injectedRole.system_prompt).not.toContain("{{setvar::")
      expect(injectedRole.system_prompt).not.toContain("{{getvar::")
    })

    test("should use convenience function with templates", () => {
      const presetWithVars = {
        name: "Convenience Function Test",
        prompts: [
          {
            identifier: "var-test",
            role: "system" as const,
            content: "Character: {{character_name}}, Setting: {{setting}}, Mood: {{mood}}",
            enabled: true,
            system_prompt: true
          }
        ],
        prompt_order: [
          {
            character_id: 1,
            order: [{ identifier: "var-test", enabled: true }]
          }
        ]
      }

      const templateVars = {
        character_name: "艾蜜莉雅",
        setting: "魔法森林",
        mood: "神秘"
      }

      const injectedRole = parseCompileAndInjectPresetWithTemplates(
        baseRole,
        presetWithVars,
        templateVars,
        {
          select: { characterId: 1 },
          strictMode: false,
          removeUnprocessed: true
        }
      )

      expect(injectedRole.system_prompt).toContain("Character: 艾蜜莉雅")
      expect(injectedRole.system_prompt).toContain("Setting: 魔法森林")
      expect(injectedRole.system_prompt).toContain("Mood: 神秘")
    })

    test("should handle template errors gracefully", () => {
      const presetWithErrors = {
        name: "Error Handling Test",
        prompts: [
          {
            identifier: "error-test",
            role: "system" as const,
            content: "{{setvar::good::value}} {{bad_var}} {{incomplete::template",
            enabled: true,
            system_prompt: true
          }
        ],
        prompt_order: [
          {
            character_id: 1,
            order: [{ identifier: "error-test", enabled: true }]
          }
        ]
      }

      const options: CompilePresetOptions = {
        characterId: 1,
        enableTemplateProcessing: true,
        templateOptions: {
          strict: false, // Don't throw errors, just warnings
          keepVariableDefinitions: false
        }
      }

      // Should not throw, but process with warnings
      expect(() => {
        const injectedRole = parseCompileAndInjectPreset(
          baseRole,
          presetWithErrors,
          options,
          DEFAULT_INJECT_MAPPING
        )

        expect(injectedRole.system_prompt).toContain("value")
        expect(injectedRole.system_prompt).toContain("{{bad_var}}")
      }).not.toThrow()
    })
  })

  describe("Advanced Template Features", () => {
    test("should handle complex variable definitions from preset", () => {
      const complexPreset = {
        name: "Complex Template Test",
        prompts: [
          {
            identifier: "complex-defs",
            role: "system" as const,
            content: `{{setvar::min字数::1000}}
{{setvar::max字数::6000}}
{{setvar::对白量::对白占比要求：对白和描述同时推动剧情，正文中的文字应由对白提供40％以上}}
{{setvar::思维链1::<COT_Guide_Simplified>
1. 理解用户输入和上下文
2. 分析关键要素和意图
3. 制定响应策略
</COT_Guide_Simplified>}}
{{setvar::思维链2::* 用户输入分析
- 识别主要请求类型
- 提取关键信息
- 确定响应重点}}
{{setvar::思维链3::* 响应生成
- 基于{{思维链1}}的框架
- 应用{{思维链2}}的分析结果
- 生成符合{{对白量}}要求的内容}}

写作要求：
- 字数范围：{{min字数}}-{{max字数}}
- {{getvar::对白量}}
- 思维流程：{{思维链1}} → {{思维链2}} → {{思维链3}}`,
            enabled: true,
            system_prompt: true
          }
        ],
        prompt_order: [
          {
            character_id: 1,
            order: [{ identifier: "complex-defs", enabled: true }]
          }
        ]
      }

      const options: CompilePresetOptions = {
        characterId: 1,
        enableTemplateProcessing: true,
        templateOptions: {
          keepVariableDefinitions: false
        }
      }

      const compiled = compilePresetChannels(complexPreset, options)

      expect(compiled.system).toContain("字数范围：1000-6000")
      expect(compiled.system).toContain("对白占比要求：对白和描述同时推动剧情")
      expect(compiled.system).toContain("思维流程：<COT_Guide_Simplified>")
      expect(compiled.system).toContain("→ * 用户输入分析")
      expect(compiled.system).toContain("→ * 响应生成")
      expect(compiled.system).not.toContain("{{setvar::")
      expect(compiled.system).not.toContain("{{getvar::")
    })

    test("should handle recursive variable references", () => {
      const recursivePreset = {
        name: "Recursive Test",
        prompts: [
          {
            identifier: "recursive-vars",
            role: "system" as const,
            content: `{{setvar::base::Hello}}
{{setvar::greeting::{{base}} World}}
{{setvar::full_greeting::{{greeting}}!}}
{{setvar::response::{{full_greeting}} How are you?}}

Final message: {{response}}`,
            enabled: true,
            system_prompt: true
          }
        ],
        prompt_order: [
          {
            character_id: 1,
            order: [{ identifier: "recursive-vars", enabled: true }]
          }
        ]
      }

      const options: CompilePresetOptions = {
        characterId: 1,
        enableTemplateProcessing: true,
        templateOptions: {
          keepVariableDefinitions: false,
          maxRecursionDepth: 10
        }
      }

      const compiled = compilePresetChannels(recursivePreset, options)

      expect(compiled.system).toContain("Final message: Hello World! How are you?")
    })

    test("should handle custom injection mapping with templates", () => {
      const presetForCustomMapping = {
        name: "Custom Mapping Test",
        prompts: [
          {
            identifier: "system-content",
            role: "system" as const,
            content: "{{setvar::system_info::Enhanced system information}}",
            enabled: true,
            system_prompt: true
          },
          {
            identifier: "scenario-content",
            role: "user" as const,
            content: "{{setvar::scenario_info::Enhanced scenario setting}}",
            enabled: true,
            system_prompt: false
          },
          {
            identifier: "example-content",
            role: "assistant" as const,
            content: "{{setvar::example_info::Enhanced example dialogue}}",
            enabled: true,
            system_prompt: false
          }
        ],
        prompt_order: [
          {
            character_id: 1,
            order: [
              { identifier: "system-content", enabled: true },
              { identifier: "scenario-content", enabled: true },
              { identifier: "example-content", enabled: true }
            ]
          }
        ]
      }

      const customMapping = {
        systemTo: "creator_notes" as const,
        userTo: "description" as const,
        assistantTo: "post_history_instructions" as const
      }

      const options: CompilePresetOptions = {
        characterId: 1,
        enableTemplateProcessing: true,
        templateOptions: {
          keepVariableDefinitions: false
        }
      }

      const injectedRole = parseCompileAndInjectPreset(
        baseRole,
        presetForCustomMapping,
        options,
        customMapping
      )

      expect(injectedRole.creator_notes).toContain("Enhanced system information")
      expect(injectedRole.description).toContain("Enhanced scenario setting")
      expect(injectedRole.post_history_instructions).toContain("Enhanced example dialogue")
    })
  })

  describe("Backward Compatibility", () => {
    test("should work without template processing enabled", () => {
      const regularPreset = {
        name: "Regular Preset",
        prompts: [
          {
            identifier: "regular",
            role: "system" as const,
            content: "Regular content without templates",
            enabled: true,
            system_prompt: true
          }
        ],
        prompt_order: [
          {
            character_id: 1,
            order: [{ identifier: "regular", enabled: true }]
          }
        ]
      }

      // Should work exactly like before when templates are disabled
      const oldWay = parseCompileAndInjectPreset(
        baseRole,
        regularPreset,
        { characterId: 1 }, // Old STPresetSelect interface
        DEFAULT_INJECT_MAPPING
      )

      const newWayDisabled = parseCompileAndInjectPreset(
        baseRole,
        regularPreset,
        { characterId: 1, enableTemplateProcessing: false }, // New interface but disabled
        DEFAULT_INJECT_MAPPING
      )

      expect(oldWay.system_prompt).toBe(newWayDisabled.system_prompt)
      expect(oldWay.scenario).toBe(newWayDisabled.scenario)
      expect(oldWay.mes_example).toBe(newWayDisabled.mes_example)
    })

    test("should handle undefined template options gracefully", () => {
      const presetWithTemplates = {
        name: "Backward Compatibility Test",
        prompts: [
          {
            identifier: "test",
            role: "system" as const,
            content: "{{setvar::test::value}} {{test}}",
            enabled: true,
            system_prompt: true
          }
        ],
        prompt_order: [
          {
            character_id: 1,
            order: [{ identifier: "test", enabled: true }]
          }
        ]
      }

      // Should work with default options
      expect(() => {
        const result = parseCompileAndInjectPreset(
          baseRole,
          presetWithTemplates,
          { characterId: 1 }, // No template options specified
          DEFAULT_INJECT_MAPPING
        )

        // Templates should be processed by default
        expect(result.system_prompt).toContain("value")
      }).not.toThrow()
    })
  })
})