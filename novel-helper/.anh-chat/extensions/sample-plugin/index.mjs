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
	}
}

export async function deactivate(context) {
	context.logger.info(`[${context.manifest.name}] deactivated`)
}
