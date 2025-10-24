import { useEffect, useMemo, useState } from "react"
import { getCssVariableValue, getThemeManager, isStandaloneThemeEnvironment, type Theme } from "../utils/theme-manager"

const getVsCodeEffectiveTheme = (): "light" | "dark" => {
	if (typeof document === "undefined") {
		return "dark"
	}

	const themeKind = document.body?.getAttribute("data-vscode-theme-kind") ?? ""
	return themeKind.toLowerCase().includes("light") ? "light" : "dark"
}

export const useTheme = () => {
	const isStandalone = isStandaloneThemeEnvironment()
	const themeManager = useMemo(() => (isStandalone ? getThemeManager() : null), [isStandalone])

	const [theme, setThemeState] = useState<"light" | "dark">(() => {
		if (isStandalone && themeManager) {
			return themeManager.getEffectiveTheme()
		}
		return getVsCodeEffectiveTheme()
	})

	useEffect(() => {
		if (!isStandalone) {
			if (typeof document === "undefined" || !document.body) {
				return
			}
			const observer = new MutationObserver(() => setThemeState(getVsCodeEffectiveTheme()))
			observer.observe(document.body, { attributes: true, attributeFilter: ["data-vscode-theme-kind"] })
			return () => observer.disconnect()
		}

		if (themeManager) {
			return themeManager.onThemeChange((newTheme) => {
				setThemeState(newTheme)
			})
		}

		return
	}, [isStandalone, themeManager])

	useEffect(() => {
		if (!isStandalone || typeof document === "undefined") {
			return
		}

		const root = document.documentElement
		const body = document.body

		if (root) {
			root.setAttribute("data-theme", theme)
			root.style.colorScheme = theme
		}

		if (body) {
			const themeClasses = ["theme-light", "theme-dark", "vscode-light", "vscode-dark"]
			body.classList.remove(...themeClasses)
			body.classList.add(`theme-${theme}`, `vscode-${theme}`)
			body.setAttribute("data-theme", theme)
			body.setAttribute("data-vscode-theme-kind", `vscode-${theme}`)
		}
	}, [theme, isStandalone])

	return {
		theme,
		isDark: theme === "dark",
		isLight: theme === "light",
		currentTheme: isStandalone && themeManager ? themeManager.getCurrentTheme() : ("system" as Theme),
		setTheme: (newTheme: Theme) => {
			if (themeManager) {
				themeManager.setTheme(newTheme)
			}
		},
		toggleTheme: () => {
			if (themeManager) {
				themeManager.toggleTheme()
			}
		},
		getCSSVariable: (variableName: string) => getCssVariableValue(variableName),
	}
}
