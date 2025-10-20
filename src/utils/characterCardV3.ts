import type { CharacterCardV3, CharacterAsset, AssetType } from "@roo-code/types"

/**
 * Character Card V3 工具函数
 */

/**
 * 检查是否为 Character Card V3 格式
 */
export function isCharacterCardV3(card: any): card is CharacterCardV3 {
    return card?.spec === "chara_card_v3" && card?.spec_version === "3.0"
}

/**
 * 从 Character Card V3 中提取头像 URL
 */
export function extractAvatarFromCardV3(card: CharacterCardV3): string | null {
    if (!card.data.assets || card.data.assets.length === 0) {
        return null
    }

    // 查找类型为 'icon' 且名称为 'main' 的资源
    const mainIcon = card.data.assets.find(asset => 
        asset.type === 'icon' && asset.name === 'main'
    )
    
    if (mainIcon) {
        return resolveAssetUri(mainIcon.uri)
    }

    // 如果没有找到 main icon，查找第一个 icon 类型的资源
    const firstIcon = card.data.assets.find(asset => asset.type === 'icon')
    if (firstIcon) {
        return resolveAssetUri(firstIcon.uri)
    }

    return null
}

/**
 * 解析资源 URI
 */
export function resolveAssetUri(uri: string): string | null {
    if (!uri || uri === "ccdefault:") {
        return null
    }

    // 如果是 base64 数据 URL，直接返回
    if (uri.startsWith('data:')) {
        return uri
    }

    // 如果是 HTTP/HTTPS URL，直接返回
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
        return uri
    }

    // 如果是嵌入资源格式，暂时不支持（需要 CHARX 文件支持）
    if (uri.startsWith('embeded://')) {
        console.warn('Embedded assets (embeded://) are not yet supported')
        return null
    }

    // 其他格式暂时不支持
    console.warn(`Unsupported asset URI format: ${uri}`)
    return null
}

/**
 * 从 Character Card V3 中提取指定类型的资源
 */
export function extractAssetsByType(card: CharacterCardV3, type: AssetType): CharacterAsset[] {
    if (!card.data.assets || card.data.assets.length === 0) {
        return []
    }

    return card.data.assets.filter(asset => asset.type === type)
}

/**
 * 获取角色的显示名称（优先使用 nickname）
 */
export function getCharacterDisplayName(card: CharacterCardV3): string {
    return card.data.nickname || card.data.name || 'Unknown Character'
}

/**
 * 将 Character Card V2 转换为 V3 格式（基础转换）
 */
export function convertV2ToV3(v2Card: any): CharacterCardV3 {
    const now = Date.now() / 1000
    return {
        spec: "chara_card_v3",
        spec_version: "3.0",
        data: {
            ...v2Card.data,
            // V3 新增字段的默认值
            assets: v2Card.data.avatar ? [{
                type: 'icon',
                uri: v2Card.data.avatar,
                name: 'main',
                ext: 'png'
            }] : [],
            nickname: v2Card.data.nickname || undefined,
            creator_notes_multilingual: undefined,
            source: undefined,
            group_only_greetings: [],
            creation_date: now,
            modification_date: now,
            // 记录原始格式信息
            original_format: {
                spec: v2Card.spec || 'chara_card_v2',
                spec_version: v2Card.spec_version || '2.0',
                converted_at: now,
                converted_from: 'chara_card_v2'
            }
        }
    }
}

/**
 * 验证 Character Card V3 格式
 */
export function validateCharacterCardV3(card: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!card) {
        errors.push('Card is null or undefined')
        return { isValid: false, errors }
    }

    if (card.spec !== "chara_card_v3") {
        errors.push(`Invalid spec: expected "chara_card_v3", got "${card.spec}"`)
    }

    if (card.spec_version !== "3.0") {
        errors.push(`Invalid spec_version: expected "3.0", got "${card.spec_version}"`)
    }

    if (!card.data || typeof card.data !== 'object') {
        errors.push('Card data is missing or invalid')
        return { isValid: false, errors }
    }

    if (!card.data.name || typeof card.data.name !== 'string') {
        errors.push('Character name is required')
    }

    // 验证资源格式
    if (card.data.assets && Array.isArray(card.data.assets)) {
        card.data.assets.forEach((asset: any, index: number) => {
            if (!asset.type || typeof asset.type !== 'string') {
                errors.push(`Asset ${index}: type is required`)
            }
            if (!asset.uri || typeof asset.uri !== 'string') {
                errors.push(`Asset ${index}: uri is required`)
            }
            if (!asset.name || typeof asset.name !== 'string') {
                errors.push(`Asset ${index}: name is required`)
            }
            if (!asset.ext || typeof asset.ext !== 'string') {
                errors.push(`Asset ${index}: ext is required`)
            }
        })
    }

    return { isValid: errors.length === 0, errors }
}

/**
 * 从角色卡片中提取所有可用信息用于历史记录
 */
export function extractHistoryInfoFromCard(card: CharacterCardV3): {
    name: string;
    avatar?: string;
    nickname?: string;
    description?: string;
} {
    const info = {
        name: getCharacterDisplayName(card),
        avatar: extractAvatarFromCardV3(card) || undefined,
        nickname: card.data.nickname,
        description: card.data.description
    }

    return info
}
