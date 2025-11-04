import { convertBlockRulesToTagRules, createASTFoldEngine } from "../webview-ui/src/components/common/ast-fold-engine"
import { defaultBlockRules } from "../webview-ui/src/components/common/fold-config"
import type { Block } from "../webview-ui/src/components/common/fold-engine"

const engine = createASTFoldEngine(convertBlockRulesToTagRules(defaultBlockRules))

const bases = [
  `<thinking>outer<thinking>inner</thinking></thinking><thinking>other</thinking>`,
  `<thinking>
outer
<thinking>inner</thinking>
</thinking>
<thinking>
inner
</thinking>`,
  `<thinking>\n  <thinking>nested</thinking>\n</thinking>\n<thinking>nested</thinking>`,
  `<thinking>outer<thinking>inner</thinking></thinking>\n\n<thinking>inner</thinking>`,
  `<thinking>outer<thinking>inner</thinking><thinking>dup</thinking></thinking>`
]

const checkBlocks = (blocks: Block[], path: string, map: Map<string, string>) => {
  blocks.forEach((block, index) => {
    const curPath = path ? `${path}/${index}` : `${index}`
    const key = `${block.start}-${block.end}:${block.type}`
    if (map.has(key)) {
      console.log('duplicate', key, 'paths', map.get(key), curPath)
    } else {
      map.set(key, curPath)
    }
    if (block.children) {
      checkBlocks(block.children, curPath, map)
    }
  })
}

bases.forEach((markdown, idx) => {
  const result = engine.processText(markdown)
  const map = new Map<string, string>()
  checkBlocks(result.blocks, '', map)
  console.log('case', idx, 'done')
})
