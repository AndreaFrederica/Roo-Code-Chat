import React, { createContext, useContext, useState, useCallback } from "react"
import { Check, X, Info } from "lucide-react"
import { type Role } from "@roo-code/types"

// 通知类型
export interface Notification {
	id: string
	type: "info" | "success" | "warning" | "error"
	title: string
	message?: string
	duration?: number // 自动关闭时间（毫秒），0表示不自动关闭
	actions?: NotificationAction[]
}

export interface NotificationAction {
	label: string
	onClick: () => void
	primary?: boolean
}

// 通知Context
interface NotificationContextType {
	notifications: Notification[]
	addNotification: (notification: Omit<Notification, "id">) => void
	removeNotification: (id: string) => void
	clearAllNotifications: () => void
	showRoleDebugInfo: (role: Role) => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

// 通知Provider组件
export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [notifications, setNotifications] = useState<Notification[]>([])

	const addNotification = useCallback((notification: Omit<Notification, "id">) => {
		const id = Math.random().toString(36).substring(2, 9)
		const newNotification = { ...notification, id }

		setNotifications(prev => [...prev, newNotification])

		// 如果设置了自动关闭时间，则定时移除
		if (notification.duration && notification.duration > 0) {
			setTimeout(() => {
				removeNotification(id)
			}, notification.duration)
		}
	}, [])

	const removeNotification = useCallback((id: string) => {
		setNotifications(prev => prev.filter(n => n.id !== id))
	}, [])

	const clearAllNotifications = useCallback(() => {
		setNotifications([])
	}, [])

