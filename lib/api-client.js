/**
 * API Client Utilities — Premium Edition
 * Centralized, cached, resilient API helpers with timeouts and deduplication
 */

// ─── Configuration ─────────────────────────────────────────────────────────
const DEFAULT_TIMEOUT = 25000 // 25s: Yahoo(~5s) + Screener(~5s) + TradingView(6s cap) + headroom
const CACHE_TTL = 30000 // 30 seconds for GET requests

// ─── In-Memory Cache ─────────────────────────────────────────────────────────
const cache = new Map()
const inFlight = new Map()

/**
 * Get cached value or undefined
 * @param {string} key
 * @returns {any | undefined}
 */
function getCache(key) {
  const entry = cache.get(key)
  if (!entry) return undefined
  if (Date.now() > entry.expires) {
    cache.delete(key)
    return undefined
  }
  return entry.data
}

/**
 * Set cache value with TTL
 * @param {string} key
 * @param {any} data
 * @param {number} ttl
 */
function setCache(key, data, ttl = CACHE_TTL) {
  cache.set(key, { data, expires: Date.now() + ttl })
}

/**
 * Clear expired cache entries periodically
 */
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of cache) {
      if (now > entry.expires) cache.delete(key)
    }
  }, 60000) // Clean every minute
}

// ─── Enhanced Fetch with Timeout ─────────────────────────────────────────────

/**
 * Fetch with timeout support
 * @param {string} url
 * @param {RequestInit} options
 * @param {number} timeout
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}, timeout = DEFAULT_TIMEOUT) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error('Request timeout — please try again')
    }
    throw error
  }
}

// ─── Deduplication ─────────────────────────────────────────────────────────

/**
 * Get or create in-flight request promise
 * @param {string} key
 * @param {() => Promise<any>} factory
 * @returns {Promise<any>}
 */
function dedupeRequest(key, factory) {
  const existing = inFlight.get(key)
  if (existing) return existing

  const promise = factory().finally(() => inFlight.delete(key))
  inFlight.set(key, promise)
  return promise
}

// ─── Enhanced API Fetch ──────────────────────────────────────────────────────

/**
 * Enhanced fetch with caching, deduplication, and timeout
 * Backend returns: { success: boolean, data: any, error?: string }
 *
 * @param {string} url - API endpoint
 * @param {RequestInit} options - fetch options
 * @param {{ cache?: boolean, timeout?: number, dedupe?: boolean }} config - advanced config
 * @returns {Promise<any>} - Returns data directly
 */
export async function apiFetch(url, options = {}, config = {}) {
  const { cache: useCache = true, timeout = DEFAULT_TIMEOUT, dedupe = true } = config
  const cacheKey = `${options.method || 'GET'}:${url}`

  // Return cached value immediately
  if (useCache && (!options.method || options.method === 'GET')) {
    const cached = getCache(cacheKey)
    if (cached !== undefined) return cached
  }

  const execute = async () => {
    try {
      const res = await fetchWithTimeout(url, options, timeout)
      const json = await res.json()

      if (!json.success) {
        throw new Error(json.error || 'API request failed')
      }

      // Cache successful GET responses
      if (useCache && (!options.method || options.method === 'GET')) {
        setCache(cacheKey, json.data)
      }

      console.log('[API Response]', url, 'ROE:', json.data?.roe)
      return json.data
    } catch (error) {
      // Normalize error messages
      if (error.message?.includes('fetch')) {
        throw new Error('Network error — check your connection')
      }
      throw error
    }
  }

  // Deduplicate identical in-flight requests
  if (dedupe) {
    return dedupeRequest(cacheKey, execute)
  }

  return execute()
}

/**
 * POST helper with automatic timeout
 * @param {string} url
 * @param {any} body
 * @param {{ timeout?: number }} config
 * @returns {Promise<any>}
 */
export async function apiPost(url, body, config = {}) {
  return apiFetch(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    { cache: false, timeout: config.timeout || 60000, dedupe: false } // 60s for AI
  )
}

/**
 * GET helper with caching
 * @param {string} url
 * @param {Record<string, string>} params
 * @param {{ timeout?: number }} config
 * @returns {Promise<any>}
 */
export async function apiGet(url, params = {}, config = {}) {
  const queryString = new URLSearchParams(params).toString()
  const fullUrl = queryString ? `${url}?${queryString}` : url
  return apiFetch(fullUrl, {}, { cache: true, timeout: config.timeout || DEFAULT_TIMEOUT })
}

// ─── Error Handling ─────────────────────────────────────────────────────────

/**
 * User-friendly error messages
 * @param {Error | unknown} error
 * @returns {string}
 */
export function getErrorMessage(error) {
  if (!error) return 'Something went wrong'

  const message = error.message || String(error)

  // Normalize common errors
  const errorMap = {
    'API request failed': 'Unable to fetch data. Please try again.',
    'Network error': 'Network error — check your connection',
    'Request timeout': 'Request timed out. Please retry.',
    'Failed to fetch': 'Network error — check your connection',
    'invalid ticker': 'Invalid ticker symbol. Please check and try again.',
    'rate limit': 'Too many requests. Please wait a moment.',
  }

  for (const [pattern, friendly] of Object.entries(errorMap)) {
    if (message.toLowerCase().includes(pattern.toLowerCase())) {
      return friendly
    }
  }

  return message || 'An unexpected error occurred'
}

/**
 * Check if error is retryable
 * @param {Error} error
 * @returns {boolean}
 */
export function isRetryableError(error) {
  if (!error?.message) return false
  const retryable = ['timeout', 'network', 'rate limit', '503', '502']
  return retryable.some(pattern => error.message.toLowerCase().includes(pattern))
}

// ─── Cache Utilities ─────────────────────────────────────────────────────────

/**
 * Manually invalidate cache entries
 * @param {string} pattern - URL pattern to match
 */
export function invalidateCache(pattern) {
  for (const key of cache.keys()) {
    if (key.includes(pattern)) cache.delete(key)
  }
}

/**
 * Clear entire cache
 */
export function clearApiCache() {
  cache.clear()
}

/**
 * Get cache stats for debugging
 * @returns {{ size: number, keys: string[] }}
 */
export function getCacheStats() {
  return { size: cache.size, keys: Array.from(cache.keys()) }
}

// ─── Legacy Exports (Backward Compatibility) ───────────────────────────────────

export async function unwrapResponse(fetchPromise) {
  const res = await fetchPromise
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'API Error')
  return json.data
}

export function isSuccess(response) {
  return response?.success === true
}

export function extractData(response) {
  if (!response.success) throw new Error(response.error || 'API Error')
  return response.data
}
