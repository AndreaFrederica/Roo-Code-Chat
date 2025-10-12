/**
 * Comprehensive test suite for ST Preset injection functionality
 * Tests the parsing, compilation, and injection of SillyTavern presets into Roles
 */

import { describe, test, expect, beforeEach } from "vitest"
import {
  parseTavernPresetStrict,
  looksLikeTavernPreset,
  compilePresetChannels,
  injectCompiledPresetIntoRole,
  parseCompileAndInjectPreset,
  DEFAULT_INJECT_MAPPING,
  type STPresetSelect,
  type InjectMapping
} from "../st-preset-injector.js"
import { DEFAULT_ASSISTANT_ROLE, type Role } from "../anh-chat.js"

describe("ST Preset Injection", () => {
  // Test data setup
  const basePreset = {
    temperature: 0.8,
    prompts: [
      {
        identifier: "sys-1",
        name: "System Prompt 1",
        role: "system" as const,
        content: "You are a helpful assistant.",
        enabled: true,
        system_prompt: true
      },
      {
        identifier: "sys-2",
        name: "System Prompt 2",
        role: "system" as const,
        content: "Be concise and accurate.",
        enabled: true,
        system_prompt: true
      },
      {
        identifier: "user-1",
        name: "User Prompt 1",
        role: "user" as const,
        content: "The user wants help with {{topic}}.",
        enabled: true,
        system_prompt: false
      },
      {
        identifier: "assistant-1",
        name: "Assistant Response 1",
        role: "assistant" as const,
        content: "Example: {{example}}",
        enabled: true,
        system_prompt: false
      },
      {
        identifier: "disabled-prompt",
        name: "Disabled Prompt",
        role: "system" as const,
        content: "This should not appear",
        enabled: false,
        system_prompt: true
      }
    ],
    prompt_order: [
      {
        character_id: 100001,
        order: [
          { identifier: "sys-1", enabled: true },
          { identifier: "disabled-prompt", enabled: false },
          { identifier: "user-1", enabled: true },
          { identifier: "assistant-1", enabled: true },
          { identifier: "sys-2", enabled: true }
        ]
      },
      {
        character_id: 100002,
        order: [
          { identifier: "sys-2", enabled: true },
          { identifier: "sys-1", enabled: true }
        ]
      }
    ]
  }

  let testRole: Role

  beforeEach(() => {
    // Create a fresh test role for each test
    testRole = {
      ...DEFAULT_ASSISTANT_ROLE,
      uuid: "test-role-uuid",
      name: "Test Role",
      system_prompt: "Original system prompt",
      scenario: "Original scenario",
      mes_example: "Original example"
    }
  })

  describe("Preset Detection", () => {
    test("should identify valid preset objects", () => {
      expect(looksLikeTavernPreset(basePreset)).toBe(true)
      expect(looksLikeTavernPreset({ prompts: [], prompt_order: [] })).toBe(true)
    })

    test("should reject non-preset objects", () => {
      expect(looksLikeTavernPreset(null)).toBe(false)
      expect(looksLikeTavernPreset(undefined)).toBe(false)
      expect(looksLikeTavernPreset({})).toBe(false)
      expect(looksLikeTavernPreset({ prompts: [] })).toBe(false)
      expect(looksLikeTavernPreset({ prompt_order: [] })).toBe(false)
      expect(looksLikeTavernPreset({ temperature: 0.8 })).toBe(false)
    })
  })

  describe("Preset Parsing", () => {
    test("should parse valid preset successfully", () => {
      const result = parseTavernPresetStrict(basePreset)

      expect(result.temperature).toBe(0.8)
      expect(result.prompts).toHaveLength(5)
      expect(result.prompt_order).toHaveLength(2)
      expect(result.prompts[0]?.identifier).toBe("sys-1")
    })

    test("should reject invalid preset with validation error", () => {
      const invalidPreset = {
        prompts: [
          { identifier: "valid-prompt", content: "test", enabled: true, system_prompt: true }
        ],
        prompt_order: "not an array" // should be array
      }

      expect(() => parseTavernPresetStrict(invalidPreset)).toThrow()
    })

    test("should handle preset with unknown fields", () => {
      const presetWithUnknowns = {
        ...basePreset,
        unknown_field: "preserved",
        unknown_object: { nested: true }
      }

      const result = parseTavernPresetStrict(presetWithUnknowns)
      expect(result.unknown_field).toBe("preserved")
      expect(result.unknown_object).toEqual({ nested: true })
    })
  })

  describe("Preset Compilation", () => {
    test("should compile preset with default character ID", () => {
      const compiled = compilePresetChannels(basePreset)

      expect(compiled.characterId).toBe(100001) // first prompt_order
      expect(compiled.system).toContain("You are a helpful assistant")
      expect(compiled.system).toContain("Be concise and accurate")
      expect(compiled.user).toContain("The user wants help with {{topic}}")
      expect(compiled.assistant).toContain("Example: {{example}}")
      expect(compiled.system).not.toContain("This should not appear") // disabled
      expect(compiled.sequence).toEqual(["sys-1", "user-1", "assistant-1", "sys-2"])
    })

    test("should compile preset with specific character ID", () => {
      const select: STPresetSelect = { characterId: 100002 }
      const compiled = compilePresetChannels(basePreset, select)

      expect(compiled.characterId).toBe(100002)
      expect(compiled.system).toContain("Be concise and accurate")
      expect(compiled.system).toContain("You are a helpful assistant")
      expect(compiled.user).toBe("") // no user prompts in this character
      expect(compiled.assistant).toBe("") // no assistant prompts in this character
      expect(compiled.sequence).toEqual(["sys-2", "sys-1"])
    })

    test("should handle preset without prompt_order", () => {
      const presetWithoutOrder = {
        ...basePreset,
        prompt_order: []
      }

      const compiled = compilePresetChannels(presetWithoutOrder)

      expect(compiled.characterId).toBe(-1) // fallback
      expect(compiled.system).toContain("You are a helpful assistant")
      expect(compiled.system).toContain("Be concise and accurate")
      expect(compiled.user).toContain("The user wants help with {{topic}}")
      expect(compiled.assistant).toContain("Example: {{example}}")
      // Should use natural order
      expect(compiled.sequence).toEqual(["sys-1", "sys-2", "user-1", "assistant-1"])
    })

    test("should respect onlyEnabled setting", () => {
      const selectDisabled: STPresetSelect = { onlyEnabled: false }
      const compiledDisabled = compilePresetChannels(basePreset, selectDisabled)

      expect(compiledDisabled.system).toContain("This should not appear") // disabled prompt included
      expect(compiledDisabled.sequence).toContain("disabled-prompt")

      const selectEnabled: STPresetSelect = { onlyEnabled: true }
      const compiledEnabled = compilePresetChannels(basePreset, selectEnabled)

      expect(compiledEnabled.system).not.toContain("This should not appear") // disabled prompt excluded
      expect(compiledEnabled.sequence).not.toContain("disabled-prompt")
    })

    test("should use custom joiner", () => {
      const compiled = compilePresetChannels(basePreset, {}, "\n---\n")

      // Only system has multiple prompts, so it should contain the joiner
      expect(compiled.system).toContain("\n---\n")
      // User and assistant have single prompts, so no joiner expected
      expect(compiled.user).toBe("The user wants help with {{topic}}.")
      expect(compiled.assistant).toBe("Example: {{example}}")
    })

    test("should handle prompts with undefined role", () => {
      const presetWithUndefinedRole = {
        prompts: [
          { identifier: "no-role", content: "No role specified", enabled: true, system_prompt: true },
          { identifier: "sys-role", role: "system" as const, content: "System role", enabled: true, system_prompt: true }
        ],
        prompt_order: []
      }

      const compiled = compilePresetChannels(presetWithUndefinedRole)

      expect(compiled.system).toContain("No role specified") // defaults to system
      expect(compiled.system).toContain("System role")
    })

    test("should handle missing identifiers in order", () => {
      const presetWithMissingId = {
        prompts: [
          { identifier: "existing", role: "system" as const, content: "Exists", enabled: true, system_prompt: true }
        ],
        prompt_order: [
          {
            character_id: 1,
            order: [
              { identifier: "existing", enabled: true },
              { identifier: "missing", enabled: true } // doesn't exist in prompts
            ]
          }
        ]
      }

      const compiled = compilePresetChannels(presetWithMissingId)

      expect(compiled.system).toContain("Exists")
      expect(compiled.sequence).toEqual(["existing"]) // missing identifier filtered out
    })
  })

  describe("Role Injection", () => {
    test("should inject compiled preset with default mapping", () => {
      const compiled = compilePresetChannels(basePreset)
      const injected = injectCompiledPresetIntoRole(testRole, compiled)

      expect(injected.system_prompt).toContain("Original system prompt")
      expect(injected.system_prompt).toContain("You are a helpful assistant")
      expect(injected.system_prompt).toContain("\n\n----\n\n")

      expect(injected.scenario).toContain("Original scenario")
      expect(injected.scenario).toContain("The user wants help with {{topic}}")

      expect(injected.mes_example).toContain("Original example")
      expect(injected.mes_example).toContain("Example: {{example}}")

      expect(injected.updatedAt).toBeGreaterThan(testRole.updatedAt)
    })

    test("should preserve extensions data", () => {
      const compiled = compilePresetChannels(basePreset)
      const injected = injectCompiledPresetIntoRole(testRole, compiled)

      expect((injected.extensions as any)?.anh?.stPreset).toBeDefined()
      expect((injected.extensions as any)?.anh?.stPreset?.characterId).toBe(100001)
      expect((injected.extensions as any)?.anh?.stPreset?.sequence).toEqual(["sys-1", "user-1", "assistant-1", "sys-2"])
      expect((injected.extensions as any)?.anh?.stPreset?.compiled).toBeDefined()
    })

    test("should use custom injection mapping", () => {
      const compiled = compilePresetChannels(basePreset)
      const customMapping: InjectMapping = {
        systemTo: "creator_notes",
        userTo: "description",
        assistantTo: "post_history_instructions",
        joiner: "\n###\n"
      }

      const injected = injectCompiledPresetIntoRole(testRole, compiled, customMapping)

      expect(injected.creator_notes).toContain("You are a helpful assistant")
      expect(injected.description).toContain("The user wants help with {{topic}}")
      expect(injected.post_history_instructions).toContain("Example: {{example}}")
      expect(injected.creator_notes).toContain("\n###\n")
    })

    test("should not overwrite existing content when compiled is empty", () => {
      const emptyCompiled = {
        characterId: 1,
        system: "",
        user: "",
        assistant: "",
        sequence: []
      }

      const injected = injectCompiledPresetIntoRole(testRole, emptyCompiled)

      expect(injected.system_prompt).toBe("Original system prompt")
      expect(injected.scenario).toBe("Original scenario")
      expect(injected.mes_example).toBe("Original example")
    })

    test("should handle role without existing content", () => {
      const emptyRole = { ...testRole }
      delete emptyRole.system_prompt
      delete emptyRole.scenario
      delete emptyRole.mes_example

      const compiled = compilePresetChannels(basePreset)
      const injected = injectCompiledPresetIntoRole(emptyRole, compiled)

      expect(injected.system_prompt).toContain("You are a helpful assistant")
      expect(injected.scenario).toContain("The user wants help with {{topic}}")
      expect(injected.mes_example).toContain("Example: {{example}}")
    })

    test("should control extension data preservation", () => {
      const compiled = compilePresetChannels(basePreset)
      const noExtensionsMapping: InjectMapping = {
        keepRawInExtensions: false,
        keepCompiledInExtensions: false
      }

      const injected = injectCompiledPresetIntoRole(testRole, compiled, noExtensionsMapping)

      expect((injected.extensions as any)?.anh?.stPreset?.characterId).toBeUndefined()
      expect((injected.extensions as any)?.anh?.stPreset?.sequence).toBeUndefined()
      expect((injected.extensions as any)?.anh?.stPreset?.compiled).toBeUndefined()
    })
  })

  describe("End-to-End Integration", () => {
    test("should perform complete parse-compile-inject workflow", () => {
      const injected = parseCompileAndInjectPreset(
        testRole,
        basePreset,
        { characterId: 100001, onlyEnabled: true },
        DEFAULT_INJECT_MAPPING,
        "\n\n"
      )

      expect(injected.system_prompt).toContain("You are a helpful assistant")
      expect(injected.scenario).toContain("The user wants help with {{topic}}")
      expect(injected.mes_example).toContain("Example: {{example}}")
      expect((injected.extensions as any)?.anh?.stPreset?.characterId).toBe(100001)
    })

    test("should handle real-world complex preset", () => {
      const complexPreset = {
        temperature: 1.25,
        frequency_penalty: 0,
        presence_penalty: 0,
        top_p: 0.98,
        wrap_in_quotes: false,
        names_behavior: 0,
        stream_openai: true,
        prompts: [
          {
            identifier: "main-system",
            name: "Main System",
            role: "system" as const,
            content: "You are {{char}}, a helpful AI assistant. Personality: {{personality}}",
            enabled: true,
            system_prompt: true
          },
          {
            identifier: "scenario-context",
            name: "Scenario Context",
            role: "system" as const,
            content: "Current scenario: {{scenario}}. User request: {{user_request}}",
            enabled: true,
            system_prompt: true
          },
          {
            identifier: "response-style",
            name: "Response Style",
            role: "assistant" as const,
            content: "Respond in a {{tone}} manner, keeping responses {{length}}.",
            enabled: true,
            system_prompt: false
          }
        ],
        prompt_order: [
          {
            character_id: 1,
            order: [
              { identifier: "main-system", enabled: true },
              { identifier: "scenario-context", enabled: true },
              { identifier: "response-style", enabled: true }
            ]
          }
        ]
      }

      const injected = parseCompileAndInjectPreset(testRole, complexPreset)

      expect(injected.system_prompt).toContain("You are {{char}}")
      expect(injected.system_prompt).toContain("Current scenario: {{scenario}}")
      expect(injected.mes_example).toContain("Respond in a {{tone}} manner")
    })

    test("should handle empty preset gracefully", () => {
      const emptyPreset = {
        prompts: [],
        prompt_order: []
      }

      const injected = parseCompileAndInjectPreset(testRole, emptyPreset)

      expect(injected.system_prompt).toBe("Original system prompt")
      expect(injected.scenario).toBe("Original scenario")
      expect(injected.mes_example).toBe("Original example")
    })

    test("should preserve role validation", () => {
      const injected = parseCompileAndInjectPreset(testRole, basePreset)

      // Should still be a valid Role object
      expect(injected.uuid).toBe("test-role-uuid")
      expect(injected.name).toBe("Test Role")
      expect(injected.type).toBe("主角")
      expect(injected.createdAt).toBeDefined()
      expect(injected.updatedAt).toBeDefined()
    })
  })

  describe("Error Handling", () => {
    test("should handle malformed preset in end-to-end", () => {
      const malformedPreset = {
        prompts: "not an array", // will cause validation error
        prompt_order: []
      }

      expect(() => parseCompileAndInjectPreset(testRole, malformedPreset)).toThrow()
    })

    test("should handle missing compiled data", () => {
      const incompleteCompiled = {
        characterId: 1
        // missing required fields
      } as any

      // Should not throw, but handle gracefully
      const injected = injectCompiledPresetIntoRole(testRole, incompleteCompiled)
      expect(injected).toBeDefined()
    })
  })
})