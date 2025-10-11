import * as vscode from "vscode";

/**
 * 获取debug设置状态
 * @returns 是否启用debug模式
 */
export function isDebugEnabled(): boolean {
	const config = vscode.workspace.getConfiguration('anh-cline');
	return config.get<boolean>('debug.enabled', false);
}

/**
 * debug日志输出，只有在debug模式启用时才会输出
 * @param message 日志消息
 * @param data 可选的数据对象
 */
export function debugLog(message: string, ...data: any[]): void {
	if (isDebugEnabled()) {
		console.log(`[DEBUG] ${message}`, ...data);
	}
}

/**
 * debug信息输出，只有在debug模式启用时才会输出
 * @param message 信息消息
 * @param data 可选的数据对象
 */
export function debugInfo(message: string, ...data: any[]): void {
	if (isDebugEnabled()) {
		console.info(`[DEBUG] ${message}`, ...data);
	}
}

/**
 * debug警告输出，只有在debug模式启用时才会输出
 * @param message 警告消息
 * @param data 可选的数据对象
 */
export function debugWarn(message: string, ...data: any[]): void {
	if (isDebugEnabled()) {
		console.warn(`[DEBUG] ${message}`, ...data);
	}
}

/**
 * debug错误输出，只有在debug模式启用时才会输出
 * @param message 错误消息
 * @param data 可选的数据对象
 */
export function debugError(message: string, ...data: any[]): void {
	if (isDebugEnabled()) {
		console.error(`[DEBUG] ${message}`, ...data);
	}
}