import { describe, it, expect } from 'vitest'
import { 
    isCharacterCardV3, 
    extractAvatarFromCardV3, 
    getCharacterDisplayName,
    convertV2ToV3,
    validateCharacterCardV3,
    extractHistoryInfoFromCard,
    resolveAssetUri
} from '../utils/characterCardV3'
import type { CharacterCardV3, CharaCardV2 } from '@roo-code/types'

describe('CharacterCardV3 Utils', () => {
    const mockV3Card: CharacterCardV3 = {
        spec: "chara_card_v3",
        spec_version: "3.0",
        data: {
            name: "测试角色",
            nickname: "小测",
            description: "这是一个测试角色",
            personality: "友好、善良",
            first_mes: "你好！",
            creator_notes: "测试用角色",
            group_only_greetings: ["大家好！"],
            assets: [
                {
                    type: "icon",
                    uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
                    name: "main",
                    ext: "png"
                },
                {
                    type: "background",
                    uri: "https://example.com/bg.jpg",
                    name: "main",
                    ext: "jpg"
                }
            ],
            character_book: {
                name: "测试设定集",
                extensions: {},
                entries: [
                    {
                        keys: ["测试"],
                        content: "测试内容",
                        extensions: {},
                        enabled: true,
                        insertion_order: 1,
                        use_regex: false
                    }
                ]
            }
        }
    }

    const mockV2Card: CharaCardV2 = {
        spec: "chara_card_v2",
        spec_version: "2.0",
        data: {
            name: "V2角色",
            description: "这是一个V2角色",
            avatar: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
        }
    }

    describe('isCharacterCardV3', () => {
        it('should return true for valid V3 card', () => {
            expect(isCharacterCardV3(mockV3Card)).toBe(true)
        })

        it('should return false for V2 card', () => {
            expect(isCharacterCardV3(mockV2Card)).toBe(false)
        })

        it('should return false for invalid object', () => {
            expect(isCharacterCardV3({})).toBe(false)
            expect(isCharacterCardV3(null)).toBe(false)
            expect(isCharacterCardV3(undefined)).toBe(false)
        })

        it('should return false for wrong spec', () => {
            const wrongSpec = { ...mockV3Card, spec: "chara_card_v2" }
            expect(isCharacterCardV3(wrongSpec)).toBe(false)
        })

        it('should return false for wrong version', () => {
            const wrongVersion = { ...mockV3Card, spec_version: "2.0" }
            expect(isCharacterCardV3(wrongVersion)).toBe(false)
        })
    })

    describe('extractAvatarFromCardV3', () => {
        it('should extract main icon avatar', () => {
            const avatar = extractAvatarFromCardV3(mockV3Card)
            expect(avatar).toBe("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==")
        })

        it('should return null for card without assets', () => {
            const cardNoAssets = {
                ...mockV3Card,
                data: { ...mockV3Card.data, assets: undefined }
            }
            expect(extractAvatarFromCardV3(cardNoAssets)).toBeNull()
        })

        it('should return null for empty assets array', () => {
            const cardEmptyAssets = {
                ...mockV3Card,
                data: { ...mockV3Card.data, assets: [] }
            }
            expect(extractAvatarFromCardV3(cardEmptyAssets)).toBeNull()
        })

        it('should return null for ccdefault URI', () => {
            const cardWithDefault = {
                ...mockV3Card,
                data: {
                    ...mockV3Card.data,
                    assets: [{
                        type: "icon",
                        uri: "ccdefault:",
                        name: "main",
                        ext: "png"
                    }]
                }
            }
            expect(extractAvatarFromCardV3(cardWithDefault)).toBeNull()
        })
    })

    describe('getCharacterDisplayName', () => {
        it('should return nickname if available', () => {
            expect(getCharacterDisplayName(mockV3Card)).toBe("小测")
        })

        it('should return name if no nickname', () => {
            const cardNoNickname = {
                ...mockV3Card,
                data: { ...mockV3Card.data, nickname: undefined }
            }
            expect(getCharacterDisplayName(cardNoNickname)).toBe("测试角色")
        })

        it('should return fallback name if both missing', () => {
            const cardNoName = {
                ...mockV3Card,
                data: { ...mockV3Card.data, name: "", nickname: undefined }
            }
            expect(getCharacterDisplayName(cardNoName)).toBe("Unknown Character")
        })
    })

    describe('convertV2ToV3', () => {
        it('should convert V2 to V3 format', () => {
            const v3Card = convertV2ToV3(mockV2Card)
            
            expect(v3Card.spec).toBe("chara_card_v3")
            expect(v3Card.spec_version).toBe("3.0")
            expect(v3Card.data.name).toBe("V2角色")
            expect(v3Card.data.assets).toHaveLength(1)
            expect(v3Card.data.assets![0].type).toBe("icon")
            expect(v3Card.data.assets![0].uri).toBe(mockV2Card.data.avatar)
        })

        it('should handle V2 card without avatar', () => {
            const v2NoAvatar = {
                ...mockV2Card,
                data: { ...mockV2Card.data, avatar: undefined }
            }
            const v3Card = convertV2ToV3(v2NoAvatar)
            
            expect(v3Card.data.assets).toHaveLength(0)
        })
    })

    describe('validateCharacterCardV3', () => {
        it('should validate correct V3 card', () => {
            const result = validateCharacterCardV3(mockV3Card)
            expect(result.isValid).toBe(true)
            expect(result.errors).toHaveLength(0)
        })

        it('should reject card with wrong spec', () => {
            const wrongSpec = { ...mockV3Card, spec: "chara_card_v2" }
            const result = validateCharacterCardV3(wrongSpec)
            expect(result.isValid).toBe(false)
            expect(result.errors).toContain('Invalid spec: expected "chara_card_v3", got "chara_card_v2"')
        })

        it('should reject card with missing name', () => {
            const noName = {
                ...mockV3Card,
                data: { ...mockV3Card.data, name: "" }
            }
            const result = validateCharacterCardV3(noName)
            expect(result.isValid).toBe(false)
            expect(result.errors).toContain('Character name is required')
        })

        it('should reject card with invalid assets', () => {
            const invalidAssets = {
                ...mockV3Card,
                data: {
                    ...mockV3Card.data,
                    assets: [{
                        type: "", // invalid
                        uri: "test.jpg",
                        name: "test",
                        ext: "jpg"
                    }]
                }
            }
            const result = validateCharacterCardV3(invalidAssets)
            expect(result.isValid).toBe(false)
            expect(result.errors).toContain('Asset 0: type is required')
        })
    })

    describe('resolveAssetUri', () => {
        it('should return base64 data URL as-is', () => {
            const base64Uri = "data:image/png;base64,test"
            expect(resolveAssetUri(base64Uri)).toBe(base64Uri)
        })

        it('should return HTTPS URL as-is', () => {
            const httpsUri = "https://example.com/image.png"
            expect(resolveAssetUri(httpsUri)).toBe(httpsUri)
        })

        it('should return HTTP URL as-is', () => {
            const httpUri = "http://example.com/image.png"
            expect(resolveAssetUri(httpUri)).toBe(httpUri)
        })

        it('should return null for ccdefault', () => {
            expect(resolveAssetUri("ccdefault:")).toBeNull()
        })

        it('should return null for embedded resources', () => {
            expect(resolveAssetUri("embeded://path/to/image.png")).toBeNull()
        })

        it('should return null for empty string', () => {
            expect(resolveAssetUri("")).toBeNull()
        })
    })

    describe('extractHistoryInfoFromCard', () => {
        it('should extract all required info', () => {
            const info = extractHistoryInfoFromCard(mockV3Card)
            
            expect(info.name).toBe("小测")
            expect(info.avatar).toBe("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==")
            expect(info.nickname).toBe("小测")
            expect(info.description).toBe("这是一个测试角色")
        })

        it('should handle card without avatar', () => {
            const cardNoAvatar = {
                ...mockV3Card,
                data: { ...mockV3Card.data, assets: [] }
            }
            const info = extractHistoryInfoFromCard(cardNoAvatar)
            
            expect(info.avatar).toBeUndefined()
            expect(info.name).toBe("小测")
        })
    })
})
