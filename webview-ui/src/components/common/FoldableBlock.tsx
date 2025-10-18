import React, { memo } from "react"
import ReactMarkdown from "react-markdown"
import { useTranslation } from "react-i18next"
import rehypeKatex from "rehype-katex"
import remarkMath from "remark-math"
import remarkGfm from "remark-gfm"

import { ChevronUp, Lightbulb, Database, FileText, Code } from "lucide-react"
import { cn } from "@/lib/utils"
import { BlockTypeConfig } from "./fold-config"
import CodeBlock from "./CodeBlock"

interface FoldableBlockProps {
  content: string
  type: string
  isCollapsed: boolean
  onToggle: () => void
}

const FoldableBlock = memo(({ content, type, isCollapsed, onToggle }: FoldableBlockProps) => {
  const { t } = useTranslation()

  // 获取块类型配置
  const config = BlockTypeConfig[type as keyof typeof BlockTypeConfig] || BlockTypeConfig.thinking

  return (
    <div className="group my-4">
      <div
        className="flex items-center justify-between mb-2.5 pr-2 cursor-pointer select-none"
        onClick={onToggle}>
        <div className="flex items-center gap-2">
          {(() => {
            const iconMap = {
              thinking: <Lightbulb className="w-4" />,
              variables: <Database className="w-4" />,
              meta: <FileText className="w-4" />,
              code: <Code className="w-4" />,
            }
            return iconMap[type as keyof typeof iconMap] || <Lightbulb className="w-4" />
          })()}
          <span className="font-bold text-vscode-foreground">
            {t(config.label, type.charAt(0).toUpperCase() + type.slice(1))}
          </span>
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
          </div>
        </div>
      )}
    </div>
  )
})

FoldableBlock.displayName = "FoldableBlock"

export default FoldableBlock