/**
 * AST折叠系统测试文件
 * 验证AST系统能否正确处理各种情况，特别是半截标签问题
 */

import { createASTFoldEngine, convertBlockRulesToTagRules, demonstrateASTFolding } from './ast-fold-engine'
import { defaultBlockRules } from './fold-config'
import { Block } from '@/types/block'

/** 测试用例 */
interface TestCase {
  name: string
  input: string
  expectedBehavior: 'complete' | 'incomplete' | 'fallback'
  description: string
}

/** AST系统测试套件 */
export class ASTFoldSystemTester {
  private engine = createASTFoldEngine(convertBlockRulesToTagRules(defaultBlockRules))

  /** 运行所有测试 */
  public runAllTests(): TestResult[] {
    console.log('🚀 开始AST折叠系统测试...')
    
    const testCases = this.getTestCases()
    const results: TestResult[] = []

    for (const testCase of testCases) {
      const result = this.runSingleTest(testCase)
      results.push(result)
      console.log(`${result.passed ? '✅' : '❌'} ${testCase.name}: ${result.message}`)
    }

    this.printSummary(results)
    return results
  }

  /** 运行单个测试 */
  private runSingleTest(testCase: TestCase): TestResult {
    try {
      const result = this.engine.processText(testCase.input)

      switch (testCase.expectedBehavior) {
        case 'complete':
          if (result.hasIncompleteTags) {
            return {
              passed: false,
              message: `期望完整标签，但检测到不完整标签`,
              details: result
            }
          }
          if (!result.usedAST) {
            return {
              passed: false,
              message: `期望使用AST系统，但回退到了正则系统`,
              details: result
            }
          }
          break

        case 'incomplete':
          if (!result.hasIncompleteTags) {
            return {
              passed: false,
              message: `期望检测到不完整标签，但未检测到`,
              details: result
            }
          }
          break

        case 'fallback':
          if (result.usedAST) {
            return {
              passed: false,
              message: `期望回退到正则系统，但仍在使用AST`,
              details: result
            }
          }
          break
      }

      return {
        passed: true,
        message: `测试通过，生成${result.blocks.length}个块`,
        details: result
      }
    } catch (error) {
      return {
        passed: false,
        message: `测试失败: ${error instanceof Error ? error.message : '未知错误'}`,
        details: { error: error instanceof Error ? error.message : String(error) }
      }
    }
  }

  /** 获取测试用例 */
  private getTestCases(): TestCase[] {
    return [
      // 完整标签测试
      {
        name: '完整英文思维标签',
        input: '<thinking>这是一个完整的英文思维块</thinking>',
        expectedBehavior: 'complete',
        description: '测试基本的英文thinking标签识别'
      },
      {
        name: '完整中文思维标签',
        input: '<思考>这是一个完整的中文思维块</思考>',
        expectedBehavior: 'complete',
        description: '测试基本的中文思考标签识别'
      },
      {
        name: '完整跨语言标签',
        input: '<thinking>内容</思考>',
        expectedBehavior: 'complete',
        description: '测试跨语言标签匹配（英文开始，中文结束）'
      },
      {
        name: '完整变量标签',
        input: '<UpdateVariable>name: "test"</UpdateVariable>',
        expectedBehavior: 'complete',
        description: '测试变量标签识别'
      },

      // 不完整标签测试（关键测试）
      {
        name: '不完整的思维标签-只有开始标签',
        input: '<thinking>内容还没完成',
        expectedBehavior: 'incomplete',
        description: '测试只有开始标签的半截标签检测'
      },
      {
        name: '不完整的思维标签-只有结束标签',
        input: '</thinking>内容不应该被折叠',
        expectedBehavior: 'incomplete',
        description: '测试只有结束标签的半截标签检测'
      },
      {
        name: '不完整的跨语言标签',
        input: '<thinking>内容还没</思考>',
        expectedBehavior: 'incomplete',
        description: '测试跨语言半截标签检测'
      },
      {
        name: '不完整的变量标签',
        input: '<UpdateVariable>name: "test"',
        expectedBehavior: 'incomplete',
        description: '测试变量半截标签检测'
      },

      // 复杂场景测试
      {
        name: '混合完整和不完整标签',
        input: '<thinking>完整的标签</thinking> 前面 <thinking>不完整的标签',
        expectedBehavior: 'incomplete',
        description: '测试同时存在完整和不完整标签的情况'
      },
      {
        name: '嵌套标签',
        input: '<thinking>外层<thinking>内层</thinking></thinking>',
        expectedBehavior: 'complete',
        description: '测试嵌套标签处理'
      },
      {
        name: '代码块保护',
        input: '普通文本 ```javascript\nconst x = "<thinking>不应该被处理</thinking>"\n``` <thinking>这个应该被处理</thinking>',
        expectedBehavior: 'complete',
        description: '测试代码块保护机制'
      },

      // 边界情况测试
      {
        name: '空内容标签',
        input: '<thinking></thinking>',
        expectedBehavior: 'complete',
        description: '测试空内容标签处理'
      },
      {
        name: '只有空白字符的标签',
        input: '<thinking>   </thinking>',
        expectedBehavior: 'complete',
        description: '测试只有空白字符的标签处理'
      },
      {
        name: '无匹配标签',
        input: '普通文本没有任何特殊标签',
        expectedBehavior: 'fallback',
        description: '测试没有匹配标签时回退到正则系统'
      }
    ]
  }

