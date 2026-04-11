/**
 * Request deduplication utility
 * Prevents duplicate in-flight requests for the same resource
 */

/** @type {Map<string, Promise<any>>} */
const inFlight = new Map()

/**
 * Execute function with deduplication
 * If multiple calls with the same key happen while the first is still pending,
 * they will all receive the same promise result.
 *
 * @template T
 * @param {string} key - Deduplication key
 * @param {() => Promise<T>} factory - Factory function
 * @returns {Promise<T>}
 *
 * @example
 * const result = await dedupe(`stock:${ticker}`, () => fetchStockData(ticker))
 */
export async function dedupe(key, factory) {
  // Check if there's already an in-flight request
  const existing = inFlight.get(key)
  if (existing) {
    return existing
  }

  // Create new promise
  const promise = factory().finally(() => {
    // Clean up when done (success or error)
    inFlight.delete(key)
  })

  // Store for deduplication
  inFlight.set(key, promise)

  return promise
}

/**
 * Check if there's an in-flight request for a key
 * @param {string} key - Deduplication key
 * @returns {boolean}
 */
export function isInFlight(key) {
  return inFlight.has(key)
}

/**
 * Get count of in-flight requests
 * @returns {number}
 */
export function inFlightCount() {
  return inFlight.size
}

/**
 * Get all in-flight request keys
 * @returns {string[]}
 */
export function inFlightKeys() {
  return Array.from(inFlight.keys())
}

/**
 * Clear all in-flight requests (use with caution)
 */
export function clearInFlight() {
  inFlight.clear()
}
