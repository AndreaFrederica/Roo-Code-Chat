/**
 * 块类型定义 - 用于 Markdown 处理和折叠功能
 */

export type Block = { 
  type: "text" | string; 
  content: string; 
  start: number; 
  end: number; 
  defaultCollapsed?: boolean; 
  children?: Block[] 
}