/**
 * API Utilities
 * Shared helpers for API route handlers
 */

import { NextResponse } from 'next/server'

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
  if (contentLength && parseInt(contentLength) > MAX_BODY_SIZE) {
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

/**
 * Log error with structured format
 * @param {string} route - Route identifier (e.g., 'analyze', 'stock')
 * @param {Error} error - Error object
 * @param {Object} [context] - Additional context
 */
export function logError(route, error, context = {}) {
  console.error(`[${route}] Error:`, {
    message: error.message,
    stack: error.stack,
    ...context,
    timestamp: new Date().toISOString(),
  })
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
 * Attempt a single AI request
 * @param {Object} config - Configuration
 */
async function attemptAIRequest({ systemPrompt, userPrompt, modelConfig }) {
  const { model = 'llama3.1-8b', maxTokens = 4096, temperature = 0.7 } = modelConfig

  // Try Cerebras first
  if (process.env.CEREBRAS_API_KEY) {
    try {
      const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CEREBRAS_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          stream: false,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature,
          max_completion_tokens: maxTokens,
        }),
      })

      const data = await res.json()

      if (res.ok && data.choices?.[0]?.message?.content) {
        return data.choices[0].message.content
      }

      if (!res.ok && data.error) {
        throw new Error(`Cerebras: ${data.error.message || 'API error'}`)
      }
    } catch (error) {
      // Only throw if no fallback available, otherwise continue to Groq
      if (!process.env.GROQ_API_KEY) {
        throw error
      }
    }
  }

  // Fallback to Groq
  if (process.env.GROQ_API_KEY) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error?.message || 'Groq API error')
    }

    return data.choices?.[0]?.message?.content || ''
  }

  throw new Error('No AI API key configured')
}

/**
 * Generate unique request ID
 * @returns {string}
 */
export function generateRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`
}
