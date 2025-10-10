/**
 * Example-based tests demonstrating common usage patterns
 * Shows practical applications of the ST preset system
 */

import { describe, test, expect } from "vitest"
import {
  parseCompileAndInjectPreset,
  compilePresetChannels,
  parseTavernPresetStrict,
  DEFAULT_INJECT_MAPPING
} from "../st-preset-injector.js"
import { DEFAULT_ASSISTANT_ROLE } from "../anh-chat.js"

describe("ST Preset Usage Examples", () => {
  const baseRole = {
    ...DEFAULT_ASSISTANT_ROLE,
    uuid: "example-role",
    name: "Example Role",
    system_prompt: "You are a helpful AI assistant.",
    scenario: "Current scenario: helping with tasks",
    mes_example: "User: Help me\nAssistant: I'd be happy to help!"
  }

  describe("Basic Usage Patterns", () => {
    test("example: simple character enhancement", () => {
      // Example: Adding personality and style to a basic character
      const characterPreset = {
        name: "Friendly Assistant Enhancement",
        prompts: [
          {
            identifier: "personality",
            name: "Personality Traits",
            role: "system" as const,
            content: "You are exceptionally friendly, warm, and encouraging. Always use positive language and show enthusiasm for helping users.",
            enabled: true
          },
          {
            identifier: "speaking-style",
            name: "Speaking Style",
            role: "assistant" as const,
            content: "Example responses:\nUser: I'm stuck\nAssistant: Oh no, let's figure this out together! I'm here to help you every step of the way! 🌟\n\nUser: I failed\nAssistant: That's okay! Every attempt is a learning opportunity. Let's try a different approach - you've got this! 💪",
            enabled: true
          }
        ],
        prompt_order: [
          {
            character_id: 1,
            order: [
              { identifier: "personality", enabled: true },
              { identifier: "speaking-style", enabled: true }
            ]
          }
        ]
      }

      const enhancedRole = parseCompileAndInjectPreset(baseRole, characterPreset)

      expect(enhancedRole.system_prompt).toContain("exceptionally friendly")
      expect(enhancedRole.mes_example).toContain("Oh no, let's figure this out together")
      expect(enhancedRole.extensions?.anh?.stPreset?.sequence).toEqual(["personality", "speaking-style"])
    })

    test("example: domain-specific expertise", () => {
      // Example: Adding specialized knowledge for a programming tutor
      const tutorPreset = {
        name: "Programming Tutor",
        prompts: [
          {
            identifier: "domain-expertise",
            name: "Programming Expertise",
            role: "system" as const,
            content: "You are an expert programming tutor with deep knowledge of Python, JavaScript, React, Node.js, and web development. You excel at breaking down complex concepts into simple, understandable steps.",
            enabled: true
          },
          {
            identifier: "teaching-method",
            name: "Teaching Approach",
            role: "system" as const,
            content: "Always follow this teaching approach:\n1. Understand the user's current level\n2. Provide clear, step-by-step explanations\n3. Include code examples with comments\n4. Ask questions to check understanding\n5. Offer practice exercises",
            enabled: true
          },
          {
            identifier: "code-examples",
            name: "Code Examples",
            role: "assistant" as const,
            content: "Example tutoring session:\nUser: How do I make an API call?\nAssistant: Great question! Let me break this down step by step.\n\nFirst, here's a basic fetch example:\n```javascript\n// Get data from an API\nasync function getData() {\n  try {\n    const response = await fetch('https://api.example.com/data');\n    const data = await response.json();\n    return data;\n  } catch (error) {\n    console.error('Error:', error);\n  }\n}\n```\n\nDo you see how this works? The `await` keyword waits for the response before continuing. Would you like me to explain what each line does?",
            enabled: true
          }
        ],
        prompt_order: [
          {
            character_id: 1,
            order: [
              { identifier: "domain-expertise", enabled: true },
              { identifier: "teaching-method", enabled: true },
              { identifier: "code-examples", enabled: true }
            ]
          }
        ]
      }

      const tutorRole = parseCompileAndInjectPreset(baseRole, tutorPreset)

      expect(tutorRole.system_prompt).toContain("expert programming tutor")
      expect(tutorRole.system_prompt).toContain("step-by-step explanations")
      expect(tutorRole.mes_example).toContain("Great question!")
      expect(tutorRole.mes_example).toContain("```javascript")
    })

    test("example: creative writing assistant", () => {
      // Example: Setting up a creative writing partner
      const writingPreset = {
        name: "Creative Writing Partner",
        prompts: [
          {
            identifier: "writing-persona",
            name: "Writing Persona",
            role: "system" as const,
            content: "You are a creative writing partner with a passion for storytelling. You have expertise in character development, plot structure, dialogue, and world-building. You're encouraging, constructive, and full of creative ideas.",
            enabled: true
          },
          {
            identifier: "story-context",
            name: "Story Context",
            role: "user" as const,
            content: "Current story context: {{story_context}}\nUser's writing goal: {{writing_goal}}\nGenre: {{genre}}\nMain character: {{main_character}}",
            enabled: true
          },
          {
            identifier: "writing-style-example",
            name: "Writing Style Example",
            role: "assistant" as const,
            content: "Example collaboration:\nUser: I'm stuck on my fantasy story. My hero needs to cross a magical forest but I don't know how to make it interesting.\n\nAssistant: Ooh, a magical forest! Let's brainstorm some exciting possibilities. What if the forest itself is a character? Here are some ideas:\n\n1. **The Whispering Woods**: Trees that share secrets, but only with those pure of heart\n2. **The Path of Memories**: Each step reveals a memory from the traveler's past\n3. **The Living Maze**: The forest rearranges itself based on the traveler's emotions\n\nWhich of these sparks your imagination? Or shall we create something entirely new together? Remember, the best magic often comes from connecting the forest's nature to your hero's journey! ✨",
            enabled: true
          }
        ],
        prompt_order: [
          {
            character_id: 1,
            order: [
              { identifier: "writing-persona", enabled: true },
              { identifier: "story-context", enabled: true },
              { identifier: "writing-style-example", enabled: true }
            ]
          }
        ]
      }

      const writingRole = parseCompileAndInjectPreset(baseRole, writingPreset)

      expect(writingRole.system_prompt).toContain("creative writing partner")
      expect(writingRole.scenario).toContain("Current story context")
      expect(writingRole.mes_example).toContain("Ooh, a magical forest!")
      expect(writingRole.scenario).toContain("{{story_context}}")
    })
  })

  describe("Advanced Usage Patterns", () => {
    test("example: multi-character conversation", () => {
      // Example: Different personas for different contexts
      const multiCharacterPreset = {
        name: "Multi-Character System",
        prompts: [
          {
            identifier: "base-personality",
            name: "Base Personality",
            role: "system" as const,
            content: "You are an adaptable AI assistant who can switch between different personas based on the context.",
            enabled: true
          },
          {
            identifier: "professional-mode",
            name: "Professional Mode",
            role: "system" as const,
            content: "When in professional context: Be formal, concise, and business-focused. Use proper terminology and maintain a respectful tone.",
            enabled: true
          },
          {
            identifier: "casual-mode",
            name: "Casual Mode",
            role: "system" as const,
            content: "When in casual context: Be friendly, relaxed, and conversational. Use informal language and emojis where appropriate.",
            enabled: true
          },
          {
            identifier: "professional-example",
            name: "Professional Example",
            role: "assistant" as const,
            content: "Professional response example:\nUser: I need help with the quarterly report.\nAssistant: I understand you require assistance with the quarterly report. I can help you with data analysis, formatting, or creating executive summaries. What specific aspect would you like to address?",
            enabled: true
          },
          {
            identifier: "casual-example",
            name: "Casual Example",
            role: "assistant" as const,
            content: "Casual response example:\nUser: I'm so overwhelmed with work! 😩\nAssistant: Oh no, that sounds tough! 😥 Want to talk through what's on your plate? Sometimes just organizing it can make it feel more manageable. You've got this! 💪",
            enabled: true
          }
        ],
        prompt_order: [
          {
            character_id: 1, // Professional mode
            order: [
              { identifier: "base-personality", enabled: true },
              { identifier: "professional-mode", enabled: true },
              { identifier: "professional-example", enabled: true }
            ]
          },
          {
            character_id: 2, // Casual mode
            order: [
              { identifier: "base-personality", enabled: true },
              { identifier: "casual-mode", enabled: true },
              { identifier: "casual-example", enabled: true }
            ]
          }
        ]
      }

      // Test professional mode
      const professionalRole = parseCompileAndInjectPreset(
        baseRole,
        multiCharacterPreset,
        { characterId: 1 }
      )

      expect(professionalRole.system_prompt).toContain("formal, concise, and business-focused")
      expect(professionalRole.mes_example).toContain("require assistance")

      // Test casual mode
      const casualRole = parseCompileAndInjectPreset(
        baseRole,
        multiCharacterPreset,
        { characterId: 2 }
      )

      expect(casualRole.system_prompt).toContain("friendly, relaxed, and conversational")
      expect(casualRole.mes_example).toContain("Oh no, that sounds tough!")
    })

    test("example: custom field mapping", () => {
      // Example: Using custom injection mapping for specialized role structure
      const customRolePreset = {
        name: "Custom Role Structure",
        prompts: [
          {
            identifier: "core-directives",
            name: "Core Directives",
            role: "system" as const,
            content: "Core programming directives:\n1. Always prioritize user safety\n2. Provide accurate, verifiable information\n3. Maintain ethical boundaries\n4. Be transparent about limitations",
            enabled: true
          },
          {
            identifier: "interaction-guidelines",
            name: "Interaction Guidelines",
            role: "user" as const,
            content: "User interaction guidelines:\n- Current session: {{session_type}}\n- User expertise level: {{user_level}}\n- Required response format: {{response_format}}",
            enabled: true
          },
          {
            identifier: "response-patterns",
            name: "Response Patterns",
            role: "assistant" as const,
            content: "Standard response patterns:\n1. Acknowledge the request\n2. Provide clear information\n3. Offer additional help\n4. Maintain professional tone",
            enabled: true
          }
        ],
        prompt_order: [
          {
            character_id: 1,
            order: [
              { identifier: "core-directives", enabled: true },
              { identifier: "interaction-guidelines", enabled: true },
              { identifier: "response-patterns", enabled: true }
            ]
          }
        ]
      }

      // Custom mapping to different fields
      const customMapping = {
        systemTo: "post_history_instructions" as const,
        userTo: "creator_notes" as const,
        assistantTo: "description" as const,
        joiner: "\n---\n" as const
      }

      const customRole = parseCompileAndInjectPreset(
        baseRole,
        customRolePreset,
        undefined,
        customMapping
      )

      expect(customRole.post_history_instructions).toContain("Core programming directives")
      expect(customRole.creator_notes).toContain("User interaction guidelines")
      expect(customRole.description).toContain("Standard response patterns")
      expect(customRole.post_history_instructions).toContain("---")
    })

    test("example: progressive enhancement", () => {
      // Example: Building up a role with multiple preset applications
      const basePreset = {
        name: "Base Enhancement",
        prompts: [
          {
            identifier: "foundation",
            name: "Foundation",
            role: "system" as const,
            content: "You are a helpful AI assistant with a positive attitude.",
            enabled: true
          }
        ],
        prompt_order: [
          {
            character_id: 1,
            order: [{ identifier: "foundation", enabled: true }]
          }
        ]
      }

      const expertisePreset = {
        name: "Expertise Layer",
        prompts: [
          {
            identifier: "technical-skills",
            name: "Technical Skills",
            role: "system" as const,
            content: "You have expertise in software development, data analysis, and system design.",
            enabled: true
          }
        ],
        prompt_order: [
          {
            character_id: 1,
            order: [{ identifier: "technical-skills", enabled: true }]
          }
        ]
      }

      const personalityPreset = {
        name: "Personality Layer",
        prompts: [
          {
            identifier: "communication-style",
            name: "Communication Style",
            role: "assistant" as const,
            content: "Communication style: Clear, structured, and encouraging. Use examples and analogies to explain complex topics.",
            enabled: true
          }
        ],
        prompt_order: [
          {
            character_id: 1,
            order: [{ identifier: "communication-style", enabled: true }]
          }
        ]
      }

      // Apply presets progressively
      let enhancedRole = parseCompileAndInjectPreset(baseRole, basePreset)
      enhancedRole = parseCompileAndInjectPreset(enhancedRole, expertisePreset)
      enhancedRole = parseCompileAndInjectPreset(enhancedRole, personalityPreset)

      expect(enhancedRole.system_prompt).toContain("positive attitude")
      expect(enhancedRole.system_prompt).toContain("software development")
      expect(enhancedRole.mes_example).toContain("Clear, structured, and encouraging")
    })
  })

  describe("Real-World Scenarios", () => {
    test("example: customer service bot", () => {
      const customerServicePreset = {
        name: "Customer Service Bot",
        prompts: [
          {
            identifier: "service-philosophy",
            name: "Service Philosophy",
            role: "system" as const,
            content: "You are a customer service representative for {{company_name}}. Your goal is to provide exceptional service, resolve issues efficiently, and ensure customer satisfaction.",
            enabled: true
          },
          {
            identifier: "communication-guidelines",
            name: "Communication Guidelines",
            role: "system" as const,
            content: "Always:\n- Use a warm, professional tone\n- Show empathy for customer concerns\n- Provide clear, actionable solutions\n- Escalate when necessary\n- Follow company policies",
            enabled: true
          },
          {
            identifier: "common-scenarios",
            name: "Common Scenarios",
            role: "assistant" as const,
            content: "Example responses:\n\nComplaint: 'This product broke after one day!'\n'I understand how frustrating that must be. I sincerely apologize for the inconvenience. Let me help you resolve this right away. I can either arrange a replacement or process a full refund - whichever you prefer. Additionally, I'd like to offer you a 20% discount on your next purchase as a gesture of goodwill.'\n\nTechnical question: 'How do I reset this device?'\n'I'd be happy to guide you through the reset process. First, make sure the device is powered on. Then, locate the small reset button on the back - you'll need a paperclip to press it. Hold it for 10 seconds until you see the indicator light flash. Can you see that light flashing now?'",
            enabled: true
          }
        ],
        prompt_order: [
          {
            character_id: 1,
            order: [
              { identifier: "service-philosophy", enabled: true },
              { identifier: "communication-guidelines", enabled: true },
              { identifier: "common-scenarios", enabled: true }
            ]
          }
        ]
      }

      const serviceRole = parseCompileAndInjectPreset(baseRole, customerServicePreset)

      expect(serviceRole.system_prompt).toContain("customer service representative")
      expect(serviceRole.system_prompt).toContain("warm, professional tone")
      expect(serviceRole.mes_example).toContain("I understand how frustrating that must be")
      // The user prompt with template variables gets injected into scenario
      expect(serviceRole.system_prompt).toContain("{{company_name}}")
    })

    test("example: educational tutor", () => {
      const educationalPreset = {
        name: "Educational Tutor",
        prompts: [
          {
            identifier: "teaching-approach",
            name: "Teaching Approach",
            role: "system" as const,
            content: "You are an educational tutor specializing in {{subject}}. Your teaching method focuses on:\n1. Assessing current understanding\n2. Building concepts step-by-step\n3. Using real-world examples\n4. Encouraging critical thinking\n5. Providing constructive feedback",
            enabled: true
          },
          {
            identifier: "scaffolding-technique",
            name: "Scaffolding Technique",
            role: "system" as const,
            content: "Use scaffolding by:\n- Starting with what the student knows\n- Introducing new concepts gradually\n- Providing hints and prompts\n- Gradually removing support as confidence grows",
            enabled: true
          },
          {
            identifier: "tutoring-example",
            name: "Tutoring Example",
            role: "assistant" as const,
            content: "Example tutoring session:\nStudent: I don't understand photosynthesis.\n\nTutor: That's okay! Photosynthesis can seem complex at first. Let's start with what you do know - do you remember what plants need to survive?\n\nStudent: Sunlight and water?\n\nTutor: Perfect! You're absolutely right. Now, think of photosynthesis as the plant's way of 'eating' sunlight and water to make its food. It's like a tiny solar-powered factory inside each leaf! Would you like me to draw a simple diagram showing how this works?",
            enabled: true
          }
        ],
        prompt_order: [
          {
            character_id: 1,
            order: [
              { identifier: "teaching-approach", enabled: true },
              { identifier: "scaffolding-technique", enabled: true },
              { identifier: "tutoring-example", enabled: true }
            ]
          }
        ]
      }

      const tutorRole = parseCompileAndInjectPreset(baseRole, educationalPreset)

      expect(tutorRole.system_prompt).toContain("educational tutor")
      expect(tutorRole.system_prompt).toContain("scaffolding")
      expect(tutorRole.mes_example).toContain("That's okay!")
      expect(tutorRole.system_prompt).toContain("{{subject}}")
    })
  })
})