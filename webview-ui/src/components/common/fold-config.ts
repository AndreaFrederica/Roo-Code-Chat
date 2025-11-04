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
  /** 规则唯一ID，用于依赖管理 */
  id?: string
  /** 依赖的其他规则ID */
  dependsOn?: string[]
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

/** 
 * AST处理的标签规则 - 这些标签将由AST系统处理，不再由正则处理
 * 包括：thinking相关标签、UpdateVariable等
 */
export const astBlockRules: BlockRule[] = [
  // <UpdateVariable> … </UpdateVariable> 折叠成 variables - 优先级更高
  {
    id: "db27da82-8057-4f0b-bf96-b67f95eb1707",
    name: "update-variable",
    re: /<\s*UpdateVariable\b[^>]*>(?<content>[\s\S]*?)(?:<\s*\/\s*UpdateVariable\b[^>]*>|$)/gi,
    toType: "variables",
    defaultCollapsed: false,
  },
  // <thinking>...</thinking>：英文思考块
  {
    id: "52206560-5c47-4697-ae30-be5ca8d60dac",
    name: "thinking-english",
    re: /<thinking>(?<content>[\s\S]*?)<\/thinking>/gi,
    toType: "thinking",
    defaultCollapsed: true,
  },
  // 简短英文思考块
  {
    id: "52206560-5c47-4697-ae30-be5ca8d60dac",
    name: "think-english",
    re: /<think>(?<content>[\s\S]*?)<\/think>/gi,
    toType: "thinking",
    defaultCollapsed: true,
  },
  // <思考>...</思考>：中文思考块
  {
    id: "52206560-5c47-4697-ae30-be5ca8d60dac",
    name: "thinking-chinese", 
    re: /<思考>(?<content>[\s\S]*?)<\/思考>/gi,
    toType: "thinking",
    defaultCollapsed: true,
  },
  // <思索>...</思索>：另一种中文思考块
  {
    id: "52206560-5c47-4697-ae30-be5ca8d60dac",
    name: "thinking-sisu", 
    re: /<思索>(?<content>[\s\S]*?)<\/思索>/gi,
    toType: "thinking",
    defaultCollapsed: true,
  },
  // 混合语言标签：<思考thinking>...</thinkingthinking> 或 <thinking思考>...</思考thinking> 等
  {
    id: "52206560-5c47-4697-ae30-be5ca8d60dac",
    name: "thinking-mixed",
    re: /<\s*(?:思考|thinking|ThinkingProcess)\s*(?:思考|thinking|ThinkingProcess)\s*(?<content>[\s\S]*?)<\/\s*(?:思考|thinking|ThinkingProcess)\s*(?:思考|thinking|ThinkingProcess)\s*>/gi,
    toType: "thinking",
    defaultCollapsed: true,
  },
  // 跨语言标签：<thinking>...</思考> 或 <思考>...</thinking> 等（开始和结束标签不同）
  {
    id: "52206560-5c47-4697-ae30-be5ca8d60dac",
    name: "thinking-cross-language",
    re: /<\s*(thinking|思考|ThinkingProcess)\s*>(?<content>[\s\S]*?)<\/\s*(thinking|思考|ThinkingProcess)\s*>/gi,
    toType: "thinking",
    defaultCollapsed: true,
  },
  // <Tips>...</Tips>：提示块
  {
    id: "d3ec857c-78a3-4ad5-8c76-4af07b866c7f",
    name: "tips-block",
    re: /<\s*Tips?\b[^>]*>(?<content>[\s\S]*?)(?:<\s*\/\s*Tips?\b[^>]*>|$)/gi,
    toType: "tips",
    defaultCollapsed: false,
  },
]

/** 
 * 正则处理的标签规则 - 这些标签仍由正则系统处理
 * 包括：YAML front-matter、自定义分隔符等非AST标签
 */
export const regexOnlyBlockRules: BlockRule[] = [
  // YAML front-matter
  {
    id: "d6347738-3693-4bcb-9744-24abe833f3c0",
    name: "yaml-frontmatter",
    re: /^---\s*\n(?<content>[\s\S]*?)\n---\s*(?=\n|$)/gi,
    toType: "meta",
    defaultCollapsed: true,
  },
  // 自定义分隔：<<<BEGIN>>> … <<<END>>>
  {
    id: "803cd120-23f4-4da4-b665-d6a48c2e69b4",
    name: "triple-angle",
    re: /<<<BEGIN>>>\s*(?<content>[\s\S]*?)\s*(?:<<<END>>>|$)/gi,
    toType: "meta", // 改为meta类型，避免与AST thinking冲突
    defaultCollapsed: true,
  },
]

/** 保持向后兼容的默认规则 - 包含所有规则 */
export const defaultBlockRules: BlockRule[] = [
  ...regexOnlyBlockRules,
  ...astBlockRules,
]

/** 获取所有规则中的标签名称，用于清理半截标签 */
export function getAllRuleNames(rules: BlockRule[]): string {
  const names = rules.map(rule => {
    // 从正则中提取标签名（简化版本，可以根据需要扩展）
    if (rule.name.includes("thinking")) {
      return "thinking|思考|ThinkingProcess|思索"
    } else if (rule.name === "update-variable") {
      return "UpdateVariable"
    } else if (rule.name === "tips-block") {
      return "Tips"
    }
    return ""
  }).filter(Boolean)

  return names.join("|")
}

export type BlockTypeAppearance = {
  icon: string
  labelKey?: string
  label?: string
  color: string
  borderColor: string
}

const DefaultBlockTypeAppearance: BlockTypeAppearance = {
  icon: "FileText",
  label: "",
  color: "text-vscode-descriptionForeground",
  borderColor: "border-vscode-panel-border/30",
}

/** 块类型配置 */
export const BlockTypeConfig: Record<string, BlockTypeAppearance> = {
  thinking: {
    icon: "Lightbulb",
    labelKey: "chat:reasoning.thinking",
    color: "text-vscode-descriptionForeground",
    borderColor: "border-vscode-descriptionForeground/20",
  },
  variables: {
    icon: "Database",
    labelKey: "chat:reasoning.variables",
    color: "text-vscode-terminal-ansiBlue",
    borderColor: "border-vscode-terminal-ansiBlue/20",
  },
  meta: {
    icon: "FileText",
    labelKey: "chat:reasoning.metadata",
    color: "text-vscode-terminal-ansiGreen",
    borderColor: "border-vscode-terminal-ansiGreen/20",
  },
  code: {
    icon: "Code",
    labelKey: "chat:reasoning.code",
    color: "text-vscode-terminal-ansiYellow",
    borderColor: "border-vscode-terminal-ansiYellow/20",
  },
  tips: {
    icon: "Info",
    label: "Tips",
    color: "text-vscode-terminal-ansiCyan",
    borderColor: "border-vscode-terminal-ansiCyan/30",
  },
}

export function getBlockTypeAppearance(type: string): BlockTypeAppearance {
  const config = BlockTypeConfig[type]
  if (config) {
    return config
  }
  return {
    ...DefaultBlockTypeAppearance,
    label: type.charAt(0).toUpperCase() + type.slice(1),
  }
}
