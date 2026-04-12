/**
 * Security utilities
 * Middleware and helpers for API security hardening
 */

import { NextResponse } from 'next/server'

/**
 * Security headers for all API responses
 */
export const SECURITY_HEADERS = {
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  // XSS protection
  'X-XSS-Protection': '1; mode=block',
  // Referrer policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Permissions policy
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  // Content Security Policy (API routes - minimal)
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none';",
  // Strict Transport Security (should be set at reverse proxy level for production)
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
}

/**
 * CORS headers helper
 * @param {Request} request - Incoming request
 * @returns {Record<string, string>} CORS headers
 */
export function getCorsHeaders(request) {
  const origin = request.headers.get('origin') || ''
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || []

  // Check if origin is allowed
  const isAllowed = allowedOrigins.length === 0 ||
    allowedOrigins.some(allowed => origin.includes(allowed)) ||
    origin === '' // Allow same-origin requests

  if (!isAllowed) {
    return {
      'Access-Control-Allow-Origin': '',
    }
  }

  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }
}

/**
 * Sanitize input to prevent injection attacks
 * @param {string} input - Raw input string
 * @returns {string} Sanitized string
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') return ''

  return input
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Remove potential script tags
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    // Remove event handlers
    .replace(/on\w+\s*=/gi, '')
    // Remove javascript: protocol
    .replace(/javascript:/gi, '')
    // Limit length
    .slice(0, 1000)
    .trim()
}

/**
 * Validate ticker symbol strictly
 * @param {string} ticker - Raw ticker input
 * @returns {{ valid: boolean, ticker?: string, reason?: string }}
 */
export function strictValidateTicker(ticker) {
  if (!ticker || typeof ticker !== 'string') {
    return { valid: false, reason: 'Ticker is required' }
  }

  const sanitized = sanitizeInput(ticker).toUpperCase()

  // Strict pattern: 1-10 uppercase letters, optionally with .XX suffix
  if (!/^[A-Z]{1,10}(\.[A-Z]{1,3})?$/.test(sanitized)) {
    return {
      valid: false,
      reason: 'Invalid ticker format. Use 1-10 letters, optional exchange suffix (e.g., RELIANCE.NS)',
    }
  }

  // Block suspicious patterns
  const suspicious = ['API', 'KEY', 'SECRET', 'TOKEN', 'AUTH', 'PASS', 'PWD']
  if (suspicious.some(s => sanitized.includes(s))) {
    return { valid: false, reason: 'Invalid ticker symbol' }
  }

  return { valid: true, ticker: sanitized }
}

/**
 * Check request for common attack patterns
 * @param {Request} request - Incoming request
 * @returns {{ safe: boolean, reason?: string }}
}
 */
export function checkRequestSafety(request) {
  const userAgent = request.headers.get('user-agent') || ''
  const contentType = request.headers.get('content-type') || ''

  // Block known bad user agents
  const badAgents = ['sqlmap', 'nmap', 'masscan', 'zgrab', 'gobuster', 'nikto', 'dirbuster']
  if (badAgents.some(agent => userAgent.toLowerCase().includes(agent))) {
    return { safe: false, reason: 'Access denied' }
  }

  // Validate Content-Type
  if (request.method === 'POST' && !contentType.includes('application/json')) {
    return { safe: false, reason: 'Invalid Content-Type' }
  }

  return { safe: true }
}

/**
 * API middleware wrapper with security checks
 * @param {Function} handler - API route handler
 * @param {Object} options - Security options
 * @returns {Function} Wrapped handler
 */
