import * as crypto from 'crypto'
import type { CharaCardV2 } from './silly-tavern-card.js'

/**
 * 哈希UUID生成器
 * 用于生成基于内容的确定性UUID
 */
export class HashUuidGenerator {
	/**
	 * 从SillyTavern角色卡生成确定性UUID
	 * 使用角色的核心数据（名称、描述、人格等）生成哈希，确保相同内容生成相同UUID
	 */
	static fromSillyTavernCard(card: CharaCardV2): string {
		// 提取用于生成哈希的核心数据
		const coreData = {
			name: card.data.name || '',
			description: card.data.description || '',
			personality: card.data.personality || '',
			first_mes: card.data.first_mes || '',
			scenario: card.data.scenario || '',
			mes_example: card.data.mes_example || '',
			creator: card.data.creator || '',
			character_version: card.data.character_version || '',
			// 包含character_book以确保词条变化时UUID也会变化
			character_book: card.data.character_book ? {
				name: card.data.character_book.name || '',
				description: card.data.character_book.description || '',
				entries: card.data.character_book.entries?.map(entry => ({
					name: entry.name || '',
					keys: entry.keys || [],
					content: entry.content || '',
					enabled: entry.enabled
				})) || []
			} : null
		}

		// 生成确定性哈希
		const hash = this.generateHash(coreData)
		
		// 将哈希转换为UUID格式 (8-4-4-4-12)
		return this.hashToUuid(hash)
	}

	/**
	 * 从文件Buffer生成确定性UUID
	 * 适用于PNG文件等二进制文件
	 */
	static fromFileBuffer(buffer: Buffer): string {
		const hash = crypto.createHash('sha256').update(buffer).digest('hex')
		return this.hashToUuid(hash)
	}

	/**
	 * 从文件路径和修改时间生成确定性UUID
	 * 适用于需要考虑文件位置和时间的场景
	 */
	static fromFilePathAndMtime(filePath: string, mtime: Date): string {
		const data = `${filePath}:${mtime.getTime()}`
		const hash = crypto.createHash('sha256').update(data, 'utf8').digest('hex')
		return this.hashToUuid(hash)
	}

	/**
	 * 生成对象的确定性哈希
	 */
	private static generateHash(data: any): string {
		// 使用深度排序确保一致性
		const jsonString = JSON.stringify(data, (key, value) => {
			if (value && typeof value === 'object' && !Array.isArray(value)) {
				// 对对象的键进行排序
				const sortedObj: any = {}
				Object.keys(value).sort().forEach(k => {
					sortedObj[k] = value[k]
				})
				return sortedObj
			}
			return value
		})
		return crypto.createHash('sha256').update(jsonString, 'utf8').digest('hex')
	}

	/**
	 * 将32位哈希转换为UUID格式
	 * 格式: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
	 * 其中4表示版本4，y的第一位固定为8、9、a或b
	 */
	private static hashToUuid(hash: string): string {
		// 确保哈希长度足够
		if (hash.length < 32) {
			hash = hash.padEnd(32, '0')
		}

		// 分割哈希为UUID格式的各部分
		const part1 = hash.substring(0, 8)
		const part2 = hash.substring(8, 12)
		const part3 = hash.substring(12, 16)
		const part4 = hash.substring(16, 20)
		const part5 = hash.substring(20, 32)

		// 设置版本位（第13位设为4）和变体位
		const versionPart3 = '4' + part3.substring(1)
		const firstChar = parseInt(part4.charAt(0), 16)
		const variantChar = (8 + (firstChar & 0x3)).toString(16)
		const variantPart4 = variantChar + part4.substring(1)

		return `${part1}-${part2}-${versionPart3}-${variantPart4}-${part5}`
	}

	/**
	 * 验证UUID格式是否正确
	 */
	static validateUuid(uuid: string): boolean {
		const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
		return uuidRegex.test(uuid)
	}
}

/**
 * 便捷函数：生成SillyTavern角色卡的UUID
 */
export function generateSillyTavernUuid(card: CharaCardV2): string {
	return HashUuidGenerator.fromSillyTavernCard(card)
}

/**
 * 便捷函数：生成文件的UUID
 */
export function generateFileUuid(buffer: Buffer): string {
	return HashUuidGenerator.fromFileBuffer(buffer)
}