	// 显示角色调试信息的专用函数
	const showRoleDebugInfo = useCallback((role: Role) => {
		console.log('=== Role Debug Info ===');
		console.log('Role object type:', typeof role);
		console.log('Role constructor:', role.constructor.name);
		console.log('Role keys:', Object.keys(role));
		console.log('Full role object:', role);
		console.log('Role JSON string:', JSON.stringify(role, null, 2));
		console.log('Profile data:', role.profile);
		console.log('Profile type:', typeof role.profile);
		console.log('Profile keys:', role.profile ? Object.keys(role.profile) : 'No profile');
		console.log('Profile entries:', role.profile ? Object.entries(role.profile) : 'No profile');
		console.log('========================');
		const formatValue = (value: any, indent: number = 0): string => {
			console.log(`formatValue called with:`, { value, type: typeof value, isArray: Array.isArray(value), indent });
			
			if (value === undefined || value === null) {
				console.log('Value is undefined or null');
				return '未设定'
			}
			
			if (typeof value === 'string') {
				console.log('Value is string:', value);
				return value
			}
			
			if (typeof value === 'number' || typeof value === 'boolean') {
				console.log('Value is number/boolean:', value);
				return String(value)
			}
			
			if (Array.isArray(value)) {
				console.log('Value is array, length:', value.length);
				if (value.length === 0) {
					console.log('Array is empty');
					return '无'
				}
				const result = value.map((item, index) => {
					console.log(`Processing array item ${index}:`, item);
					if (typeof item === 'string') {
						return `  ${index + 1}. ${item}`
					}
					if (typeof item === 'object' && item !== null) {
						const formattedObj = Object.entries(item)
							.map(([k, v]) => `    ${k}: ${formatValue(v, indent + 2)}`)
							.join('\n')
						return `  ${index + 1}. {\n${formattedObj}\n  }`
					}
					return `  ${index + 1}. ${String(item)}`
				}).join('\n')
				console.log('Array formatted result:', result);
				return result
			}
			
			if (typeof value === 'object') {
				console.log('Value is object, keys:', Object.keys(value));
				const entries = Object.entries(value)
				if (entries.length === 0) {
					console.log('Object is empty');
					return '{}'
				}
				
				const indentStr = '  '.repeat(indent)
				const result = entries
					.map(([k, v]) => {
						console.log(`Processing object property ${k}:`, v);
						const formatted = formatValue(v, indent + 1);
						return `${indentStr}  ${k}: ${formatted}`
					})
					.join('\n')
				console.log('Object formatted result:', result);
				return result
			}
			
			console.log('Value fallback to String:', value);
			return String(value)
		}

		// 基本信息部分
		const basicInfo = [
			`角色基本信息:`,
			`- UUID: ${role.uuid}`,
			`- 名称: ${role.name}`,
			`- 类型: ${role.type}`,
			`- 描述: ${role.description || '无'}`,
			role.aliases && role.aliases.length > 0 ? `- 别名: ${role.aliases.join(', ')}` : '',
			role.affiliation ? `- 所属: ${role.affiliation}` : '',
			role.color ? `- 代表色: ${role.color}` : '',
			`- 创建时间: ${role.createdAt ? new Date(role.createdAt).toLocaleString() : '未知'}`,
			`- 更新时间: ${role.updatedAt ? new Date(role.updatedAt).toLocaleString() : '未知'}`,
		].filter(Boolean).join('\n')

		// Profile设定部分 - 动态处理所有字段
		let profileInfo = 'Profile设定: 无'
		console.log('Processing profile...', role.profile);
		if (role.profile && typeof role.profile === 'object' && Object.keys(role.profile).length > 0) {
			console.log('Profile has keys:', Object.keys(role.profile));
			const profileSections: string[] = ['Profile设定:']

			// 常见字段的友好显示名称
			const fieldNames: Record<string, string> = {
				'appearance': '外貌',
				'personality': '性格',
				'background': '背景',
				'skills': '技能',
				'titles': '称号',
				'hobbies': '爱好',
				'relationships': '关系',
				'notes': '备注',
				'speechStyle': '说话风格',
				'behaviorPatterns': '行为模式',
				'age': '年龄',
				'gender': '性别',
				'occupation': '职业',
				'代表符卡': '代表符卡',
				'个人特质': '个人特质',
				'能力': '能力',
				'武器': '武器',
				'装备': '装备'
			}

			Object.entries(role.profile).forEach(([key, value]) => {
				console.log(`Processing profile field: ${key} =`, value);
				console.log(`Field type: ${typeof value}, is array: ${Array.isArray(value)}`);
				
				if (value !== undefined && value !== null) {
					const displayName = fieldNames[key] || key
					console.log(`Display name for ${key}: ${displayName}`);
					
					const formattedValue = formatValue(value)
					console.log(`Formatted value for ${key}:`, formattedValue);
					
					// 确保formattedValue不为空
					if (formattedValue && formattedValue.trim() !== '' && formattedValue !== '未设定') {
						// 如果值是多行的，使用缩进格式
						if (formattedValue.includes('\n')) {
							profileSections.push(`- ${displayName}:`)
							profileSections.push(formattedValue.split('\n').map(line => `  ${line}`).join('\n'))
						} else {
							profileSections.push(`- ${displayName}: ${formattedValue}`)
						}
					} else {
						console.log(`Skipping ${key} because formatted value is empty or invalid`);
					}
				} else {
					console.log(`Skipping ${key} because value is null/undefined`);
				}
			})

			if (profileSections.length > 1) {
				profileInfo = profileSections.join('\n')
				console.log('Final profile info:', profileInfo);
			} else {
				console.log('No valid profile sections generated');
				profileInfo = 'Profile设定: 数据解析失败'
			}
		} else {
			console.log('No profile data or invalid profile structure');
		}

		// Timeline设定部分
		let timelineInfo = ''
		console.log('Processing timeline...', (role as any).timeline);
		
		const timeline = (role as any).timeline
		if (timeline) {
			// 检查是否是新的 StorylineFile 格式
			if (timeline.arcs && Array.isArray(timeline.arcs)) {
				console.log('Timeline has arcs:', timeline.arcs.length);
				const timelineSections: string[] = ['Timeline时间线:']
				
				timeline.arcs.forEach((arc: any, index: number) => {
					const arcInfo = [`${index + 1}. ${arc.title}`]
					if (arc.summary) {
						arcInfo.push(`   概述: ${arc.summary}`)
					}
					if (arc.tags && arc.tags.length > 0) {
						arcInfo.push(`   标签: ${arc.tags.join(', ')}`)
					}
					timelineSections.push(arcInfo.join('\n'))
				})
				
				timelineInfo = timelineSections.join('\n')
				console.log('Final timeline info (arcs):', timelineInfo);
			}
			// 兼容旧的数组格式
			else if (Array.isArray(timeline) && timeline.length > 0) {
				console.log('Timeline has entries (legacy format):', timeline.length);
				const timelineSections: string[] = ['Timeline时间线:']
				
				timeline.forEach((event: any, index: number) => {
					const eventStr = typeof event === 'string' ? event : 
						typeof event === 'object' ? formatValue(event) : String(event)
					timelineSections.push(`${index + 1}. ${eventStr}`)
				})
				
				timelineInfo = timelineSections.join('\n')
				console.log('Final timeline info (legacy):', timelineInfo);
			} else {
				console.log('Timeline exists but has no recognizable structure');
			}
		} else {
			console.log('No timeline data');
		}
		const knownFields = ['uuid', 'name', 'type', 'aliases', 'description', 'affiliation', 'color', 'profile', 'timeline', 'tags', 'packagePath', 'createdAt', 'updatedAt']
		const customFields: string[] = []

		Object.entries(role).forEach(([key, value]) => {
			if (!knownFields.includes(key) && value !== undefined && value !== null) {
				const formattedValue = formatValue(value)
				
				// 如果值是多行的，使用缩进格式
				if (formattedValue.includes('\n')) {
					customFields.push(`- ${key}:`)
					customFields.push(formattedValue.split('\n').map(line => `  ${line}`).join('\n'))
				} else {
					customFields.push(`- ${key}: ${formattedValue}`)
				}
			}
		})

		const customInfo = customFields.length > 0
			? `自定义字段:\n${customFields.join('\n')}`
			: ''

		const debugInfo = [basicInfo, profileInfo, timelineInfo, customInfo]
			.filter(Boolean)
			.join('\n\n')
			.trim()

		addNotification({
			type: "info",
			title: `角色调试信息: ${role.name}`,
			message: debugInfo,
			duration: 0, // 不自动关闭
			actions: [
				{
					label: "确认",
					onClick: () => removeNotification("debug-role"),
					primary: true
				}
			]
		})
	}, [addNotification, removeNotification])

