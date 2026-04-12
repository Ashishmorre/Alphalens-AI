/**
 * Safe JSON Parser
 * Handles AI responses with markdown code blocks and other formatting
 */

/**
 * Safely parse JSON from AI response
 * @param {string} text - Raw text from AI response
 * @returns {Object} Parsed JSON object
 * @throws {Error} If JSON cannot be parsed
 */
export function safeParseJSON(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid response from AI service')
  }

  // Try direct parse first (fast path)
  let trimmed = text.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      return JSON.parse(trimmed)
    } catch {
      // Continue to fallback
    }
  }

  // Remove markdown code blocks and explanatory text
  let clean = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/```\s*$/i, '')
    .replace(/^```\s*/, '')
    .trim()

  // Remove common AI text prefixes
  clean = clean
    .replace(/^(Here is|Here's|Here are|Here) (the|a|an) (JSON|analysis|dcf|model|response)/i, '')
    .trim()

  // Remove any trailing explanatory text after JSON
  const jsonEndMatch = clean.match(/}[\s\n]*[^[{\s]/)
  if (jsonEndMatch) {
    clean = clean.slice(0, jsonEndMatch.index + 1).trim()
  }

  // Find balanced JSON object with brace counting
  let braceCount = 0
  let startIdx = -1

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i]
    if (char === '{') {
      if (braceCount === 0) startIdx = i
      braceCount++
    } else if (char === '}') {
      braceCount--
      if (braceCount === 0 && startIdx !== -1) {
        try {
          return JSON.parse(clean.slice(startIdx, i + 1))
        } catch {
          // Continue searching for next valid JSON
          startIdx = -1
        }
      }
    }
  }

  // Final fallback: try parsing entire cleaned string
  try {
    return JSON.parse(clean)
  } catch {
    throw new Error('Could not parse AI response as valid JSON')
  }
}
