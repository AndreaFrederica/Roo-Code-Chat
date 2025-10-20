import type { CharaCardV2, CharaCardV3, Role } from '@roo-code/types'
import { createSillyTavernCompatibility } from '@roo-code/types'
import { SillyTavernPngDecoder, type SillyTavernPngDecodeResult } from './sillytavern-png-decoder.js'
import { Buffer } from 'buffer'
import { debugLog } from '../utils/debug'
import { isCharacterCardV3, convertV2ToV3 } from './characterCardV3'

/**
 * SillyTavern 解析结果
 */
export interface SillyTavernParseResult {
	success: boolean
	role?: Role
	originalCard?: CharaCardV2 | CharaCardV3
	error?: string
	source: 'png' | 'json' | 'unknown'
	cardVersion?: 'v2' | 'v3'
}

/**
 * SillyTavern 解析选项
 */
export interface SillyTavernParseOptions {
	/** 生成的角色 UUID，如果不提供则自动生成 */
	uuid?: string
	/** 默认角色类型 */
	defaultRoleType?: Role['type']
	/** 是否验证卡片格式 */
	validateCard?: boolean
}

/**
 * SillyTavern 卡片解析器
 */
export class SillyTavernParser {
	private static compatibility = createSillyTavernCompatibility()

	/**
	 * 从 PNG 文件解析 SillyTavern 角色卡片
	 */
	static async parseFromPngFile(
		filePath: string,
		options: SillyTavernParseOptions = {}
	): Promise<SillyTavernParseResult> {
		try {
			// 检查文件扩展名
			if (!SillyTavernPngDecoder.isSupportedFile(filePath)) {
				return {
					success: false,
					error: 'Unsupported file format. Only PNG files are supported.',
					source: 'unknown'
				}
			}

			debugLog(`[SillyTavernParser] 🎨 Starting to parse PNG character card: ${filePath}`)

			// 解码 PNG 文件
			const decodeResult = await SillyTavernPngDecoder.decodeFromFile(filePath)

			if (!decodeResult.success || !decodeResult.data) {
				debugLog(`[SillyTavernParser] ❌ Failed to decode PNG file: ${decodeResult.error || 'Unknown error'}`)
				return {
					success: false,
					error: decodeResult.error || 'Failed to decode PNG file',
					source: 'png'
				}
			}

			debugLog(`[SillyTavernParser] 📋 PNG decoded successfully, found character: ${decodeResult.data.data?.name || 'Unknown'}`)

			// 根据卡片版本转换为 anh-chat 角色
			let role: Role
			let cardVersion: 'v2' | 'v3' | undefined

			if (decodeResult.cardVersion === 'v3') {
				// V3 格式处理
				const compatibility = createSillyTavernCompatibility()
				role = compatibility.fromSillyTavernV3(decodeResult.data as CharaCardV3, options.uuid)
				cardVersion = 'v3'
			} else {
				// V2 格式处理
				role = this.convertToRole(decodeResult.data as CharaCardV2, options)
				cardVersion = 'v2'
			}

			debugLog(`[SillyTavernParser] ✅ Successfully parsed SillyTavern character "${role.name}" from PNG`)
			debugLog(`[SillyTavernParser] 📊 Character details:`, {
				name: role.name,
				type: role.type,
				description: role.description?.substring(0, 100) + (role.description && role.description.length > 100 ? "..." : ""),
				uuid: role.uuid,
				cardVersion
			})

			return {
				success: true,
				role,
				originalCard: decodeResult.data,
				source: 'png',
				cardVersion
			}
		} catch (error) {
			debugLog(`[SillyTavernParser] 💥 Error parsing PNG character card: ${error instanceof Error ? error.message : String(error)}`)
			return {
				success: false,
				error: `Parse error: ${error instanceof Error ? error.message : String(error)}`,
				source: 'png'
			}
		}
	}

