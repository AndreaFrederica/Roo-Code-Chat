/**
 * 折叠块配置 - 支持可扩展的正则表达式规则
 * 就像写"查找/替换表达式"一样简单
 */

export type ReplaceRule = {
  re: RegExp;
  replace: string | ((match: string) => string)
}

export type BlockRule = {
  /** 规则名称，仅用于调试 */
  name: string
  /**
   * 正常的"替换表达式风格"的正则即可：
   * - 建议用 (?<content>...) 命名捕获内容
   * - 或者把内容放在第 2 个捕获组
   * - 自带 /g /i 等 flags；建议使用 /gi
   * - 可用 |$ 支持"未闭合到结尾"
   */
  re: RegExp
  /** 这个块在 UI 上显示成什么类型（默认 thinking） */
  toType?: "thinking" | "variables" | "meta" | "code" | string
  /** 是否默认折叠 */
  defaultCollapsed?: boolean
}

/** 默认预处理（保护代码块/行内代码等） */
export const defaultPreReplace: ReplaceRule[] = [
  // fenced code ```...``` 或 ~~~...~~~
  {
    re: /(^|[\r\n])(```|~~~)[^\r\n]*[\r\n][\s\S]*?\2(?=[\r\n]|$)/g,
    replace: (m: string) => (m.startsWith("\n") ? "\n" : "") + `\u0000__SLOT__${m}\u0000`,
  } as unknown as ReplaceRule,
  // inline code `...`
  {
    re: /`[^`\r\n]+`/g,
    replace: (m: string) => `\u0000__SLOT__${m}\u0000`,
  } as unknown as ReplaceRule,
]

/** 你的"折叠块"通用规则示例（完全是普通正则！） */
export const defaultBlockRules: BlockRule[] = [
  // 2) <UpdateVariable> … </UpdateVariable> 折叠成 variables - 优先级更高
  {
    name: "update-variable",
    re: /<\s*UpdateVariable\b[^>]*>(?<content>[\s\S]*?)(?:<\s*\/\s*UpdateVariable\b[^>]*>|$)/gi,
    toType: "variables",
    defaultCollapsed: false,
  },
  // 1) <thinking>...</thinking>：英文思考块
  {
    name: "thinking-english",
    re: /<thinking>(?<content>[\s\S]*?)<\/thinking>/gi,
    toType: "thinking",
    defaultCollapsed: true,
  },
  // 1.5) ：简短英文思考块
  {
    name: "think-english",
    re: /<think>(?<content>[\s\S]*?)<\/think>/gi,
        toType: "thinking",
    defaultCollapsed: true,
  },
  // 2) <思考>...</思考>：中文思考块
  {
    name: "thinking-chinese", 
    re: /<思考>(?<content>[\s\S]*?)<\/思考>/gi,
    toType: "thinking",
    defaultCollapsed: true,
  },
  // 5) <思索>...</思索>：另一种中文思考块
  {
    name: "thinking-sisu", 
    re: /<思索>(?<content>[\s\S]*?)<\/思索>/gi,
    toType: "thinking",
    defaultCollapsed: true,
  },
  // 3) 混合语言标签：<思考thinking>...</thinkingthinking> 或 <thinking思考>...</思考thinking> 等
  {
    name: "thinking-mixed",
    re: /<\s*(?:思考|thinking|ThinkingProcess)\s*(?:思考|thinking|ThinkingProcess)\s*(?<content>[\s\S]*?)<\/\s*(?:思考|thinking|ThinkingProcess)\s*(?:思考|thinking|ThinkingProcess)\s*>/gi,
    toType: "thinking",
    defaultCollapsed: true,
  },
  // 4) 跨语言标签：<thinking>...</思考> 或 <思考>...</thinking> 等（开始和结束标签不同）
  {
    name: "thinking-cross-language",
    re: /<\s*(thinking|思考|ThinkingProcess)\s*>(?<content>[\s\S]*?)<\/\s*(thinking|思考|ThinkingProcess)\s*>/gi,
    toType: "thinking",
    defaultCollapsed: true,
  },
  // 3) YAML front-matter
  {
    name: "yaml-frontmatter",
    re: /^---\s*\n(?<content>[\s\S]*?)\n---\s*(?=\n|$)/gi,
    toType: "meta",
    defaultCollapsed: true,
  },
  // 4) 自定义分隔（举例：<<<BEGIN>>> … <<<END>>>）
  {
    name: "triple-angle",
    re: /<<<BEGIN>>>\s*(?<content>[\s\S]*?)\s*(?:<<<END>>>|$)/gi,
    toType: "thinking",
    defaultCollapsed: true,
  },
  ]

/** 获取所有规则中的标签名称，用于清理半截标签 */
export function getAllRuleNames(rules: BlockRule[]): string {
  const names = rules.map(rule => {
    // 从正则中提取标签名（简化版本，可以根据需要扩展）
    if (rule.name.includes("thinking")) {
      return "thinking|思考|ThinkingProcess|思索"
    } else if (rule.name === "update-variable") {
      return "UpdateVariable"
    }
    return ""
  }).filter(Boolean)

  return names.join("|")
}

/** 块类型配置 */
export const BlockTypeConfig = {
  thinking: {
    icon: "Lightbulb",
    label: "chat:reasoning.thinking",
    color: "text-vscode-descriptionForeground",
    borderColor: "border-vscode-descriptionForeground/20",
  },
  variables: {
    icon: "Database",
    label: "chat:reasoning.variables",
    color: "text-vscode-terminal-ansiBlue",
    borderColor: "border-vscode-terminal-ansiBlue/20",
  },
  meta: {
    icon: "FileText",
    label: "chat:reasoning.metadata",
    color: "text-vscode-terminal-ansiGreen",
    borderColor: "border-vscode-terminal-ansiGreen/20",
  },
  code: {
    icon: "Code",
    label: "chat:reasoning.code",
    color: "text-vscode-terminal-ansiYellow",
    borderColor: "border-vscode-terminal-ansiYellow/20",
  },
} as const
