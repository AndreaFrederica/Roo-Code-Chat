/**
 * 安全的折叠引擎 - 仅支持字符串替换，不执行任何函数
 * 基于JSON配置驱动的安全处理系统
 */

import {
	type SafeBlockRule,
	type SafeReplaceRule,
	createSafeBlockRule,
	createSafeReplaceRule
} from "./safe-fold-config"

export type Block = { type: "text" | string; content: string; start: number; end: number; defaultCollapsed?: boolean; children?: Block[] }

const SLOT_RE = /\u0000__SLOT__([\s\S]*?)\u0000/g

/**
 * 安全的字符串替换函数 - 不执行函数
 */
function applySafePreReplace(input: string, rules: SafeReplaceRule[]): string {
  let text = input
  for (const rule of rules) {
    // 仅使用字符串替换，不执行函数
    text = text.replace(rule.re, rule.replace)
  }
  return text
}

function restoreSlots(s: string): string {
  return s.replace(SLOT_RE, (_m, raw) => raw)
}

/**
 * 安全的折叠块处理 - 仅使用正则表达式和字符串替换
 */
export function splitBlocksSafe(markdown: string, opts: {
  pre?: SafeReplaceRule[],
  rules: SafeBlockRule[],
  stripTrailingHalf?: RegExp,
}): Block[] {
  if (!markdown) return []

  // 0) 预处理（保护代码块/行内代码等）
  const protectedText = opts.pre?.length ? applySafePreReplace(markdown, opts.pre) : markdown

  // 1) 收集所有规则的匹配区间
  type Hit = { start: number; end: number; type: string; inner: string; defaultCollapsed?: boolean }
  const hits: Hit[] = []

  // 2) 查找所有匹配项
  for (const rule of opts.rules) {
    let match: RegExpExecArray | null
    while ((match = rule.re.exec(protectedText)) !== null) {
      // 对于全局正则，避免无限循环
      if (rule.re.global && match.index === rule.re.lastIndex - match[0].length) {
        rule.re.lastIndex = match.index + 1
      }

      const start = match.index
      const end = start + match[0].length
      const inner = match[1] || match[2] || match[0] // 尝试获取内容

      hits.push({
        start,
        end,
        type: rule.toType || rule.name,
        inner,
        defaultCollapsed: rule.defaultCollapsed
      })
    }
  }

  // 3) 按位置排序并去重
  hits.sort((a, b) => a.start - b.start || b.end - a.end)
  const filteredHits: Hit[] = []
  for (const hit of hits) {
    // 检查是否与已有区间重叠
    const overlaps = filteredHits.some(h =>
      (hit.start >= h.start && hit.start < h.end) ||
      (hit.end > h.start && hit.end <= h.end) ||
      (hit.start <= h.start && hit.end >= h.end)
    )
    if (!overlaps) {
      filteredHits.push(hit)
    }
  }

  // 4) 构建块结构
  const blocks: Block[] = []
  let lastEnd = 0

  for (const hit of filteredHits) {
    // 添加前面的文本
    if (hit.start > lastEnd) {
      const textContent = protectedText.slice(lastEnd, hit.start)
      if (textContent) {
        blocks.push({
          type: "text",
          content: restoreSlots(textContent),
          start: lastEnd,
          end: hit.start
        })
      }
    }

    // 添加折叠块
    blocks.push({
      type: hit.type,
      content: restoreSlots(hit.inner),
      start: hit.start,
      end: hit.end,
      defaultCollapsed: hit.defaultCollapsed
    })

    lastEnd = hit.end
  }

  // 添加剩余文本
  if (lastEnd < protectedText.length) {
    const textContent = protectedText.slice(lastEnd)
    if (textContent) {
      blocks.push({
        type: "text",
        content: restoreSlots(textContent),
        start: lastEnd,
        end: protectedText.length
      })
    }
  }

  // 5) 清理尾部半截标签
  if (opts.stripTrailingHalf && blocks.length > 0) {
    const lastBlock = blocks[blocks.length - 1]
    if (lastBlock.type === "text") {
      const cleaned = lastBlock.content.replace(opts.stripTrailingHalf, "")
      if (cleaned !== lastBlock.content) {
        blocks[blocks.length - 1] = {
          ...lastBlock,
          content: cleaned
        }
      }
    }
  }

  return blocks
}

/**
 * 从mixin配置创建安全规则
 */
export function createSafeRulesFromConfig(
  regexRules: Record<string, any>
): SafeBlockRule[] {
  const rules: SafeBlockRule[] = []

  for (const [ruleKey, rule] of Object.entries(regexRules)) {
    if (!rule.enabled) continue

    try {
      if (rule.pattern) {
        const toType = typeof rule.toType === 'string' && rule.toType.trim().length > 0
          ? rule.toType.trim()
          : undefined

        if (!toType) {
          continue
        }

        const safeRule = createSafeBlockRule(
          ruleKey,
          rule.pattern,
          rule.flags || 'g',
          {
            toType,
            defaultCollapsed: rule.defaultCollapsed
          }
        )
        rules.push(safeRule)
      }
    } catch (error) {
      console.warn(`Invalid rule ${ruleKey}:`, error)
    }
  }

  return rules
}

/**
 * 从mixin配置创建安全替换规则
 */
export function createSafeReplaceRulesFromConfig(
  regexRules: Record<string, any>
): SafeReplaceRule[] {
  const rules: SafeReplaceRule[] = []

  for (const [ruleKey, rule] of Object.entries(regexRules)) {
    if (!rule.enabled) continue

    try {
      if (rule.pattern && rule.replacement) {
        const safeRule = createSafeReplaceRule(
          rule.pattern,
          rule.flags || 'g',
          rule.replacement
        )
        rules.push(safeRule)
      }
    } catch (error) {
      console.warn(`Invalid replace rule ${ruleKey}:`, error)
    }
  }

  return rules
}

/**
 * 获取块的默认折叠状态 - 安全版本
 */
export function getDefaultCollapsedState(block: Block, globalDefault: boolean): boolean {
  if (block.type === "text") return false

  // 特殊处理：如果块有特定的默认折叠设置，优先使用
  if (block.defaultCollapsed !== undefined) {
    return block.defaultCollapsed
  }

  // 对于 variables 类型，默认折叠
  if (block.type === "variables") {
    return true
  }

  // 对于 thinking 类型，使用全局设置
  if (block.type === "thinking") {
    return globalDefault
  }

  // 其他类型默认展开
  return false
}