export function withSecurity(handler, options = {}) {
  const {
    cors = true,
    validateTicker = false,
    sanitizeBody = false,
    maxBodySize = 1024 * 1024,
    requireAuth = false,
  } = options

  return async function (request, context) {
    // Basic safety check
    const safety = checkRequestSafety(request)
    if (!safety.safe) {
      return NextResponse.json(
        { success: false, error: safety.reason },
        { status: 403, headers: SECURITY_HEADERS }
      )
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: {
          ...SECURITY_HEADERS,
          ...(cors ? getCorsHeaders(request) : {}),
        },
      })
    }

    // Check body size
    const contentLength = parseInt(request.headers.get('content-length') || '0')
    if (contentLength > maxBodySize) {
      return NextResponse.json(
        { success: false, error: 'Request too large' },
        { status: 413, headers: SECURITY_HEADERS }
      )
    }

    // Attach security helpers to request - use spread to prevent prototype pollution
    const securedRequest = { ...request }
    Object.defineProperty(securedRequest, 'security', {
      value: {
        headers: { ...SECURITY_HEADERS },
        cors: cors ? getCorsHeaders(request) : {},
        sanitizeInput,
        strictValidateTicker,
      },
      writable: false,
      enumerable: true,
      configurable: false,
    })

    try {
      const response = await handler(securedRequest, context)

      // Merge security headers into response
      if (response?.headers) {
        Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
          response.headers.set(key, value)
        })
        if (cors) {
          Object.entries(getCorsHeaders(request)).forEach(([key, value]) => {
            response.headers.set(key, value)
          })
        }
      }

      return response
    } catch (error) {
      // Log security errors
      console.error('[Security] Request failed:', {
        error: error.message,
        url: request.url,
        ip: request.ip || request.headers.get('x-forwarded-for'),
        timestamp: new Date().toISOString(),
      })

      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500, headers: SECURITY_HEADERS }
      )
    }
  }
}

/**
 * Rate limit response helper
 * @param {number} retryAfter - Seconds until retry allowed
 * @returns {NextResponse}
 */
export function createRateLimitResponse(retryAfter) {
  return NextResponse.json(
    {
      success: false,
      error: 'Rate limit exceeded. Please try again later.',
      retryAfter,
    },
    {
      status: 429,
      headers: {
        ...SECURITY_HEADERS,
        'Retry-After': String(retryAfter),
      },
    }
  )
}

/**
 * API key validation helper
 * @param {Request} request - Incoming request
 * @returns {{ valid: boolean, key?: string }}
 */
export function validateApiKey(request) {
  const authHeader = request.headers.get('authorization') || ''
  const apiKey = authHeader.replace(/^Bearer\s+/i, '')

  if (!apiKey || apiKey !== process.env.PROTECT_API_KEY) {
    return { valid: false }
  }

  return { valid: true, key: apiKey }
}

/**
 * Request fingerprinting for rate limiting
 * Creates stable identifier from request characteristics
 * @param {Request} request - Incoming request
 * @returns {string} Fingerprint hash
 */
export function getRequestFingerprint(request) {
  const ip = request.ip ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  const ua = request.headers.get('user-agent') || ''
  const path = new URL(request.url).pathname

  // Simple fingerprint (consider using crypto for production)
  const data = `${ip}:${path}:${ua.slice(0, 50)}`
  return btoa(data).slice(0, 32)
}

/**
 * Content validation helpers
 */
export const validators = {
  /**
   * Validate JSON structure
   * @param {any} data
   * @returns {boolean}
   */
  isValidJSON(data) {
    try {
      if (typeof data === 'object') return true
      JSON.parse(data)
      return true
    } catch {
      return false
    }
  },

  /**
   * Check for SQL injection patterns
   * @param {string} input
   * @returns {boolean}
   */
  hasSQLInjection(input) {
    if (typeof input !== 'string') return false
    const patterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
      /(--|#|\/\*|\*\/)/,
      /(\bOR\s+\d+=\d+\b)/i,
      /(\bAND\s+\d+=\d+\b)/i,
    ]
    return patterns.some(p => p.test(input))
  },

  /**
   * Check for NoSQL injection patterns
   * @param {any} input
   * @returns {boolean}
   */
  hasNoSQLInjection(input) {
    if (typeof input !== 'object' || input === null) return false
    const json = JSON.stringify(input)
    const patterns = [
      /\$where/i,
      /\$regex/i,
      /\$gt/i,
      /\$lt/i,
      /\$ne/i,
      /\$exists/i,
    ]
    return patterns.some(p => p.test(json))
  },

  /**
   * Validate email format
   * @param {string} email
   * @returns {boolean}
   */
  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  },

  /**
   * Check string length
   * @param {string} str
   * @param {number} max
   * @returns {boolean}
   */
  withinLength(str, max) {
    return typeof str === 'string' && str.length <= max
  },
}
