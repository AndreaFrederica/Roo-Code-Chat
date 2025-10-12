// 调试 AssistantMessageParser 的参数解析逻辑

console.log("=== 调试 AssistantMessageParser 参数解析 ===\n")

// 模拟 AssistantMessageParser 的参数识别逻辑
function simulateParameterParsing() {
    console.log("1. 模拟 toolParamNames:")
    const toolParamNames = [
        "command", "path", "content", "line_count", "regex", "file_pattern",
        "recursive", "action", "url", "coordinate", "text", "server_name",
        "tool_name", "arguments", "uri", "question", "result", "diff",
        "mode_slug", "reason", "line", "mode", "message", "cwd", "follow_up",
        "task", "size", "search", "replace", "use_regex", "ignore_case",
        "args", "start_line", "end_line", "query", "args", "todos",
        "prompt", "image", "xml_memory", "user_message", "xml_traits",
        "xml_goals", "search_text", "memory_types", "limit", "max_results",
        "max_age_days", "dry_run"
    ]
    console.log("xml_memory 在 toolParamNames 中:", toolParamNames.includes("xml_memory"))
    console.log("user_message 在 toolParamNames 中:", toolParamNames.includes("user_message"))
    console.log()

    console.log("2. 模拟参数识别过程:")
    
    // 模拟累积的文本
    let accumulator = ""
    const testXML = "<add_semantic_memory>\n<xml_memory>\n<memory>\n<content>测试内容</content>\n<keywords>测试</keywords>\n<priority>80</priority>\n</memory>\n</xml_memory>\n<user_message>我记下了这个重要的信息</user_message>\n</add_semantic_memory>"
    
    console.log("测试 XML:", testXML)
    console.log()

    // 模拟逐字符解析
    let currentToolUse = null
    let currentParamName = null
    let currentParamValueStartIndex = 0
    
    for (let i = 0; i < testXML.length; i++) {
        const char = testXML[i]
        accumulator += char
        
        // 检查是否遇到工具开始标签
        if (accumulator.endsWith("<add_semantic_memory>")) {
            console.log(`✓ 识别到工具开始: add_semantic_memory`)
            currentToolUse = {
                name: "add_semantic_memory",
                params: {},
                partial: true
            }
            currentParamValueStartIndex = accumulator.length
            continue
        }
        
        // 检查是否遇到参数开始标签
        if (currentToolUse && !currentParamName) {
            const possibleParamOpeningTags = toolParamNames.map((name) => `<${name}>`)
            for (const paramOpeningTag of possibleParamOpeningTags) {
                if (accumulator.endsWith(paramOpeningTag)) {
                    const paramName = paramOpeningTag.slice(1, -1)
                    console.log(`✓ 识别到参数开始: ${paramName}`)
                    if (!toolParamNames.includes(paramName)) {
                        console.log(`✗ 参数名 ${paramName} 不在 toolParamNames 中，跳过`)
                        continue
                    }
                    currentParamName = paramName
                    currentParamValueStartIndex = accumulator.length
                    break
                }
            }
        }
        
        // 检查是否遇到参数结束标签
        if (currentToolUse && currentParamName) {
            const paramClosingTag = `</${currentParamName}>`
            if (accumulator.endsWith(paramClosingTag)) {
                const currentParamValue = accumulator.slice(currentParamValueStartIndex)
                const paramValue = currentParamValue.slice(0, -paramClosingTag.length)
                console.log(`✓ 识别到参数结束: ${currentParamName}`)
                console.log(`  参数值: "${paramValue.trim()}"`)
                currentToolUse.params[currentParamName] = paramValue.trim()
                currentParamName = null
                continue
            }
        }
        
        // 检查是否遇到工具结束标签
        if (currentToolUse && accumulator.endsWith("</add_semantic_memory>")) {
            console.log("✓ 识别到工具结束")
            currentToolUse.partial = false
            break
        }
    }
    
    console.log()
    console.log("3. 最终解析结果:")
    console.log(JSON.stringify(currentToolUse, null, 2))
    
    if (currentToolUse && Object.keys(currentToolUse.params).length === 0) {
        console.log("❌ 参数解析失败！")
    } else {
        console.log("✅ 参数解析成功！")
    }
}

function testParameterIdentification() {
    console.log("4. 测试特定参数识别:")
    
    const testCases = [
        "<xml_memory>",
        "<user_message>",
        "<xml_memory>content</xml_memory>",
        "<user_message>message</user_message>",
        "prefix<xml_memory>",
        "prefix<xml_memory>content",
        "content</xml_memory>suffix"
    ]
    
    const toolParamNames = ["xml_memory", "user_message", "content", "path"]
    
    testCases.forEach(testCase => {
        console.log(`测试: "${testCase}"`)
        
        const possibleParamOpeningTags = toolParamNames.map((name) => `<${name}>`)
        let foundParam = null
        
        for (const paramOpeningTag of possibleParamOpeningTags) {
            if (testCase.endsWith(paramOpeningTag)) {
                const paramName = paramOpeningTag.slice(1, -1)
                console.log(`  ✓ 匹配到参数: ${paramName}`)
                foundParam = paramName
                break
            }
        }
        
        if (!foundParam) {
            console.log(`  ✗ 未匹配到任何参数`)
        }
    })
}

function analyzePartialState() {
    console.log()
    console.log("5. 分析 partial 状态:")
    console.log("- 如果工具调用没有正确关闭，partial 会保持 true")
    console.log("- 如果参数没有被正确识别，params 会保持为空对象")
    console.log("- 这会导致 presentAssistantMessage 认为工具调用还没有完成")
    console.log("- 实际的调用数据: { type: 'tool_use', name: 'add_semantic_memory', params: {}, partial: true }")
    console.log()
    console.log("可能的原因:")
    console.log("1. XML 格式问题 - 标签没有正确闭合")
    console.log("2. 参数识别问题 - 解析器没有识别到参数开始")
    console.log("3. 流式解析问题 - 在流式传输中参数被截断")
    console.log("4. 字符编码问题 - 特殊字符影响解析")
}

simulateParameterParsing()
testParameterIdentification()
analyzePartialState()

console.log()
console.log("6. 建议的调试步骤:")
console.log("- 在 AssistantMessageParser.processChunk 中添加详细日志")
console.log("- 检查 AI 模型生成的原始 XML 内容")
console.log("- 验证参数识别逻辑是否正确匹配标签")
console.log("- 确认流式传输不会导致 XML 标签被分割")
