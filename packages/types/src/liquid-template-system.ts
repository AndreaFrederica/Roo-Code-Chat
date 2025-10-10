import { Liquid } from 'liquidjs'

/**
 * 模板处理选项
 */
export interface LiquidTemplateProcessingOptions {
  /** 严格模式 - 未定义变量会抛出错误 */
  strict?: boolean
  /** 移除未处理的模板 */
  removeUnprocessed?: boolean
  /** 预定义变量 */
  variables?: Record<string, any>
  /** 保留变量定义（不移除 {{setvar::}} 等） */
  keepVariableDefinitions?: boolean
  /** 最大递归深度 */
  maxRecursionDepth?: number
  /** LiquidJS 配置选项 */
  liquidOptions?: {
    /** 是否启用严格模式 */
    strict?: boolean
    /** 自定义过滤器 */
    filters?: Record<string, (...args: any[]) => any>
    /** 自定义标签 */
    tags?: Record<string, (...args: any[]) => any>
  }
}

/**
 * 模板变量信息
 */
export interface LiquidTemplateVariable {
  name: string
  value: string
  type: 'variable' | 'output' | 'comment'
  line?: number
  source?: string
}

/**
 * 模板处理结果
 */
export interface LiquidTemplateProcessingResult {
  /** 处理后的文本 */
  processedText: string
  /** 所有找到的变量 */
  variables: LiquidTemplateVariable[]
  /** 设置的变量（通过 set 标签） */
  setVariables: Record<string, string>
  /** 使用的变量 */
  usedVariables: string[]
  /** 未处理的模板（如果有的话） */
  unprocessedTemplates: string[]
  /** 处理错误 */
  errors: string[]
  /** 警告 */
  warnings: string[]
  /** 统计信息 */
  stats: {
    totalTemplates: number
    processedTemplates: number
    variableCount: number
    outputCount: number
    commentCount: number
  }
}

/**
 * 基于 LiquidJS 的模板处理器
 */
export class LiquidTemplateProcessor {
  private liquid: Liquid
  private options: Required<LiquidTemplateProcessingOptions>
  private defaultVariables: Record<string, any>

  constructor(options: LiquidTemplateProcessingOptions = {}) {
    this.options = {
      strict: false,
      removeUnprocessed: false,
      variables: {},
      keepVariableDefinitions: false,
      maxRecursionDepth: 10,
      liquidOptions: {
        strict: false,
        filters: {},
        tags: {}
      },
      ...options
    }

    // 初始化 LiquidJS 引擎
    this.liquid = new Liquid()

    // 设置默认变量
    this.defaultVariables = this.createDefaultVariables()

    // 合并用户变量
    const allVariables = { ...this.defaultVariables, ...this.options.variables }

    // 添加变量到 LiquidJS 上下文
    this.setupLiquidVariables(allVariables)
  }

  /**
   * 创建默认变量
   */
  private createDefaultVariables(): Record<string, any> {
    const now = new Date()
    return {
      user: '用户',
      char: '角色',
      isodate: now.toISOString().split('T')[0],
      isotime: now.toTimeString().split(' ')[0],
      idle_duration: '5分钟',
      lastUserMessage: '(上一条消息)'
    }
  }

  /**
   * 设置 LiquidJS 变量和过滤器
   */
  private setupLiquidVariables(variables: Record<string, any>): void {
    // 添加自定义过滤器
    this.liquid.registerFilter('date', (value: string | Date, format = 'YYYY-MM-DD') => {
      if (typeof value === 'string') {
        value = new Date(value)
      }
      // 简单的日期格式化
      if (format === 'YYYY-MM-DD') {
        return value.toISOString().split('T')[0]
      }
      return value.toString()
    })

    this.liquid.registerFilter('time', (value: string | Date) => {
      if (typeof value === 'string') {
        value = new Date(value)
      }
      return value.toTimeString().split(' ')[0]
    })
  }

