/**
 * 完整的PNG角色卡和Profile集成测试
 * 测试整个流程：PNG解析 → Profile加载 → Preset注入 → 模板渲染
 */

const fs = require('fs')
const path = require('path')

// 导入所有必要的模块
const {
  processLiquidTemplateVariables,
  parseCompileAndInjectPresetWithLiquidTemplates,
  validateSTPreset
} = require('../../packages/types/dist/index.cjs')

const { SillyTavernParser } = require('./sillytavern-parser')

class CompleteIntegrationTester {
  constructor() {
    this.projectRoot = process.cwd()
    this.rolesPath = path.join(this.projectRoot, 'novel-helper/.anh-chat/roles')
    this.profilePath = path.join(this.projectRoot, 'novel-helper/.anh-chat/profile/GrayWill-0.36-ex (2).json')
    this.testResults = []
  }

  // 记录测试结果
  logResult(testName, success, details = {}) {
    const result = {
      testName,
      success,
      timestamp: new Date().toISOString(),
      ...details
    }
    this.testResults.push(result)

    const status = success ? '✅' : '❌'
    console.log(`${status} ${testName}`)
    if (details.error) {
      console.log(`   错误: ${details.error}`)
    }
    if (details.duration) {
      console.log(`   耗时: ${details.duration}ms`)
    }
  }

  // 测试1: PNG角色卡解析
  async testPNGParsing() {
    console.log('\n🔍 测试1: PNG角色卡解析')

    const startTime = Date.now()
    const pngFiles = [
      '灰风 (1).png',
      '舰娘与指挥官的蔚蓝世界 v1.1.png'
    ]

    const results = []

    for (const filename of pngFiles) {
      const pngPath = path.join(this.rolesPath, filename)

      if (!fs.existsSync(pngPath)) {
        this.logResult(`PNG文件存在检查 - ${filename}`, false, {
          error: '文件不存在'
        })
        continue
      }

      try {
        const parseResult = await SillyTavernParser.parseFromPngFile(pngPath)

        if (parseResult.success && parseResult.role) {
          const role = parseResult.role
          console.log(`   ✅ ${filename}: ${role.name} (${role.description?.substring(0, 50)}...)`)

          results.push({
            filename,
            name: role.name,
            description: role.description,
            personality: role.personality,
            scenario: role.scenario,
            first_mes: role.first_mes,
            mes_example: role.mes_example ? '存在' : '不存在'
          })

          this.logResult(`PNG解析 - ${filename}`, true, {
            details: `角色: ${role.name}`
          })
        } else {
          this.logResult(`PNG解析 - ${filename}`, false, {
            error: parseResult.error || '解析失败'
          })
        }
      } catch (error) {
        this.logResult(`PNG解析 - ${filename}`, false, {
          error: error.message
        })
      }
    }

    const duration = Date.now() - startTime
    this.logResult('PNG解析总览', results.length > 0, {
      success: results.length,
      total: pngFiles.length,
      duration
    })

    return results
  }

  // 测试2: Profile数据加载和验证
  async testProfileLoading() {
    console.log('\n🔍 测试2: Profile数据加载和验证')

    const startTime = Date.now()

    try {
      if (!fs.existsSync(this.profilePath)) {
        this.logResult('Profile文件存在检查', false, {
          error: 'Profile文件不存在'
        })
        return null
      }

      const profileData = JSON.parse(fs.readFileSync(this.profilePath, 'utf-8'))

      console.log(`   ✅ Profile加载成功`)
      console.log(`   📊 包含 ${profileData.prompts?.length || 0} 个prompts`)
      console.log(`   📊 包含 ${Object.keys(profileData.extensions || {}).length} 个扩展`)

      // 检查prompts结构
      const prompts = profileData.prompts || []
      const enabledPrompts = prompts.filter(p => p.enabled)

      console.log(`   📊 启用的prompts: ${enabledPrompts.length} 个`)

      // 检查每个prompt的结构
      enabledPrompts.forEach((prompt, index) => {
        console.log(`   ${index + 1}. ${prompt.name || '未命名'} (${prompt.identifier})`)
      })

      this.logResult('Profile数据验证', true, {
        totalPrompts: prompts.length,
        enabledPrompts: enabledPrompts.length
      })

      const duration = Date.now() - startTime
      this.logResult('Profile加载完成', true, { duration })

      return profileData

    } catch (error) {
      this.logResult('Profile加载失败', false, {
        error: error.message
      })
      return null
    }
  }

