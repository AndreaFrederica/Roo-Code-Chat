/**
 * 网页版主题管理器
 * 负责检测和切换深色/浅色主题
 */

export type Theme = 'light' | 'dark' | 'system'

const isStandaloneEnvironment = () =>
  typeof window !== 'undefined' && typeof (window as any).acquireVsCodeApi !== 'function'

export class ThemeManager {
  private static instance: ThemeManager
  private currentTheme: Theme = 'system'
  private systemMediaQuery: MediaQueryList | null = null
  private listeners: Set<(theme: 'light' | 'dark') => void> = new Set()

  private constructor() {
    this.init()
  }

  public static getInstance(): ThemeManager {
    if (!isStandaloneEnvironment()) {
      throw new Error('ThemeManager is only available in standalone browser mode')
    }
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager()
    }
    return ThemeManager.instance
  }

  private init() {
    // 检查系统主题支持
    if (typeof window !== 'undefined' && window.matchMedia) {
      this.systemMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

      // 监听系统主题变化
      this.systemMediaQuery.addEventListener('change', this.handleSystemThemeChange.bind(this))
    }

    // 从本地存储恢复用户设置
    this.loadSavedTheme()

    // 应用初始主题
    this.applyTheme()
  }

  private handleSystemThemeChange = (e: MediaQueryListEvent) => {
    if (this.currentTheme === 'system') {
      this.applyTheme()
      this.notifyListeners(e.matches ? 'dark' : 'light')
    }
  }

  private loadSavedTheme() {
    try {
      const saved = localStorage.getItem('standalone-theme')
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        this.currentTheme = saved
      }
    } catch (error) {
      console.warn('Failed to load theme from localStorage:', error)
    }
  }

  private saveTheme(theme: Theme) {
    try {
      localStorage.setItem('standalone-theme', theme)
    } catch (error) {
      console.warn('Failed to save theme to localStorage:', error)
    }
  }

  private applyTheme() {
    if (typeof window !== 'undefined' && typeof (window as any).acquireVsCodeApi === 'function') {
      return
    }

    if (typeof document === 'undefined') return

    const effectiveTheme = this.getEffectiveTheme()
    const vscodeThemeKind = effectiveTheme === 'dark' ? 'vscode-dark' : 'vscode-light'

    // 优先设置文档根节点，以便在 body 尚未可用时也能应用正确的主题色
    document.documentElement.setAttribute('data-theme', effectiveTheme)
    document.documentElement.setAttribute('data-vscode-theme-kind', vscodeThemeKind)
    document.documentElement.style.colorScheme = effectiveTheme

    const body = document.body
    if (!body) {
      if (typeof window !== 'undefined') {
        window.addEventListener(
          'DOMContentLoaded',
          () => {
            this.applyTheme()
          },
          { once: true },
        )
      }
    } else {
      // 设置 body 类名与 VS Code 兼容的属性
      body.classList.remove('theme-light', 'theme-dark', 'vscode-light', 'vscode-dark')
      body.classList.add(`theme-${effectiveTheme}`, vscodeThemeKind)
      body.setAttribute('data-theme', effectiveTheme)
      body.setAttribute('data-vscode-theme-kind', vscodeThemeKind)
    }

    // 设置 meta theme-color（移动端）
    this.updateMetaThemeColor(effectiveTheme)
  }

  private updateMetaThemeColor(theme: 'light' | 'dark') {
    let themeColor = '#1e1e1e' // 深色主题默认

    if (theme === 'light') {
      themeColor = '#ffffff' // 浅色主题默认
    }

    // 查找或创建 theme-color meta 标签
    let metaThemeColor = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta')
      metaThemeColor.name = 'theme-color'
      document.head.appendChild(metaThemeColor)
    }

    metaThemeColor.content = getComputedStyle(document.documentElement).getPropertyValue('--background').trim() || themeColor
  }

  private notifyListeners(theme: 'light' | 'dark') {
    this.listeners.forEach(listener => {
      try {
        listener(theme)
      } catch (error) {
        console.error('Error in theme listener:', error)
      }
    })
  }

  /**
   * 获取当前有效主题（不考虑 'system'）
   */
  public getEffectiveTheme(): 'light' | 'dark' {
    if (this.currentTheme === 'system') {
      return this.systemMediaQuery?.matches ? 'dark' : 'light'
    }
    return this.currentTheme as 'light' | 'dark'
  }

  /**
   * 获取当前设置的主题（包括 'system'）
   */
  public getCurrentTheme(): Theme {
    return this.currentTheme
  }

  /**
   * 设置主题
   */
  public setTheme(theme: Theme) {
    this.currentTheme = theme
    this.saveTheme(theme)
    this.applyTheme()
    this.notifyListeners(this.getEffectiveTheme())
  }

  /**
   * 切换主题
   */
  public toggleTheme() {
    const effectiveTheme = this.getEffectiveTheme()
    this.setTheme(effectiveTheme === 'light' ? 'dark' : 'light')
  }

  /**
   * 监听主题变化
   */
  public onThemeChange(listener: (theme: 'light' | 'dark') => void) {
    this.listeners.add(listener)

    // 立即调用一次，让监听者知道当前主题
    listener(this.getEffectiveTheme())

    // 返回取消监听的函数
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * 检查是否为深色主题
   */
  public isDarkTheme(): boolean {
    return this.getEffectiveTheme() === 'dark'
  }

  /**
   * 检查是否为浅色主题
   */
  public isLightTheme(): boolean {
    return this.getEffectiveTheme() === 'light'
  }

  /**
   * 获取主题相关的 CSS 变量值
   */
  public getCSSVariable(variableName: string): string {
    if (typeof document === 'undefined') return ''

    return getComputedStyle(document.documentElement)
      .getPropertyValue(variableName)
      .trim()
  }

  /**
   * 销毁主题管理器
   */
  public destroy() {
    if (this.systemMediaQuery) {
      this.systemMediaQuery.removeEventListener('change', this.handleSystemThemeChange)
    }
    this.listeners.clear()
  }
}

/**
 * 检查当前是否为独立浏览器环境
 */
export const isStandaloneThemeEnvironment = () => isStandaloneEnvironment()

/**
 * 获取主题管理器实例（仅在独立浏览器环境下可用）
 */
export const getThemeManager = (): ThemeManager | null => {
  return isStandaloneEnvironment() ? ThemeManager.getInstance() : null
}

/**
 * 获取 CSS 变量值，兼容 VS Code Webview 与独立浏览器
 */
export const getCssVariableValue = (variableName: string): string => {
  if (isStandaloneEnvironment()) {
    return ThemeManager.getInstance().getCSSVariable(variableName)
  }

  if (typeof document === 'undefined') return ''
  return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim()
}

// 注意：useTheme Hook 需要在使用的地方导入 React
// export const useTheme = () => {
//   const [theme, setTheme] = React.useState<'light' | 'dark'>(themeManager.getEffectiveTheme())
//
//   React.useEffect(() => {
//     return themeManager.onThemeChange((newTheme) => {
//       setTheme(newTheme)
//     })
//   }, [])
//
//   return {
//     theme,
//     isDark: theme === 'dark',
//     isLight: theme === 'light',
//     setTheme: themeManager.setTheme.bind(themeManager),
//     toggleTheme: themeManager.toggleTheme.bind(themeManager),
//     getCurrentTheme: themeManager.getCurrentTheme.bind(themeManager),
//     getCSSVariable: themeManager.getCSSVariable.bind(themeManager)
//   }
// }
