import * as fs from "fs/promises"
import * as path from "path"

import type { HistoryItem } from "@roo-code/types"

import { fileExistsAtPath } from "../../utils/fs"

export interface TaskBundleFile {
	path: string
	encoding: "base64"
	content: string
}

export interface TaskBundle {
	version: 1
	exportedAt: string
	historyItem: HistoryItem
	files: TaskBundleFile[]
	metadata?: {
		extensionVersion?: string
	}
}

type CollectOptions = {
	baseDir: string
	currentDir: string
}

async function collectTaskFiles({ baseDir, currentDir }: CollectOptions): Promise<TaskBundleFile[]> {
	const entries = await fs.readdir(currentDir, { withFileTypes: true })
	const results: TaskBundleFile[] = []

	for (const entry of entries) {
		const absolutePath = path.join(currentDir, entry.name)
		const relativePath = path.relative(baseDir, absolutePath).replace(/\\/g, "/")

		if (entry.isDirectory()) {
			const nested = await collectTaskFiles({ baseDir, currentDir: absolutePath })
			results.push(...nested)
		} else if (entry.isFile()) {
			const buffer = await fs.readFile(absolutePath)
			results.push({
				path: relativePath,
				encoding: "base64",
				content: buffer.toString("base64"),
			})
		}
	}

	return results
}

export async function createTaskBundle(taskDir: string, historyItem: HistoryItem, extensionVersion?: string): Promise<TaskBundle> {
	const normalizedHistoryItem = JSON.parse(JSON.stringify(historyItem)) as HistoryItem
	const files = await collectTaskFiles({ baseDir: taskDir, currentDir: taskDir })

	const totalSize = files.reduce((sum, file) => sum + Buffer.from(file.content, "base64").length, 0)

	if (typeof normalizedHistoryItem.size !== "number" || normalizedHistoryItem.size <= 0) {
		normalizedHistoryItem.size = totalSize
	}

	return {
		version: 1,
		exportedAt: new Date().toISOString(),
		historyItem: normalizedHistoryItem,
		files,
		metadata: {
			extensionVersion,
		},
	}
}

export function parseTaskBundle(raw: string): TaskBundle {
	const bundle = JSON.parse(raw) as TaskBundle

	if (!bundle || typeof bundle !== "object") {
		throw new Error("Invalid bundle format")
	}

	if (bundle.version !== 1) {
		throw new Error("Unsupported bundle version")
	}

	if (!bundle.historyItem || typeof bundle.historyItem !== "object") {
		throw new Error("Missing history item in bundle")
	}

	if (!Array.isArray(bundle.files)) {
		throw new Error("Invalid file list in bundle")
	}

	return bundle
}

export async function writeTaskBundleToDirectory(taskDir: string, bundle: TaskBundle): Promise<void> {
	// Clear existing directory contents first to avoid stale files
	if (await fileExistsAtPath(taskDir)) {
		await fs.rm(taskDir, { recursive: true, force: true })
	}

	await fs.mkdir(taskDir, { recursive: true })

	for (const file of bundle.files) {
		const sanitizedRelativePath = path.normalize(file.path).replace(/\\/g, "/")

		if (sanitizedRelativePath === "" || sanitizedRelativePath.startsWith("../") || sanitizedRelativePath.includes("/../")) {
			throw new Error(`Invalid file path in bundle: ${file.path}`)
		}

		const destinationPath = path.join(taskDir, sanitizedRelativePath)
		const normalizedDestination = path.normalize(destinationPath)

		if (!normalizedDestination.startsWith(path.normalize(taskDir))) {
			throw new Error(`Attempted to write outside of task directory: ${file.path}`)
		}

		await fs.mkdir(path.dirname(normalizedDestination), { recursive: true })
		await fs.writeFile(normalizedDestination, Buffer.from(file.content, "base64"))
	}
}