  // 测试3: ST Preset验证
  async testSTPresetValidation(profileData) {
    console.log('\n🔍 测试3: ST Preset验证')

    const startTime = Date.now()

    if (!profileData || !profileData.prompts) {
      this.logResult('Preset验证准备', false, {
        error: 'Profile数据无效'
      })
      return []
    }

    const validationResults = []
    const validPresets = []

    // 验证每个prompt
    for (let i = 0; i < profileData.prompts.length; i++) {
      const prompt = profileData.prompts[i]

      if (!prompt.enabled) {
        console.log(`   ⏭️ 跳过禁用的preset: ${prompt.name || prompt.identifier}`)
        continue
      }

      const validationResult = validateSTPreset(prompt)

      if (validationResult.isValid) {
        console.log(`   ✅ 有效preset: ${prompt.name || prompt.identifier}`)
        validPresets.push(prompt)
      } else {
        console.log(`   ❌ 无效preset: ${prompt.name || prompt.identifier}`)
        console.log(`      错误: ${validationResult.errors.join(', ')}`)
      }

      validationResults.push({
        presetName: prompt.name || prompt.identifier,
        isValid: validationResult.isValid,
        errors: validationResult.errors
      })
    }

    const duration = Date.now() - startTime
    this.logResult('Preset验证完成', validPresets.length > 0, {
      validCount: validPresets.length,
      totalCount: profileData.prompts.length,
      duration
    })

    return { validPresets, validationResults }
  }

  // 测试4: 模板变量处理
  async testTemplateProcessing() {
    console.log('\n🔍 测试4: 模板变量处理')

    const startTime = Date.now()

    // 测试各种模板场景
    const testCases = [
      {
        name: '基础变量替换',
        template: '你好，{{user}}！今天是{{isodate}}。',
        variables: { user: '测试用户', isodate: '2025-10-10' },
        expected: '你好，测试用户！今天是2025-10-10。'
      },
      {
        name: '条件语句',
        template: '{% if user == "admin" %}管理员{% else %}普通用户{% endif %}',
        variables: { user: 'admin' },
        expected: '管理员'
      },
      {
        name: '循环处理',
        template: '{% for item in items %}{{item}} {% endfor %}',
        variables: { items: ['A', 'B', 'C'] },
        expected: 'A B C '
      },
      {
        name: '复杂嵌套模板',
        template: '{{user}}的设定：{% if char %}角色是{{char}}{% endif %}，日期{{isodate}}',
        variables: { user: '玩家', char: '灰风', isodate: '2025-10-10' },
        expected: '玩家的设定：角色是灰风，日期2025-10-10'
      }
    ]

    const results = []

    for (const testCase of testCases) {
      try {
        const result = processLiquidTemplateVariables(testCase.template, testCase.variables)
        const success = result.processedText === testCase.expected

        console.log(`   ${success ? '✅' : '❌'} ${testCase.name}`)
        if (!success) {
          console.log(`      期望: ${testCase.expected}`)
          console.log(`      实际: ${result.processedText}`)
        }

        results.push({
          name: testCase.name,
          success,
          template: testCase.template,
          result: result.processedText,
          expected: testCase.expected
        })

      } catch (error) {
        console.log(`   ❌ ${testCase.name}: ${error.message}`)
        results.push({
          name: testCase.name,
          success: false,
          error: error.message
        })
      }
    }

    const duration = Date.now() - startTime
    const successCount = results.filter(r => r.success).length

    this.logResult('模板处理测试', successCount === testCases.length, {
      success: successCount,
      total: testCases.length,
      duration
    })

    return results
  }