  /**
   * 处理文本中的模板变量
   */
  async processText(text: string): Promise<LiquidTemplateProcessingResult> {
    const result: LiquidTemplateProcessingResult = {
      processedText: text,
      variables: [],
      setVariables: {},
      usedVariables: [],
      unprocessedTemplates: [],
      errors: [],
      warnings: [],
      stats: {
        totalTemplates: 0,
        processedTemplates: 0,
        variableCount: 0,
        outputCount: 0,
        commentCount: 0
      }
    }

    try {
      // 第一步：解析模板
      const parsedTemplate = await this.parseTemplate(text, result)

      // 第二步：处理变量设置
      await this.processVariableAssignments(parsedTemplate, result)

      // 第三步：渲染模板
      result.processedText = await this.renderTemplate(parsedTemplate, result)

    } catch (error) {
      result.errors.push(`处理过程中发生错误: ${error instanceof Error ? error.message : String(error)}`)
    }

    return result
  }

  /**
   * 同步版本的处理方法
   */
  processTextSync(text: string): LiquidTemplateProcessingResult {
    const result: LiquidTemplateProcessingResult = {
      processedText: text,
      variables: [],
      setVariables: {},
      usedVariables: [],
      unprocessedTemplates: [],
      errors: [],
      warnings: [],
      stats: {
        totalTemplates: 0,
        processedTemplates: 0,
        variableCount: 0,
        outputCount: 0,
        commentCount: 0
      }
    }

    try {
      // 预处理：将自定义语法转换为 LiquidJS 语法
      const preprocessedText = this.preprocessText(text)

      // 收集模板信息
      this.collectTemplateInfo(preprocessedText, result)

      // 合并所有变量
      const allVariables = {
        ...this.defaultVariables,
        ...this.options.variables,
        ...result.setVariables
      }

      // 渲染模板
      let rendered = this.liquid.parseAndRenderSync(preprocessedText, allVariables)

      // 如果需要保留变量定义，则恢复原始的 {{setvar::}} 语法
      if (this.options.keepVariableDefinitions) {
        rendered = this.restoreVariableDefinitions(rendered, result.setVariables)
      }

      result.processedText = rendered

      // 后处理：清理未处理的模板（如果需要）
      if (this.options.removeUnprocessed) {
        result.processedText = this.removeUnprocessedTemplates(result.processedText, result)
      }

    } catch (error) {
      result.errors.push(`处理过程中发生错误: ${error instanceof Error ? error.message : String(error)}`)
    }

    return result
  }

  /**
   * 预处理文本：将自定义语法转换为 LiquidJS 语法
   */
  private preprocessText(text: string): string {
    let processed = text

    // 转换 {{setvar::name::value}} 为 {% assign name = value %}
    // 支持多行内容和特殊字符的更安全的处理方式
    processed = processed.replace(
      /\{\{setvar::([^:]+)::\s*([\s\S]*?)\s*\}\}/g,
      (match, name, value) => {
        // 处理空值
        if (!value || value.trim() === '') {
          value = '""'
        } else {
          // 保持原始内容，只做必要的转义
          value = value.replace(/"/g, '\\"') // 转义引号
          value = `"${value}"` // 始终用引号包围以确保安全
        }
        return `{% assign ${name.trim()} = ${value} %}`
      }
    )

    // 转换 {{getvar::name}} 为 {{ name }}
    processed = processed.replace(
      /\{\{getvar::([^}]+)\}\}/g,
      '{{ $1 }}'
    )

    // 转换注释 {{// comment}} 为 {% comment %}comment{% endcomment %}
    processed = processed.replace(
      /\{\{\/\/([^}]*)\}\}/g,
      '{% comment %}$1{% endcomment %}'
    )

