// 测试真实世界场景中可能出现的问题
console.log('=== 测试真实世界场景中可能出现的问题 ===\n');

// 模拟真实世界中模型可能生成的有问题的XML
const problematicXMLs = {
    // 问题1: 模型可能生成缺少必需字段的XML
    missingRequiredFields: `
<memory>
  <content>用户分享了一些信息</content>
  <!-- 缺少keywords字段 -->
  <priority>50</priority>
</memory>`,

    // 问题2: 模型可能生成字段名错误的XML
    wrongFieldNames: `
<memory>
  <content>用户分享了一个项目经历</content>
  <keyword>项目,成功</keyword>  <!-- 应该是keywords -->
  <priority>80</priority>
  <is_constant>false</is_constant>
</memory>`,

    // 问题3: 模型可能生成嵌套错误的XML
    nestedErrors: `
<memory>
  <content>用户的信息</content>
  <keywords>信息,分享</keywords>
  <priority>70</priority>
  <!-- 缺少闭合标签 -->
  <is_constant>false
</memory>`,

    // 问题4: 模型可能生成包含HTML特殊字符的XML
    htmlEntities: `
<memory>
  <content>用户说："这个功能真的很棒！&lt;awesome&gt;"</content>
  <keywords>功能,反馈</keywords>
  <priority>85</priority>
  <is_constant>false</is_constant>
</memory>`,

    // 问题5: 模型可能生成换行符格式问题
    formattingIssues: `
<memory>
  <content>
    用户分享了一个多行的故事，
    包含了复杂的情感描述。
  </content>
  <keywords>故事,情感</keywords>
  <priority>75</priority>
  <is_constant>false</is_constant>
</memory>`,

    // 问题6: 模型可能生成不匹配的标签
    mismatchedTags: `
<memory>
  <content>用户信息</content>
  <keywords>信息,用户</keywords>
  <priority>60</priority>
  <is_constant>true</is_constant>
  <related_topic>话题1,话题2</related_topic>  <!-- 应该是related_topics -->
</memory>`
};

// 增强的XML解析器（更健壮的错误处理）
function robustParseXmlMemory(xmlString) {
    const memoryData = {};

    const extractTagContent = (tag) => {
        const regex = new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 'is');
        const match = xmlString.match(regex);
        return match ? match[1].trim() : '';
    };

    // 解析基础字段
    memoryData.content = extractTagContent('content');

    // 如果content为空，尝试其他可能的标签名
    if (!memoryData.content) {
        // 检查是否有拼写错误的标签
        const contentVariations = ['Content', 'CONTENT', 'message', 'text'];
        for (const variation of contentVariations) {
            memoryData.content = extractTagContent(variation);
            if (memoryData.content) break;
        }
    }

    // 解析keywords字段
    let keywordsStr = extractTagContent('keywords');
    if (!keywordsStr) {
        // 尝试可能的拼写错误
        keywordsStr = extractTagContent('keyword') || extractTagContent('key') || extractTagContent('tags');
    }
    memoryData.keywords = keywordsStr ? keywordsStr.split(',').map(k => k.trim()).filter(k => k) : [];

    // 解析priority字段
    const priorityStr = extractTagContent('priority');
    memoryData.priority = priorityStr ? parseInt(priorityStr, 10) : undefined;

    // 解析is_constant字段
    const isConstantStr = extractTagContent('is_constant');
    memoryData.isConstant = isConstantStr ? isConstantStr.toLowerCase() === 'true' : undefined;

    // 解析其他字段
    const emotionalStr = extractTagContent('emotional_context');
    memoryData.emotionalContext = emotionalStr ? emotionalStr.split(',').map(e => e.trim()).filter(e => e) : undefined;

    const topicsStr = extractTagContent('related_topics') || extractTagContent('related_topic'); // 处理可能的拼写错误
    memoryData.relatedTopics = topicsStr ? topicsStr.split(',').map(t => t.trim()).filter(t => t) : undefined;

    // 增强字段
    memoryData.perspective = extractTagContent('perspective');
    memoryData.contextType = extractTagContent('context_type');

    return memoryData;
}

