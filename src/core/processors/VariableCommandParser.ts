// 变量命令的AST解析器 - 后端版本
// 与前端webview-ui/src/components/common/VariableCommandParser.ts保持完全一致

export interface ASTNode {
	type: 'call' | 'identifier' | 'string' | 'number' | 'property' | 'argument_list'
	value: string
	children?: ASTNode[]
	position?: { start: number; end: number }
}

export interface ParsedCommand {
	type: 'set' | 'add' | 'insert' | 'remove'
	method: string
	variable: string
	value?: string | number
	comment?: string
	position?: { start: number; end: number }
}

export class VariableCommandParser {
	private input: string
	private position: number = 0

	constructor(input: string) {
		this.input = input
	}

	// 解析所有命令
	parseCommands(): ParsedCommand[] {
		const commands: ParsedCommand[] = []

		while (this.position < this.input.length) {
			this.skipWhitespace()

			if (this.position >= this.input.length) break

			// 查找 _. 开头的调用
			if (this.input.slice(this.position).startsWith('_.')) {
				this.position += 2
				this.skipWhitespace()

				const command = this.parseCommand()
				if (command) {
					commands.push(command)
				}
			} else {
				this.position++
			}
		}

		return commands
	}

	// 解析单个命令
	private parseCommand(): ParsedCommand | null {
		const startPos = this.position

		// 解析方法名
		const method = this.parseIdentifier()
		if (!method) return null

		this.skipWhitespace()

		// 解析参数列表
		if (!this.consume('(')) return null

		this.skipWhitespace()

		const args = this.parseArgumentList()

		this.skipWhitespace()

		if (!this.consume(')')) return null

		// 解析注释
		this.skipWhitespace()
		let comment: string | undefined
		if (this.input[this.position] === ';' || this.input.slice(this.position).startsWith('//')) {
			comment = this.parseComment()
		}

		const endPos = this.position

		// 构建命令对象
		const command: ParsedCommand = {
			type: method as ParsedCommand['type'],
			method: `_.${method}`,
			variable: '',
			comment,
			position: { start: startPos, end: endPos }
		}

		// 解析参数
		if (args.length >= 2) {
			command.variable = this.extractStringValue(args[0])

			if (method === 'set') {
				command.value = this.extractStringValue(args[1])
				if (args.length >= 3) {
					command.comment = this.extractStringValue(args[2])
				}
			} else if (method === 'add') {
				command.value = this.extractNumberValue(args[1])
			} else if (method === 'insert' || method === 'remove') {
				command.value = this.extractStringValue(args[1])
			}
		}

		return command
	}

	// 解析标识符
	private parseIdentifier(): string | null {
		this.skipWhitespace()

		let result = ''
		while (this.position < this.input.length) {
			const char = this.input[this.position]

			if (/[a-zA-Z_$]/.test(char) || (result && /[0-9]/.test(char))) {
				result += char
				this.position++
			} else {
				break
			}
		}

		return result || null
	}

	// 解析参数列表
	private parseArgumentList(): string[] {
		const args: string[] = []
		let currentArg = ''
		let inString = false
		let stringChar = ''
		let depth = 0

		while (this.position < this.input.length) {
			const char = this.input[this.position]

			if (!inString && (char === '"' || char === "'")) {
				inString = true
				stringChar = char
				currentArg += char
				this.position++
			} else if (inString && char === stringChar) {
				inString = false
				currentArg += char
				this.position++
			} else if (!inString && char === '(') {
				depth++
				currentArg += char
				this.position++
			} else if (!inString && char === ')') {
				if (depth === 0) {
					// 参数列表结束
					break
				} else {
					depth--
					currentArg += char
					this.position++
				}
			} else if (!inString && char === ',' && depth === 0) {
				// 参数分隔符
				args.push(currentArg.trim())
				currentArg = ''
				this.position++
				this.skipWhitespace()
			} else {
				currentArg += char
				this.position++
			}
		}

		if (currentArg.trim()) {
			args.push(currentArg.trim())
		}

		return args
	}

	// 解析注释
	private parseComment(): string | undefined {
		this.skipWhitespace()

		if (this.input.slice(this.position).startsWith('//')) {
			this.position += 2
			const start = this.position
			while (this.position < this.input.length && this.input[this.position] !== '\n') {
				this.position++
			}
			return this.input.slice(start, this.position).trim()
		}

		if (this.input[this.position] === ';') {
			this.position++
			const start = this.position
			while (this.position < this.input.length && this.input[this.position] !== '\n') {
				this.position++
			}
			return this.input.slice(start, this.position).trim()
		}

		return undefined
	}

	// 提取字符串值
	private extractStringValue(arg: string): string {
		if ((arg.startsWith('"') && arg.endsWith('"')) ||
			(arg.startsWith("'") && arg.endsWith("'"))) {
			return arg.slice(1, -1)
		}
		return arg
	}

	// 提取数字值
	private extractNumberValue(arg: string): number {
		const num = parseInt(arg, 10)
		return isNaN(num) ? 0 : num
	}

	// 跳过空白字符
	private skipWhitespace(): void {
		while (this.position < this.input.length && /\s/.test(this.input[this.position])) {
			this.position++
		}
	}

	// 消费特定字符
	private consume(char: string): boolean {
		if (this.position < this.input.length && this.input[this.position] === char) {
			this.position++
			return true
		}
		return false
	}
}

/**
 * 从文本中提取 UpdateVariable 块的内容
 * 与前端 fold-config.ts 中的逻辑保持一致
 * @param input 包含 UpdateVariable 块的文本
 * @returns 提取出的 UpdateVariable 内容数组
 */
function extractUpdateVariableBlocks(input: string): string[] {
	const updateVariableRegex = /<\s*UpdateVariable\b[^>]*>(?<content>[\s\S]*?)(?:<\s*\/\s*UpdateVariable\b[^>]*>|$)/gi
	const blocks: string[] = []
	let match

	while ((match = updateVariableRegex.exec(input)) !== null) {
		const content = match.groups?.content?.trim()
		if (content) {
			blocks.push(content)
		}
	}

	return blocks
}

// 便捷函数：解析变量命令字符串
export function parseVariableCommands(input: string): ParsedCommand[] {
	const parser = new VariableCommandParser(input)
	return parser.parseCommands()
}

/**
 * 从消息文本中解析变量命令（包含 UpdateVariable 块处理）
 * 与前端的处理逻辑保持一致：
 * 1. 首先尝试从 UpdateVariable 块中提取内容并解析
 * 2. 如果没有 UpdateVariable 块，则直接解析整个文本
 * @param input 消息文本
 * @returns 解析后的命令数组
 */
export function parseVariableCommandsWithUpdateVariable(input: string): ParsedCommand[] {
	const allCommands: ParsedCommand[] = []

	// 1. 首先提取 UpdateVariable 块内容
	const updateVariableBlocks = extractUpdateVariableBlocks(input)
	updateVariableBlocks.forEach(block => {
		const commands = parseVariableCommands(block)
		allCommands.push(...commands)
	})

	// 2. 如果没有找到 UpdateVariable 块，则解析整个文本
	if (updateVariableBlocks.length === 0) {
		const commands = parseVariableCommands(input)
		allCommands.push(...commands)
	}

	return allCommands
}