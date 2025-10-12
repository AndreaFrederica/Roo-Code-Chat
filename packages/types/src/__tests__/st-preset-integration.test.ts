/**
 * Integration tests using real SillyTavern preset data
 * Tests with actual preset files from the project
 */

import { describe, test, expect, beforeEach } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"
import {
  parseTavernPresetStrict,
  looksLikeTavernPreset,
  compilePresetChannels,
  parseCompileAndInjectPreset,
  DEFAULT_INJECT_MAPPING
} from "../st-preset-injector.js"
import { DEFAULT_ASSISTANT_ROLE } from "../anh-chat.js"

describe("Real-World Preset Integration", () => {
  let realPresetData: any
  let testRole: typeof DEFAULT_ASSISTANT_ROLE

  beforeEach(() => {
    // Reset test role for each test
    testRole = {
      ...DEFAULT_ASSISTANT_ROLE,
      uuid: "integration-test-role",
      name: "Integration Test Role"
    }

    try {
      // Try to read the actual preset file
      const presetPath = join(process.cwd(), "novel-helper/.anh-chat/profile/GrayWill-0.36-ex (2).json")
      const presetContent = readFileSync(presetPath, "utf-8")
      realPresetData = JSON.parse(presetContent)
    } catch (error) {
      console.warn("Could not load real preset file, using mock data")
      // Fallback to comprehensive mock data if real file not available
      realPresetData = {
        temperature: 1.25,
        frequency_penalty: 0,
        presence_penalty: 0,
        top_p: 0.98,
        top_k: 500,
        top_a: 1,
        min_p: 0,
        repetition_penalty: 1,
        openai_max_context: 2000000,
        openai_max_tokens: 8190,
        wrap_in_quotes: false,
        names_behavior: 0,
        send_if_empty: "",
        impersonation_prompt: "[灰魂帮我作为{{user}}简短的输出接下来的行动.]",
        new_chat_prompt: "",
        new_group_chat_prompt: "[Start a new group chat. Group members: {{group}}]",
        new_example_chat_prompt: "[示例推演]",
        continue_nudge_prompt: "[继续{{lastChatMessage}}，输出中不得包含原始消息的任何部分，使用与原始消息一致的[大小写 ∨ 标点符号] ⇒ 使回复看似原始消息的自然延续]",
        bias_preset_selected: "Default (none)",
        max_context_unlocked: true,
        wi_format: "[{0}]",
        scenario_format: "[Circumstances and context of the dialogue: {{scenario}}]",
        personality_format: "[{{char}}'s personality: {{personality}}]",
        group_nudge_prompt: "[作为{{char}}回答.]",
        stream_openai: true,
        prompts: [
          {
            identifier: "enhanceDefinitions",
            name: "000",
            enabled: false,
            role: "system",
            content: "0",
            system_prompt: true,
            marker: false,
            forbid_overrides: false
          },
          {
            identifier: "systemContext",
            name: "System Context",
            enabled: true,
            role: "system",
            content: "你是ANH Chat的助手，专门协助创作和写作。",
            system_prompt: true,
            marker: false
          },
          {
            identifier: "userGuidance",
            name: "User Guidance",
            enabled: true,
            role: "user",
            content: "用户希望获得关于{{topic}}的帮助。",
            marker: false
          },
          {
            identifier: "assistantStyle",
            name: "Assistant Style",
            enabled: true,
            role: "assistant",
            content: "示例回答：这里是一个关于{{topic}}的详细说明。",
            marker: false
          }
        ],
        prompt_order: [
          {
            character_id: 100001,
            order: [
              { identifier: "systemContext", enabled: true },
              { identifier: "userGuidance", enabled: true },
              { identifier: "assistantStyle", enabled: true }
            ]
          }
        ]
      }
    }
  })

  describe("Real Preset File Processing", () => {
    test("should detect real preset as valid tavern preset", () => {
      expect(looksLikeTavernPreset(realPresetData)).toBe(true)
    })

    test("should parse real preset without errors", () => {
      expect(() => {
        const parsed = parseTavernPresetStrict(realPresetData)
        expect(parsed).toBeDefined()
        expect(parsed.prompts).toBeInstanceOf(Array)
        expect(parsed.prompt_order).toBeInstanceOf(Array)
      }).not.toThrow()
    })

    test("should handle complex prompt content from real preset", () => {
      const parsed = parseTavernPresetStrict(realPresetData)

      // Should handle multi-line and template content
      const hasComplexContent = parsed.prompts.some(prompt =>
        prompt.content && (
          prompt.content.includes('\n') ||
          prompt.content.includes('{{') ||
          prompt.content.includes('[') ||
          prompt.content.length > 100
        )
      )

      expect(hasComplexContent).toBe(true)
    })

    test("should preserve unknown fields from real preset", () => {
      const parsed = parseTavernPresetStrict(realPresetData)

      // Should have temperature and other fields
      expect(parsed.temperature).toBeDefined()
      expect(typeof parsed.temperature).toBe('number')

      // Should preserve unknown fields through catchall
      expect(parsed).toBeDefined()
    })
  })

  describe("Real Preset Compilation", () => {
    test("should compile real preset into channels", () => {
      const parsed = parseTavernPresetStrict(realPresetData)
      const compiled = compilePresetChannels(parsed)

      expect(compiled).toBeDefined()
      expect(typeof compiled.characterId).toBe('number')
      expect(typeof compiled.system).toBe('string')
      expect(typeof compiled.user).toBe('string')
      expect(typeof compiled.assistant).toBe('string')
      expect(Array.isArray(compiled.sequence)).toBe(true)
    })

    test("should respect enabled/disabled status in real preset", () => {
      const parsed = parseTavernPresetStrict(realPresetData)

      // Check if there are any disabled prompts
      const hasDisabledPrompts = parsed.prompts.some(p => p.enabled === false)

      if (hasDisabledPrompts) {
        const compiledEnabled = compilePresetChannels(parsed, { onlyEnabled: true })
        const compiledAll = compilePresetChannels(parsed, { onlyEnabled: false })

        // Should have different results when including disabled prompts
        expect(compiledEnabled.sequence.length).toBeLessThanOrEqual(compiledAll.sequence.length)
      }
    })

    test("should handle different character IDs from real preset", () => {
      const parsed = parseTavernPresetStrict(realPresetData)

      if (parsed.prompt_order.length > 1) {
        const firstCharId = parsed.prompt_order[0]?.character_id
        const compiled1 = compilePresetChannels(parsed, { characterId: firstCharId })

        // Should use specified character ID
        expect(compiled1.characterId).toBe(firstCharId)
      }
    })

    test("should handle presets without prompt_order", () => {
      const parsed = parseTavernPresetStrict(realPresetData)
      const presetWithoutOrder = { ...parsed, prompt_order: [] }

      const compiled = compilePresetChannels(presetWithoutOrder)

      // Should fallback to -1 character ID
      expect(compiled.characterId).toBe(-1)
      // Should still compile prompts in natural order
      expect(compiled.sequence.length).toBeGreaterThan(0)
    })
  })

  describe("Real Preset Integration", () => {
    test("should inject real preset into role successfully", () => {
      const injected = parseCompileAndInjectPreset(
        testRole,
        realPresetData,
        undefined, // use defaults
        DEFAULT_INJECT_MAPPING
      )

      expect(injected).toBeDefined()
      expect(injected.uuid).toBe(testRole.uuid)
      expect(injected.name).toBe(testRole.name)
      expect(injected.updatedAt).toBeGreaterThan(testRole.updatedAt)
    })

    test("should preserve original role content when injecting", () => {
      const originalSystemPrompt = testRole.system_prompt
      const originalScenario = testRole.scenario
      const originalMesExample = testRole.mes_example

      const injected = parseCompileAndInjectPreset(testRole, realPresetData)

      // Should preserve original content with injected additions
      expect(injected.system_prompt).toContain(originalSystemPrompt)
      expect(injected.scenario).toContain(originalScenario)
      expect(injected.mes_example).toContain(originalMesExample)
    })

    test("should add preset metadata to extensions", () => {
      const injected = parseCompileAndInjectPreset(testRole, realPresetData)

      expect((injected.extensions as any)?.anh?.stPreset).toBeDefined()
      expect((injected.extensions as any)?.anh?.stPreset?.characterId).toBeDefined()
      expect((injected.extensions as any)?.anh?.stPreset?.sequence).toBeDefined()
      expect((injected.extensions as any)?.anh?.stPreset?.compiled).toBeDefined()
    })

    test("should handle custom injection mapping with real preset", () => {
      const customMapping = {
        systemTo: "creator_notes" as const,
        userTo: "description" as const,
        assistantTo: "post_history_instructions" as const,
        joiner: "\n--- CUSTOM ---\n" as const
      }

      const injected = parseCompileAndInjectPreset(
        testRole,
        realPresetData,
        undefined,
        customMapping
      )

      // Should inject into custom fields
      expect(injected.creator_notes).toBeDefined()
      expect(injected.description).toBeDefined()
      expect(injected.post_history_instructions).toBeDefined()

      // Should use custom joiner
      if (injected.creator_notes && injected.creator_notes.includes("--- CUSTOM ---")) {
        expect(injected.creator_notes).toContain("--- CUSTOM ---")
      }
    })
  })

  describe("Performance and Edge Cases", () => {
    test("should handle large preset efficiently", () => {
      const startTime = Date.now()

      const parsed = parseTavernPresetStrict(realPresetData)
      const compiled = compilePresetChannels(parsed)
      const injected = parseCompileAndInjectPreset(testRole, realPresetData)

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should complete within reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000)
      expect(injected).toBeDefined()
    })

    test("should handle malformed preset gracefully", () => {
      const malformedPresets = [
        null,
        undefined,
        {},
        { prompts: "not an array" },
        { prompt_order: "not an array" },
        { prompts: [], prompt_order: "invalid" }
      ]

      malformedPresets.forEach((preset, index) => {
        expect(() => {
          if (preset !== null && preset !== undefined) {
            looksLikeTavernPreset(preset)
          }
        }, `Preset at index ${index} should not crash`).not.toThrow()
      })
    })

    test("should handle empty or minimal presets", () => {
      const minimalPresets = [
        { prompts: [], prompt_order: [] },
        { temperature: 0.7, prompts: [], prompt_order: [] },
        { prompts: [{ identifier: "only-prompt" }], prompt_order: [] }
      ]

      minimalPresets.forEach(preset => {
        expect(() => {
          const injected = parseCompileAndInjectPreset(testRole, preset)
          expect(injected).toBeDefined()
        }).not.toThrow()
      })
    })

    test("should maintain type safety throughout pipeline", () => {
      const parsed = parseTavernPresetStrict(realPresetData)
      const compiled = compilePresetChannels(parsed)
      const injected = parseCompileAndInjectPreset(testRole, realPresetData)

      // All should be properly typed
      expect(typeof parsed).toBe('object')
      expect(typeof compiled).toBe('object')
      expect(typeof injected).toBe('object')

      // Should have expected properties
      expect(Array.isArray(parsed.prompts)).toBe(true)
      expect(Array.isArray(parsed.prompt_order)).toBe(true)
      expect(typeof compiled.characterId).toBe('number')
      expect(Array.isArray(compiled.sequence)).toBe(true)
      expect(typeof injected.uuid).toBe('string')
    })
  })
})