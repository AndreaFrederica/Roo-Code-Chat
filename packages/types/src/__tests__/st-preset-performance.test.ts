/**
 * Performance and stress tests for ST Preset processing
 * Tests handling of large presets, complex structures, and edge cases
 */

import { describe, test, expect, beforeEach } from "vitest"
import {
  parseTavernPresetStrict,
  compilePresetChannels,
  parseCompileAndInjectPreset,
  looksLikeTavernPreset
} from "../st-preset-injector.js"
import { DEFAULT_ASSISTANT_ROLE } from "../anh-chat.js"

describe("Performance and Stress Tests", () => {
  let testRole: typeof DEFAULT_ASSISTANT_ROLE

  beforeEach(() => {
    testRole = {
      ...DEFAULT_ASSISTANT_ROLE,
      uuid: "performance-test-role",
      name: "Performance Test Role"
    }
  })

  describe("Large Preset Handling", () => {
    test("should handle preset with many prompts efficiently", () => {
      // Create a preset with 1000 prompts
      const largePreset = {
        temperature: 0.8,
        prompts: Array.from({ length: 1000 }, (_, i) => ({
          identifier: `prompt-${i}`,
          name: `Prompt ${i}`,
          role: i % 3 === 0 ? "system" : i % 3 === 1 ? "user" : "assistant",
          content: `This is prompt content number ${i}. `.repeat(10), // ~400 chars each
          enabled: i % 10 !== 0 // Disable every 10th prompt
        })),
        prompt_order: [
          {
            character_id: 1,
            order: Array.from({ length: 1000 }, (_, i) => ({
              identifier: `prompt-${i}`,
              enabled: i % 10 !== 0
            }))
          }
        ]
      }

      const startTime = Date.now()

      const parsed = parseTavernPresetStrict(largePreset)
      const compiled = compilePresetChannels(parsed)
      const injected = parseCompileAndInjectPreset(testRole, largePreset)

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(parsed.prompts).toHaveLength(1000)
      expect(compiled.sequence.length).toBe(900) // 100 disabled
      expect(injected).toBeDefined()
      expect(duration).toBeLessThan(2000) // Should complete within 2 seconds
    })

    test("should handle preset with many character orders", () => {
      // Create a preset with 100 different character orders
      const manyOrdersPreset = {
        temperature: 0.7,
        prompts: Array.from({ length: 50 }, (_, i) => ({
          identifier: `prompt-${i}`,
          content: `Content ${i}`,
          role: "system" as const,
          enabled: true
        })),
        prompt_order: Array.from({ length: 100 }, (_, charId) => ({
          character_id: charId,
          order: Array.from({ length: 10 }, (_, i) => ({
            identifier: `prompt-${i % 50}`,
            enabled: true
          }))
        }))
      }

      const startTime = Date.now()

      const parsed = parseTavernPresetStrict(manyOrdersPreset)
      const compiled = compilePresetChannels(parsed, { characterId: 50 })

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(parsed.prompt_order).toHaveLength(100)
      expect(compiled.characterId).toBe(50)
      expect(duration).toBeLessThan(1000)
    })

    test("should handle extremely long prompt content", () => {
      const longContent = "A".repeat(100_000) // 100KB prompt content
      const longPreset = {
        prompts: [
          {
            identifier: "long-prompt",
            content: longContent,
            role: "system" as const,
            enabled: true
          }
        ],
        prompt_order: [
          {
            character_id: 1,
            order: [{ identifier: "long-prompt", enabled: true }]
          }
        ]
      }

      const startTime = Date.now()

      const compiled = compilePresetChannels(longPreset)
      const injected = parseCompileAndInjectPreset(testRole, longPreset)

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(compiled.system).toBe(longContent)
      expect(injected.system_prompt).toContain(longContent)
      expect(duration).toBeLessThan(500)
    })
  })

  describe("Complex Structure Handling", () => {
    test("should handle deeply nested objects in catchall", () => {
      const complexPreset = {
        temperature: 0.9,
        prompts: [
          { identifier: "simple", content: "Simple content" }
        ],
        prompt_order: [
          { character_id: 1, order: [{ identifier: "simple" }] }
        ],
        complexNested: {
          level1: {
            level2: {
              level3: {
                level4: {
                  deepArray: Array.from({ length: 100 }, (_, i) => ({
                    id: i,
                    name: `item-${i}`,
                    metadata: {
                      created: Date.now(),
                      tags: [`tag-${i % 10}`],
                      nested: {
                        value: i * 2,
                        description: `Description for item ${i}`
                      }
                    }
                  }))
                }
              }
            }
          }
        }
      }

      const startTime = Date.now()

      const parsed = parseTavernPresetStrict(complexPreset)
      const compiled = compilePresetChannels(parsed)

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(parsed.complexNested).toBeDefined()
      expect(parsed.complexNested.level1.level2.level3.level4.deepArray).toHaveLength(100)
      expect(duration).toBeLessThan(1000)
    })

    test("should handle prompts with many template variables", () => {
      const templateHeavy = Array.from({ length: 100 }, (_, i) => ({
        identifier: `template-${i}`,
        content: `This has {{variable${i}}} and {{other${i}}} and {{nested${i}.path}} and {{array${i}[0]}}`,
        role: ["system", "user", "assistant"][i % 3] as "system" | "user" | "assistant",
        enabled: true
      }))

      const templatePreset = {
        prompts: templateHeavy,
        prompt_order: [
          {
            character_id: 1,
            order: templateHeavy.map(p => ({ identifier: p.identifier, enabled: true }))
          }
        ]
      }

      const compiled = compilePresetChannels(templatePreset)

      expect(compiled.system).toContain("{{variable")
      expect(compiled.user).toContain("{{variable")
      expect(compiled.assistant).toContain("{{variable")
    })
  })

  describe("Memory and Resource Management", () => {
    test("should not leak memory with repeated operations", () => {
      const preset = {
        prompts: Array.from({ length: 100 }, (_, i) => ({
          identifier: `mem-test-${i}`,
          content: `Memory test content ${i}`,
          role: "system" as const,
          enabled: true
        })),
        prompt_order: [
          {
            character_id: 1,
            order: Array.from({ length: 100 }, (_, i) => ({
              identifier: `mem-test-${i}`,
              enabled: true
            }))
          }
        ]
      }

      // Run many iterations to test for memory leaks
      const iterations = 100
      const startTime = Date.now()

      for (let i = 0; i < iterations; i++) {
        const parsed = parseTavernPresetStrict(preset)
        const compiled = compilePresetChannels(parsed)
        const injected = parseCompileAndInjectPreset(testRole, preset)

        // Verify results are consistent
        expect(compiled.sequence).toHaveLength(100)
        expect(injected.uuid).toBe(testRole.uuid)
      }

      const endTime = Date.now()
      const avgTime = (endTime - startTime) / iterations

      // Average time per iteration should be reasonable
      expect(avgTime).toBeLessThan(50) // Less than 50ms per iteration
    })

    test("should handle concurrent-like operations", () => {
      const preset = {
        prompts: [
          { identifier: "concurrent-1", content: "Content 1", role: "system" as const, enabled: true },
          { identifier: "concurrent-2", content: "Content 2", role: "user" as const, enabled: true },
          { identifier: "concurrent-3", content: "Content 3", role: "assistant" as const, enabled: true }
        ],
        prompt_order: [
          {
            character_id: 1,
            order: [
              { identifier: "concurrent-1", enabled: true },
              { identifier: "concurrent-2", enabled: true },
              { identifier: "concurrent-3", enabled: true }
            ]
          }
        ]
      }

      // Simulate multiple operations happening
      const results = Array.from({ length: 20 }, () => {
        const charId = Math.floor(Math.random() * 3) + 1
        return compilePresetChannels(preset, { characterId: 1 })
      })

      // All results should be valid and consistent
      results.forEach(result => {
        expect(result).toBeDefined()
        expect(result.characterId).toBe(1)
        expect(result.system).toContain("Content 1")
        expect(result.user).toContain("Content 2")
        expect(result.assistant).toContain("Content 3")
      })
    })
  })

  describe("Edge Cases and Error Resilience", () => {
    test("should handle circular references gracefully", () => {
      const circularObj: any = { name: "circular" }
      circularObj.self = circularObj

      const circularPreset = {
        temperature: 0.8,
        prompts: [
          { identifier: "normal", content: "Normal content", role: "system" as const, enabled: true }
        ],
        prompt_order: [
          { character_id: 1, order: [{ identifier: "normal", enabled: true }] }
        ],
        circularField: circularObj
      }

      // Should not crash with circular references
      expect(() => {
        const parsed = parseTavernPresetStrict(circularPreset)
        expect(parsed).toBeDefined()
      }).not.toThrow()
    })

    test("should handle extreme values", () => {
      const extremePreset = {
        temperature: Number.MAX_SAFE_INTEGER,
        prompts: [
          {
            identifier: "extreme",
            content: "X".repeat(1_000_000), // 1MB content
            role: "system" as const,
            enabled: true,
            injection_position: Number.MAX_SAFE_INTEGER,
            injection_depth: Number.MIN_SAFE_INTEGER,
            injection_order: Number.MAX_SAFE_INTEGER
          }
        ],
        prompt_order: [
          {
            character_id: Number.MAX_SAFE_INTEGER,
            order: [{ identifier: "extreme", enabled: true }]
          }
        ]
      }

      expect(() => {
        const parsed = parseTavernPresetStrict(extremePreset)
        const compiled = compilePresetChannels(extremePreset)
        expect(compiled.system).toHaveLength(1_000_000)
      }).not.toThrow()
    })

    test("should handle malformed but parseable JSON", () => {
      const weirdPreset = {
        temperature: 0.8, // Valid number
        prompts: [
          {
            identifier: "123", // String identifier
            content: "", // Empty string content (valid)
            role: "system", // Valid
            enabled: true, // Valid boolean
            marker: true, // Valid boolean
            unknownField: "some value" // Unknown field
          }
        ],
        prompt_order: [], // Empty
        nullField: null,
        undefinedField: undefined
      }

      // Should handle type coercion and weird values
      expect(() => {
        const isPreset = looksLikeTavernPreset(weirdPreset)
        if (isPreset) {
          const parsed = parseTavernPresetStrict(weirdPreset)
          expect(parsed).toBeDefined()
        }
      }).not.toThrow()
    })
  })

  describe("Benchmarking", () => {
    test("should establish performance baseline", () => {
      const benchmarkPreset = {
        prompts: Array.from({ length: 500 }, (_, i) => ({
          identifier: `bench-${i}`,
          content: `Benchmark content ${i}`.repeat(10),
          role: ["system", "user", "assistant"][i % 3] as "system" | "user" | "assistant",
          enabled: i % 5 !== 0
        })),
        prompt_order: [
          {
            character_id: 1,
            order: Array.from({ length: 500 }, (_, i) => ({
              identifier: `bench-${i}`,
              enabled: i % 5 !== 0
            }))
          }
        ]
      }

      const iterations = 10
      const times: number[] = []

      for (let i = 0; i < iterations; i++) {
        const start = Date.now()
        parseCompileAndInjectPreset(testRole, benchmarkPreset)
        const end = Date.now()
        times.push(end - start)
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length
      const maxTime = Math.max(...times)
      const minTime = Math.min(...times)

      console.log(`Performance Benchmark (500 prompts):`)
      console.log(`  Average: ${avgTime.toFixed(2)}ms`)
      console.log(`  Min: ${minTime.toFixed(2)}ms`)
      console.log(`  Max: ${maxTime.toFixed(2)}ms`)

      // Performance should be reasonable
      expect(avgTime).toBeLessThan(1000) // Less than 1 second average
      expect(maxTime).toBeLessThan(2000) // Less than 2 seconds max
    })
  })
})