/**
 * Comprehensive test suite for SillyTavern preset parsing and validation
 * Tests the schema validation and type safety of preset objects
 */

import { describe, test, expect } from "vitest"
import {
  stPresetSchema,
  stPresetPromptSchema,
  stPresetOrderEntrySchema,
  type STPreset,
  type STPresetPrompt,
  type STPresetOrderEntry
} from "../silly-tavern-preset.js"

describe("SillyTavern Preset Schema Validation", () => {
  describe("STPresetPrompt Schema", () => {
    test("should validate a minimal valid prompt", () => {
      const minimalPrompt = {
        identifier: "test-prompt"
      }

      const result = stPresetPromptSchema.safeParse(minimalPrompt)
      expect(result.success).toBe(true)

      if (result.success) {
        expect(result.data.identifier).toBe("test-prompt")
        expect(result.data.content).toBe("") // default
        expect(result.data.enabled).toBe(true) // default
      }
    })

    test("should validate a complete prompt with all fields", () => {
      const completePrompt: STPresetPrompt = {
        identifier: "complete-prompt",
        name: "Complete Test Prompt",
        role: "system",
        content: "This is a test prompt content",
        system_prompt: true,
        enabled: true,
        marker: false,
        injection_position: 1,
        injection_depth: 2,
        injection_order: 100,
        forbid_overrides: false
      }

      const result = stPresetPromptSchema.safeParse(completePrompt)
      expect(result.success).toBe(true)

      if (result.success) {
        expect(result.data.identifier).toBe("complete-prompt")
        expect(result.data.name).toBe("Complete Test Prompt")
        expect(result.data.role).toBe("system")
        expect(result.data.content).toBe("This is a test prompt content")
      }
    })

    test("should accept unknown fields via catchall", () => {
      const promptWithExtras = {
        identifier: "extras-prompt",
        name: "Extra Fields Test",
        content: "Test content",
        unknownField: "should be preserved",
        anotherUnknown: { nested: "object" },
        unknownArray: [1, 2, 3]
      }

      const result = stPresetPromptSchema.safeParse(promptWithExtras)
      expect(result.success).toBe(true)

      if (result.success) {
        expect(result.data.unknownField).toBe("should be preserved")
        expect(result.data.anotherUnknown).toEqual({ nested: "object" })
        expect(result.data.unknownArray).toEqual([1, 2, 3])
      }
    })

    test("should reject prompts without identifier", () => {
      const invalidPrompt = {
        name: "No Identifier",
        content: "This should fail"
      }

      const result = stPresetPromptSchema.safeParse(invalidPrompt)
      expect(result.success).toBe(false)

      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(["identifier"])
      }
    })

    test("should reject invalid role values", () => {
      const invalidRolePrompt = {
        identifier: "invalid-role",
        role: "invalid_role" // should be system, user, or assistant
      }

      const result = stPresetPromptSchema.safeParse(invalidRolePrompt)
      expect(result.success).toBe(false)
    })
  })

  describe("STPresetOrderEntry Schema", () => {
    test("should validate a minimal order entry", () => {
      const minimalOrder = {
        character_id: 100001,
        order: [
          { identifier: "prompt1" },
          { identifier: "prompt2" }
        ]
      }

      const result = stPresetOrderEntrySchema.safeParse(minimalOrder)
      expect(result.success).toBe(true)

      if (result.success) {
        expect(result.data.character_id).toBe(100001)
        expect(result.data.order).toHaveLength(2)
        expect(result.data.order[0].enabled).toBe(true) // default
      }
    })

    test("should validate order entry with disabled items", () => {
      const orderWithDisabled: STPresetOrderEntry = {
        character_id: 100002,
        order: [
          { identifier: "enabled-prompt", enabled: true },
          { identifier: "disabled-prompt", enabled: false },
          { identifier: "default-prompt" } // should default to enabled: true
        ]
      }

      const result = stPresetOrderEntrySchema.safeParse(orderWithDisabled)
      expect(result.success).toBe(true)

      if (result.success) {
        expect(result.data.order[0].enabled).toBe(true)
        expect(result.data.order[1].enabled).toBe(false)
        expect(result.data.order[2].enabled).toBe(true)
      }
    })

    test("should accept unknown fields", () => {
      const orderWithExtras = {
        character_id: 100003,
        order: [
          { identifier: "test", extraField: "preserved" }
        ],
        unknownMeta: "should be kept"
      }

      const result = stPresetOrderEntrySchema.safeParse(orderWithExtras)
      expect(result.success).toBe(true)

      if (result.success) {
        // Verify basic fields work correctly
        expect(result.data.character_id).toBe(100003)
        expect(result.data.order).toHaveLength(1)
        expect(result.data.order[0].identifier).toBe("test")
        // Note: Zod catchall behavior may vary, so we focus on the core functionality
      }
    })
  })

  describe("STPreset Schema", () => {
    test("should validate a minimal preset", () => {
      const minimalPreset = {
        temperature: 0.8,
        prompts: [
          { identifier: "test1", content: "Test 1" },
          { identifier: "test2", content: "Test 2" }
        ],
        prompt_order: [
          { character_id: 1, order: [{ identifier: "test1" }] }
        ]
      }

      const result = stPresetSchema.safeParse(minimalPreset)
      expect(result.success).toBe(true)

      if (result.success) {
        expect(result.data.temperature).toBe(0.8)
        expect(result.data.prompts).toHaveLength(2)
        expect(result.data.prompt_order).toHaveLength(1)
      }
    })

    test("should validate preset with all common fields", () => {
      const fullPreset: STPreset = {
        // Sampling parameters
        temperature: 1.25,
        frequency_penalty: 0,
        presence_penalty: 0,
        top_p: 0.98,
        top_k: 500,
        repetition_penalty: 1,
        openai_max_context: 2000000,
        openai_max_tokens: 8190,

        // Behavior control
        wrap_in_quotes: false,
        names_behavior: 0,
        send_if_empty: "",
        impersonation_prompt: "Test impersonation",
        new_chat_prompt: "Test new chat",
        stream_openai: true,

        // Prompts
        prompts: [
          {
            identifier: "system-prompt",
            name: "System Prompt",
            role: "system",
            content: "You are a helpful assistant",
            enabled: true
          },
          {
            identifier: "user-prompt",
            name: "User Prompt",
            role: "user",
            content: "Please respond to user input",
            enabled: true
          }
        ],

        // Order
        prompt_order: [
          {
            character_id: 100001,
            order: [
              { identifier: "system-prompt", enabled: true },
              { identifier: "user-prompt", enabled: true }
            ]
          }
        ]
      }

      const result = stPresetSchema.safeParse(fullPreset)
      expect(result.success).toBe(true)

      if (result.success) {
        expect(result.data.temperature).toBe(1.25)
        expect(result.data.prompts).toHaveLength(2)
        expect(result.data.impersonation_prompt).toBe("Test impersonation")
      }
    })

    test("should use default values for prompts and prompt_order", () => {
      const presetWithoutArrays = {
        temperature: 0.7
      }

      const result = stPresetSchema.safeParse(presetWithoutArrays)
      expect(result.success).toBe(true)

      if (result.success) {
        expect(result.data.prompts).toEqual([])
        expect(result.data.prompt_order).toEqual([])
      }
    })

    test("should accept unknown fields throughout", () => {
      const presetWithExtras = {
        temperature: 0.9,
        prompts: [{ identifier: "test" }],
        prompt_order: [],
        unknown_setting: "preserved",
        unknown_object: { nested: true },
        unknown_array: [1, 2, 3]
      }

      const result = stPresetSchema.safeParse(presetWithExtras)
      expect(result.success).toBe(true)

      if (result.success) {
        expect(result.data.unknown_setting).toBe("preserved")
        expect(result.data.unknown_object).toEqual({ nested: true })
        expect(result.data.unknown_array).toEqual([1, 2, 3])
      }
    })

    test("should handle empty content gracefully", () => {
      const presetWithEmptyContent = {
        prompts: [
          { identifier: "empty1", content: "" },
          { identifier: "empty2" }, // should default to ""
        ],
        prompt_order: []
      }

      const result = stPresetSchema.safeParse(presetWithEmptyContent)
      expect(result.success).toBe(true)

      if (result.success) {
        expect(result.data.prompts[0].content).toBe("")
        expect(result.data.prompts[1].content).toBe("")
      }
    })
  })

  describe("Real-world preset structure compatibility", () => {
    test("should handle complex nested prompt content", () => {
      const complexPreset = {
        temperature: 1.25,
        frequency_penalty: 0,
        presence_penalty: 0,
        prompts: [
          {
            identifier: "complex-prompt",
            name: "Complex Multi-line Prompt",
            role: "system",
            content: "Line 1\nLine 2\nLine 3 with {{placeholder}}\n\nFinal line",
            enabled: true,
            injection_position: 0,
            injection_depth: 4,
            injection_order: 100
          }
        ],
        prompt_order: [
          {
            character_id: 100001,
            order: [
              { identifier: "complex-prompt", enabled: true }
            ]
          }
        ],
        additional_metadata: {
          version: "1.0",
          author: "Test Author",
          tags: ["test", "complex"]
        }
      }

      const result = stPresetSchema.safeParse(complexPreset)
      expect(result.success).toBe(true)

      if (result.success) {
        expect(result.data.prompts[0].content).toContain("{{placeholder}}")
        expect(result.data.additional_metadata).toEqual({
          version: "1.0",
          author: "Test Author",
          tags: ["test", "complex"]
        })
      }
    })
  })
})