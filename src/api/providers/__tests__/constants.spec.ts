// npx vitest run src/api/providers/__tests__/constants.spec.ts

import { vi, describe, it, expect, beforeEach } from "vitest"
import { DEFAULT_HEADERS, ROO_CLOUD_HEADERS, getCustomUserAgent, getCustomReferer, getCustomTitle } from "../constants"
import { Package } from "../../../shared/package"

describe("DEFAULT_HEADERS", () => {
	beforeEach(() => {
		// Clear environment variables before each test
		delete process.env.CUSTOM_USER_AGENT
		delete process.env.CUSTOM_HTTP_REFERER
		delete process.env.CUSTOM_X_TITLE
	})

	it("should contain all required headers", () => {
		expect(DEFAULT_HEADERS).toHaveProperty("HTTP-Referer")
		expect(DEFAULT_HEADERS).toHaveProperty("X-Title")
		expect(DEFAULT_HEADERS).toHaveProperty("User-Agent")
	})

	it("should have default HTTP-Referer value when no custom value is set", () => {
		expect(DEFAULT_HEADERS["HTTP-Referer"]).toBe("https://github.com/AndreaFrederica/Roo-Code-Chat")
	})

	it("should have default X-Title value when no custom value is set", () => {
		expect(DEFAULT_HEADERS["X-Title"]).toBe("ANH CHAT")
	})

	it("should have correct User-Agent format when no custom UA is set", () => {
		const userAgent = DEFAULT_HEADERS["User-Agent"]
		expect(userAgent).toBe(`RooCode/${Package.version}`)

		// Verify it follows the tool_name/version pattern
		expect(userAgent).toMatch(/^[a-zA-Z-]+\/\d+\.\d+\.\d+$/)
	})

	it("should have User-Agent with correct tool name", () => {
		const userAgent = DEFAULT_HEADERS["User-Agent"]
		expect(userAgent.startsWith("RooCode/")).toBe(true)
	})

	it("should have User-Agent with semantic version format", () => {
		const userAgent = DEFAULT_HEADERS["User-Agent"]
		const version = userAgent.split("/")[1]

		// Check semantic version format (major.minor.patch)
		expect(version).toMatch(/^\d+\.\d+\.\d+$/)

		// Verify current version matches package version
		expect(version).toBe(Package.version)
	})

	it("should be an object with string values", () => {
		expect(typeof DEFAULT_HEADERS).toBe("object")
		expect(DEFAULT_HEADERS).not.toBeNull()

		Object.values(DEFAULT_HEADERS).forEach((value) => {
			expect(typeof value).toBe("string")
			expect(value.length).toBeGreaterThan(0)
		})
	})

	it("should have exactly 3 headers", () => {
		const headerKeys = Object.keys(DEFAULT_HEADERS)
		expect(headerKeys).toHaveLength(3)
		expect(headerKeys).toEqual(["HTTP-Referer", "X-Title", "User-Agent"])
	})

	it("should use custom values from environment variables", async () => {
		process.env.CUSTOM_HTTP_REFERER = "https://example.com"
		process.env.CUSTOM_X_TITLE = "Custom App"
		process.env.CUSTOM_USER_AGENT = "CustomAgent/1.0.0"

		// Re-import to get updated values
		vi.resetModules()
		const { DEFAULT_HEADERS: updatedHeaders } = await import("../constants")
		
		expect(updatedHeaders["HTTP-Referer"]).toBe("https://example.com")
		expect(updatedHeaders["X-Title"]).toBe("Custom App")
		expect(updatedHeaders["User-Agent"]).toBe("CustomAgent/1.0.0")
	})
})

