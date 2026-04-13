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
import { calculateRatiosFromXBRL } from '@/lib/financial-utils'
import { fetchScreenerData, mergeScreenerData, isScreenerEligible } from '@/lib/screener-scraper'
import { fetchTradingViewData, mergeTradingViewData, tickerToTradingView } from '@/lib/tradingview-scraper'

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
    // If Yahoo Finance returns null for key ratios on .NS/.BO tickers,
    // fetch audited data from NSE Corporate Filings and calculate ratios
    const isIndianTicker = validation.ticker.endsWith('.NS') || validation.ticker.endsWith('.BO')

    if (isIndianTicker) {
      const needsDebtToEquity = data.debtToEquity === null || data.debtToEquity === undefined || data.debtToEquity === 0
      const needsROE = data.roe === null || data.roe === undefined || data.roe === 0
      const needsCurrentRatio = data.currentRatio === null || data.currentRatio === undefined || data.currentRatio === 0
      const needsPriceToBook = data.priceToBook === null || data.priceToBook === undefined || data.priceToBook === 0

      if (needsDebtToEquity || needsROE || needsCurrentRatio || needsPriceToBook) {
        try {
          // Construct NSE corporate filings URL
          const nseSymbol = validation.ticker.replace('.NS', '').replace('.BO', '')
          const nseUrl = `https://www.nseindia.com/api/company-filings?symbol=${nseSymbol}&filingType=xbrl`

          // Fetch XBRL data with session management
          const xbrlXml = await fetchNSEData(nseUrl)

          if (xbrlXml) {
            const xbrlMetrics = parseIndASXBRL(xbrlXml)

            if (!xbrlMetrics.error) {
              // Calculate ratios from XBRL using professional-grade math
              const marketData = {
                currentPrice: data.price || 0,
                sharesOutstanding: data.sharesOutstanding || 0,
                marketCap: data.marketCap || 0,
              }

              const calculatedRatios = calculateRatiosFromXBRL(xbrlMetrics, marketData)

              // Patch missing ratios with XBRL-derived values
              if (needsDebtToEquity && calculatedRatios.debtToEquity !== null) {
                data.debtToEquity = calculatedRatios.debtToEquity
              }
              if (needsROE && calculatedRatios.roe !== null) {
                data.roe = calculatedRatios.roe / 100 // Convert from percentage to decimal
              }
              if (needsCurrentRatio && calculatedRatios.currentRatio !== null) {
                data.currentRatio = calculatedRatios.currentRatio
              }
              if (needsPriceToBook && calculatedRatios.priceToBook !== null) {
                data.priceToBook = calculatedRatios.priceToBook
              }
              if (!data.bookValuePerShare && calculatedRatios.bookValuePerShare !== null) {
                data.bookValuePerShare = calculatedRatios.bookValuePerShare
              }

              // Fill in raw XBRL-derived metrics if missing
              if (!data.revenue && xbrlMetrics.revenueFromOperations) {
                data.revenue = xbrlMetrics.revenueFromOperations
              }
              if (!data.totalDebt && xbrlMetrics.totalDebt) {
                data.totalDebt = xbrlMetrics.totalDebt
              }
              if (!data.totalEquity && xbrlMetrics.totalEquity) {
                data.totalEquity = xbrlMetrics.totalEquity
              }

              // Mark data as XBRL-enhanced for UI transparency and AI context
              data._xbrlEnhanced = true
              data._xbrlMetrics = {
                totalEquity: xbrlMetrics.totalEquity,
                totalDebt: xbrlMetrics.totalDebt,
                netIncome: xbrlMetrics.netIncome,
                currentAssets: xbrlMetrics.currentAssets,
                currentLiabilities: xbrlMetrics.currentLiabilities,
                bookValuePerShare: calculatedRatios.bookValuePerShare,
              }
              data._xbrlRatios = calculatedRatios
            }
          }
        } catch (nseError) {
          // Graceful degradation — don't fail the request if NSE fetch fails
          console.warn('NSE XBRL fetch failed (graceful degradation):', nseError.message)
          data._xbrlError = nseError.message
        }
      }
    }

    // ─── Screener.in Peer & Ratio Data for Indian Equities ────────────────────
    // fetchScreenerData was imported but never called — this is the fix for
    // missing Peer Groups in Risk & Ratios analysis
    if (isIndianTicker && isScreenerEligible(validation.ticker)) {
      try {
        const screenerResult = await fetchScreenerData(validation.ticker)
        if (screenerResult) {
          // mergeScreenerData attaches screenerPeers + fills gaps in Yahoo ratios
          Object.assign(data, mergeScreenerData(data, screenerResult))
        }
      } catch (screenerError) {
        // Graceful degradation — don't fail if Screener fetch fails
        console.warn('Screener data fetch failed (graceful degradation):', screenerError.message)
      }
    }

    // ─── TradingView Fallback (4th source) ─────────────────────────────────
    // Fills any remaining null fields using Playwright-scraped TradingView data.
    // Runs ONLY if critical fields are still missing after Yahoo + XBRL + Screener.
    // Skipped when Screener already covered all ratios (avoids unnecessary 45s scrape).
    const missingCritical = [
      data.pe, data.priceToBook, data.debtToEquity,
      data.roe, data.currentRatio, data.evToEbitda,
    ].filter(v => v === null || v === undefined || v === 0).length

    if (missingCritical >= 2) {
      try {
        const tv = tickerToTradingView(validation.ticker)
        if (tv) {
          // Hard 20-second limit — Playwright is slow; degrade gracefully if timeout
          const tvTimeout = new Promise(resolve => setTimeout(() => resolve(null), 20000))
          const tvFetch   = fetchTradingViewData(tv.exchange, tv.symbol)
          const tvData    = await Promise.race([tvFetch, tvTimeout])
          if (tvData) {
            Object.assign(data, mergeTradingViewData(data, tvData))
          }
        }
      } catch (tvError) {
        // Graceful degradation — TradingView scraping is best-effort
        console.warn('TradingView data fetch failed (graceful degradation):', tvError.message)
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
