/**
 * ============================================================================
 * PRODUCTION DCF VALUATION API
 * v16.0 - Architecture: Yahoo → DB → Validation → Macro → Projections → Output
 * ============================================================================
 *
 * This API uses the production-grade orchestrator.
 * No AI for calculations - pure JS math with database persistence.
 */

import { NextResponse } from 'next/server'
import { getClientIP, checkRateLimit, RATE_LIMIT_PRESETS, createRateLimitHeaders } from '@/lib/rate-limit'
import { checkRequestSafety, SECURITY_HEADERS } from '@/lib/security'
import { logError } from '@/lib/api-utils'
import { runCompleteDCF, runBatchDCF } from '@/lib/dcf-orchestrator'

const RATE_LIMIT = RATE_LIMIT_PRESETS.aiAnalysis

/**
 * POST /api/valuation
 * Run complete DCF valuation with production architecture
 */
export async function POST(request) {
  const startTime = Date.now()
  const clientIP = getClientIP(request)

  try {
    // Rate limit check
    const rateLimit = await checkRateLimit(clientIP, RATE_LIMIT)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
        { status: 429, headers: createRateLimitHeaders(rateLimit) }
      )
    }

    // Request safety check
    const safety = checkRequestSafety(request)
    if (!safety.safe) {
      return NextResponse.json(
        { error: 'Request blocked', reason: safety.reason },
        { status: 403, headers: SECURITY_HEADERS }
      )
    }

    // Parse request
    const body = await request.json()
    const { ticker, options = {} } = body

    if (!ticker) {
      return NextResponse.json(
        { error: 'Ticker required' },
        { status: 400, headers: SECURITY_HEADERS }
      )
    }

    // Validate inputs
    const validatedTicker = String(ticker).toUpperCase().trim().slice(0, 20)
    if (!/^[A-Z0-9\.\-]+$/.test(validatedTicker)) {
      return NextResponse.json(
        { error: 'Invalid ticker format' },
        { status: 400, headers: SECURITY_HEADERS }
      )
    }

    // Run production DCF
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const result = await runCompleteDCF(validatedTicker, {
      ...options,
      signal: controller.signal,
      includeAI: options.includeAI !== false, // Default to true for now
    })

    clearTimeout(timeoutId)

    // Handle errors
    if (result.error) {
      const statusCode = result.error === 'VALIDATION_FAILED' ? 422 : 500
      return NextResponse.json(result, {
        status: statusCode,
        headers: {
          ...SECURITY_HEADERS,
          ...createRateLimitHeaders(rateLimit),
        }
      })
    }

    // Success response
    const duration = Date.now() - startTime

    return NextResponse.json({
      ...result,
      meta: {
        apiVersion: '16.0',
        architecture: 'production',
        duration,
        timestamp: new Date().toISOString(),
      }
    }, {
      headers: {
        ...SECURITY_HEADERS,
        ...createRateLimitHeaders(rateLimit),
      }
    })

  } catch (error) {
    logError('Valuation API error', error)
    return NextResponse.json(
      { error: 'Internal error', message: error.message },
      { status: 500, headers: SECURITY_HEADERS }
    )
  }
}

/**
 * GET /api/valuation?ticker=XYZ
 * Quick valuation (cached)
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const ticker = searchParams.get('ticker')?.toUpperCase().trim()

  if (!ticker) {
    return NextResponse.json(
      { error: 'Ticker required as query parameter' },
      { status: 400 }
    )
  }

  const clientIP = getClientIP(request)
  const rateLimit = await checkRateLimit(clientIP, { ...RATE_LIMIT, max: RATE_LIMIT.max * 2 })

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429, headers: createRateLimitHeaders(rateLimit) }
    )
  }

  try {
    const result = await runCompleteDCF(ticker, { includeAI: false })

    if (result.error) {
      return NextResponse.json(result, { status: 422 })
    }

    // Return simplified response
    return NextResponse.json({
      ticker,
      status: result.status,
      currentPrice: result.currentPrice,
      intrinsicValue: result.intrinsicValue,
      upside: result.upside,
      verdict: result.verdict,
      dataQuality: result.dataQuality,
      recommendation: result.recommendation,
    }, {
      headers: createRateLimitHeaders(rateLimit)
    })

  } catch (error) {
    logError('Valuation GET error', error)
    return NextResponse.json(
      { error: 'Internal error', message: error.message },
      { status: 500 }
    )
  }
}

function createRateLimitHeaders(rateLimit) {
  return {
    'X-RateLimit-Limit': rateLimit.limit?.toString() || '0',
    'X-RateLimit-Remaining': rateLimit.remaining?.toString() || '0',
    'X-RateLimit-Reset': rateLimit.reset?.toString() || '0',
  }
}