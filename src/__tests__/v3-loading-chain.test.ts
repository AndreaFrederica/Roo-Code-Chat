import { describe, it, expect } from 'vitest'
import { SillyTavernParser } from '../utils/sillytavern-parser'
import { isCharacterCardV3, extractAvatarFromCardV3 } from '../utils/characterCardV3'
import { createSillyTavernCompatibility } from '@roo-code/types'
import type { CharaCardV3, CharacterCardV3 } from '@roo-code/types'

describe('V3 Character Card Loading Chain Tests', () => {
    const mockV3Card: CharacterCardV3 = {
        spec: "chara_card_v3",
        spec_version: "3.0",
        data: {
            name: "水色",
            nickname: "小水",
            description: "一个温柔善良的少女，喜欢帮助别人，总是带着微笑。",
            personality: "温柔、善良、乐于助人、有点害羞",
            first_mes: "你好...我是水色。很高兴认识你。有什么我可以帮助你的吗？",
            scenario: "在一个宁静的小镇上，你遇到了正在帮助老人的水色...",
            creator_notes: "这是一个温柔的角色，适合日常对话和温馨的故事。",
            system_prompt: "你是一个温柔善良的少女名叫水色。说话要温柔、礼貌，总是关心对方的感受。",
            post_history_instructions: "保持角色设定，继续以水色的身份对话。",
            alternate_greetings: [
                "啊...你好！需要帮忙吗？",
                "嗯...有什么事吗？我在这里哦。"
            ],
            group_only_greetings: [
                "大家好！我是水色，很高兴见到大家。",
                "嗯...大家好，请多指教。"
            ],
            tags: ["温柔", "少女", "善良", "蓝色头发"],
            creator: "示例创作者",
            character_version: "1.0",
            extensions: {
                fav: true,
                world: "幻想乡"
            },
            creation_date: 1698784000,
            modification_date: 1698870400,
            assets: [
                {
                    type: "icon",
                    uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
                    name: "main",
                    ext: "png"
                },
                {
                    type: "background",
                    uri: "https://example.com/backgrounds/mizuiro_bg.jpg",
                    name: "main",
                    ext: "jpg"
                }
            ],
            character_book: {
                name: "水色设定集",
                description: "关于水色的详细设定信息",
                scan_depth: 50,
                token_budget: 1000,
                recursive_scanning: true,
                extensions: {},
                entries: [
                    {
                        name: "基本信息",
                        keys: ["水色", "基本信息", "身份"],
                        content: "水色是一个18岁的少女，住在宁静的小镇上。",
                        extensions: {},
                        enabled: true,
                        insertion_order: 1,
                        case_sensitive: false,
                        use_regex: false,
                        constant: false,
                        priority: 100,
                        id: "basic_info"
                    }
                ]
            }
        }
    }

    describe('V3 Card Recognition', () => {
        it('should recognize V3 card format', () => {
            expect(isCharacterCardV3(mockV3Card)).toBe(true)
        })

        it('should parse V3 card from JSON string', () => {
            const jsonString = JSON.stringify(mockV3Card)
            const result = SillyTavernParser.parseFromJson(jsonString)
            
            expect(result.success).toBe(true)
            expect(result.cardVersion).toBe('v3')
            expect(result.role).toBeDefined()
            expect(result.role?.name).toBe('水色')
        })

        it('should extract avatar from V3 card', () => {
            const avatar = extractAvatarFromCardV3(mockV3Card)
            expect(avatar).toBe("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==")
        })
    })

    describe('V3 to ANH Conversion', () => {
        it('should convert V3 card to ANH role format', () => {
            const compatibility = createSillyTavernCompatibility()
            const anhRole = compatibility.fromSillyTavernV3(mockV3Card)
            
            expect(anhRole.uuid).toBeDefined()
            expect(anhRole.name).toBe('水色')
            expect(anhRole.type).toBe('SillyTavernRole')
            expect(anhRole.scope).toBe('workspace')
            expect(anhRole.avatar).toBe("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==")
            expect(anhRole.spec).toBe('chara_card_v3')
            expect(anhRole.spec_version).toBe('3.0')
        })

        it('should preserve V3 specific fields in ANH format', () => {
            const compatibility = createSillyTavernCompatibility()
            const anhRole = compatibility.fromSillyTavernV3(mockV3Card)
            
            expect(anhRole.first_mes).toBe('你好...我是水色。很高兴认识你。有什么我可以帮助你的吗？')
            expect(anhRole.personality).toBe('温柔、善良、乐于助人、有点害羞')
            expect(anhRole.scenario).toBe('在一个宁静的小镇上，你遇到了正在帮助老人的水色...')
            expect(anhRole.alternate_greetings).toEqual([
                "啊...你好！需要帮忙吗？",
                "嗯...有什么事吗？我在这里哦。"
            ])
        })

        it('should handle V3 card without avatar', () => {
            const v3CardNoAvatar = {
                ...mockV3Card,
                data: {
                    ...mockV3Card.data,
                    assets: []
                }
            }
            
            const compatibility = createSillyTavernCompatibility()
            const anhRole = compatibility.fromSillyTavernV3(v3CardNoAvatar)
            
            expect(anhRole.avatar).toBeUndefined()
        })
    })

    describe('Complete Loading Chain', () => {
        it('should complete the full V3 loading chain', () => {
            // Step 1: Parse V3 from JSON
            const jsonString = JSON.stringify(mockV3Card)
            const parseResult = SillyTavernParser.parseFromJson(jsonString)
            
            expect(parseResult.success).toBe(true)
            expect(parseResult.cardVersion).toBe('v3')
            expect(parseResult.role).toBeDefined()
            
            // Step 2: Verify the role is already in ANH format
            const anhRole = parseResult.role!
            expect(anhRole.name).toBe('水色')
            expect(anhRole.type).toBe('SillyTavernRole')
            expect(anhRole.avatar).toBe("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==")
            
            // Step 3: Check history info extraction
            const historyInfo = {
                name: anhRole.name,
                avatar: anhRole.avatar,
                nickname: anhRole.name, // V3 doesn't have nickname in ANH format
                description: anhRole.description
            }
            
            expect(historyInfo.name).toBe('水色')
            expect(historyInfo.avatar).toBeDefined()
            expect(historyInfo.description).toBe('一个温柔善良的少女，喜欢帮助别人，总是带着微笑。')
        })

        it('should handle malformed V3 cards gracefully', () => {
            const malformedV3 = {
                ...mockV3Card,
                spec: "chara_card_v2", // Wrong spec
                data: {
                    ...mockV3Card.data,
                    name: "" // Empty name
                }
            }
            
            const jsonString = JSON.stringify(malformedV3)
            const result = SillyTavernParser.parseFromJson(jsonString)
            
            // Should still parse but as V2 or fail gracefully
            expect(result.success).toBe(false) // Should fail validation
            expect(result.error).toBeDefined()
        })
    })

    describe('PNG and JSON Format Support', () => {
        it('should support both PNG and JSON V3 formats', async () => {
            const jsonString = JSON.stringify(mockV3Card)
            
            // Test JSON parsing
            const jsonResult = SillyTavernParser.parseFromJson(jsonString)
            expect(jsonResult.success).toBe(true)
            expect(jsonResult.source).toBe('json')
            expect(jsonResult.cardVersion).toBe('v3')
            
            // Test auto-detection
            const autoResult = await SillyTavernParser.parseAuto(jsonString)
            expect(autoResult.success).toBe(true)
            expect(autoResult.source).toBe('json')
            expect(autoResult.cardVersion).toBe('v3')
        })

        it('should distinguish between V2 and V3 formats', () => {
            const v3Json = JSON.stringify(mockV3Card)
            const v3Result = SillyTavernParser.parseFromJson(v3Json)
            
            expect(v3Result.success).toBe(true)
            expect(v3Result.cardVersion).toBe('v3')
            expect(v3Result.originalCard).toBeDefined()
            expect((v3Result.originalCard as any).spec).toBe('chara_card_v3')
        })
    })

    describe('Avatar Handling', () => {
        it('should extract avatar correctly for frontend display', () => {
            const jsonString = JSON.stringify(mockV3Card)
            const result = SillyTavernParser.parseFromJson(jsonString)
            
            expect(result.success).toBe(true)
            expect(result.role?.avatar).toBeDefined()
            
            // Simulate frontend avatar extraction
            const avatar = result.role?.avatar
            expect(avatar).toBe("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==")
            
            // This should be displayable in frontend
            expect(avatar?.startsWith('data:image/')).toBe(true)
        })

        it('should handle missing avatar gracefully', () => {
            const v3NoAvatar = {
                ...mockV3Card,
                data: {
                    ...mockV3Card.data,
                    assets: []
                }
            }
            
            const jsonString = JSON.stringify(v3NoAvatar)
            const result = SillyTavernParser.parseFromJson(jsonString)
            
            expect(result.success).toBe(true)
            expect(result.role?.avatar).toBeUndefined()
        })
    })
})