	/**
	 * 从 PNG Buffer 解析 SillyTavern 角色卡片
	 */
	static parseFromPngBuffer(
		buffer: Buffer,
		options: SillyTavernParseOptions = {}
	): SillyTavernParseResult {
		try {
			debugLog(`[SillyTavernParser] 🎨 Starting to parse PNG character buffer (${buffer.length} bytes)`)

			// 解码 PNG Buffer
			const decodeResult = SillyTavernPngDecoder.decode(buffer)

			if (!decodeResult.success || !decodeResult.data) {
				debugLog(`[SillyTavernParser] ❌ Failed to decode PNG buffer: ${decodeResult.error || 'Unknown error'}`)
				return {
					success: false,
					error: decodeResult.error || 'Failed to decode PNG buffer',
					source: 'png'
				}
			}

			debugLog(`[SillyTavernParser] 📋 PNG buffer decoded successfully, found character: ${decodeResult.data.data?.name || 'Unknown'}`)

			// 根据卡片版本转换为 anh-chat 角色
			let role: Role
			let cardVersion: 'v2' | 'v3' | undefined

			if (decodeResult.cardVersion === 'v3') {
				// V3 格式处理
				const compatibility = createSillyTavernCompatibility()
				role = compatibility.fromSillyTavernV3(decodeResult.data as CharaCardV3, options.uuid)
				cardVersion = 'v3'
			} else {
				// V2 格式处理
				role = this.convertToRole(decodeResult.data as CharaCardV2, options)
				cardVersion = 'v2'
			}

			debugLog(`[SillyTavernParser] ✅ Successfully parsed SillyTavern character "${role.name}" from PNG buffer`)
			debugLog(`[SillyTavernParser] 📊 Character details:`, {
				name: role.name,
				type: role.type,
				description: role.description?.substring(0, 100) + (role.description && role.description.length > 100 ? "..." : ""),
				uuid: role.uuid,
				cardVersion
			})

			return {
				success: true,
				role,
				originalCard: decodeResult.data,
				source: 'png',
				cardVersion
			}
		} catch (error) {
			debugLog(`[SillyTavernParser] 💥 Error parsing PNG character buffer: ${error instanceof Error ? error.message : String(error)}`)
			return {
				success: false,
				error: `Parse error: ${error instanceof Error ? error.message : String(error)}`,
				source: 'png'
			}
		}
	}

	/**
	 * 从 JSON 字符串解析 SillyTavern 角色卡片
	 */
	static parseFromJson(
		jsonString: string,
		options: SillyTavernParseOptions = {}
	): SillyTavernParseResult {
		try {
			debugLog(`[SillyTavernParser] 📄 Starting to parse JSON character data`)

			// 解析 JSON
			const rawData = JSON.parse(jsonString)

			// 检测是否为 V3 格式
			if (isCharacterCardV3(rawData)) {
				debugLog(`[SillyTavernParser] 🆕 Detected Character Card V3 format: ${rawData.data?.name || 'Unknown'}`)
				return this.parseFromV3Card(rawData, options)
			}

			// 检测是否为 V2 格式
			if (this.validateCard(rawData)) {
				debugLog(`[SillyTavernParser] 📋 Detected Character Card V2 format: ${rawData.data?.name || 'Unknown'}`)
				return this.parseFromV2Card(rawData as CharaCardV2, options)
			}

			debugLog(`[SillyTavernParser] ❌ Invalid SillyTavern card format`)
			return {
				success: false,
				error: 'Invalid SillyTavern card format - not V2 or V3',
				source: 'json'
			}
		} catch (error) {
			debugLog(`[SillyTavernParser] 💥 Error parsing JSON character data: ${error instanceof Error ? error.message : String(error)}`)
			return {
				success: false,
				error: `JSON parse error: ${error instanceof Error ? error.message : String(error)}`,
				source: 'json'
			}
		}
	}

	/**
	 * 从 Character Card V3 解析角色
	 */
	private static parseFromV3Card(
		card: CharaCardV3,
		options: SillyTavernParseOptions = {}
	): SillyTavernParseResult {
		try {
			debugLog(`[SillyTavernParser] 🆕 Parsing Character Card V3: ${card.data?.name || 'Unknown'}`)

			// 将 V3 转换为 V2 以兼容现有的转换逻辑
			const v2Card = this.convertV3ToV2(card)

			// 转换为 anh-chat 角色
			const role = this.compatibility.fromSillyTavernV3(card, options.uuid)

			debugLog(`[SillyTavernParser] ✅ Successfully parsed Character Card V3 "${role.name}"`)
			debugLog(`[SillyTavernParser] 📊 Character details:`, {
				name: role.name,
				type: role.type,
				description: role.description?.substring(0, 100) + (role.description && role.description.length > 100 ? "..." : ""),
				uuid: role.uuid,
				cardVersion: 'v3'
			})

			return {
				success: true,
				role,
				originalCard: card,
				source: 'json',
				cardVersion: 'v3'
			}
		} catch (error) {
			debugLog(`[SillyTavernParser] 💥 Error parsing Character Card V3: ${error instanceof Error ? error.message : String(error)}`)
			return {
				success: false,
				error: `V3 parse error: ${error instanceof Error ? error.message : String(error)}`,
				source: 'json',
				cardVersion: 'v3'
			}
		}
	}

