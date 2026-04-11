/**
 * Rate Limiting Utility
 * Shared in-memory rate limiter for API routes
 * Note: Resets on deploy/restart. For production scale, use Redis (Upstash)
 */

const rateLimitMap = new Map()

/**
 * Rate limit configuration presets
 */
export const RATE_LIMIT_PRESETS = {
  // Standard endpoints: 10 requests per minute
  standard: { max: 10, windowMs: 60 * 1000 },
  // AI analysis endpoints: 5 requests per minute (expensive)
  aiAnalysis: { max: 5, windowMs: 60 * 1000 },
  // Compare endpoint: 3 requests per minute (most expensive)
  compare: { max: 3, windowMs: 60 * 1000 },
  // Stock data endpoints: 20 requests per minute (cheaper)
  stockData: { max: 20, windowMs: 60 * 1000 },
}

/**
 * Extract client IP from request headers
 * @param {Request} request
 * @returns {string}
 */
export function getClientIP(request) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIP = request.headers.get('x-real-ip')
  if (realIP) return realIP

  const cfIP = request.headers.get('cf-connecting-ip')
  if (cfIP) return cfIP

  return 'unknown'
}

/**
 * Check rate limit for a key
 * @param {string} key - Unique identifier (e.g., "analyze:192.168.1.1")
 * @param {Object} config - Rate limit config { max, windowMs }
 * @returns {{ allowed: boolean, remaining: number, retryAfter?: number }}
 */
export function checkRateLimit(key, config) {
  const now = Date.now()
  const record = rateLimitMap.get(key)

  if (!record) {
    rateLimitMap.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    })
    return {
      allowed: true,
      remaining: config.max - 1,
      reset: now + config.windowMs,
    }
  }

  // Reset if window expired
  if (now > record.resetTime) {
    record.count = 1
    record.resetTime = now + config.windowMs
    return {
      allowed: true,
      remaining: config.max - 1,
      reset: now + config.windowMs,
    }
  }

  // Check limit
  if (record.count >= config.max) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000)
    return {
      allowed: false,
      remaining: 0,
      reset: record.resetTime,
      retryAfter,
    }
  }

  record.count++
  return {
    allowed: true,
    remaining: config.max - record.count,
    reset: record.resetTime,
  }
}

/**
 * Create rate limit headers for response
 * @param {Object} result - Rate limit check result
 * @returns {Record<string, string>}
 */
export function createRateLimitHeaders(result) {
  const headers = {
    'X-RateLimit-Limit': String(RATE_LIMIT_PRESETS.standard.max),
    'X-RateLimit-Remaining': String(Math.max(0, result.remaining)),
    'X-RateLimit-Reset': String(Math.ceil(result.reset / 1000)),
  }

  if (result.retryAfter) {
    headers['Retry-After'] = String(result.retryAfter)
  }

  return headers
}

/**
 * Clean up old rate limit entries (call periodically)
 * @param {number} maxAgeMs - Maximum age to keep entries
 */
export function cleanupRateLimits(maxAgeMs = 2 * 60 * 1000) {
  const now = Date.now()
  for (const [key, record] of rateLimitMap.entries()) {
    if (now - record.resetTime > maxAgeMs) {
      rateLimitMap.delete(key)
    }
  }
}

// Auto-cleanup every 5 minutes if in production
if (process.env.NODE_ENV === 'production') {
  setInterval(() => cleanupRateLimits(), 5 * 60 * 1000)
}
