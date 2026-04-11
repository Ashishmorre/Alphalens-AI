/**
 * Server-side caching utilities
 * In-memory cache with TTL for API responses
 */

/**
 * Cache entry structure
 * @template T
 * @typedef {Object} CacheEntry
 * @property {T} data - Cached data
 * @property {number} timestamp - When the entry was created
 * @property {number} ttl - Time to live in milliseconds
 */

/** @type {Map<string, CacheEntry>} */
const cache = new Map()

/**
 * Default TTL values in milliseconds
 */
export const CACHE_TTL = {
  // Stock data - 30 seconds (Yahoo rate limits are strict)
  stockData: 30 * 1000,
  // AI analysis - 5 minutes (expensive to compute)
  aiAnalysis: 5 * 60 * 1000,
  // Comparison - 2 minutes
  compare: 2 * 60 * 1000,
  // Short term - 10 seconds
  short: 10 * 1000,
  // Medium term - 1 minute
  medium: 60 * 1000,
  // Long term - 5 minutes
  long: 5 * 60 * 1000,
}

/**
 * Get cached value or compute if not present
 * @template T
 * @param {string} key - Cache key
 * @param {() => Promise<T>} factory - Factory function to compute value
 * @param {number} ttl - Time to live in milliseconds
 * @returns {Promise<T>}
 */
export async function getOrSet(key, factory, ttl = CACHE_TTL.medium) {
  const now = Date.now()
  const entry = cache.get(key)

  // Return cached value if still valid
  if (entry && now - entry.timestamp < entry.ttl) {
    return entry.data
  }

  // Delete stale entry
  if (entry) {
    cache.delete(key)
  }

  // Compute and cache new value
  const data = await factory()
  cache.set(key, { data, timestamp: now, ttl })
  return data
}

/**
 * Get value from cache without factory
 * @template T
 * @param {string} key - Cache key
 * @returns {T | undefined}
 */
export function get(key) {
  const entry = cache.get(key)
  if (!entry) return undefined

  const now = Date.now()
  if (now - entry.timestamp > entry.ttl) {
    cache.delete(key)
    return undefined
  }

  return entry.data
}

/**
 * Set value in cache
 * @template T
 * @param {string} key - Cache key
 * @param {T} data - Data to cache
 * @param {number} ttl - Time to live in milliseconds
 */
export function set(key, data, ttl = CACHE_TTL.medium) {
  cache.set(key, { data, timestamp: Date.now(), ttl })
}

/**
 * Delete value from cache
 * @param {string} key - Cache key
 */
export function del(key) {
  cache.delete(key)
}

/**
 * Clear entire cache
 */
export function clear() {
  cache.clear()
}

/**
 * Get cache statistics
 * @returns {{ size: number, keys: string[], memoryEstimate: string }}
 */
export function stats() {
  const keys = Array.from(cache.keys())
  const size = cache.size

  // Rough memory estimation
  let memoryBytes = 0
  for (const [key, entry] of cache.entries()) {
    memoryBytes += key.length * 2 // UTF-16
    memoryBytes += JSON.stringify(entry).length * 2
  }

  const memoryEstimate = memoryBytes > 1024 * 1024
    ? `${(memoryBytes / (1024 * 1024)).toFixed(2)} MB`
    : `${(memoryBytes / 1024).toFixed(2)} KB`

  return { size, keys, memoryEstimate }
}

/**
 * Clean up expired entries
 */
export function cleanup() {
  const now = Date.now()
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > entry.ttl) {
      cache.delete(key)
    }
  }
}

// Run cleanup every 60 seconds
if (typeof setInterval !== 'undefined') {
  setInterval(cleanup, 60 * 1000)
}