describe("getCustomReferer", () => {
	beforeEach(() => {
		delete process.env.CUSTOM_HTTP_REFERER
	})

	it("should return default referer when no custom value is set", () => {
		const referer = getCustomReferer()
		expect(referer).toBe("https://github.com/AndreaFrederica/Roo-Code-Chat")
	})

	it("should return custom referer from environment variable", () => {
		process.env.CUSTOM_HTTP_REFERER = "https://example.com"
		const referer = getCustomReferer()
		expect(referer).toBe("https://example.com")
	})

	it("should trim whitespace from custom referer", () => {
		process.env.CUSTOM_HTTP_REFERER = "  https://example.com  "
		const referer = getCustomReferer()
		expect(referer).toBe("https://example.com")
	})

	it("should return default when custom referer is empty", () => {
		process.env.CUSTOM_HTTP_REFERER = ""
		const referer = getCustomReferer()
		expect(referer).toBe("https://github.com/AndreaFrederica/Roo-Code-Chat")
	})
})

describe("getCustomTitle", () => {
	beforeEach(() => {
		delete process.env.CUSTOM_X_TITLE
	})

	it("should return default title when no custom value is set", () => {
		const title = getCustomTitle()
		expect(title).toBe("ANH CHAT")
	})

	it("should return custom title from environment variable", () => {
		process.env.CUSTOM_X_TITLE = "My Custom App"
		const title = getCustomTitle()
		expect(title).toBe("My Custom App")
	})

	it("should trim whitespace from custom title", () => {
		process.env.CUSTOM_X_TITLE = "  My Custom App  "
		const title = getCustomTitle()
		expect(title).toBe("My Custom App")
	})

	it("should return default when custom title is empty", () => {
		process.env.CUSTOM_X_TITLE = ""
		const title = getCustomTitle()
		expect(title).toBe("ANH CHAT")
	})
})

describe("getCustomUserAgent", () => {
	beforeEach(() => {
		// Clear environment variable before each test
		delete process.env.CUSTOM_USER_AGENT
	})

	it("should return default User-Agent when no custom UA is set", () => {
		const userAgent = getCustomUserAgent()
		expect(userAgent).toBe(`RooCode/${Package.version}`)
	})

	it("should return custom User-Agent from environment variable", () => {
		process.env.CUSTOM_USER_AGENT = "MyCustomApp/1.2.3"
		const userAgent = getCustomUserAgent()
		expect(userAgent).toBe("MyCustomApp/1.2.3")
	})

	it("should trim whitespace from custom User-Agent", () => {
		process.env.CUSTOM_USER_AGENT = "  MyCustomApp/1.2.3  "
		const userAgent = getCustomUserAgent()
		expect(userAgent).toBe("MyCustomApp/1.2.3")
	})

	it("should return default when custom UA is empty string", () => {
		process.env.CUSTOM_USER_AGENT = ""
		const userAgent = getCustomUserAgent()
		expect(userAgent).toBe(`RooCode/${Package.version}`)
	})

	it("should return default when custom UA is only whitespace", () => {
		process.env.CUSTOM_USER_AGENT = "   "
		const userAgent = getCustomUserAgent()
		expect(userAgent).toBe(`RooCode/${Package.version}`)
	})
})

describe("ROO_CLOUD_HEADERS", () => {
	it("should contain all required headers", () => {
		expect(ROO_CLOUD_HEADERS).toHaveProperty("HTTP-Referer")
		expect(ROO_CLOUD_HEADERS).toHaveProperty("X-Title")
		expect(ROO_CLOUD_HEADERS).toHaveProperty("User-Agent")
	})

	it("should have correct HTTP-Referer value", () => {
		expect(ROO_CLOUD_HEADERS["HTTP-Referer"]).toBe("https://github.com/RooVetGit/Roo-Cline")
	})

	it("should have correct X-Title value", () => {
		expect(ROO_CLOUD_HEADERS["X-Title"]).toBe("Roo Code")
	})

	it("should always use RooCode User-Agent format", () => {
		// Set custom UA to verify ROO_CLOUD_HEADERS is not affected
		process.env.CUSTOM_USER_AGENT = "CustomApp/1.0.0"
		
		const userAgent = ROO_CLOUD_HEADERS["User-Agent"]
		expect(userAgent).toBe(`RooCode/${Package.version}`)
	})

	it("should have exactly 3 headers", () => {
		const headerKeys = Object.keys(ROO_CLOUD_HEADERS)
		expect(headerKeys).toHaveLength(3)
		expect(headerKeys).toEqual(["HTTP-Referer", "X-Title", "User-Agent"])
	})
})