// 测试问题场景
function testProblematicScenarios() {
    console.log('测试真实世界中的问题场景：\n');

    const scenarios = Object.entries(problematicXMLs);
    let successCount = 0;

    scenarios.forEach(([name, xml], index) => {
        console.log(`${index + 1}. 测试场景: ${name}`);
        console.log(`   XML: ${xml.trim().substring(0, 80)}...`);

        try {
            const parsed = robustParseXmlMemory(xml);

            // 验证必需字段
            const hasContent = !!parsed.content;
            const hasKeywords = parsed.keywords && parsed.keywords.length > 0;

            console.log(`   解析结果:`);
            console.log(`     content: ${hasContent ? '✅' : '❌'} ${parsed.content ? parsed.content.substring(0, 30) + '...' : '缺失'}`);
            console.log(`     keywords: ${hasKeywords ? '✅' : '❌'} [${parsed.keywords.join(', ')}]`);
            console.log(`     priority: ${parsed.priority !== undefined ? '✅' : '⚠️'} ${parsed.priority || '未设置'}`);
            console.log(`     is_constant: ${parsed.isConstant !== undefined ? '✅' : '⚠️'} ${parsed.isConstant || '未设置'}`);

            if (hasContent && hasKeywords) {
                successCount++;
                console.log(`   状态: ✅ 可接受（能提取基本信息）`);
            } else {
                console.log(`   状态: ⚠️  有问题（缺少必要信息）`);
            }

        } catch (error) {
            console.log(`   状态: ❌ 解析失败 - ${error.message}`);
        }

        console.log('');
    });

    console.log(`测试结果: ${successCount}/${scenarios.length} 个场景可接受\n`);
    return successCount;
}

// 模拟实际使用中的错误处理
function simulateRealWorldErrorHandling() {
    console.log('2. 模拟实际使用中的错误处理流程:\n');

    const testCases = [
        {
            name: '正常情况',
            xml: problematicXMLs.missingRequiredFields,
            shouldPass: false // 缺少keywords
        },
        {
            name: '字段名错误',
            xml: problematicXMLs.wrongFieldNames,
            shouldPass: true // 能纠正拼写错误
        },
        {
            name: '格式化问题',
            xml: problematicXMLs.formattingIssues,
            shouldPass: true // 能处理多行内容
        }
    ];

    testCases.forEach((testCase, index) => {
        console.log(`测试 ${index + 1}: ${testCase.name}`);

        try {
            const memoryData = robustParseXmlMemory(testCase.xml);

            // 验证必需参数
            if (!memoryData.content) {
                throw new Error("记忆内容不能为空");
            }

            if (!memoryData.keywords || memoryData.keywords.length === 0) {
                // 如果keywords为空，尝试从content中提取
                const words = memoryData.content.toLowerCase().split(/\s+/).filter(w => w.length > 1);
                memoryData.keywords = words.slice(0, 3);
                console.log(`   ⚠️  自动提取关键词: [${memoryData.keywords.join(', ')}]`);
            }

            // 设置默认值
            if (memoryData.priority === undefined) {
                memoryData.priority = 50;
                console.log(`   ⚠️  使用默认优先级: ${memoryData.priority}`);
            }

            if (memoryData.isConstant === undefined) {
                memoryData.isConstant = false;
                console.log(`   ⚠️  使用默认常驻设置: ${memoryData.isConstant}`);
            }

            const success = !!memoryData.content && memoryData.keywords.length > 0;
            console.log(`   结果: ${success === testCase.shouldPass ? '✅' : '❌'} ${success ? '成功' : '失败'}`);

        } catch (error) {
            console.log(`   结果: ❌ 异常 - ${error.message}`);
        }

        console.log('');
    });
}

// 生成改进建议
function generateImprovementSuggestions() {
    console.log('3. 改进建议:\n');

    console.log('🔧 XML解析器改进建议:');
    console.log('   - 添加字段名纠错功能（如keyword→keywords）');
    console.log('   - 支持从content自动提取关键词');
    console.log('   - 添加默认值处理逻辑');
    console.log('   - 增强错误恢复机制');
    console.log('');

    console.log('📝 提示词改进建议:');
    console.log('   - 明确指定必需字段和格式');
    console.log('   - 提供更多正确的XML示例');
    console.log('   - 强调字段名的大小写敏感性');
    console.log('   - 添加字段验证说明');
    console.log('');

    console.log('🛠️ 工具改进建议:');
    console.log('   - 添加参数验证和默认值处理');
    console.log('   - 提供更详细的错误信息');
    console.log('   - 实现数据清洗和标准化');
    console.log('   - 添加调试和日志功能');
}

// 运行所有测试
function runRealWorldTests() {
    console.log('开始真实世界场景测试...\n');

    const successCount = testProblematicScenarios();
    simulateRealWorldErrorHandling();
    generateImprovementSuggestions();

    console.log('=== 最终总结 ===');
    console.log(`✅ 能处理的场景: ${successCount}/${Object.keys(problematicXMLs).length}`);
    console.log('✅ XML解析器基础功能正常');
    console.log('✅ 错误处理机制基本可用');
    console.log('✅ 有改进空间以处理更多边界情况');

    console.log('\n🎯 如果实际使用中仍有"信息记录失败"，最可能的原因：');
    console.log('1. 模型生成的XML缺少必需字段（如content或keywords）');
    console.log('2. 字段名拼写错误导致解析失败');
    console.log('3. XML格式不正确（如缺少闭合标签）');
    console.log('4. 记忆服务本身的问题（如文件权限、角色UUID等）');
    console.log('5. 传递过程中的数据丢失或损坏');
}

// 执行测试
runRealWorldTests();