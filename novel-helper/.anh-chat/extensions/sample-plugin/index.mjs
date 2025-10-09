/**
 * Sample system prompt plugin.
 * Logs the role prompt data (if any) and appends a confirmation banner to the system prompt.
 */

export async function activate(context) {
	context.logger.info(`[${context.manifest.name}] activated at ${context.extensionPath}`)

	const os = context.getModule("os")
	if (os) {
		context.logger.info(
			`[${context.manifest.name}] Detected platform ${os.platform?.()} ${os.release?.()}`
		)
	}

	const echoToolId = "echo_message"
	const toolDefinition = {
		name: echoToolId,
		displayName: "Echo Message",
		description: "Echoes the provided text and logs it to the sample plugin output channel.",
		prompt: [
			"### Sample Plugin Tool",
			`- \`extension:${context.id}/${echoToolId}\` — Echo the provided \`text\` parameter and log it to the sample plugin output channel.`,
			"  - Parameters:",
			"    - `text`: message content to echo back.",
		].join("\n"),
		requiresApproval: false,
	}

	return {
		systemPrompt(systemContext) {
			const { rolePromptData } = systemContext
			const logRoleData = context.getSetting("logRoleData") !== false
			const appendMessageSetting = context.getSetting("appendMessage")
			const appendMessage =
				typeof appendMessageSetting === "string" && appendMessageSetting.trim().length > 0
					? appendMessageSetting.trim()
					: "This system prompt contains additions from Sample Prompt Logger."

			if (logRoleData) {
				if (rolePromptData) {
					context.logger.info(
						`[${context.manifest.name}] rolePromptData received`,
						JSON.stringify(rolePromptData, null, 2),
					)
				} else {
					context.logger.info(`[${context.manifest.name}] no rolePromptData present`)
				}
			}

			const banner = ["### Plugin Notice", appendMessage].join("\n")

			return { append: `\n\n${banner}` }
		},
		systemPromptFinal({ finalPrompt, mode }) {
			const preview = finalPrompt.slice(0, 160).replace(/\s+/g, " ").trim()
			context.logger.info(
				`[${context.manifest.name}] Final prompt (${mode ?? "unknown"}) length: ${finalPrompt.length}, preview: ${preview}`,
			)
		},
		tools: {
			async getTools() {
				return [toolDefinition]
			},
			async invoke({ parameters }) {
				const textParam = typeof parameters.text === "string" ? parameters.text.trim() : ""
				if (!textParam) {
					return { success: false, error: "Parameter 'text' is required." }
				}

				context.logger.info(
					`[${context.manifest.name}] echo_message invoked with text: ${textParam}`,
				)

				return {
					success: true,
					message: `Plugin echo: ${textParam}`,
				}
			},
		},
	}
}

export async function deactivate(context) {
	context.logger.info(`[${context.manifest.name}] deactivated`)
}
