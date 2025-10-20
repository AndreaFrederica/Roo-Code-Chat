/**
 * 折叠引擎 - 用"正常替换正则"样式的 BlockRule 进行分块
 */

import type { BlockRule, ReplaceRule } from "./fold-config"

export type Block = { type: "text" | string; content: string; start: number; end: number; defaultCollapsed?: boolean }

const SLOT_RE = /\u0000__SLOT__([\s\S]*?)\u0000/g

// 允许 ReplaceRule.replace 是 string 或 (m)=>string
function applyPreReplace(input: string, rules: ReplaceRule[]) {
  let text = input
  for (const r of rules) {
    const rep: any = (r as any).replace
    text = text.replace(r.re, typeof rep === "function" ? rep : rep)
  }
  return text
}

function restoreSlots(s: string) {
  return s.replace(SLOT_RE, (_m, raw) => raw)
}

/** 用"正常替换正则"样式的 BlockRule 进行分块 */
export function splitBlocks(markdown: string, opts: {
  pre?: ReplaceRule[],
  rules: BlockRule[],
  stripTrailingHalf?: RegExp, // 可选：清尾半截
}) : Block[] {
  if (!markdown) return []

  // 0) 预处理（保护代码块/行内代码等）
  const protectedText = opts.pre?.length ? applyPreReplace(markdown, opts.pre) : markdown

  // 1) 收集所有规则的匹配区间
  type Hit = { start: number; end: number; type: string; inner: string; defaultCollapsed?: boolean }
  const hits: Hit[] = []

  for (const rule of opts.rules) {
    const re = new RegExp(rule.re.source, rule.re.flags) // 防止共享 lastIndex
    let m: RegExpExecArray | null

    while ((m = re.exec(protectedText))) {
      const full = m[0]
      const start = m.index
      const end = start + full.length
      // 内容优先取命名组 content，否则取第 2 个捕获组
      const inner = (m.groups?.content ?? m[2] ?? "").trim()
      if (inner) { // 只处理非空内容
        hits.push({
          start,
          end,
          inner,
          type: rule.toType ?? "thinking",
          defaultCollapsed: rule.defaultCollapsed
        })
      }
      // 避免死循环：零宽匹配则手动前进
      if (re.lastIndex === m.index) {
        re.lastIndex++
        continue
      }
    }
  }

  // 2) 排序：按起点位置，优先保留更短的匹配（避免大块吞小块）
  hits.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start
    // 起点相同，优先保留更短的匹配（避免大块吞小块）
    return (a.end - a.start) - (b.end - b.start)
  })

  // 3) 去重：移除被包含在更大连通区间内的匹配
  const merged: Hit[] = []
  for (const h of hits) {
    const isContained = merged.some(existing => h.start >= existing.start && h.end <= existing.end)
    if (!isContained) {
      merged.push(h)
    }
  }

  // 4) 生成 blocks（thinking/text 交替）
  const blocks: Block[] = []
  let cursor = 0
  for (const h of merged) {
    if (h.start > cursor) {
      blocks.push({
        type: "text",
        content: protectedText.slice(cursor, h.start),
        start: cursor,
        end: h.start
      })
    }
    blocks.push({
      type: h.type,
      content: h.inner,
      start: h.start,
      end: h.end,
      defaultCollapsed: h.defaultCollapsed
    })
    cursor = h.end
  }
  if (cursor < protectedText.length) {
    blocks.push({
      type: "text",
      content: protectedText.slice(cursor),
      start: cursor,
      end: protectedText.length
    })
  }

  // 5) 可选：清理最后一个块中的"半截标签残影"
  if (opts.stripTrailingHalf && blocks.length) {
    const tail = blocks[blocks.length - 1]
    tail.content = tail.content.replace(opts.stripTrailingHalf, "").trimEnd()
  }

  // 6) 还原被保护的代码槽
  for (const b of blocks) b.content = restoreSlots(b.content)

  // 7) 过滤空 thinking/variables 块；合并相邻同类型块（可选）
  const out: Block[] = []
  for (const b of blocks) {
    if (b.type !== "text" && !b.content.trim()) continue
    const last = out[out.length - 1]
    if (last && last.type === b.type && b.type !== "text") {
      last.content += "\n" + b.content
      last.end = b.end
    } else {
      out.push(b)
    }
  }
  return out.length ? out : [{ type: "text", content: markdown, start: 0, end: markdown.length }]
}

/** 获取指定类型的块索引 */
export function getBlockIndicesByType(blocks: Block[], targetType: string): number[] {
  return blocks
    .map((block, index) => (block.type === targetType ? index : -1))
    .filter((index) => index !== -1)
}

/** 获取块的默认折叠状态 */
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

  // 其他类型使用全局默认设置
  return globalDefault
}