	/**
	 * 从 Character Card V2 解析角色
	 */
	private static parseFromV2Card(
		card: CharaCardV2,
		options: SillyTavernParseOptions = {}
	): SillyTavernParseResult {
		try {
			debugLog(`[SillyTavernParser] 📋 Parsing Character Card V2: ${card.data?.name || 'Unknown'}`)

			// 转换为 anh-chat 角色
			const role = this.convertToRole(card, options)

			debugLog(`[SillyTavernParser] ✅ Successfully parsed Character Card V2 "${role.name}"`)
			debugLog(`[SillyTavernParser] 📊 Character details:`, {
				name: role.name,
				type: role.type,
				description: role.description?.substring(0, 100) + (role.description && role.description.length > 100 ? "..." : ""),
				uuid: role.uuid,
				cardVersion: 'v2'
			})

			return {
				success: true,
				role,
				originalCard: card,
				source: 'json',
				cardVersion: 'v2'
			}
		} catch (error) {
			debugLog(`[SillyTavernParser] 💥 Error parsing Character Card V2: ${error instanceof Error ? error.message : String(error)}`)
			return {
				success: false,
				error: `V2 parse error: ${error instanceof Error ? error.message : String(error)}`,
				source: 'json',
				cardVersion: 'v2'
			}
		}
	}

	/**
	 * 将 Character Card V3 转换为 V2 格式（用于兼容现有转换逻辑）
	 */
	private static convertV3ToV2(v3Card: CharaCardV3): CharaCardV2 {
		// 从 V3 的 assets 中提取头像
		const v3Data = v3Card.data as any
		const avatar = v3Data.assets?.find((asset: any) => asset.type === 'icon')?.uri || null

		// 构建 V2 格式的 data，只包含 V2 支持的字段
		const v2Data: any = {
			name: v3Data.name,
			description: v3Data.description,
			personality: v3Data.personality,
			first_mes: v3Data.first_mes,
			mes_example: v3Data.mes_example,
			scenario: v3Data.scenario,
			creator_notes: v3Data.creator_notes,
			system_prompt: v3Data.system_prompt,
			post_history_instructions: v3Data.post_history_instructions,
			alternate_greetings: v3Data.alternate_greetings,
			tags: v3Data.tags,
			creator: v3Data.creator,
			character_version: v3Data.character_version,
			extensions: v3Data.extensions,
			character_book: v3Data.character_book,
			avatar: avatar
		}

		const v2Card: CharaCardV2 = {
			spec: v3Card.spec,
			spec_version: v3Card.spec_version,
			data: v2Data
		}

		return v2Card
	}

	/**
	 * 从 CharaCardV2 对象解析角色
	 */
	static parseFromCard(
		card: CharaCardV2,
		options: SillyTavernParseOptions = {}
	): SillyTavernParseResult {
		try {
			debugLog(`[SillyTavernParser] 🃏 Starting to parse character card object: ${card.data?.name || 'Unknown'}`)

			// 验证卡片格式
			if (options.validateCard !== false && !this.validateCard(card)) {
				debugLog(`[SillyTavernParser] ❌ Invalid SillyTavern card format`)
				return {
					success: false,
					error: 'Invalid SillyTavern card format',
					source: 'json'
				}
			}

			// 转换为 anh-chat 角色
			const role = this.convertToRole(card, options)

			debugLog(`[SillyTavernParser] ✅ Successfully parsed SillyTavern character "${role.name}" from card object`)
			debugLog(`[SillyTavernParser] 📊 Character details:`, {
				name: role.name,
				type: role.type,
				description: role.description?.substring(0, 100) + (role.description && role.description.length > 100 ? "..." : ""),
				uuid: role.uuid
			})

			return {
				success: true,
				role,
				originalCard: card,
				source: 'json'
			}
		} catch (error) {
			debugLog(`[SillyTavernParser] 💥 Error parsing character card object: ${error instanceof Error ? error.message : String(error)}`)
			return {
				success: false,
				error: `Conversion error: ${error instanceof Error ? error.message : String(error)}`,
				source: 'json'
			}
		}
	}

