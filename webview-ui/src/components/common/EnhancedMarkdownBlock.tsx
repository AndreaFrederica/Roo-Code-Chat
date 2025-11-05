import React, { memo, useMemo, useState, useCallback } from "react"
import ReactMarkdown from "react-markdown"
import styled from "styled-components"
import { visit } from "unist-util-visit"
import rehypeKatex from "rehype-katex"
import remarkMath from "remark-math"
import remarkGfm from "remark-gfm"

import { vscode } from "@src/utils/vscode"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useTranslation } from "react-i18next"

import CodeBlock from "./CodeBlock"
import MermaidBlock from "./MermaidBlock"
import FoldableBlock from "./FoldableBlock"
import { useMarkdownProcessor } from "@/hooks/useMarkdownProcessor"
import { Eye, EyeOff } from "lucide-react"

interface EnhancedMarkdownBlockProps {
	markdown?: string
}

const StyledMarkdown = styled.div`
	* {
		font-weight: 400;
	}

	strong {
		font-weight: 600;
	}

	code:not(pre > code) {
		font-family: var(--vscode-editor-font-family, monospace);
		font-size: 0.85em;
		filter: saturation(110%) brightness(95%);
		color: var(--vscode-textPreformat-foreground) !important;
		background-color: var(--vscode-textPreformat-background) !important;
		padding: 1px 2px;
		white-space: pre-line;
		word-break: break-word;
		overflow-wrap: anywhere;
	}

	/* Target only Dark High Contrast theme using the data attribute VS Code adds to the body */
	body[data-vscode-theme-kind="vscode-high-contrast"] & code:not(pre > code) {
		color: var(
			--vscode-editorInlayHint-foreground,
			var(
				--vscode-symbolIcon-stringForeground,
				var(--vscode-charts-orange, var(--vscode-textLink-foreground, var(--foreground)))
			)
		);
	}

	/* KaTeX styling */
	.katex {
		font-size: 1.1em;
		color: var(--vscode-editor-foreground);
		font-family: KaTeX_Main, "Times New Roman", serif;
		line-height: 1.2;
		white-space: normal;
		text-indent: 0;
	}

	.katex-display {
		display: block;
		margin: 1em 0;
		text-align: center;
		padding: 0.5em;
		overflow-x: auto;
		overflow-y: hidden;
		background-color: var(--vscode-textCodeBlock-background);
		border-radius: 3px;
	}

	.katex-error {
		color: var(--vscode-errorForeground);
	}

	font-family:
		var(--vscode-font-family),
		system-ui,
		-apple-system,
		BlinkMacSystemFont,
		"Segoe UI",
		Roboto,
		Oxygen,
		Ubuntu,
		Cantarell,
		"Open Sans",
		"Helvetica Neue",
		sans-serif;

	font-size: var(--vscode-font-size, 13px);

	p,
	li,
	ol,
	ul {
		line-height: 1.35em;
	}

	li {
		margin: 0.5em 0;
	}

	ol,
	ul {
		padding-left: 2em;
		margin-left: 0;
	}

	ol {
		list-style-type: decimal;
	}

	ul {
		list-style-type: disc;
	}

	ol ol {
		list-style-type: lower-alpha;
	}

	ol ol ol {
		list-style-type: lower-roman;
	}

	p {
		white-space: pre-wrap;
		margin: 1em 0 0.25em;
	}

	/* Prevent layout shifts during streaming */
	pre {
		min-height: 3em;
		transition: height 0.2s ease-out;
	}

	/* Code block container styling */
	div:has(> pre) {
		position: relative;
		contain: layout style;
		padding: 0.5em 1em;
	}

	a {
		color: var(--vscode-textLink-foreground);
		text-decoration: none;
		text-decoration-color: var(--vscode-textLink-foreground);
		&:hover {
			color: var(--vscode-textLink-activeForeground);
			text-decoration: underline;
		}
	}

	h1 {
		font-size: 1.65em;
		font-weight: 700;
		margin: 1.35em 0 0.5em;
	}

	h2 {
		font-size: 1.35em;
		font-weight: 500;
		margin: 1.35em 0 0.5em;
	}

	h3 {
		font-size: 1.2em;
		font-weight: 500;
	}

	/* Table styles for remark-gfm */
	table {
		border-collapse: collapse;
		margin: 1em 0;
		width: auto;
		min-width: 50%;
		max-width: 100%;
		table-layout: fixed;
	}

	/* Table wrapper for horizontal scrolling */
	.table-wrapper {
		overflow-x: auto;
		margin: 1em 0;
	}

	th,
	td {
		border: 1px solid var(--vscode-panel-border);
		padding: 8px 12px;
		text-align: left;
		word-wrap: break-word;
		overflow-wrap: break-word;
	}

	th {
		background-color: var(--vscode-editor-background);
		font-weight: 600;
		color: var(--vscode-foreground);
	}

	tr:nth-child(even) {
		background-color: var(--vscode-editor-inactiveSelectionBackground);
	}

	tr:hover {
		background-color: var(--vscode-list-hoverBackground);
	}

	/* Raw markdown view styles */
	.raw-content {
		font-family: var(--vscode-editor-font-family, monospace);
		font-size: 0.9em;
		white-space: pre-wrap;
		word-wrap: break-word;
		background-color: var(--vscode-textCodeBlock-background);
		border: 1px solid var(--vscode-panel-border);
		border-radius: 4px;
		padding: 12px;
		line-height: 1.4;
		color: var(--vscode-editor-foreground);
		overflow-x: auto;
	}

	/* Toggle button styles */
	.toggle-button {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		margin-bottom: 12px;
		background-color: var(--vscode-button-secondaryBackground);
		color: var(--vscode-button-secondaryForeground);
		border: 1px solid var(--vscode-button-border);
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
		transition: all 0.2s ease;
		select: none;
	}

	.toggle-button:hover {
		background-color: var(--vscode-button-secondaryHoverBackground);
		color: var(--vscode-button-secondaryHoverForeground);
	}
`

