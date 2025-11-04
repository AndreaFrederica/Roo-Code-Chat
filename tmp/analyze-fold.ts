import { convertBlockRulesToTagRules, createASTFoldEngine } from "../webview-ui/src/components/common/ast-fold-engine"
import { defaultBlockRules } from "../webview-ui/src/components/common/fold-config"
import type { Block } from "../webview-ui/src/components/common/fold-engine"

const engine = createASTFoldEngine(convertBlockRulesToTagRules(defaultBlockRules))
const markdown = `<thinking>outer<thinking>inner</thinking></thinking><thinking>other</thinking>`
const result = engine.processText(markdown)

const printBlock = (block: Block, indent: string = "") => {
  const summary = block.content ? block.content.replace(/\s+/g, " ").slice(0, 30) : ""
  console.log(`${indent}- type: ${block.type}, start: ${block.start}, end: ${block.end}, content: ${JSON.stringify(summary)}`)
  block.children?.forEach((child) => printBlock(child, indent + "  "))
}

result.blocks.forEach((block) => printBlock(block))
