import { render, screen, fireEvent } from "@testing-library/react"
import EnhancedMarkdownBlock from "../EnhancedMarkdownBlock"

// Mock the ExtensionStateContext
jest.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		reasoningBlockCollapsed: true,
	}),
}))

// Mock the translation context
jest.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

describe("EnhancedMarkdownBlock", () => {
	it("should render plain text without thinking blocks", () => {
		const markdown = "This is a simple text message."
		render(<EnhancedMarkdownBlock markdown={markdown} />)

		expect(screen.getByText("This is a simple text message.")).toBeInTheDocument()
	})

	it("should render Chinese thinking blocks as collapsible", () => {
		const markdown = `这是一段普通文本。

<思考>
这是思考内容，应该被隐藏在折叠块中。
包含一些 **markdown** 格式。
</thinking>

这是另一段普通文本。`

		render(<EnhancedMarkdownBlock markdown={markdown} />)

		// Check that normal text is rendered
		expect(screen.getByText("这是一段普通文本。")).toBeInTheDocument()
		expect(screen.getByText("这是另一段普通文本。")).toBeInTheDocument()

		// Check that thinking block header is present
		expect(screen.getByText("chat:reasoning.thinking")).toBeInTheDocument()

		// Thinking content should not be visible when collapsed
		expect(screen.queryByText("这是思考内容，应该被隐藏在折叠块中。")).not.toBeInTheDocument()
	})

	it("should render English thinking blocks as collapsible", () => {
		const markdown = `This is normal text.

<thinking>
This is thinking content that should be hidden in a collapsible block.
With some **markdown** formatting.
</thinking>

This is more normal text.`

		render(<EnhancedMarkdownBlock markdown={markdown} />)

		// Check that normal text is rendered
		expect(screen.getByText("This is normal text.")).toBeInTheDocument()
		expect(screen.getByText("This is more normal text.")).toBeInTheDocument()

		// Check that thinking block header is present
		expect(screen.getByText("chat:reasoning.thinking")).toBeInTheDocument()

		// Thinking content should not be visible when collapsed
		expect(
			screen.queryByText("This is thinking content that should be hidden in a collapsible block."),
		).not.toBeInTheDocument()
	})

	it("should toggle thinking block visibility when clicked", () => {
		const markdown = `Normal text

<思考>
Hidden thinking content
</thinking>

More text`

		render(<EnhancedMarkdownBlock markdown={markdown} />)

		// Initially collapsed
		expect(screen.queryByText("Hidden thinking content")).not.toBeInTheDocument()

		// Click to expand
		const thinkingHeader = screen.getByText("chat:reasoning.thinking").closest("div")
		fireEvent.click(thinkingHeader!)

		// Should now be visible
		expect(screen.getByText("Hidden thinking content")).toBeInTheDocument()

		// Click to collapse again
		fireEvent.click(thinkingHeader!)

		// Should be hidden again
		expect(screen.queryByText("Hidden thinking content")).not.toBeInTheDocument()
	})

	it("should handle multiple thinking blocks", () => {
		const markdown = `Text 1

<思考>
First thinking block
</thinking>

Text 2

<thinking>
Second thinking block
</thinking>

Text 3`

		render(<EnhancedMarkdownBlock markdown={markdown} />)

		// All normal text should be visible
		expect(screen.getByText("Text 1")).toBeInTheDocument()
		expect(screen.getByText("Text 2")).toBeInTheDocument()
		expect(screen.getByText("Text 3")).toBeInTheDocument()

		// Should have two thinking block headers
		const thinkingHeaders = screen.getAllByText("chat:reasoning.thinking")
		expect(thinkingHeaders).toHaveLength(2)

		// Thinking content should be collapsed
		expect(screen.queryByText("First thinking block")).not.toBeInTheDocument()
		expect(screen.queryByText("Second thinking block")).not.toBeInTheDocument()
	})

	it("should handle mixed Chinese and English thinking tags", () => {
		const markdown = `Normal text

<思考>
Chinese thinking content
</thinking>

Middle text

<thinking>
English thinking content
</thinking>

End text`

		render(<EnhancedMarkdownBlock markdown={markdown} />)

		// All normal text should be visible
		expect(screen.getByText("Normal text")).toBeInTheDocument()
		expect(screen.getByText("Middle text")).toBeInTheDocument()
		expect(screen.getByText("End text")).toBeInTheDocument()

		// Should have two thinking block headers
		const thinkingHeaders = screen.getAllByText("chat:reasoning.thinking")
		expect(thinkingHeaders).toHaveLength(2)

		// Thinking content should be collapsed
		expect(screen.queryByText("Chinese thinking content")).not.toBeInTheDocument()
		expect(screen.queryByText("English thinking content")).not.toBeInTheDocument()
	})

	it("should handle empty thinking blocks", () => {
		const markdown = `Text before

<思考>

</thinking>

Text after`

		render(<EnhancedMarkdownBlock markdown={markdown} />)

		// Normal text should be visible
		expect(screen.getByText("Text before")).toBeInTheDocument()
		expect(screen.getByText("Text after")).toBeInTheDocument()

		// Empty thinking block should still create a header
		expect(screen.getByText("chat:reasoning.thinking")).toBeInTheDocument()
	})

	it("should handle nested thinking blocks gracefully", () => {
		const markdown = `Normal text

<思考>
Outer thinking content
<思考>
Inner thinking content
</thinking>
More outer content
</thinking>

End text`

		render(<EnhancedMarkdownBlock markdown={markdown} />)

		// Normal text should be visible
		expect(screen.getByText("Normal text")).toBeInTheDocument()
		expect(screen.getByText("End text")).toBeInTheDocument()

		// Should have thinking block header
		expect(screen.getByText("chat:reasoning.thinking")).toBeInTheDocument()
	})

	it("should handle malformed thinking tags gracefully", () => {
		const markdown = `Normal text

<思考>
Unclosed thinking content

<thinking>
Another unclosed block

End text`

		render(<EnhancedMarkdownBlock markdown={markdown} />)

		// Normal text should be visible
		expect(screen.getByText("Normal text")).toBeInTheDocument()
		expect(screen.getByText("End text")).toBeInTheDocument()

		// Should not crash and should not show thinking headers for malformed tags
		expect(screen.queryByText("chat:reasoning.thinking")).not.toBeInTheDocument()
	})
})