  /** 打印测试总结 */
  private printSummary(results: TestResult[]): void {
    const passed = results.filter(r => r.passed).length
    const total = results.length
    
    console.log(`\n📊 测试总结: ${passed}/${total} 通过`)
    
    if (passed === total) {
      console.log('🎉 所有测试通过！AST系统工作正常。')
    } else {
      console.log('⚠️  存在失败的测试，请检查实现。')
      
      const failedTests = results.filter(r => !r.passed)
      console.log('\n失败的测试:')
      failedTests.forEach(test => {
        console.log(`  - ${test.message}`)
      })
    }
  }

  /** 演示AST系统功能 */
  public demonstrateFeatures(): void {
    console.log('\n🔍 AST系统功能演示:')
    demonstrateASTFolding()

    console.log('\n📈 流式处理演示:')
    this.demonstrateStreaming()
  }

  /** 演示流式处理 */
  private demonstrateStreaming(): void {
    const testText = '<thinking>这是一个思维块的内容</thinking>'
    
    // 模拟分片处理
    const chunks = [
      '<thinkin', // 模拟半截标签
      'g>这是一个思维块的内容</', // 完成标签
      'thinking>' // 完成
    ]

    console.log('模拟流式文本处理:')
    for (let i = 0; i < chunks.length; i++) {
      const isComplete = i === chunks.length - 1
      const result = this.engine.processStreamingText(chunks[i], isComplete)
      
      console.log(`片段 ${i + 1}: "${chunks[i]}" ${isComplete ? '(完整)' : '(部分)'}`)
      console.log(`  - 新完成标签: ${result.hasNewCompleteTags ? '是' : '否'}`)
      console.log(`  - 生成块数: ${result.blocks.length}`)
      console.log(`  - 缓冲区大小: ${result.bufferContent.length}`)
    }
  }
}

/** 测试结果类型 */
interface TestResult {
  passed: boolean
  message: string
  details: any
}

/** 快速测试函数 */
export function quickASTTest(): void {
  const tester = new ASTFoldSystemTester()
  tester.runAllTests()
  tester.demonstrateFeatures()
}

/** 性能测试 */
export function performanceTest(): void {
  console.log('\n⚡ AST系统性能测试:')
  
  const engine = createASTFoldEngine(convertBlockRulesToTagRules(defaultBlockRules))
  
  // 大文本测试
  const largeText = Array.from({ length: 100 }, (_, i) => 
    `<thinking>思维块 ${i} 的内容，包含一些文字来增大体积</thinking>\n`
  ).join('\n') + '普通文本内容'

  const startTime = performance.now()
  const result = engine.processText(largeText)
  const endTime = performance.now()

  console.log(`大文本处理 (${largeText.length} 字符):`)
  console.log(`  - 处理时间: ${(endTime - startTime).toFixed(2)}ms`)
  console.log(`  - 生成块数: ${result.blocks.length}`)
  console.log(`  - 使用AST: ${result.usedAST ? '是' : '否'}`)
  console.log(`  - 不完整标签: ${result.hasIncompleteTags ? '是' : '否'}`)

  // 流式处理测试
  console.log('\n流式处理性能测试:')
  const streamingStart = performance.now()
  
  const chunks = largeText.match(/.{1,100}/g) || []
  for (const chunk of chunks) {
    engine.processStreamingText(chunk, chunk === chunks[chunks.length - 1])
  }
  
  const streamingEnd = performance.now()
  console.log(`  - 分片数量: ${chunks.length}`)
  console.log(`  - 总处理时间: ${(streamingEnd - streamingStart).toFixed(2)}ms`)
}
