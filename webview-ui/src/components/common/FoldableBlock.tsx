import React, { memo } from "react"
import ReactMarkdown from "react-markdown"
import { useTranslation } from "react-i18next"
import rehypeKatex from "rehype-katex"
import remarkMath from "remark-math"
import remarkGfm from "remark-gfm"

import { ChevronUp, Lightbulb, Database, FileText, Code, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { getBlockTypeAppearance } from "./fold-config"
import CodeBlock from "./CodeBlock"
import VariableCommandsRenderer from "./VariableCommandsRenderer"

interface FoldableBlockProps {
  content: string
  type: string
  isCollapsed: boolean
  onToggle: () => void
  children?: React.ReactNode
}

const FoldableBlock = memo(({ content, type, isCollapsed, onToggle, children }: FoldableBlockProps) => {
  const { t } = useTranslation()

  // 获取块类型配置
  const config = getBlockTypeAppearance(type)

  const iconComponents: Record<string, React.ComponentType<{ className?: string }>> = {
    Lightbulb,
    Database,
    FileText,
    Code,
    Info,
  }

  const IconComponent = iconComponents[config.icon] || Lightbulb

  const displayLabel = config.labelKey
    ? t(config.labelKey, config.label ?? type.charAt(0).toUpperCase() + type.slice(1))
    : config.label ?? type.charAt(0).toUpperCase() + type.slice(1)

  return (
    <div className="group my-4">
      <div
        className="flex items-center justify-between mb-2.5 pr-2 cursor-pointer select-none"
        onClick={onToggle}>
        <div className="flex items-center gap-2">
          <IconComponent className="w-4" />
          <span className="font-bold text-vscode-foreground">{displayLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <ChevronUp
            className={cn(
              "w-4 transition-all opacity-0 group-hover:opacity-100",
              isCollapsed && "-rotate-180",
            )}
          />
        </div>
      </div>
      {!isCollapsed && (
        <div
          className={cn(
            "border-l ml-2 pl-4 pb-1",
            config.borderColor
          )}
        >
          <div className={cn(config.color)}>
            {/* 对于UpdateVariable/variables类型，需要同时渲染children和自己的内容 */}
            {type === 'UpdateVariable' || type === 'variables' ? (
              <>
                {/* 先渲染嵌套的子块（如ThinkingProcess） */}
                {children}
                {/* 再渲染变量命令部分 */}
                {content && <VariableCommandsRenderer content={content} />}
              </>
            ) : children ? (
              // 其他类型有children时，只渲染children
              children
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex as any]}
                components={{
                  code: ({ children, className, ...props }: any) => {
                    if (className?.includes("language-")) {
                      const match = /language-(\w+)/.exec(className)
                      const language = match ? match[1] : "text"
                      return (
                        <div style={{ margin: "1em 0" }}>
                          <CodeBlock
                            source={String(children).replace(/\n$/, "")}
                            language={language}
                          />
                        </div>
                      )
                    }
                    return (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    )
                  },
                }}>
                {content}
              </ReactMarkdown>
            )}
          </div>
        </div>
      )}
    </div>
  )
})

FoldableBlock.displayName = "FoldableBlock"

export default FoldableBlock
