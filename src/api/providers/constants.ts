import { Package } from "../../shared/package"

// Custom HTTP-Referer configuration
export const getCustomReferer = (): string => {
	const customReferer = process.env.CUSTOM_HTTP_REFERER
	if (customReferer && customReferer.trim().length > 0) {
		return customReferer.trim()
	}
	return "https://github.com/AndreaFrederica/Roo-Code-Chat"
}

// Custom X-Title configuration
export const getCustomTitle = (): string => {
	const customTitle = process.env.CUSTOM_X_TITLE
	if (customTitle && customTitle.trim().length > 0) {
		return customTitle.trim()
	}
	return "ANH CHAT"
}

// Custom User-Agent configuration
export const getCustomUserAgent = (
	customUserAgent?: string, 
	customUserAgentMode?: "segments" | "full", 
	customUserAgentFull?: string
): string => {
	// If mode is "full" and customUserAgentFull is provided, use it directly
	if (customUserAgentMode === "full" && customUserAgentFull && customUserAgentFull.trim().length > 0) {
		return customUserAgentFull.trim()
	}
	
	// Otherwise use segments mode (original behavior)
	// First check if a custom user agent is provided as parameter (from global settings)
	if (customUserAgent && customUserAgent.trim().length > 0) {
		return customUserAgent.trim()
	}
	
	// Fallback to environment variable for backward compatibility
	const customUA = process.env.CUSTOM_USER_AGENT
	if (customUA && customUA.trim().length > 0) {
		return customUA.trim()
	}
	
	return `AnhChat/${Package.version}`
}

// Default headers for non-Roo cloud services (customizable)
export const DEFAULT_HEADERS = {
	"HTTP-Referer": getCustomReferer(),
	"X-Title": getCustomTitle(),
	"User-Agent": getCustomUserAgent(),
}

// Headers specifically for Roo cloud services (original format, not customizable)
export const ROO_CLOUD_HEADERS = {
	"HTTP-Referer": "https://github.com/RooVetGit/Roo-Cline",
	"X-Title": "Roo Code",
	"User-Agent": `RooCode/${Package.version}`,
}
