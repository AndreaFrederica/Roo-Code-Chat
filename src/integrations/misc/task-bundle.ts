import * as vscode from "vscode"
import * as path from "path"
import os from "os"

import type { TaskBundle } from "../../core/task-persistence/taskBundle"

export async function saveTaskBundleFile(defaultTimestamp: number, bundle: TaskBundle) {
	const date = new Date(defaultTimestamp)
	const month = date.toLocaleString("en-US", { month: "short" }).toLowerCase()
	const day = date.getDate()
	const year = date.getFullYear()
	const hours = date.getHours().toString().padStart(2, "0")
	const minutes = date.getMinutes().toString().padStart(2, "0")
	const seconds = date.getSeconds().toString().padStart(2, "0")

	const defaultFileName = `roo_task_bundle_${month}-${day}-${year}_${hours}-${minutes}-${seconds}.roo-task.json`

	const saveUri = await vscode.window.showSaveDialog({
		filters: { "Roo Task Bundle": ["roo-task.json", "json"] },
		defaultUri: vscode.Uri.file(path.join(os.homedir(), "Downloads", defaultFileName)),
	})

	if (!saveUri) {
		return false
	}

	const serialized = JSON.stringify(bundle, null, 2)
	await vscode.workspace.fs.writeFile(saveUri, Buffer.from(serialized, "utf8"))

	await vscode.window.showInformationMessage(`任务已导出：${saveUri.fsPath}`)
	return true
}

