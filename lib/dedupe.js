/**
 * Request deduplication utility
 * Prevents duplicate in-flight requests for the same resource
 *
 * SECURITY FIX: Added TTL and max size limits to prevent unbounded memory growth
 * [CRITICAL] Prevents serverless function OOM crashes
 */

/** @type {Map<string, {promise: Promise<any>, timestamp: number}>} */
const inFlight = new Map()

// Configuration
const MAX_IN_FLIGHT = 1000 // Maximum concurrent dedupe operations
const MAX_AGE_MS = 60000 // TTL: 60 seconds max age

/**
 * Clean up expired entries
 */
function cleanup() {
  const now = Date.now()
  for (const [key, entry] of inFlight.entries()) {
    if (now - entry.timestamp > MAX_AGE_MS) {
      inFlight.delete(key)
    }
  }
}

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
  // Security: Prevent prototype pollution
  if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
    throw new Error('Invalid dedupe key')
  }

  // Cleanup expired entries before adding new ones
  cleanup()

  // Check if there's already an in-flight request
  const existing = inFlight.get(key)
  if (existing) {
    return existing.promise
  }

  // Security: Enforce max size limit to prevent unbounded growth
  if (inFlight.size >= MAX_IN_FLIGHT) {
    // Remove oldest entry (FIFO)
    const firstKey = inFlight.keys().next().value
    inFlight.delete(firstKey)
    console.warn(`Dedupe: Evicted oldest entry (${firstKey}), size limit reached`)
  }

  // Create new promise
  const promise = factory().finally(() => {
    // Clean up when done (success or error)
    inFlight.delete(key)
  })

  // Store with timestamp for TTL tracking
  inFlight.set(key, { promise, timestamp: Date.now() })

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
