import { convertBlockRulesToTagRules, createASTFoldEngine } from "../webview-ui/src/components/common/ast-fold-engine"
import { defaultBlockRules } from "../webview-ui/src/components/common/fold-config"
import type { Block } from "../webview-ui/src/components/common/fold-engine"

const engine = createASTFoldEngine(convertBlockRulesToTagRules(defaultBlockRules))
const markdown = `<UpdateVariable>_.set("foo", "bar");</UpdateVariable>`
const result = engine.processText(markdown)

const printBlock = (block: Block, indent: string = "") => {
  const summary = block.content ? block.content.replace(/\s+/g, " ").slice(0, 50) : ""
  console.log(`${indent}- type: ${block.type}, start: ${block.start}, end: ${block.end}, content: ${JSON.stringify(summary)}, children: ${block.children?.length ?? 0}`)
  block.children?.forEach((child) => printBlock(child, indent + "  "))
}

result.blocks.forEach((block) => printBlock(block))
