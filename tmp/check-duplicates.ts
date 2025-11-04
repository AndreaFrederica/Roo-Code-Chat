import { convertBlockRulesToTagRules, createASTFoldEngine } from "../webview-ui/src/components/common/ast-fold-engine"
import { defaultBlockRules } from "../webview-ui/src/components/common/fold-config"
import { readFileSync } from "fs"
import type { Block } from "../webview-ui/src/components/common/fold-engine"

const engine = createASTFoldEngine(convertBlockRulesToTagRules(defaultBlockRules))
const markdown = readFileSync("./test-thinking-blocks.md", "utf8")
const result = engine.processText(markdown)

const seen = new Map<string, { path: string; block: Block }>()

const walk = (blocks: Block[], path: string) => {
  blocks.forEach((block, index) => {
    const curPath = path ? `${path}/${index}` : `${index}`
    const start = (block as any).start
    const end = (block as any).end
    const key = `${start}-${end}:${block.type}`
    if (seen.has(key)) {
      const existing = seen.get(key)!
      console.log("Duplicate nodeId:", key)
      console.log("  existing path:", existing.path)
      console.log("  new path:", curPath)
      console.log("  content eq:", existing.block.content === block.content)
    } else {
      seen.set(key, { path: curPath, block })
    }
    if (block.children) {
      walk(block.children, curPath)
    }
  })
}

walk(result.blocks, "")
