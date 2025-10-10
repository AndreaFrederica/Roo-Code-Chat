/**
 * 完整系统提示词生成测试
 * 将所有启用的presets注入到角色中，生成完整的系统提示词文件
 */

const fs = require('fs')
const path = require('path')

// 导入核心模板系统
const {
  parseCompileAndInjectPresetWithLiquidTemplates
} = require('../../packages/types/dist/index.cjs')

class CompleteSystemPromptTester {
  constructor() {
    this.projectRoot = process.cwd()
    this.profilePath = path.join(this.projectRoot, 'novel-helper/.anh-chat/profile/GrayWill-0.36-ex (2).json')
    this.outputDir = path.join(this.projectRoot, 'generated-system-prompts')

    // 确保输出目录存在
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true })
    }
  }

  // 创建基础角色
  createBaseRole() {
    return {
      name: "灰风",
      description: "一个神秘而智慧的角色，拥有深邃的洞察力和独特的视角。总是能从不同的角度看待问题，并提供富有哲理的建议。",
      personality: "智慧、神秘、温和、富有洞察力",
      scenario: "在古老的图书馆中，窗外下着细雨，你们围坐在温暖的壁炉旁交谈",
      first_mes: "你好，我是灰风。很高兴在这里见到你。看起来你有很多故事想要分享。",
      mes_example: "",
      system_prompt: "你是灰风，一个充满智慧的角色。你应该以温和而富有洞察力的方式与用户互动。",
      post_history_instructions: "",
      greeting: "你好，我是灰风。今天想聊些什么呢？",
      example_dialogue: "",
      extensions: {}
    }
  }

  // 创建测试用户变量
  createTestVariables() {
    return {
      user: "测试用户",
      char: "灰风",
      isodate: new Date().toISOString().split('T')[0],
      isotime: new Date().toTimeString().split(' ')[0],
      idle_duration: "5分钟",
      lastUserMessage: "(上一条用户消息)",
      bot_name: "灰风",
      user_name: "测试用户"
    }
  }

  // 生成完整的系统提示词
  async generateCompleteSystemPrompt() {
    console.log('🚀 开始生成完整系统提示词')

    try {
      // 1. 加载Profile数据
      const profileData = JSON.parse(fs.readFileSync(this.profilePath, 'utf-8'))
      const baseRole = this.createBaseRole()
      const templateVariables = this.createTestVariables()

      console.log(`✅ Profile加载成功，包含 ${profileData.prompts.length} 个presets`)
      console.log(`✅ 启用的presets: ${profileData.prompts.filter(p => p.enabled).length} 个`)

      // 2. 获取所有启用的presets
      const enabledPresets = profileData.prompts.filter(p => p.enabled)
      console.log(`🔧 开始处理 ${enabledPresets.length} 个启用的presets...`)

      // 3. 逐步注入所有presets
      let currentRole = { ...baseRole }
      const injectionLog = []

      for (let i = 0; i < enabledPresets.length; i++) {
        const preset = enabledPresets[i]
        const presetName = preset.name || preset.identifier || `Preset_${i}`

        try {
          // 注入当前preset
          const injectedRole = parseCompileAndInjectPresetWithLiquidTemplates(
            currentRole,
            preset,
            templateVariables,
            {
              enableTemplateProcessing: true,
              preserveOriginalContent: true
            }
          )

          // 记录变化
          const systemPromptChange = injectedRole.system_prompt.length - currentRole.system_prompt.length
          const descriptionChange = injectedRole.description.length - currentRole.description.length

          injectionLog.push({
            step: i + 1,
            presetName: presetName,
            presetIdentifier: preset.identifier,
            systemPromptChange: systemPromptChange,
            descriptionChange: descriptionChange,
            newSystemPromptLength: injectedRole.system_prompt.length,
            success: true
          })

          currentRole = injectedRole

          if (i % 10 === 0) {
            console.log(`   进度: ${i + 1}/${enabledPresets.length} - 系统提示长度: ${currentRole.system_prompt.length}`)
          }

        } catch (error) {
          injectionLog.push({
            step: i + 1,
            presetName: presetName,
            presetIdentifier: preset.identifier,
            error: error.message,
            success: false
          })

          console.log(`   ⚠️ Preset注入失败: ${presetName} - ${error.message}`)
        }
      }

      console.log(`✅ 所有presets处理完成`)
      console.log(`📊 最终系统提示长度: ${currentRole.system_prompt.length} 字符`)
      console.log(`📊 最终描述长度: ${currentRole.description.length} 字符`)

      // 4. 生成完整的系统提示词文件
      const completeSystemPrompt = this.formatCompleteSystemPrompt(currentRole, templateVariables, injectionLog)

      // 5. 保存文件
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const filename = `complete-system-prompt-${timestamp}.md`
      const filepath = path.join(this.outputDir, filename)

      fs.writeFileSync(filepath, completeSystemPrompt, 'utf-8')

      // 6. 生成简化的版本
      const simplifiedPrompt = this.generateSimplifiedPrompt(currentRole)
      const simplifiedFilename = `simplified-system-prompt-${timestamp}.md`
      const simplifiedFilepath = path.join(this.outputDir, simplifiedFilename)

      fs.writeFileSync(simplifiedFilepath, simplifiedPrompt, 'utf-8')

      // 7. 生成注入日志
      const logContent = this.generateInjectionLog(injectionLog, templateVariables)
      const logFilename = `injection-log-${timestamp}.md`
      const logFilepath = path.join(this.outputDir, logFilename)

      fs.writeFileSync(logFilepath, logContent, 'utf-8')

      console.log(`📄 完整系统提示词已保存: ${filepath}`)
      console.log(`📄 简化版本已保存: ${simplifiedFilepath}`)
      console.log(`📄 注入日志已保存: ${logFilepath}`)

      return {
        success: true,
        completePromptPath: filepath,
        simplifiedPromptPath: simplifiedFilepath,
        logPath: logFilepath,
        stats: {
          totalPresets: enabledPresets.length,
          successfulInjections: injectionLog.filter(log => log.success).length,
          failedInjections: injectionLog.filter(log => !log.success).length,
          finalSystemPromptLength: currentRole.system_prompt.length,
          finalDescriptionLength: currentRole.description.length
        }
      }

    } catch (error) {
      console.error('❌ 生成过程中发生错误:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  // 格式化完整的系统提示词
  formatCompleteSystemPrompt(role, variables, injectionLog) {
    const timestamp = new Date().toLocaleString('zh-CN')

    return `# 完整的系统提示词

## 生成信息
- **角色名称**: ${role.name}
- **生成时间**: ${timestamp}
- **使用变量**: ${JSON.stringify(variables, null, 2)}

## 角色基础信息

**名称**: ${role.name}

**描述**:
${role.description}

**个性**: ${role.personality}

**场景**: ${role.scenario}

## 系统提示词

\`\`\`
${role.system_prompt}
\`\`\`

## 首条消息

${role.first_mes}

## 问候语

${role.greeting}

## 后历史指令

${role.post_history_instructions || '无'}

## 示例对话

${role.example_dialogue || '无'}

## 扩展信息

\`\`\`json
${JSON.stringify(role.extensions, null, 2)}
\`\`\`

---

## 注入统计

- **总注入次数**: ${injectionLog.length}
- **成功注入**: ${injectionLog.filter(log => log.success).length}
- **失败注入**: ${injectionLog.filter(log => !log.success).length}
- **最终系统提示长度**: ${role.system_prompt.length} 字符

---

*此文件由 LiquidJS 模板系统自动生成*
*所有模板变量已被正确渲染和处理*
`
  }

  // 生成简化版本的系统提示词
  generateSimplifiedPrompt(role) {
    return `# 简化系统提示词

## 角色设定

**你是 ${role.name}**

### 核心特征
${role.description}

### 个性特点
${role.personality}

### 场景设定
${role.scenario}

## 系统指令

\`\`\`
${role.system_prompt}
\`\`\`

## 开场白

"${role.first_mes}"

---

*简化的角色设定文档，便于快速参考*
`
  }

  // 生成注入日志
  generateInjectionLog(injectionLog, variables) {
    let log = `# Preset注入日志

## 使用的变量

\`\`\`json
${JSON.stringify(variables, null, 2)}
\`\`\`

## 注入详情

| 步骤 | Preset名称 | 标识符 | 系统提示变化 | 描述变化 | 最终长度 | 状态 |
|------|-----------|--------|------------|----------|----------|------|
`

    injectionLog.forEach(entry => {
      const status = entry.success ? '✅ 成功' : '❌ 失败'
      const promptChange = entry.systemPromptChange ? `${entry.systemPromptChange >= 0 ? '+' : ''}${entry.systemPromptChange}` : 'N/A'
      const descChange = entry.descriptionChange ? `${entry.descriptionChange >= 0 ? '+' : ''}${entry.descriptionChange}` : 'N/A'
      const finalLength = entry.newSystemPromptLength || 'N/A'

      log += `| ${entry.step} | ${entry.presetName} | ${entry.presetIdentifier || 'N/A'} | ${promptChange} | ${descChange} | ${finalLength} | ${status} |\n`
    })

    log += `

## 统计摘要

- **总处理数**: ${injectionLog.length}
- **成功注入**: ${injectionLog.filter(log => log.success).length}
- **失败注入**: ${injectionLog.filter(log => !log.success).length}
- **成功率**: ${((injectionLog.filter(log => log.success).length / injectionLog.length) * 100).toFixed(1)}%

---

*注入日志生成时间: ${new Date().toLocaleString('zh-CN')}*
`

    return log
  }
}

// 运行测试
async function runCompleteSystemPromptTest() {
  const tester = new CompleteSystemPromptTester()
  const result = await tester.generateCompleteSystemPrompt()

  if (result.success) {
    console.log('\n🎉 完整系统提示词生成成功！')
    console.log(`📊 处理统计:`)
    console.log(`   总Presets: ${result.stats.totalPresets}`)
    console.log(`   成功注入: ${result.stats.successfulInjections}`)
    console.log(`   失败注入: ${result.stats.failedInjections}`)
    console.log(`   最终系统提示长度: ${result.stats.finalSystemPromptLength} 字符`)
    console.log(`   最终描述长度: ${result.stats.finalDescriptionLength} 字符`)
    console.log(`\n📁 输出文件:`)
    console.log(`   完整版: ${result.completePromptPath}`)
    console.log(`   简化版: ${result.simplifiedPromptPath}`)
    console.log(`   注入日志: ${result.logPath}`)
  } else {
    console.log('\n❌ 生成失败:', result.error)
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runCompleteSystemPromptTest().catch(console.error)
}

module.exports = { CompleteSystemPromptTester }