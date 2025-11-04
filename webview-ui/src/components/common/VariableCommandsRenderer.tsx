import React, { memo } from "react"
import { cn } from "@/lib/utils"
import { Database, Plus, Edit } from "lucide-react"
import { parseVariableCommands, ParsedCommand } from "./VariableCommandParser"

interface VariableCommandsRendererProps {
  content: string
  className?: string
}

const VariableCommandsRenderer = memo(({ content, className }: VariableCommandsRendererProps) => {
  // 使用AST解析器解析所有变量命令
  const commands = parseVariableCommands(content)
  
  if (commands.length === 0) {
    // 如果没有找到变量命令，使用普通的代码块渲染
    return (
      <pre className={cn("bg-vscode-editor-background border border-vscode-panel-border rounded p-3 overflow-x-auto", className)}>
        <code className="text-vscode-editor-foreground text-sm font-mono">{content}</code>
      </pre>
    )
  }
  
  return (
    <div className={cn("space-y-2", className)}>
      {commands.map((command, index) => (
        <div
          key={index}
          className="flex items-start gap-3 p-3 bg-vscode-editor-background border border-vscode-terminal-ansiBlue/20 rounded-lg"
        >
          {/* 命令图标 */}
          <div className="flex-shrink-0 mt-0.5">
            {command.type === 'set' && <Edit className="w-4 h-4 text-vscode-terminal-ansiBlue" />}
            {command.type === 'add' && <Plus className="w-4 h-4 text-vscode-terminal-ansiGreen" />}
            {command.type === 'insert' && <Database className="w-4 h-4 text-vscode-terminal-ansiYellow" />}
            {command.type === 'remove' && <Database className="w-4 h-4 text-vscode-terminal-ansiRed" />}
          </div>
          
          {/* 命令内容 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-vscode-terminal-ansiBlue font-mono text-sm font-semibold">
                _.{command.type}
              </span>
              <span className="text-vscode-descriptionForeground text-xs">
                {command.type === 'set' && '设置变量值'}
                {command.type === 'add' && '增加变量值'}
                {command.type === 'insert' && '插入数组元素'}
                {command.type === 'remove' && '删除数组元素'}
              </span>
            </div>
            
            {/* 变量名 */}
            <div className="mb-1">
              <span className="text-vscode-foreground text-xs">变量:</span>
              <code className="ml-2 px-2 py-1 bg-vscode-textBlock-background border border-vscode-panel-border rounded text-vscode-foreground text-xs font-mono">
                {command.variable}
              </code>
            </div>
            
            {/* 值 */}
            {command.value !== undefined && (
              <div className="mb-1">
                <span className="text-vscode-foreground text-xs">值:</span>
                <code className="ml-2 px-2 py-1 bg-vscode-textBlock-background border border-vscode-panel-border rounded text-vscode-terminal-ansiGreen text-xs font-mono">
                  {typeof command.value === 'string' ? `"${command.value}"` : command.value}
                </code>
              </div>
            )}
            
            {/* 注释 */}
            {command.comment && (
              <div>
                <span className="text-vscode-foreground text-xs">注释:</span>
                <span className="ml-2 text-vscode-descriptionForeground text-xs italic">
                  {command.comment}
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
      
      {/* 显示原始命令（可选，用于调试） */}
      <details className="mt-3" onClick={(e) => e.stopPropagation()}>
        <summary className="cursor-pointer text-xs text-vscode-descriptionForeground hover:text-vscode-foreground outline-none">
          查看原始命令
        </summary>
        <pre className="mt-2 p-2 bg-vscode-textBlock-background border border-vscode-panel-border rounded">
          <code className="text-vscode-foreground text-xs font-mono whitespace-pre-wrap">{content}</code>
        </pre>
      </details>
    </div>
  )
})

VariableCommandsRenderer.displayName = "VariableCommandsRenderer"

export default VariableCommandsRenderer