  // 测试5: 端到端集成
  async testEndToEndIntegration(parsedRoles, profileData) {
    console.log('\n🔍 测试5: 端到端集成测试')

    const startTime = Date.now()

    if (!parsedRoles.length || !profileData) {
      this.logResult('端到端集成准备', false, {
        error: '缺少必要数据'
      })
      return
    }

    // 选择第一个角色进行测试
    const testRole = parsedRoles[0]
    console.log(`   🎭 使用角色: ${testRole.name}`)

    // 准备模板变量
    const templateVariables = {
      user: '测试用户',
      char: testRole.name,
      isodate: new Date().toISOString().split('T')[0],
      isotime: new Date().toTimeString().split(' ')[0],
      idle_duration: '5分钟'
    }

    console.log(`   📝 模板变量: ${JSON.stringify(templateVariables, null, 2)}`)

    // 测试每个有效的preset
    const validPresets = profileData.prompts.filter(p => p.enabled)
    const integrationResults = []

    for (const preset of validPresets) {
      try {
        console.log(`   🔧 处理preset: ${preset.name || preset.identifier}`)

        const injectionResult = parseCompileAndInjectPresetWithLiquidTemplates(
          testRole,
          preset,
          templateVariables,
          {
            enableTemplateProcessing: true,
            preserveOriginalContent: true
          }
        )

        if (injectionResult.success) {
          const injectedRole = injectionResult.role

          // 统计处理结果
          const originalSystemPrompt = testRole.system_prompt || ''
          const newSystemPrompt = injectedRole.system_prompt || ''

          console.log(`     ✅ 注入成功`)
          console.log(`     📊 系统提示长度: ${originalSystemPrompt.length} → ${newSystemPrompt.length}`)

          // 检查模板变量是否被正确处理
          const remainingTemplates = newSystemPrompt.match(/\{\{[^}]+\}\}/g) || []
          console.log(`     🔍 剩余未处理模板: ${remainingTemplates.length} 个`)

          if (remainingTemplates.length > 0) {
            console.log(`     ⚠️ 剩余模板: ${remainingTemplates.slice(0, 3).join(', ')}...`)
          }

          integrationResults.push({
            presetName: preset.name || preset.identifier,
            success: true,
            originalLength: originalSystemPrompt.length,
            newLength: newSystemPrompt.length,
            remainingTemplates: remainingTemplates.length,
            extensions: injectedRole.extensions
          })
        } else {
          console.log(`     ❌ 注入失败: ${injectionResult.error}`)
          integrationResults.push({
            presetName: preset.name || preset.identifier,
            success: false,
            error: injectionResult.error
          })
        }
      } catch (error) {
        console.log(`     ❌ 处理失败: ${error.message}`)
        integrationResults.push({
          presetName: preset.name || preset.identifier,
          success: false,
          error: error.message
        })
      }
    }

    const duration = Date.now() - startTime
    const successCount = integrationResults.filter(r => r.success).length

    this.logResult('端到端集成测试', successCount > 0, {
      success: successCount,
      total: validPresets.length,
      duration
    })

