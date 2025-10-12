import * as path from "path"
import * as fs from "fs/promises"

const ANH_CHAT_DIR = path.join("novel-helper", ".anh-chat")

export function getAnhChatRoot(basePath: string): string {
	return path.join(basePath, ANH_CHAT_DIR)
}

export async function ensureDirectory(dirPath: string) {
	await fs.mkdir(dirPath, { recursive: true })
}

export async function ensureAnhChatRoot(basePath: string): Promise<string> {
	// 检查是否已经包含完整的路径
	if (basePath.endsWith(ANH_CHAT_DIR)) {
		await ensureDirectory(basePath)
		return basePath
	}
	const root = getAnhChatRoot(basePath)
	await ensureDirectory(root)
	return root
}
