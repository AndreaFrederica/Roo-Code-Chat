import { Buffer } from 'buffer'
import type { CharaCardV2 } from '@roo-code/types'

/**
 * PNG 文件签名
 */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])

/**
 * PNG 块类型
 */
const CHUNK_TYPES = {
	IHDR: 'IHDR',
	tEXt: 'tEXt',
	IEND: 'IEND'
} as const

/**
 * PNG 块结构
 */
interface PngChunk {
	length: number
	type: string
	data: Buffer
	crc: number
}

/**
 * tEXt 块数据
 */
interface TextChunk {
	keyword: string
	text: string
}

/**
 * SillyTavern PNG 解码结果
 */
export interface SillyTavernPngDecodeResult {
	success: boolean
	data?: CharaCardV2
	error?: string
	rawJson?: string
}

/**
 * 解析 PNG 文件并提取 SillyTavern 角色卡片数据
 */
export class SillyTavernPngDecoder {
	/**
	 * 从 PNG 文件 Buffer 中解码 SillyTavern 角色卡片
	 */
	static decode(pngBuffer: Buffer): SillyTavernPngDecodeResult {
		try {
			// 验证 PNG 文件签名
			if (!this.validatePngSignature(pngBuffer)) {
				return {
					success: false,
					error: 'Invalid PNG file signature'
				}
			}

			// 解析 PNG 块
			const chunks = this.parseChunks(pngBuffer)
			
			// 查找包含 "chara" 关键字的 tEXt 块
			const charaChunk = this.findCharaTextChunk(chunks)
			if (!charaChunk) {
				return {
					success: false,
					error: 'No SillyTavern character data found in PNG file'
				}
			}

			// 解码 base64 数据
			const jsonString = this.decodeBase64Text(charaChunk.text)
			if (!jsonString) {
				return {
					success: false,
					error: 'Failed to decode base64 character data'
				}
			}

			// 解析 JSON
			const characterData = this.parseCharacterJson(jsonString)
			if (!characterData) {
				return {
					success: false,
					error: 'Failed to parse character JSON data',
					rawJson: jsonString
				}
			}

			return {
				success: true,
				data: characterData,
				rawJson: jsonString
			}
		} catch (error) {
			return {
				success: false,
				error: `Decoding error: ${error instanceof Error ? error.message : String(error)}`
			}
		}
	}

	/**
	 * 从文件路径解码 SillyTavern 角色卡片
	 */
	static async decodeFromFile(filePath: string): Promise<SillyTavernPngDecodeResult> {
		try {
			const fs = await import('fs')
			const pngBuffer = fs.readFileSync(filePath)
			return this.decode(pngBuffer)
		} catch (error) {
			return {
				success: false,
				error: `File reading error: ${error instanceof Error ? error.message : String(error)}`
			}
		}
	}

	/**
	 * 验证 PNG 文件签名
	 */
	private static validatePngSignature(buffer: Buffer): boolean {
		if (buffer.length < PNG_SIGNATURE.length) {
			return false
		}
		return buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
	}

	/**
	 * 解析 PNG 文件中的所有块
	 */
	private static parseChunks(buffer: Buffer): PngChunk[] {
		const chunks: PngChunk[] = []
		let offset = PNG_SIGNATURE.length

		while (offset < buffer.length) {
			// 读取块长度 (4 bytes, big-endian)
			if (offset + 4 > buffer.length) break
			const length = buffer.readUInt32BE(offset)
			offset += 4

			// 读取块类型 (4 bytes)
			if (offset + 4 > buffer.length) break
			const type = buffer.subarray(offset, offset + 4).toString('ascii')
			offset += 4

			// 读取块数据
			if (offset + length > buffer.length) break
			const data = buffer.subarray(offset, offset + length)
			offset += length

			// 读取 CRC (4 bytes)
			if (offset + 4 > buffer.length) break
			const crc = buffer.readUInt32BE(offset)
			offset += 4

			chunks.push({ length, type, data, crc })

			// 如果遇到 IEND 块，停止解析
			if (type === CHUNK_TYPES.IEND) {
				break
			}
		}

		return chunks
	}

	/**
	 * 查找包含 "chara" 关键字的 tEXt 块
	 */
	private static findCharaTextChunk(chunks: PngChunk[]): TextChunk | null {
		for (const chunk of chunks) {
			if (chunk.type === CHUNK_TYPES.tEXt) {
				const textChunk = this.parseTextChunk(chunk.data)
				if (textChunk && textChunk.keyword === 'chara') {
					return textChunk
				}
			}
		}
		return null
	}

	/**
	 * 解析 tEXt 块数据
	 */
	private static parseTextChunk(data: Buffer): TextChunk | null {
		try {
			// 查找 null 分隔符
			const nullIndex = data.indexOf(0)
			if (nullIndex === -1) {
				return null
			}

			const keyword = data.subarray(0, nullIndex).toString('latin1')
			const text = data.subarray(nullIndex + 1).toString('latin1')

			return { keyword, text }
		} catch (error) {
			return null
		}
	}

	/**
	 * 解码 base64 文本
	 */
	private static decodeBase64Text(base64Text: string): string | null {
		try {
			// 清理 base64 字符串（移除空白字符）
			const cleanBase64 = base64Text.replace(/\s/g, '')
			
			// 解码 base64
			const decoded = Buffer.from(cleanBase64, 'base64').toString('utf-8')
			return decoded
		} catch (error) {
			return null
		}
	}

	/**
	 * 解析角色 JSON 数据
	 */
	private static parseCharacterJson(jsonString: string): CharaCardV2 | null {
		try {
			const parsed = JSON.parse(jsonString)
			
			// 验证是否为有效的 SillyTavern 角色卡片格式
			if (this.validateCharacterCard(parsed)) {
				return parsed as CharaCardV2
			}
			
			return null
		} catch (error) {
			return null
		}
	}

	/**
	 * 验证角色卡片格式
	 */
	private static validateCharacterCard(data: any): boolean {
		// 基本结构验证
		if (!data || typeof data !== 'object') {
			return false
		}

		// 检查是否有 data 字段
		if (!data.data || typeof data.data !== 'object') {
			return false
		}

		// 检查必需的字段
		const cardData = data.data
		if (!cardData.name || typeof cardData.name !== 'string') {
			return false
		}

		// 可选：检查 spec 字段
		if (data.spec && data.spec !== 'chara_card_v2') {
			// 允许其他格式，但记录警告
			console.warn('Non-standard character card spec:', data.spec)
		}

		return true
	}

	/**
	 * 获取支持的文件扩展名
	 */
	static getSupportedExtensions(): string[] {
		return ['.png']
	}

	/**
	 * 检查文件是否为支持的格式
	 */
	static isSupportedFile(filename: string): boolean {
		const ext = filename.toLowerCase().split('.').pop()
		return ext === 'png'
	}
}

/**
 * 便捷函数：从 PNG 文件解码 SillyTavern 角色卡片
 */
export async function decodeSillyTavernPng(filePath: string): Promise<SillyTavernPngDecodeResult> {
	return SillyTavernPngDecoder.decodeFromFile(filePath)
}

/**
 * 便捷函数：从 Buffer 解码 SillyTavern 角色卡片
 */
export function decodeSillyTavernPngBuffer(buffer: Buffer): SillyTavernPngDecodeResult {
	return SillyTavernPngDecoder.decode(buffer)
}