	return (
		<NotificationContext.Provider value={{
			notifications,
			addNotification,
			removeNotification,
			clearAllNotifications,
			showRoleDebugInfo
		}}>
			{children}
			<NotificationCenter />
		</NotificationContext.Provider>
	)
}

// 通知中心组件
const NotificationCenter: React.FC = () => {
	const { notifications, removeNotification } = useNotification()

	if (notifications.length === 0) {
		return null
	}

	return (
		<div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-2xl max-h-[80vh] overflow-y-auto">
			{notifications.map((notification) => (
				<NotificationItem
					key={notification.id}
					notification={notification}
					onClose={() => removeNotification(notification.id)}
				/>
			))}
		</div>
	)
}

// 单个通知项组件
const NotificationItem: React.FC<{
	notification: Notification
	onClose: () => void
}> = ({ notification, onClose }) => {
	const getIcon = () => {
		switch (notification.type) {
			case "success":
				return <Check className="size-5 text-green-500" />
			case "error":
				return <X className="size-5 text-red-500" />
			case "warning":
				return <Info className="size-5 text-yellow-500" />
			default:
				return <Info className="size-5 text-blue-500" />
		}
	}

	const getBgColor = () => {
		switch (notification.type) {
			case "success":
				return "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
			case "error":
				return "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
			case "warning":
				return "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800"
			default:
				return "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800"
		}
	}

	return (
		<div className={`
			p-4 rounded-lg border shadow-lg backdrop-blur-sm max-h-[70vh] overflow-y-auto
			animate-in slide-in-from-bottom-2 fade-in-0 duration-200
			${getBgColor()}
		`}>
			<div className="flex items-start gap-3">
				{getIcon()}
				<div className="flex-1 min-w-0">
					<h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
						{notification.title}
					</h4>
					{notification.message && (
						<div className="mt-1 text-xs text-gray-700 dark:text-gray-300 whitespace-pre-line font-mono leading-relaxed overflow-x-auto">
							{notification.message}
						</div>
					)}
					{notification.actions && (
						<div className="mt-3 flex gap-2">
							{notification.actions.map((action, index) => (
								<button
									key={index}
									onClick={action.onClick}
									className={`
										px-3 py-1 text-xs rounded font-medium transition-colors
										${action.primary
											? "bg-blue-500 text-white hover:bg-blue-600"
											: "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
										}
									`}
								>
									{action.label}
								</button>
							))}
						</div>
					)}
				</div>
				<button
					onClick={onClose}
					className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
				>
					<X className="size-4" />
				</button>
			</div>
		</div>
	)
}

// Hook for using notifications
export const useNotification = () => {
	const context = useContext(NotificationContext)
	if (!context) {
		throw new Error("useNotification must be used within a NotificationProvider")
	}
	return context
}

export default NotificationProvider