    return processed
  }

  /**
   * 收集模板信息
   */
  private collectTemplateInfo(text: string, result: LiquidTemplateProcessingResult): void {
    // 匹配变量输出 {{ variable }}
    const variableMatches = text.matchAll(/\{\{([^}]+)\}\}/g)
    for (const match of variableMatches) {
      const content = match[1]?.trim()
      if (content && !content.startsWith('%') && !content.startsWith('#')) {
        result.variables.push({
          name: content,
          value: '',
          type: 'variable',
          line: this.getLineNumber(text, match.index || 0),
          source: match[0]
        })
        result.stats.variableCount++
        result.stats.totalTemplates++
      }
    }

    // 匹配标签 {% tag %}
    const tagMatches = text.matchAll(/\{%([^%]+)%\}/g)
    for (const match of tagMatches) {
      const content = match[1]?.trim()
      if (content) {
        if (content.startsWith('assign')) {
          // 变量赋值
          const assignMatch = content.match(/assign\s+([^=\s]+)\s+=\s+(.+)/)
          if (assignMatch) {
            const [, name, value] = assignMatch
            if (name && value) {
              result.setVariables[name.trim()] = value.trim().replace(/^["']|["']$/g, '')
              result.variables.push({
                name: name.trim(),
                value: value.trim(),
                type: 'variable',
                line: this.getLineNumber(text, match.index || 0),
                source: match[0]
              })
              result.stats.processedTemplates++
            }
          }
        } else if (content.startsWith('comment')) {
          result.stats.commentCount++
        }
        result.stats.totalTemplates++
      }
    }
  }

  /**
   * 移除未处理的模板
   */
  private removeUnprocessedTemplates(text: string, result: LiquidTemplateProcessingResult): string {
    let processed = text

    // 移除未处理的变量
    processed = processed.replace(/\{\{[^}]+\}\}/g, (match) => {
      result.unprocessedTemplates.push(match)
      return ''
    })

    // 移除未处理的标签
    processed = processed.replace(/\{%[^%]+%\}/g, (match) => {
      if (!match.includes('endcomment')) {
        result.unprocessedTemplates.push(match)
        return ''
      }
      return match
    })

    return processed
  }

  /**
   * 异步解析模板（保留接口，目前主要使用同步版本）
   */
  private async parseTemplate(text: string, result: LiquidTemplateProcessingResult): Promise<string> {
    return this.preprocessText(text)
  }

  /**
   * 处理变量赋值
   */
  private async processVariableAssignments(template: string, result: LiquidTemplateProcessingResult): Promise<void> {
    // 这个方法在同步版本中已经通过 collectTemplateInfo 处理
  }

  /**
   * 渲染模板
   */
  private async renderTemplate(template: string, result: LiquidTemplateProcessingResult): Promise<string> {
    const allVariables = {
      ...this.defaultVariables,
      ...this.options.variables,
      ...result.setVariables
    }

    const rendered = await this.liquid.parseAndRender(template, allVariables)

    // 如果需要保留变量定义，则恢复原始的 {{setvar::}} 语法
    if (this.options.keepVariableDefinitions) {
      return this.restoreVariableDefinitions(rendered, result.setVariables)
    }

    return rendered
  }

  /**
   * 恢复变量定义为原始 {{setvar::}} 语法
   */
  private restoreVariableDefinitions(text: string, setVariables: Record<string, string>): string {
    if (!this.options.keepVariableDefinitions) {
      return text
    }

    let result = text

    // 为每个设置的变量在开头添加 {{setvar::}} 定义
    const setvarLines = Object.entries(setVariables).map(([name, value]) => {
      return `{{setvar::${name}::${value}}}`
    })

    if (setvarLines.length > 0) {
      // 将变量定义插入到文本开头
      result = setvarLines.join('\n') + '\n' + result
    }

    return result
  }

  /**
   * 获取行号
   */
  private getLineNumber(text: string, index: number): number {
    const lines = text.substring(0, index).split('\n')
    return lines.length
  }

  /**
   * 设置变量
   */
  setVariable(name: string, value: any): void {
    this.defaultVariables[name] = value
  }

  /**
   * 获取变量
   */
  getVariable(name: string): any {
    return this.defaultVariables[name]
  }

  /**
   * 获取所有变量
   */
  getAllVariables(): Record<string, any> {
    return { ...this.defaultVariables }
  }
}

/**
 * 便捷函数：同步处理模板变量
 */
export function processLiquidTemplateVariables(
  text: string,
  options: LiquidTemplateProcessingOptions = {}
): LiquidTemplateProcessingResult {
  const processor = new LiquidTemplateProcessor(options)
  return processor.processTextSync(text)
}

/**
 * 便捷函数：异步处理模板变量
 */
export async function processLiquidTemplateVariablesAsync(
  text: string,
  options: LiquidTemplateProcessingOptions = {}
): Promise<LiquidTemplateProcessingResult> {
  const processor = new LiquidTemplateProcessor(options)
  return await processor.processText(text)
}

/**
 * 便捷函数：只处理模板渲染（不包含复杂逻辑）
 */
export function renderTemplate(
  template: string,
  variables: Record<string, any> = {}
): string {
  const processor = new LiquidTemplateProcessor()
  return processor.processTextSync(template).processedText
}

// 导出 LiquidJS 以便高级用户使用
export { Liquid }