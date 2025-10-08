import { Buffer } from 'buffer'
import { SillyTavernPngDecoder } from './sillytavern-png-decoder.js'
import { SillyTavernParser } from './sillytavern-parser.js'

/**
 * 测试 SillyTavern PNG 解码功能
 */
async function testSillyTavernDecoder() {
	console.log('=== SillyTavern PNG Decoder Test ===')

	// 创建一个完整的测试用 SillyTavern 角色数据
	const testCharacterData = {
		data: {
			name: "Lepora",
			description: "A rabbit-eared kyn character in a dystopian world where humans and kyn coexist.",
			personality: "Cautious but determined, struggles with societal prejudice",
			first_mes: "Hello there... I hope you're not here to cause trouble.",
			avatar: null,
			mes_example: "",
			scenario: "In a world where kyn are second-class citizens",
			creator_notes: "Test character for SillyTavern integration",
			system_prompt: "",
			post_history_instructions: "",
			alternate_greetings: ["*ears twitch nervously* Oh, it's you again..."],
			tags: ["kyn", "dystopian", "rabbit"],
			creator: "Test Creator",
			character_version: "1.0"
		},
		spec: "chara_card_v2",
		spec_version: "2.0"
	}

	// 将测试数据转换为 base64
	const testBase64 = Buffer.from(JSON.stringify(testCharacterData), 'utf-8').toString('base64')

	console.log('\n1. Testing base64 decoding...')
	try {
		// 解码 base64
		const decoded = Buffer.from(testBase64, 'base64').toString('utf-8')
		console.log('✓ Base64 decoded successfully')
		console.log('Decoded length:', decoded.length)
		console.log('First 200 characters:', decoded.substring(0, 200))

		// 尝试解析为 JSON
		const parsed = JSON.parse(decoded)
		console.log('✓ JSON parsed successfully')
		console.log('Character name:', parsed.data?.name)
		console.log('Character description length:', parsed.data?.description?.length)
	} catch (error) {
		console.error('✗ Base64/JSON decoding failed:', error)
	}

	console.log('\n2. Testing SillyTavern parser with JSON...')
	try {
		const decoded = Buffer.from(testBase64, 'base64').toString('utf-8')
		const parseResult = SillyTavernParser.parseFromJson(decoded)
		
		if (parseResult.success && parseResult.role) {
			console.log('✓ SillyTavern JSON parsing successful')
			console.log('Role name:', parseResult.role.name)
			console.log('Role type:', parseResult.role.type)
			console.log('Role UUID:', parseResult.role.uuid)
			console.log('Has description:', !!parseResult.role.description)
			console.log('Has personality:', !!parseResult.role.personality)
		} else {
			console.error('✗ SillyTavern JSON parsing failed:', parseResult.error)
		}
	} catch (error) {
		console.error('✗ SillyTavern parser error:', error)
	}

	console.log('\n3. Testing PNG chunk creation and parsing...')
	try {
		// 创建一个模拟的 PNG 文件用于测试
		const mockPngBuffer = createMockPngWithCharaData(testBase64)
		console.log('✓ Mock PNG created, size:', mockPngBuffer.length)

		// 使用解码器解析
		const decodeResult = SillyTavernPngDecoder.decode(mockPngBuffer)
		
		if (decodeResult.success && decodeResult.data) {
			console.log('✓ PNG decoding successful')
			console.log('Character name:', decodeResult.data.data.name)
			console.log('Raw JSON length:', decodeResult.rawJson?.length)
		} else {
			console.error('✗ PNG decoding failed:', decodeResult.error)
		}
	} catch (error) {
		console.error('✗ PNG test error:', error)
	}

	console.log('\n4. Testing complete SillyTavern parser with PNG buffer...')
	try {
		const mockPngBuffer = createMockPngWithCharaData(testBase64)
		const parseResult = SillyTavernParser.parseFromPngBuffer(mockPngBuffer)
		
		if (parseResult.success && parseResult.role) {
			console.log('✓ Complete PNG parsing successful')
			console.log('Role name:', parseResult.role.name)
			console.log('Role type:', parseResult.role.type)
			console.log('Source:', parseResult.source)
			console.log('Has SillyTavern fields:', !!parseResult.role.personality)
		} else {
			console.error('✗ Complete PNG parsing failed:', parseResult.error)
		}
	} catch (error) {
		console.error('✗ Complete parser error:', error)
	}

	console.log('\n=== Test Complete ===')
}

/**
 * 创建包含角色数据的模拟 PNG 文件
 */
function createMockPngWithCharaData(base64Data: string): Buffer {
	// PNG 文件签名
	const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
	
	// IHDR 块（最小的图像头）
	const ihdrData = Buffer.from([
		0x00, 0x00, 0x00, 0x01, // width: 1
		0x00, 0x00, 0x00, 0x01, // height: 1
		0x08, // bit depth: 8
		0x02, // color type: 2 (RGB)
		0x00, // compression: 0
		0x00, // filter: 0
		0x00  // interlace: 0
	])
	const ihdrChunk = createPngChunk('IHDR', ihdrData)
	
	// tEXt 块包含角色数据
	const textData = Buffer.concat([
		Buffer.from('chara', 'latin1'), // keyword
		Buffer.from([0]), // null separator
		Buffer.from(base64Data, 'latin1') // text data
	])
	const textChunk = createPngChunk('tEXt', textData)
	
	// IDAT 块（最小的图像数据）
	const idatData = Buffer.from([0x78, 0x9C, 0x62, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01])
	const idatChunk = createPngChunk('IDAT', idatData)
	
	// IEND 块
	const iendChunk = createPngChunk('IEND', Buffer.alloc(0))
	
	// 组合所有部分
	return Buffer.concat([
		pngSignature,
		ihdrChunk,
		textChunk,
		idatChunk,
		iendChunk
	])
}

/**
 * 创建 PNG 块
 */
function createPngChunk(type: string, data: Buffer): Buffer {
	const length = Buffer.alloc(4)
	length.writeUInt32BE(data.length, 0)
	
	const typeBuffer = Buffer.from(type, 'ascii')
	
	// 计算 CRC（简化版，实际应该计算正确的 CRC-32）
	const crc = Buffer.alloc(4)
	crc.writeUInt32BE(0x12345678, 0) // 占位符 CRC
	
	return Buffer.concat([length, typeBuffer, data, crc])
}

// 运行测试
if (require.main === module) {
	testSillyTavernDecoder().catch(console.error)
}

export { testSillyTavernDecoder }