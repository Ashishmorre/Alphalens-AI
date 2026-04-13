/**
 * Safe JSON Parser
 * Handles AI responses with markdown code blocks and other formatting
 */

/**
 * Safely parse JSON from AI response
 * @param {string} rawResponse - Raw text from AI response
 * @returns {Object} Parsed JSON object
 * @throws {Error} If JSON cannot be parsed
 */
export function safeParseJSON(rawResponse) {
  // 1. Guard against empty responses
  if (!rawResponse || typeof rawResponse !== 'string') {
    console.error("[safeParseJSON] Received empty or non-string response:", rawResponse);
    throw new Error("Invalid response from AI service");
  }

  try {
    // 2. The Regex Cleanup (The Lifesaver)
    // AI models often wrap JSON in markdown blocks like ```json ... ```
    // This regex strips those out before parsing.
    const cleanText = rawResponse
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    // 3. Attempt the parse
    return JSON.parse(cleanText);

  } catch (parseError) {
    console.error("[safeParseJSON] Failed to parse JSON. Cleaned text was:", rawResponse.substring(0, 200));
    throw new Error("Could not parse AI response as valid JSON");
  }
}
