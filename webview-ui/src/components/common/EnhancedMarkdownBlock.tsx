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
import { defaultPreReplace, defaultBlockRules, getAllRuleNames } from "./fold-config"
import { splitBlocks, getDefaultCollapsedState } from "./fold-engine"
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
			var(--vscode-symbolIcon-stringForeground, var(--vscode-charts-orange, #e9a700))
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
	const [collapsedThinkingBlocks, setCollapsedThinkingBlocks] = useState<Set<number>>(new Set())
	const [showRaw, setShowRaw] = useState(false)

	// 使用新的折叠引擎处理内容
	const processedContent = useMemo(() => {
		if (!markdown) {
			return { blocks: [] }
		}

		// 可选：额外添加你自己的"替换表达式"规则
		const myPre = [
			...defaultPreReplace,
			// 确保 <思索>…</思索> 被转换为 <thinking>…</thinking> 以便统一处理
			{ re: /<\s*思索\b([^>]*)>/gi, replace: "<thinking$1>" } as any,
			{ re: /<\s*\/\s*思索\b[^>]*>/gi, replace: "</thinking>" } as any,
		]

		// 清理尾部半截标签
		const ruleNames = getAllRuleNames(defaultBlockRules)
		const stripHalf = new RegExp(`<\\s*\\/??\\s*(?:${ruleNames})\\b[^>]*$`, "i")

		const blocks = splitBlocks(markdown, {
			pre: myPre,
			rules: defaultBlockRules,   // 这里就是纯"查找表达式"集合
			stripTrailingHalf: stripHalf,
		})

		
		return { blocks }
	}, [markdown])

	// Initialize collapsed state for all foldable blocks
	useMemo(() => {
		const foldableBlockIndices = processedContent.blocks
			.map((block, index) => (block.type !== "text" ? index : -1))
			.filter((index) => index !== -1)

		
		if (foldableBlockIndices.length > 0 && collapsedThinkingBlocks.size === 0) {
			// Initialize with default settings based on block type
			const initialCollapsed = new Set<number>()
			foldableBlockIndices.forEach((index) => {
				const block = processedContent.blocks[index]
				const shouldCollapse = getDefaultCollapsedState(block, reasoningBlockCollapsed ?? false)
								if (shouldCollapse) {
					initialCollapsed.add(index)
				}
			})
						setCollapsedThinkingBlocks(initialCollapsed)
		}
	}, [processedContent.blocks, reasoningBlockCollapsed, collapsedThinkingBlocks.size])

	const toggleThinkingBlock = useCallback((blockIndex: number) => {
		setCollapsedThinkingBlocks((prev) => {
			const newSet = new Set(prev)
			if (newSet.has(blockIndex)) {
				newSet.delete(blockIndex)
			} else {
				newSet.add(blockIndex)
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
			<button
				className="toggle-button"
				onClick={() => setShowRaw(!showRaw)}
			>
				{showRaw ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
				{showRaw ? t("settings:markdown.showRaw", "显示原文") : t("settings:markdown.showRendered", "显示渲染结果")}
			</button>
		)
	}

	const RenderedContent = () => (
		<>
			{processedContent.blocks.map((block, index) => {
				
				if (block.type === "text") {
					return (
						<ReactMarkdown
							key={`text-${index}`}
							remarkPlugins={[
								remarkGfm,
								remarkMath,
								() => {
									return (tree: any) => {
										visit(tree, "code", (node: any) => {
											if (!node.lang) {
												node.lang = "text"
											} else if (node.lang.includes(".")) {
												node.lang = node.lang.split(".").slice(-1)[0]
											}
										})
									}
								},
							]}
							rehypePlugins={[rehypeKatex as any]}
							components={components}>
							{block.content}
						</ReactMarkdown>
					)
				} else {
					return (
						<FoldableBlock
							key={`${block.type}-${index}`}
							content={block.content}
							type={block.type}
							isCollapsed={collapsedThinkingBlocks.has(index)}
							onToggle={() => toggleThinkingBlock(index)}
						/>
					)
				}
			})}
		</>
	)

	const RawContent = () => (
		<div className="raw-content">
			{markdown || ""}
		</div>
	)

	return (
		<StyledMarkdown>
			{markdown && <ToggleButton />}
			{showRaw ? <RawContent /> : <RenderedContent />}
		</StyledMarkdown>
	)
})

EnhancedMarkdownBlock.displayName = "EnhancedMarkdownBlock"

export default EnhancedMarkdownBlock
