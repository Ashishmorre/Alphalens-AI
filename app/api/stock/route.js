import { NextResponse } from 'next/server'
import {
  getClientIP,
  checkRateLimit,
  RATE_LIMIT_PRESETS,
  createRateLimitHeaders,
} from '@/lib/rate-limit'
import { validateTicker } from '@/lib/validation'
import {
  fetchStockData,
  transformYahooData,
} from '@/lib/yahoo-finance'
import { createSuccessResponse, createErrorResponse, logError } from '@/lib/api-utils'
import {
  SECURITY_HEADERS,
  checkRequestSafety,
  sanitizeInput,
} from '@/lib/security'

const RATE_LIMIT = RATE_LIMIT_PRESETS.stockData

/**
 * GET /api/stock?ticker={ticker}
 * Fetch stock data from Yahoo Finance
 */
export async function GET(request) {
  // Security check
  const safety = checkRequestSafety(request)
  if (!safety.safe) {
    return NextResponse.json(
      { success: false, error: safety.reason },
      { status: 403, headers: SECURITY_HEADERS }
    )
  }

  const clientIP = getClientIP(request)

  // Rate limiting
  const rateLimit = checkRateLimit(`stock:${clientIP}`, RATE_LIMIT)
  const headers = { ...SECURITY_HEADERS, ...createRateLimitHeaders(rateLimit) }

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: 'Rate limit exceeded. Please try again later.',
      },
      { status: 429, headers: { ...headers, 'Retry-After': String(rateLimit.retryAfter) } }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const rawTicker = searchParams.get('ticker')

    // Sanitize input
    const sanitizedTicker = sanitizeInput(rawTicker)

    // Validate ticker
    const validation = validateTicker(sanitizedTicker)
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400, headers }
      )
    }

    // Fetch and transform data
    const rawData = await fetchStockData(validation.ticker)
    const data = transformYahooData(rawData.ticker, {
      quote: rawData.quote,
      summary: rawData.summary,
    })

    return NextResponse.json(
      { success: true, data, error: null },
      { status: 200, headers }
    )

  } catch (error) {
    logError('stock', error, { url: request.url })

    // Specific error handling
    if (error.message?.includes('Rate limit')) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers }
      )
    }

    const status = error.message?.includes('Could not fetch') ? 404 : 500
    const message = status === 404
      ? error.message
      : 'Failed to fetch market data. Please try again later.'

    return NextResponse.json(
      { success: false, error: message },
      { status, headers }
    )
  }
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
