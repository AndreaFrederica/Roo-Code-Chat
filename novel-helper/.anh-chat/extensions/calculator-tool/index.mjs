/**
 * Calculator Launcher plugin.
 * Exposes a tool that launches the platform calculator application.
 */

const CALCULATOR_TOOL_ID = "open_calculator"

export async function activate(context) {
	const logger = context.logger
	logger.info(`[${context.manifest.name}] activated at ${context.extensionPath}`)

	const os = context.getModule("os")
	let childProcess

	try {
		childProcess = await import("child_process")
	} catch (error) {
		logger.error(
			`[${context.manifest.name}] Failed to load child_process module: ${
				error instanceof Error ? error.message : String(error)
			}`,
		)
		childProcess = null
	}

	const toolDefinition = {
		name: CALCULATOR_TOOL_ID,
		displayName: "Open Calculator",
		description: "Launches the system calculator application.",
		prompt: [
			"### Calculator Launcher Tool",
			`- \`extension:${context.id}/${CALCULATOR_TOOL_ID}\` — Launch the user's calculator application.`,
			"  - No parameters are required.",
		].join("\n"),
		requiresApproval: true,
	}

	return {
		tools: {
			async getTools() {
				return [toolDefinition]
			},
			async invoke() {
				if (!childProcess?.spawn) {
					return {
						success: false,
						error: "child_process module is unavailable; cannot launch calculator.",
					}
				}

				const platform = os?.platform?.() ?? process.platform
				let command
				let args = []

				if (platform === "win32") {
					command = "calc"
				} else if (platform === "darwin") {
					command = "open"
					args = ["-a", "Calculator"]
				} else {
					// Attempt common Linux commands
					command = "gnome-calculator"
				}

				try {
					const child = childProcess.spawn(command, args, {
						detached: true,
						stdio: "ignore",
					})
					child.unref()
					logger.info(
						`[${context.manifest.name}] Launched calculator using command: ${command} ${args.join(" ")}`,
					)
					return {
						success: true,
						message: `Launching calculator with command: ${command} ${args.join(" ")}`.trim(),
					}
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error)
					logger.error(`[${context.manifest.name}] Failed to launch calculator: ${message}`)
					return {
						success: false,
						error: `Failed to launch calculator: ${message}`,
					}
				}
			},
		},
	}
}

export async function deactivate(context) {
	context.logger.info(`[${context.manifest.name}] deactivated`)
}
