/**
 * API Utilities
 * Shared helpers for API route handlers
 */

import { NextResponse } from 'next/server'
import { gateway } from '@/lib/ai-gateway/ai-gateway.js'

/**
 * Maximum request body size (1MB)
 */
export const MAX_BODY_SIZE = 1024 * 1024

/**
 * Check if request body exceeds size limit
 * @param {Request} request
 * @returns {{ ok: boolean, response?: NextResponse }}
 */
export function checkBodySize(request) {
  const contentLength = request.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return {
      ok: false,
      response: createErrorResponse('Request body too large', 413),
    }
  }
  return { ok: true }
}

/**
 * Parse JSON request body safely
 * @param {Request} request
 * @returns {{ ok: boolean, data?: any, response?: NextResponse }}
 */
export async function parseJSONBody(request) {
  try {
    const body = await request.json()
    return { ok: true, data: body }
  } catch {
    return {
      ok: false,
      response: createErrorResponse('Invalid JSON in request body', 400),
    }
  }
}

/**
 * Create standardized success response
 * @param {any} data - Response data
 * @param {number} status - HTTP status code
 * @param {Record<string, string>} [additionalHeaders]
 * @returns {NextResponse}
 */
export function createSuccessResponse(data, status = 200, additionalHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...additionalHeaders,
  }

  return NextResponse.json(
    {
      success: true,
      data,
      error: null,
    },
    { status, headers }
  )
}

/**
 * Create standardized error response
 * @param {string} message - Error message (safe for client)
 * @param {number} status - HTTP status code
 * @param {Record<string, string>} [additionalHeaders]
 * @returns {NextResponse}
 */
export function createErrorResponse(message, status = 500, additionalHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...additionalHeaders,
  }

  return NextResponse.json(
    {
      success: false,
      data: null,
      error: message,
    },
    { status, headers }
  )
}

import crypto from 'crypto'

/**
 * Log error with structured format
 * @param {string} route - Route identifier (e.g., 'analyze', 'stock')
 * @param {Error} error - Error object
 * @param {Object} [context] - Additional context
 */
export function logError(route, error, context = {}) {
  // Only log stack trace in development, never in production
  const isDev = process.env.NODE_ENV !== 'production'
  const logEntry = {
    message: error.message,
    ...context,
    timestamp: new Date().toISOString(),
  }
  if (isDev) {
    logEntry.stack = error.stack
  }
  console.error(`[${route}] Error:`, logEntry)
}

/**
 * AI Provider caller with retry logic
 * @param {Object} config - Configuration object
 * @param {string} config.systemPrompt - System prompt
 * @param {string} config.userPrompt - User prompt
 * @param {Object} config.modelConfig - Model configuration
 * @returns {Promise<Object>} Parsed JSON response
 */
export async function callAIWithRetry({ systemPrompt, userPrompt, modelConfig = {} }) {
  const maxRetries = 2
  const baseDelay = 500
  let lastError

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, baseDelay * attempt))
    }

    try {
      return await attemptAIRequest({ systemPrompt, userPrompt, modelConfig })
    } catch (error) {
      lastError = error

      // Don't retry on certain errors
      if (error.message?.includes('No AI API key')) {
        throw error
      }

      if (attempt === maxRetries) {
        break
      }
    }
  }

  throw lastError || new Error('AI request failed after retries')
}

/**
 * Attempt a single AI request using the Enterprise AI Gateway
 * @param {Object} config - Configuration
 */
async function attemptAIRequest({ systemPrompt, userPrompt, modelConfig, analysisType }) {
  const { maxTokens = 4096, temperature = 0.1 } = modelConfig

  // 1. Determine Tier based on the analysis type
  // 'thesis', 'dcf', and 'risk' require deep reasoning (Tier 2 Heavy)
  // 'news' and 'extraction' require fast processing (Tier 1 Fast)
  let tier = 'heavy'
  if (analysisType === 'news' || analysisType === 'extraction') {
    tier = 'fast'
  }

  try {
    // 2. Pass the request to the Gateway.
    // The Gateway handles the queue, rate limiting, and fallback logic.
    // Check if gateway is available
    if (!gateway || !gateway.client) {
      const groqSet = (process.env.GROQ_API_KEY || '').replace(/['"]/g, '').trim();
      if (groqSet) {
        throw new Error('NVIDIA_API_KEY is missing. GROQ fallback is reserved for future implementation. Please provide a valid NVIDIA API key.');
      } else {
        throw new Error('No AI provider configured. Please set NVIDIA_API_KEY in your environment variables.');
      }
    }

    const content = await gateway.generate({
      tier: tier,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: temperature,
      max_tokens: maxTokens,
    })

    // Gateway already returns the content string directly
    return content
  } catch (error) {
    console.error(`[AIGateway] Final failure after all retries/fallbacks:`, error.message)
    throw new Error('AI request failed. The service may be experiencing high traffic.')
  }
}

/**
 * Generate unique request ID using cryptographically secure random bytes
 * @returns {string}
 */
export function generateRequestId() {
  const randomBytes = crypto.randomBytes(6).toString('base64url')
  return `${Date.now().toString(36)}-${randomBytes}`
}
