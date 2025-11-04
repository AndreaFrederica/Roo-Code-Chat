/**
 * 安全的折叠块配置 - 仅支持字符串替换，不支持函数执行
 * 基于JSON配置驱动的安全规则系统
 */

export type SafeReplaceRule = {
  re: RegExp;
  replace: string; // 仅支持字符串，不支持函数
}

export type SafeBlockRule = {
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

/** 默认预处理（保护代码块/行内代码等） - 安全版本 */
export const safeDefaultPreReplace: SafeReplaceRule[] = [
  // fenced code ```...``` 或 ~~~...~~~
  {
    re: /(^|[\r\n])(```|~~~)[^\r\n]*[\r\n][\s\S]*?\2(?=[\r\n]|$)/g,
    replace: `$1\u0000__SLOT__${'$&'}\u0000`, // 使用$&代替函数
  },
  // inline code `...`
  {
    re: /`[^`\r\n]+`/g,
    replace: `\u0000__SLOT__$&\u0000`,
  },
]

/**
 * 从mixin规则创建SafeReplaceRule
 */
export function createSafeReplaceRule(
  pattern: string,
  flags: string,
  replacement: string
): SafeReplaceRule {
  return {
    re: new RegExp(pattern, flags),
    replace: replacement
  }
}

/**
 * 从mixin规则创建SafeBlockRule
 */
export function createSafeBlockRule(
  name: string,
  pattern: string,
  flags: string,
  options?: {
    toType?: "thinking" | "variables" | "meta" | "code" | string
    defaultCollapsed?: boolean
  }
): SafeBlockRule {
  return {
    name,
    re: new RegExp(pattern, flags),
    toType: options?.toType,
    defaultCollapsed: options?.defaultCollapsed
  }
}

/**
 * 获取所有规则名称（用于清理尾部半截标签）
 */
export function getSafeRuleNames(rules: SafeBlockRule[]): string {
  return rules
    .map(r => r.name)
    .filter(Boolean)
    .join('|')
}

/**
 * 从mixin配置创建SafeBlockRule数组
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

        // 只有显式声明了折叠类型的规则才生成折叠块
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
 * 从mixin配置创建SafeReplaceRule数组
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
