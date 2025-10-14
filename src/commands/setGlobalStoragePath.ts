import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import { constants as fsConstants } from "fs"

import { Package } from "../shared/package"
import { getGlobalStorageServiceInstance } from "../services/storage/GlobalStorageService"

/**
 * 设置全局存储路径的命令处理器
 */
export async function setGlobalStoragePath(): Promise<void> {
	if (!vscode.window || !vscode.workspace) {
		console.error("VS Code API not available")
		return
	}

	let currentPath = ""
	try {
		const currentConfig = vscode.workspace.getConfiguration(Package.name)
		currentPath = currentConfig.get<string>("globalStoragePath", "")
	} catch (error) {
		console.error("Could not access configuration")
		return
	}

	const result = await vscode.window.showInputBox({
		value: currentPath,
		placeHolder: "留空使用默认路径 (~/.anh-chat)",
		prompt: "设置全局数据存储路径（角色、历史记录等）",
		validateInput: async (input) => {
			if (!input) {
				return null // 允许空值（使用默认路径）
			}

			try {
				// 验证路径格式
				path.parse(input)

				// 检查路径是否为绝对路径
				if (!path.isAbsolute(input)) {
					return "请输入绝对路径"
				}

				// 检查路径是否可访问
				await fs.mkdir(input, { recursive: true })
				await fs.access(input, fsConstants.R_OK | fsConstants.W_OK | fsConstants.X_OK)

				return null // 路径有效
			} catch (error) {
				return `路径无效或无法访问: ${error instanceof Error ? error.message : String(error)}`
			}
		},
	})

	// 如果用户取消操作，result 将为 undefined
	if (result !== undefined) {
		try {
			const currentConfig = vscode.workspace.getConfiguration(Package.name)
			await currentConfig.update("globalStoragePath", result, vscode.ConfigurationTarget.Global)

			if (result) {
				try {
					// 测试路径是否可访问
					await fs.mkdir(result, { recursive: true })
					await fs.access(result, fsConstants.R_OK | fsConstants.W_OK | fsConstants.X_OK)
					vscode.window.showInformationMessage(`全局存储路径已设置为: ${result}`)

					// 重新初始化全局存储服务以使用新路径
					const globalStorageService = getGlobalStorageServiceInstance()
					if (globalStorageService) {
						await globalStorageService.reinitialize()
						vscode.window.showInformationMessage("全局存储服务已重新初始化")
					}
				} catch (error) {
					vscode.window.showErrorMessage(
						`无法访问路径 ${result}: ${error instanceof Error ? error.message : String(error)}`
					)
				}
			} else {
				vscode.window.showInformationMessage("已恢复使用默认全局存储路径 (~/.anh-chat)")

				// 重新初始化全局存储服务以使用默认路径
				const globalStorageService = getGlobalStorageServiceInstance()
				if (globalStorageService) {
					await globalStorageService.reinitialize()
					vscode.window.showInformationMessage("全局存储服务已重新初始化为默认路径")
				}
			}
		} catch (error) {
			console.error("Failed to update configuration", error)
			vscode.window.showErrorMessage("更新配置失败")
		}
	}
}

/**
 * 获取当前全局存储路径信息
 */
export async function getGlobalStorageInfo(): Promise<void> {
	const globalStorageService = getGlobalStorageServiceInstance()
	if (!globalStorageService) {
		vscode.window.showErrorMessage("全局存储服务未初始化")
		return
	}

	const storageInfo = globalStorageService.getStorageInfo()
	const defaultPath = globalStorageService.getDefaultStoragePath()
	const currentPath = globalStorageService.getCurrentStoragePath()

	const message = `
默认全局存储路径: ${defaultPath}
当前全局存储路径: ${currentPath}
角色存储路径: ${storageInfo.globalRolesPath}
角色记忆存储路径: ${globalStorageService.getGlobalMemoryPath()}
历史记录存储路径: ${storageInfo.globalHistoryPath}
TSProfile 存储路径: ${storageInfo.globalTsProfilesPath}
世界书存储路径: ${storageInfo.globalWorldBooksPath}
世界集存储路径: ${storageInfo.globalWorldsetsPath}
扩展存储路径: ${storageInfo.globalExtensionsPath}
	`.trim()

	const result = await vscode.window.showInformationMessage(
		"全局存储路径信息",
		"打开根文件夹",
		"打开角色文件夹",
		"打开TSProfile文件夹",
		"打开世界书文件夹",
		"打开扩展文件夹",
		"复制根路径"
	)

	if (result === "打开根文件夹") {
		try {
			await vscode.env.openExternal(vscode.Uri.file(storageInfo.globalDataPath))
		} catch (error) {
			vscode.window.showErrorMessage(`无法打开文件夹: ${error instanceof Error ? error.message : String(error)}`)
		}
	} else if (result === "打开角色文件夹") {
		try {
			await vscode.env.openExternal(vscode.Uri.file(storageInfo.globalRolesPath))
		} catch (error) {
			vscode.window.showErrorMessage(`无法打开角色文件夹: ${error instanceof Error ? error.message : String(error)}`)
		}
	} else if (result === "打开TSProfile文件夹") {
		try {
			await vscode.env.openExternal(vscode.Uri.file(storageInfo.globalTsProfilesPath))
		} catch (error) {
			vscode.window.showErrorMessage(`无法打开TSProfile文件夹: ${error instanceof Error ? error.message : String(error)}`)
		}
	} else if (result === "打开世界书文件夹") {
		try {
			await vscode.env.openExternal(vscode.Uri.file(storageInfo.globalWorldBooksPath))
		} catch (error) {
			vscode.window.showErrorMessage(`无法打开世界书文件夹: ${error instanceof Error ? error.message : String(error)}`)
		}
	} else if (result === "打开扩展文件夹") {
		try {
			await vscode.env.openExternal(vscode.Uri.file(storageInfo.globalExtensionsPath))
		} catch (error) {
			vscode.window.showErrorMessage(`无法打开扩展文件夹: ${error instanceof Error ? error.message : String(error)}`)
		}
	} else if (result === "复制根路径") {
		try {
			await vscode.env.clipboard.writeText(storageInfo.globalDataPath)
			vscode.window.showInformationMessage("路径已复制到剪贴板")
		} catch (error) {
			vscode.window.showErrorMessage("复制路径失败")
		}
	}
}