    return integrationResults
  }

  // 运行所有测试
  async runAllTests() {
    console.log('🚀 开始完整集成测试')
    console.log('=' * 60)

    const totalStartTime = Date.now()

    try {
      // 1. PNG角色卡解析
      const parsedRoles = await this.testPNGParsing()

      // 2. Profile数据加载
      const profileData = await this.testProfileLoading()

      // 3. ST Preset验证
      const presetValidation = await this.testSTPresetValidation(profileData)

      // 4. 模板变量处理
      const templateTests = await this.testTemplateProcessing()

      // 5. 端到端集成
      const integrationResults = await this.testEndToEndIntegration(parsedRoles, profileData)

      const totalDuration = Date.now() - totalStartTime

      // 生成总结报告
      this.generateSummaryReport({
        parsedRoles,
        profileData,
        presetValidation,
        templateTests,
        integrationResults,
        totalDuration
      })

    } catch (error) {
      console.error('❌ 集成测试过程中发生错误:', error)
      this.logResult('集成测试过程', false, { error: error.message })
    }
  }

  // 生成总结报告
  generateSummaryReport(results) {
    console.log('\n' + '=' * 60)
    console.log('📊 集成测试总结报告')
    console.log('=' * 60)

    const totalTests = this.testResults.length
    const successfulTests = this.testResults.filter(r => r.success).length
    const successRate = ((successfulTests / totalTests) * 100).toFixed(1)

    console.log(`\n📈 测试概览:`)
    console.log(`   总测试数: ${totalTests}`)
    console.log(`   成功测试: ${successfulTests}`)
    console.log(`   失败测试: ${totalTests - successfulTests}`)
    console.log(`   成功率: ${successRate}%`)
    console.log(`   总耗时: ${results.totalDuration}ms`)

    console.log(`\n📋 详细结果:`)
    this.testResults.forEach(result => {
      const status = result.success ? '✅' : '❌'
      console.log(`   ${status} ${result.testName}`)
      if (result.details) {
        console.log(`      ${JSON.stringify(result.details)}`)
      }
    })

    console.log(`\n🎭 角色卡解析:`)
    results.parsedRoles.forEach(role => {
      console.log(`   ✅ ${role.name}: ${role.description?.substring(0, 30)}...`)
    })

    console.log(`\n🔧 Preset注入结果:`)
    results.integrationResults.forEach(result => {
      const status = result.success ? '✅' : '❌'
      console.log(`   ${status} ${result.presetName}`)
      if (result.success) {
        console.log(`      系统提示: ${result.originalLength} → ${result.newLength} 字符`)
        if (result.remainingTemplates > 0) {
          console.log(`      ⚠️ 剩余模板: ${result.remainingTemplates} 个`)
        }
      } else {
        console.log(`      ❌ 错误: ${result.error}`)
      }
    })

    // 保存报告到文件
    this.saveReportToFile({
      summary: {
        totalTests,
        successfulTests,
        successRate,
        totalDuration: results.totalDuration
      },
      details: this.testResults,
      data: results
    })

    console.log(`\n🎉 集成测试完成！`)
    console.log(`📄 详细报告已保存到: complete-integration-test-report.md`)
  }

  // 保存报告到文件
  saveReportToFile(data) {
    const reportContent = `# 完整集成测试报告

## 生成时间
${new Date().toISOString()}

## 测试概览
- 总测试数: ${data.summary.totalTests}
- 成功测试: ${data.summary.successfulTests}
- 失败测试: ${data.summary.totalTests - data.summary.successfulTests}
- 成功率: ${data.summary.successRate}%
- 总耗时: ${data.summary.totalDuration}ms

## 详细测试结果

${data.details.map(test => `
### ${test.testName}
- 状态: ${test.success ? '✅ 成功' : '❌ 失败'}
- 时间: ${test.timestamp}
${test.details ? `- 详情: ${JSON.stringify(test.details, null, 2)}` : ''}
${test.error ? `- 错误: ${test.error}` : ''}
`).join('\n')}

## 数据统计

### 角色卡解析
${data.data.parsedRoles.map(role => `- **${role.name}**: ${role.description?.substring(0, 50)}...`).join('\n')}

### Profile数据
- Prompts总数: ${data.data.profileData?.prompts?.length || 0}
- 启用的Prompts: ${data.data.profileData?.prompts?.filter(p => p.enabled).length || 0}

### Preset注入结果
${data.data.integrationResults.map(result => `
#### ${result.presetName}
- 状态: ${result.success ? '✅ 成功' : '❌ 失败'}
${result.success ? `- 系统提示长度变化: ${result.originalLength} → ${result.newLength}` : ''}
${result.success && result.remainingTemplates > 0 ? `- 剩余未处理模板: ${result.remainingTemplates} 个` : ''}
${result.error ? `- 错误: ${result.error}` : ''}
`).join('\n')}

## 结论

${data.summary.successRate === '100.0' ? '🎉 所有测试都通过了！系统已准备就绪。' : `⚠️ 有 ${data.summary.totalTests - data.summary.successfulTests} 个测试失败，需要进一步检查。`}
`

    const reportPath = path.join(this.projectRoot, 'complete-integration-test-report.md')
    fs.writeFileSync(reportPath, reportContent, 'utf-8')
  }
}

// 运行测试
async function runCompleteIntegrationTest() {
  const tester = new CompleteIntegrationTester()
  await tester.runAllTests()
}

// 如果直接运行此文件
if (require.main === module) {
  runCompleteIntegrationTest().catch(console.error)
}

module.exports = { CompleteIntegrationTester }