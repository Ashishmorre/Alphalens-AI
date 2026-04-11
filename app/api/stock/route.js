import { NextResponse } from 'next/server'
import {
  getClientIP,
  checkRateLimit,
  RATE_LIMIT_PRESETS,
  createRateLimitHeaders,
} from '@/lib/server/rate-limit.js'
import { validateTicker } from '@/lib/server/validation.js'
import {
  fetchStockData,
  transformYahooData,
} from '@/lib/server/yahoo-finance.js'
import { createSuccessResponse, createErrorResponse, logError } from '@/lib/server/api-utils.js'

const RATE_LIMIT = RATE_LIMIT_PRESETS.stockData

/**
 * GET /api/stock?ticker={ticker}
 * Fetch stock data from Yahoo Finance
 */
export async function GET(request) {
  const clientIP = getClientIP(request)

  // Rate limiting
  const rateLimit = checkRateLimit(`stock:${clientIP}`, RATE_LIMIT)
  const headers = createRateLimitHeaders(rateLimit)

  if (!rateLimit.allowed) {
    return createErrorResponse(
      'Rate limit exceeded. Please try again later.',
      429,
      { ...headers, 'Retry-After': String(rateLimit.retryAfter) }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const rawTicker = searchParams.get('ticker')

    // Validate ticker
    const validation = validateTicker(rawTicker)
    if (!validation.valid) {
      return createErrorResponse(validation.error, 400, headers)
    }

    // Fetch and transform data
    const rawData = await fetchStockData(validation.ticker)
    const data = transformYahooData(rawData.ticker, {
      quote: rawData.quote,
      summary: rawData.summary,
    })

    return createSuccessResponse(data, 200, headers)

  } catch (error) {
    logError('stock', error, { url: request.url })

    // Specific error handling
    if (error.message?.includes('Rate limit')) {
      return createErrorResponse('Rate limit exceeded. Please try again later.', 429, headers)
    }

    const status = error.message?.includes('Could not fetch') ? 404 : 500
    const message = status === 404
      ? error.message
      : 'Failed to fetch market data. Please try again later.'

    return createErrorResponse(message, status, headers)
  }
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
