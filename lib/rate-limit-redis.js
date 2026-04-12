/**
 * Redis-Backed Rate Limiting (Production)
 * Uses Upstash Redis for distributed rate limiting across serverless instances
 * Falls back to in-memory rate limiting if Redis unavailable
 *
 * [HIGH] Security Fix: Replaces ephemeral in-memory rate limiting
 * which doesn't work across Vercel serverless function instances
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { RATE_LIMIT_PRESETS, getClientIP } from './rate-limit.js'

// Check if Redis is configured
const hasRedisConfig = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN

// Initialize Redis client if configured
let redis = null
let ratelimitInstances = {}

if (hasRedisConfig) {
  try {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  } catch (err) {
    console.error('Failed to initialize Redis:', err.message)
  }
}

/**
 * Get or create ratelimit instance for a preset
 * @param {string} presetName - Name of rate limit preset
 * @returns {Ratelimit|null} Ratelimit instance or null
 */
function getRatelimit(presetName) {
  if (!redis) return null

  // Return cached instance
  if (ratelimitInstances[presetName]) {
    return ratelimitInstances[presetName]
  }

  const config = RATE_LIMIT_PRESETS[presetName]
  if (!config) return null

  // Create new instance with sliding window
  ratelimitInstances[presetName] = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.max, `${config.windowMs}ms`),
    analytics: true,
  })

  return ratelimitInstances[presetName]
}

/**
 * Check rate limit using Redis (or fallback to in-memory)
 * This is the production-grade version that works across serverless instances
 *
 * @param {string} key - Unique identifier (e.g., "analyze:192.168.1.1")
 * @param {Object} config - Rate limit config { max, windowMs }
 * @param {string} [presetName] - Optional preset name for Redis caching
 * @returns {Promise<{ allowed: boolean, remaining: number, retryAfter?: number }>}
 */
export async function checkRateLimitRedis(key, config, presetName = null) {
  // Security: Prevent prototype pollution
  if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
    return { allowed: false, remaining: 0, retryAfter: 3600 }
  }

  // Try Redis first if available
  if (redis && presetName) {
    const limiter = getRatelimit(presetName)
    if (limiter) {
      try {
        const { success, remaining, reset } = await limiter.limit(key)
        const retryAfter = success ? undefined : Math.ceil((reset - Date.now()) / 1000)
        return {
          allowed: success,
          remaining: Math.max(0, remaining),
          reset,
          retryAfter,
          source: 'redis',
        }
      } catch (err) {
        // Log error but fall through to in-memory
        console.warn('Redis rate limit error:', err.message)
      }
    }
  }

  // Fallback to in-memory rate limiting
  // Import dynamically to avoid circular dependency
  const { checkRateLimit } = await import('./rate-limit.js')
  const result = checkRateLimit(key, config)
  return { ...result, source: 'memory' }
}

/**
 * Check if Redis rate limiting is active
 * @returns {boolean}
 */
export function isRedisRateLimitingActive() {
  return !!redis
}

/**
 * Get rate limiter for use with Vercel Edge Functions
 * Returns a Ratelimit instance configured for the preset
 *
 * @param {string} presetName - Preset name from RATE_LIMIT_PRESETS
 * @returns {Ratelimit|null}
 */
export function getEdgeRatelimit(presetName) {
  return getRatelimit(presetName)
}

export default {
  checkRateLimitRedis,
  isRedisRateLimitingActive,
  getEdgeRatelimit,
}
