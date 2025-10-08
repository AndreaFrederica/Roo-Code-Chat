import { RoleRegistry } from '../services/anh-chat/RoleRegistry'
import { SillyTavernPngDecoder } from './sillytavern-png-decoder'
import { SillyTavernParser } from './sillytavern-parser'
import * as fs from 'fs'
import * as path from 'path'

// 创建模拟 PNG 文件的辅助函数
function createMockPngWithCharaData(base64Data: string): Buffer {
	const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
	
	// 创建 tEXt 块
	const keyword = 'chara'
	const keywordBuffer = Buffer.from(keyword, 'ascii')
	const nullSeparator = Buffer.from([0x00])
	const textBuffer = Buffer.from(base64Data, 'ascii')
	
	const textChunkData = Buffer.concat([keywordBuffer, nullSeparator, textBuffer])
	const textChunkLength = Buffer.alloc(4)
	textChunkLength.writeUInt32BE(textChunkData.length, 0)
	const textChunkType = Buffer.from('tEXt', 'ascii')
	
	// 计算 CRC32 (简化版本，实际应该使用正确的 CRC32 算法)
	const textChunkCrc = Buffer.alloc(4)
	textChunkCrc.writeUInt32BE(0x12345678, 0) // 占位符
	
	const textChunk = Buffer.concat([textChunkLength, textChunkType, textChunkData, textChunkCrc])
	
	// 创建 IEND 块
	const iendLength = Buffer.alloc(4)
	const iendType = Buffer.from('IEND', 'ascii')
	const iendCrc = Buffer.alloc(4)
	iendCrc.writeUInt32BE(0xAE426082, 0) // IEND 的标准 CRC
	const iendChunk = Buffer.concat([iendLength, iendType, iendCrc])
	
	return Buffer.concat([PNG_SIGNATURE, textChunk, iendChunk])
}

async function testRoleRegistryIntegration() {
	console.log('=== RoleRegistry SillyTavern Integration Test ===')

	// 创建测试目录
	const testDir = path.join(__dirname, '../../test-roles')
	if (!fs.existsSync(testDir)) {
		fs.mkdirSync(testDir, { recursive: true })
	}

	// 创建测试用的 SillyTavern 角色数据
	const testCharacterData = {
		data: {
			name: "TestCharacter",
			description: "A test character for integration testing",
			personality: "Friendly and helpful",
			first_mes: "Hello! I'm a test character.",
			avatar: null,
			mes_example: "",
			scenario: "Testing environment",
			creator_notes: "Created for testing SillyTavern integration",
			system_prompt: "",
			post_history_instructions: "",
			alternate_greetings: ["Hi there!", "Greetings!"],
			tags: ["test", "integration"],
			creator: "Test Suite",
			character_version: "1.0"
		},
		spec: "chara_card_v2",
		spec_version: "2.0"
	}

	// 创建模拟的 PNG 文件
	const base64Data = Buffer.from(JSON.stringify(testCharacterData), 'utf-8').toString('base64')
	const mockPngBuffer = createMockPngWithCharaData(base64Data)
	
	// 创建 RoleRegistry 来获取正确的角色目录路径
	const tempRegistry = await RoleRegistry.create(testDir)
	const rolesDir = path.join(testDir, 'novel-helper', '.anh-chat', 'roles')
	
	const testPngPath = path.join(rolesDir, 'test-character.png')
	
	fs.writeFileSync(testPngPath, mockPngBuffer)
	console.log(`✓ Created test PNG file: ${testPngPath}`)

	try {
		// 初始化 RoleRegistry 并测试自动检测
		console.log('\n1. Testing RoleRegistry initialization with auto-detection...')
		const roleRegistry = await RoleRegistry.create(testDir)
		console.log('✓ RoleRegistry initialized successfully')

		// 检查是否自动检测到了 SillyTavern 角色
		console.log('\n2. Checking if SillyTavern character was auto-detected...')
		const allRoles = roleRegistry.listSummaries()
		console.log(`Found ${allRoles.length} roles total`)

		const sillyTavernRole = allRoles.find(role => role.name === 'TestCharacter')
		if (sillyTavernRole) {
			console.log('✓ SillyTavern character auto-detected successfully')
			console.log(`  - Name: ${sillyTavernRole.name}`)
			console.log(`  - UUID: ${sillyTavernRole.uuid}`)
			console.log(`  - Type: ${sillyTavernRole.type}`)
			
			// 尝试加载完整的角色数据
			console.log('\n3. Testing role loading...')
			const fullRole = await roleRegistry.loadRole(sillyTavernRole.uuid)
			if (fullRole) {
				console.log('✓ Role loaded successfully')
				console.log(`  - Description length: ${fullRole.description?.length || 0}`)
				console.log(`  - Has personality: ${!!fullRole.personality}`)
				console.log(`  - Has greeting: ${!!fullRole.greeting}`)
			} else {
				console.error('✗ Failed to load role')
			}
		} else {
			console.error('✗ SillyTavern character not found in auto-detection')
			console.log('Available roles:', allRoles.map(r => r.name))
			
			// 手动测试PNG解析
			console.log('\n3. Manual PNG parsing test...')
			try {
				const role = await SillyTavernParser.parseFromPngFile(testPngPath)
				console.log('✓ Manual PNG parsing successful')
				console.log(`  - Name: ${role.role?.name}`)
				console.log(`  - UUID: ${role.role?.uuid}`)
			} catch (parseError) {
				console.error('✗ Manual PNG parsing failed:', parseError)
			}
		}

	} catch (error) {
		console.error('✗ Integration test failed:', error)
	} finally {
		// 清理测试文件
		console.log('\n4. Cleaning up test files...')
		try {
			if (fs.existsSync(testPngPath)) {
				fs.unlinkSync(testPngPath)
			}
			
			// 清理可能创建的 JSON 文件
			const files = fs.readdirSync(testDir)
			for (const file of files) {
				if (file.endsWith('.json')) {
					fs.unlinkSync(path.join(testDir, file))
				}
			}
			
			// 如果目录为空，删除目录
			const remainingFiles = fs.readdirSync(testDir)
			if (remainingFiles.length === 0) {
				fs.rmdirSync(testDir)
			}
			
			console.log('✓ Test files cleaned up')
		} catch (cleanupError) {
			console.warn('Warning: Failed to clean up some test files:', cleanupError)
		}
	}

	console.log('\n=== Integration Test Complete ===')
}

// 运行测试
testRoleRegistryIntegration().catch(console.error)