/**
 * Safely parses JSON without crashing on invalid input
 *
 * @param jsonString The string to parse
 * @param defaultValue Value to return if parsing fails
 * @returns Parsed JSON object or defaultValue if parsing fails
 */
export function safeJsonParse<T>(jsonString: string | null | undefined, defaultValue?: T): T | undefined {
	if (!jsonString) {
		return defaultValue
	}

	try {
		return JSON.parse(jsonString) as T
	} catch (error) {
		if (process.env.NODE_ENV !== "production") {
			console.debug("Error parsing JSON:", error)
		}
		return defaultValue
	}
}
