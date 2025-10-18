import type { CharaCardV2, Role } from '@roo-code/types'
import { createSillyTavernCompatibility } from '@roo-code/types'
import { SillyTavernPngDecoder, type SillyTavernPngDecodeResult } from './sillytavern-png-decoder.js'
import { Buffer } from 'buffer'
import { debugLog } from '../utils/debug'

/**
 * SillyTavern 解析结果
 */
export interface SillyTavernParseResult {
	success: boolean
	role?: Role
	originalCard?: CharaCardV2
	error?: string
	source: 'png' | 'json' | 'unknown'
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

			// 转换为 anh-chat 角色
			const role = this.convertToRole(decodeResult.data, options)

			debugLog(`[SillyTavernParser] ✅ Successfully parsed SillyTavern character "${role.name}" from PNG`)
			debugLog(`[SillyTavernParser] 📊 Character details:`, {
				name: role.name,
				type: role.type,
				description: role.description?.substring(0, 100) + (role.description && role.description.length > 100 ? "..." : ""),
				uuid: role.uuid
			})

			return {
				success: true,
				role,
				originalCard: decodeResult.data,
				source: 'png'
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

			// 转换为 anh-chat 角色
			const role = this.convertToRole(decodeResult.data, options)

			debugLog(`[SillyTavernParser] ✅ Successfully parsed SillyTavern character "${role.name}" from PNG buffer`)
			debugLog(`[SillyTavernParser] 📊 Character details:`, {
				name: role.name,
				type: role.type,
				description: role.description?.substring(0, 100) + (role.description && role.description.length > 100 ? "..." : ""),
				uuid: role.uuid
			})

			return {
				success: true,
				role,
				originalCard: decodeResult.data,
				source: 'png'
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
			const cardData = JSON.parse(jsonString) as CharaCardV2

			debugLog(`[SillyTavernParser] 📋 JSON parsed successfully, found character: ${cardData.data?.name || 'Unknown'}`)

			// 验证卡片格式
			if (options.validateCard !== false && !this.validateCard(cardData)) {
				debugLog(`[SillyTavernParser] ❌ Invalid SillyTavern card format`)
				return {
					success: false,
					error: 'Invalid SillyTavern card format',
					source: 'json'
				}
			}

			// 转换为 anh-chat 角色
			const role = this.convertToRole(cardData, options)

			debugLog(`[SillyTavernParser] ✅ Successfully parsed SillyTavern character "${role.name}" from JSON`)
			debugLog(`[SillyTavernParser] 📊 Character details:`, {
				name: role.name,
				type: role.type,
				description: role.description?.substring(0, 100) + (role.description && role.description.length > 100 ? "..." : ""),
				uuid: role.uuid
			})

			return {
				success: true,
				role,
				originalCard: cardData,
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