const EnhancedMarkdownBlock = memo(({ markdown }: EnhancedMarkdownBlockProps) => {
	const { reasoningBlockCollapsed } = useExtensionState()
	const [collapsedBlockIds, setCollapsedBlockIds] = useState<Set<string>>(new Set())
	const [showRaw, setShowRaw] = useState(false)

	// 使用新的处理器 Hook
	const processedBlocks = useMarkdownProcessor(markdown)

	// // 调试：log收到的处理结果结构
	// console.log('[EnhancedMarkdownBlock] ===== Component Render =====')
	// console.log('[EnhancedMarkdownBlock] Input markdown length:', markdown?.length)
	// console.log('[EnhancedMarkdownBlock] Input markdown content:', markdown?.substring(0, 200))
	// console.log('[EnhancedMarkdownBlock] Processed blocks count:', processedBlocks.length)
	// processedBlocks.forEach((block, index) => {
	// 	console.log(`[EnhancedMarkdownBlock] Block ${index}:`, {
	// 		type: block.type,
	// 		id: block.id,
	// 		content: block.content, // 完整内容
	// 		contentLength: block.content?.length || 0,
	// 		action: block.action,
	// 		start: block.start,
	// 		end: block.end,
	// 		hasChildren: block.children?.length || 0
	// 	})
	// })

	// Initialize collapsed state for all foldable blocks using unique IDs
	useMemo(() => {
		const foldableBlocks = processedBlocks.filter((block) => block.type !== "text")

		if (foldableBlocks.length > 0) {
			// 为每个新块初始化折叠状态（如果还没有设置的话）
			setCollapsedBlockIds((prevCollapsedIds) => {
				const newCollapsedIds = new Set(prevCollapsedIds)

				foldableBlocks.forEach((block) => {
					// 只有当这个块还没有折叠状态记录时，才设置默认状态
					if (!prevCollapsedIds.has(block.id)) {
						// 使用block的defaultCollapsed属性
						const shouldCollapse = block.defaultCollapsed ?? reasoningBlockCollapsed ?? false
						if (shouldCollapse) {
							newCollapsedIds.add(block.id)
						}
					}
				})

				return newCollapsedIds
			})
		}
	}, [processedBlocks, reasoningBlockCollapsed])

	const toggleThinkingBlock = useCallback((blockId: string) => {
		setCollapsedBlockIds((prev) => {
			const newSet = new Set(prev)
			if (newSet.has(blockId)) {
				newSet.delete(blockId)
			} else {
				newSet.add(blockId)
			}
			return newSet
		})
	}, [])

	const components = useMemo(
		() => ({
			table: ({ children, ...props }: any) => {
				return (
					<div className="table-wrapper">
						<table {...props}>{children}</table>
					</div>
				)
			},
			a: ({ href, children, ...props }: any) => {
				const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
					// Only process file:// protocol or local file paths
					const isLocalPath = href?.startsWith("file://") || href?.startsWith("/") || !href?.includes("://")

					if (!isLocalPath) {
						return
					}

					e.preventDefault()

					// Handle absolute vs project-relative paths
					let filePath = href.replace("file://", "")

					// Extract line number if present
					const match = filePath.match(/(.*):(\d+)(-\d+)?$/)
					let values = undefined
					if (match) {
						filePath = match[1]
						values = { line: parseInt(match[2]) }
					}

					// Add ./ prefix if needed
					if (!filePath.startsWith("/") && !filePath.startsWith("./")) {
						filePath = "./" + filePath
					}

					vscode.postMessage({
						type: "openFile",
						text: filePath,
						values,
					})
				}

				return (
					<a {...props} href={href} onClick={handleClick}>
						{children}
					</a>
				)
			},
			pre: ({ children, ..._props }: any) => {
				// The structure from react-markdown v9 is: pre > code > text
				const codeEl = children as React.ReactElement

				if (!codeEl || !codeEl.props) {
					return <pre>{children}</pre>
				}

				const { className = "", children: codeChildren } = codeEl.props

				// Get the actual code text
				let codeString = ""
				if (typeof codeChildren === "string") {
					codeString = codeChildren
				} else if (Array.isArray(codeChildren)) {
					codeString = codeChildren.filter((child) => typeof child === "string").join("")
				}

				// Handle mermaid diagrams
				if (className.includes("language-mermaid")) {
					return (
						<div style={{ margin: "1em 0" }}>
							<MermaidBlock code={codeString} />
						</div>
					)
				}

				// Extract language from className
				const match = /language-(\w+)/.exec(className)
				const language = match ? match[1] : "text"

				// Wrap CodeBlock in a div to ensure proper separation
				return (
					<div style={{ margin: "1em 0" }}>
						<CodeBlock source={codeString} language={language} />
					</div>
				)
			},
			code: ({ children, className, ...props }: any) => {
				// This handles inline code
				return (
					<code className={className} {...props}>
						{children}
					</code>
				)
			},
		}),
		[],
	)

	const ToggleButton = () => {
		const { t } = useTranslation()

		return (
			<button className="toggle-button" onClick={() => setShowRaw(!showRaw)}>
				{showRaw ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
				{showRaw
					? t("settings:markdown.showRaw", "显示原文")
					: t("settings:markdown.showRendered", "显示渲染结果")}
			</button>
		)
	}

	// 递归渲染块（支持嵌套）
	const renderBlock = (block: any, index: number, depth: number = 0): React.ReactNode => {
		// 处理普通文本块
		if (block.type === "text") {
			// console.log("[Rendering text block]:", block.content)
			return (
				<ReactMarkdown
					key={`text-${depth}-${index}`}
					remarkPlugins={[remarkGfm, remarkMath]}
					rehypePlugins={[rehypeKatex as any]}
					components={components}>
					{block.content}
				</ReactMarkdown>
			)
		}

		// 处理隐藏块（不渲染）
		if (block.action === "hide" || block.hidden) {
			return null
		}

		// 递归渲染children
		const childrenContent =
			block.children && block.children.length > 0
				? block.children.map((child: any, childIndex: number) => renderBlock(child, childIndex, depth + 1))
				: null

		// 处理高亮块
		if (block.action === "highlight") {
			return (
				<div
					key={`highlight-${depth}-${index}`}
					style={{
						backgroundColor: "var(--vscode-editor-selectionHighlightBackground)",
						border: "1px solid var(--vscode-editor-selectionHighlightBorder, transparent)",
						borderRadius: "3px",
						padding: "0.5em",
						margin: "0.5em 0",
					}}>
					{childrenContent || (
						<ReactMarkdown
							remarkPlugins={[remarkGfm, remarkMath]}
							rehypePlugins={[rehypeKatex as any]}
							components={components}>
							{block.content}
						</ReactMarkdown>
					)}
				</div>
			)
		}

		// 处理包装块
		if (block.action === "wrap") {
			return (
				<div
					key={`wrap-${depth}-${index}`}
					className={block.wrapperClass || `${block.type}-wrapper`}
					style={{
						border: "1px solid var(--vscode-panel-border)",
						borderRadius: "4px",
						padding: "0.75em",
						margin: "0.5em 0",
					}}>
					{childrenContent || (
						<ReactMarkdown
							remarkPlugins={[remarkGfm, remarkMath]}
							rehypePlugins={[rehypeKatex as any]}
							components={components}>
							{block.content}
						</ReactMarkdown>
					)}
				</div>
			)
		}

		// 处理自定义处理器块
		if (block.action === "custom") {
			return (
				<div
					key={`custom-${depth}-${index}`}
					data-processor={block.processor}
					data-type={block.type}
					style={{
						margin: "0.5em 0",
					}}>
					{childrenContent || (
						<ReactMarkdown
							remarkPlugins={[remarkGfm, remarkMath]}
							rehypePlugins={[rehypeKatex as any]}
							components={components}>
							{block.content}
						</ReactMarkdown>
					)}
				</div>
			)
		}

		// 处理折叠块（默认行为）- 保留原始内容，不设置为空字符串
		return (
			<FoldableBlock
				key={`${block.type}-${depth}-${index}`}
				content={block.content}
				type={block.type}
				isCollapsed={collapsedBlockIds.has(block.id)}
				onToggle={() => toggleThinkingBlock(block.id)}>
				{childrenContent}
			</FoldableBlock>
		)
	}

	const RenderedContent = () => <>{processedBlocks.map((block, index) => renderBlock(block, index, 0))}</>

	const RawContent = () => <div className="raw-content">{markdown || ""}</div>

	return (
		<StyledMarkdown>
			{markdown && <ToggleButton />}
			{showRaw ? <RawContent /> : <RenderedContent />}
		</StyledMarkdown>
	)
})

EnhancedMarkdownBlock.displayName = "EnhancedMarkdownBlock"

export default EnhancedMarkdownBlock
