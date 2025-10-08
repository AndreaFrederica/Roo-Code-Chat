import * as fs from 'fs'
import * as path from 'path'
import { RoleRegistry } from '../services/anh-chat/RoleRegistry'

// 创建模拟PNG文件的辅助函数
function createMockPngWithCharaData(base64Data: string): Buffer {
	// PNG 文件签名
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

async function testComprehensiveRoleLoading() {
	console.log('=== Comprehensive Role Loading Test ===')
	
	const testDir = path.join(process.cwd(), 'test-comprehensive')
	
	try {
		// 清理之前的测试目录
		if (fs.existsSync(testDir)) {
			fs.rmSync(testDir, { recursive: true, force: true })
		}
		
		// 创建测试目录结构
		const rolesDir = path.join(testDir, 'novel-helper', '.anh-chat', 'roles')
		fs.mkdirSync(rolesDir, { recursive: true })
		
		// 1. 创建传统的anh角色文件
		const anhRole = {
			uuid: 'anh-test-uuid-001',
			name: 'AnhTestCharacter',
			type: '主角',
			description: '这是一个传统的anh角色',
			personality: '友善、聪明、勇敢',
			greeting: '你好！我是AnhTestCharacter。',
			updatedAt: Date.now()
		}
		
		const anhRoleSummary = {
			uuid: anhRole.uuid,
			name: anhRole.name,
			type: anhRole.type,
			description: anhRole.description,
			lastUpdatedAt: anhRole.updatedAt
		}
		
		// 保存anh角色文件
		fs.writeFileSync(
			path.join(rolesDir, `${anhRole.uuid}.json`),
			JSON.stringify(anhRole, null, 2)
		)
		fs.writeFileSync(
			path.join(rolesDir, `${anhRole.uuid}.summary.json`),
			JSON.stringify(anhRoleSummary, null, 2)
		)
		
		// 创建角色索引文件
		const indexPath = path.join(rolesDir, 'index.json')
		fs.writeFileSync(indexPath, JSON.stringify([anhRoleSummary], null, 2))
		
		console.log('✓ Created traditional anh role files')
		
		// 2. 创建SillyTavern PNG角色
		const sillyTavernCharacter = {
			name: 'SillyTavernTestCharacter',
			description: '这是一个SillyTavern角色',
			personality: '神秘、优雅、智慧',
			first_mes: '欢迎！我是来自SillyTavern的角色。',
			avatar: 'none',
			chat: 'SillyTavernTestCharacter',
			mes_example: '',
			scenario: '在一个神秘的图书馆中',
			create_date: new Date().toISOString(),
			talkativeness: '0.5',
			fav: false,
			spec: 'chara_card_v2',
			spec_version: '2.0',
			data: {
				name: 'SillyTavernTestCharacter',
				description: '这是一个SillyTavern角色',
				personality: '神秘、优雅、智慧',
				scenario: '在一个神秘的图书馆中',
				first_mes: '欢迎！我是来自SillyTavern的角色。',
				mes_example: '',
				creator_notes: '',
				system_prompt: '',
				post_history_instructions: '',
				alternate_greetings: [],
				character_book: undefined,
				tags: [],
				creator: 'Test Creator',
				character_version: '1.0.0',
				extensions: {}
			}
		}
		
		const base64Data = Buffer.from(JSON.stringify(sillyTavernCharacter), 'utf-8').toString('base64')
		const mockPngBuffer = createMockPngWithCharaData(base64Data)
		const sillyTavernPngPath = path.join(rolesDir, 'sillytavern-character.png')
		
		fs.writeFileSync(sillyTavernPngPath, mockPngBuffer)
		console.log('✓ Created SillyTavern PNG character file')
		
		// 3. 初始化RoleRegistry并测试自动检测
		console.log('\n1. Testing RoleRegistry initialization with mixed role types...')
		const roleRegistry = await RoleRegistry.create(testDir)
		console.log('✓ RoleRegistry initialized successfully')
		
		// 4. 检查所有角色是否都被正确加载
		console.log('\n2. Checking all detected roles...')
		const allRoles = roleRegistry.listSummaries()
		console.log(`Found ${allRoles.length} roles total`)
		
		if (allRoles.length !== 2) {
			console.log('✗ Expected 2 roles, found:', allRoles.length)
			console.log('Available roles:', allRoles.map(r => `${r.name} (${r.type})`))
			return false
		}
		
		// 验证anh角色
		const anhRoleFound = allRoles.find(r => r.name === 'AnhTestCharacter')
		if (!anhRoleFound) {
			console.log('✗ Traditional anh role not found')
			return false
		}
		console.log(`✓ Traditional anh role found: ${anhRoleFound.name} (${anhRoleFound.type})`)
		
		// 验证SillyTavern角色
		const sillyTavernRoleFound = allRoles.find(r => r.name === 'SillyTavernTestCharacter')
		if (!sillyTavernRoleFound) {
			console.log('✗ SillyTavern role not found')
			return false
		}
		console.log(`✓ SillyTavern role found: ${sillyTavernRoleFound.name} (${sillyTavernRoleFound.type})`)
		
		// 5. 测试加载完整角色数据
		console.log('\n3. Testing full role data loading...')
		
		// 加载anh角色
		const fullAnhRole = await roleRegistry.loadRole(anhRoleFound.uuid)
		if (!fullAnhRole) {
			console.log('✗ Failed to load traditional anh role')
			return false
		}
		console.log(`✓ Traditional anh role loaded successfully`)
		console.log(`  - Description: ${fullAnhRole.description}`)
		console.log(`  - Personality: ${fullAnhRole.personality}`)
		console.log(`  - Greeting: ${fullAnhRole.greeting}`)
		
		// 加载SillyTavern角色
		const fullSillyTavernRole = await roleRegistry.loadRole(sillyTavernRoleFound.uuid)
		if (!fullSillyTavernRole) {
			console.log('✗ Failed to load SillyTavern role')
			return false
		}
		console.log(`✓ SillyTavern role loaded successfully`)
		console.log(`  - Description: ${fullSillyTavernRole.description}`)
		console.log(`  - Personality: ${fullSillyTavernRole.personality}`)
		console.log(`  - Greeting: ${fullSillyTavernRole.greeting}`)
		
		console.log('\n✓ All tests passed! Both anh and SillyTavern roles work correctly.')
		return true
		
	} catch (error) {
		console.error('✗ Test failed with error:', error)
		return false
	} finally {
		// 清理测试文件
		console.log('\n4. Cleaning up test files...')
		if (fs.existsSync(testDir)) {
			fs.rmSync(testDir, { recursive: true, force: true })
		}
		console.log('✓ Test files cleaned up')
	}
}

// 运行测试
testComprehensiveRoleLoading().then(success => {
	console.log('\n=== Comprehensive Test Complete ===')
	if (success) {
		console.log('🎉 All role loading functionality works correctly!')
	} else {
		console.log('❌ Some tests failed. Please check the output above.')
		process.exit(1)
	}
}).catch(error => {
	console.error('Test execution failed:', error)
	process.exit(1)
})