	/**
	 * 自动检测并解析 SillyTavern 数据
	 */
	static async parseAuto(
		input: string | Buffer | CharaCardV2,
		options: SillyTavernParseOptions = {}
	): Promise<SillyTavernParseResult> {
		debugLog(`[SillyTavernParser] 🔍 Starting auto-detection and parsing of SillyTavern data`)

		// 如果是对象，直接解析
		if (typeof input === 'object' && !Buffer.isBuffer(input)) {
			debugLog(`[SillyTavernParser] 📋 Detected input type: Character card object`)
			return this.parseFromCard(input, options)
		}

		// 如果是 Buffer，尝试解析为 PNG
		if (Buffer.isBuffer(input)) {
			debugLog(`[SillyTavernParser] 📋 Detected input type: PNG buffer (${input.length} bytes)`)
			return this.parseFromPngBuffer(input, options)
		}

		// 如果是字符串
		if (typeof input === 'string') {
			// 检查是否为文件路径
			if (input.includes('.') && (input.endsWith('.png') || input.includes('/'))) {
				debugLog(`[SillyTavernParser] 📋 Detected input type: PNG file path - ${input}`)
				return this.parseFromPngFile(input, options)
			}

			// 尝试解析为 JSON
			try {
				debugLog(`[SillyTavernParser] 📋 Detected input type: JSON string`)
				return this.parseFromJson(input, options)
			} catch {
				debugLog(`[SillyTavernParser] ❌ Failed to parse string input as JSON or file path`)
				return {
					success: false,
					error: 'Unable to parse input as JSON or file path',
					source: 'unknown'
				}
			}
		}

		debugLog(`[SillyTavernParser] ❌ Unsupported input type: ${typeof input}`)
		return {
			success: false,
			error: 'Unsupported input type',
			source: 'unknown'
		}
	}

	/**
	 * 将 SillyTavern 卡片转换为 anh-chat 角色
	 */
	private static convertToRole(card: CharaCardV2, options: SillyTavernParseOptions): Role {
		const role = this.compatibility.fromSillyTavern(card, options.uuid)
		
		// 应用默认角色类型
		if (options.defaultRoleType) {
			role.type = options.defaultRoleType
		}

		return role
	}

	/**
	 * 验证 SillyTavern 卡片格式
	 */
	private static validateCard(card: any): card is CharaCardV2 {
		if (!card || typeof card !== 'object') {
			return false
		}

		// 检查 data 字段
		if (!card.data || typeof card.data !== 'object') {
			return false
		}

		// 检查必需字段
		const data = card.data
		if (!data.name || typeof data.name !== 'string') {
			return false
		}

		return true
	}

	/**
	 * 获取支持的文件格式
	 */
	static getSupportedFormats(): string[] {
		return ['png', 'json']
	}

	/**
	 * 检查文件是否为支持的格式
	 */
	static isSupportedFile(filename: string): boolean {
		const ext = filename.toLowerCase().split('.').pop()
		return ext === 'png' || ext === 'json'
	}
}

/**
 * 便捷函数：解析 SillyTavern PNG 文件
 */
export async function parseSillyTavernPng(
	filePath: string,
	options?: SillyTavernParseOptions
): Promise<SillyTavernParseResult> {
	debugLog(`[SillyTavernParser] 🎯 Convenience function: parseSillyTavernPng called for ${filePath}`)
	return SillyTavernParser.parseFromPngFile(filePath, options)
}

/**
 * 便捷函数：解析 SillyTavern JSON
 */
export function parseSillyTavernJson(
	jsonString: string,
	options?: SillyTavernParseOptions
): SillyTavernParseResult {
	debugLog(`[SillyTavernParser] 🎯 Convenience function: parseSillyTavernJson called`)
	return SillyTavernParser.parseFromJson(jsonString, options)
}

/**
 * 便捷函数：自动解析 SillyTavern 数据
 */
export async function parseSillyTavern(
	input: string | Buffer | CharaCardV2,
	options?: SillyTavernParseOptions
): Promise<SillyTavernParseResult> {
	debugLog(`[SillyTavernParser] 🎯 Convenience function: parseSillyTavern called with ${typeof input} input`)
	return SillyTavernParser.parseAuto(input, options)
}
