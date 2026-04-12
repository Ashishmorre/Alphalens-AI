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
import { fetchNSEData, parseIndASXBRL } from '@/lib/nse-xbrl-parser'

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

    // ─── NSE XBRL Fallback for Indian Equities ─────────────────────────────
    // If Yahoo Finance returns null for debtToEquity or roe on .NS tickers,
    // attempt to fetch audited data from NSE Corporate Filings
    if (validation.ticker.endsWith('.NS')) {
      const needsDebtToEquity = data.debtToEquity === null || data.debtToEquity === undefined
      const needsROE = data.roe === null || data.roe === undefined

      if ((needsDebtToEquity || needsROE) && data.totalEquity === undefined) {
        try {
          // Construct NSE corporate filings URL (example pattern - adjust as needed)
          const nseSymbol = validation.ticker.replace('.NS', '')
          const nseUrl = `https://www.nseindia.com/api/company-filings?symbol=${nseSymbol}&filingType=xbrl`

          // Fetch XBRL data with session management
          const xbrlXml = await fetchNSEData(nseUrl)

          if (xbrlXml) {
            const xbrlMetrics = parseIndASXBRL(xbrlXml)

            if (!xbrlMetrics.error) {
              // Patch missing ratios with XBRL-derived values
              if (needsDebtToEquity && xbrlMetrics.totalDebt !== undefined && xbrlMetrics.totalEquity !== undefined && xbrlMetrics.totalEquity > 0) {
                data.debtToEquity = xbrlMetrics.totalDebt / xbrlMetrics.totalEquity
              }

              if (needsROE && xbrlMetrics.netIncome !== undefined && xbrlMetrics.totalEquity !== undefined && xbrlMetrics.totalEquity > 0) {
                data.roe = xbrlMetrics.netIncome / xbrlMetrics.totalEquity
              }

              // Fill in other XBRL-derived metrics if missing
              if (!data.revenue && xbrlMetrics.revenueFromOperations) {
                data.revenue = xbrlMetrics.revenueFromOperations
              }
              if (!data.totalDebt && xbrlMetrics.totalDebt) {
                data.totalDebt = xbrlMetrics.totalDebt
              }

              // Mark data as XBRL-enhanced for UI transparency
              data._xbrlEnhanced = true
              data._xbrlMetrics = {
                totalEquity: xbrlMetrics.totalEquity,
                totalDebt: xbrlMetrics.totalDebt,
                netIncome: xbrlMetrics.netIncome,
              }
            }
          }
        } catch (nseError) {
          // Graceful degradation — don't fail the request if NSE fetch fails
          console.warn('NSE XBRL fetch failed (graceful degradation):', nseError.message)
          data._xbrlError = nseError.message
        }
      }
    }

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
