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

// Known NSE-listed tickers for server-side auto-suffix
// Mirrors the KNOWN_INDIAN_TICKERS set in SearchBar.js
const KNOWN_INDIAN_TICKERS = new Set([
  'RELIANCE', 'TCS', 'HDFCBANK', 'HDFC', 'INFY', 'SBIN', 'ICICIBANK',
  'HINDUNILVR', 'KOTAKBANK', 'ITC', 'BHARTIARTL', 'AXISBANK', 'LT', 'ASIANPAINT',
  'MARUTI', 'BAJFINANCE', 'BAJAJFINSV', 'WIPRO', 'HCLTECH', 'ULTRACEMCO',
  'TITAN', 'SUNPHARMA', 'TATAMOTORS', 'TATASTEEL', 'NESTLEIND', 'ADANIPORTS',
  'POWERGRID', 'NTPC', 'ONGC', 'JSWSTEEL', 'GRASIM', 'TECHM', 'INDUSINDBK',
  'DIVISLAB', 'DRREDDY', 'CIPLA', 'BRITANNIA', 'EICHERMOT', 'TATAPOWER',
  'ADANIENT', 'VEDL', 'COALINDIA', 'HINDALCO', 'BPCL', 'HEROMOTOCO',
  'SIEMENS', 'PIDILITIND', 'HAVELLS', 'DABUR', 'MARICO'
])

/**
 * GET /api/stock?ticker={ticker}
 * Fetch stock data from Yahoo Finance with NSE XBRL fallback for Indian equities
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

    // ─── Server-Side Indian Ticker Normalization ───────────────────────────
    // If ticker has no suffix but is a known NSE stock, auto-append .NS BEFORE fetching.
    // This catches direct API calls that bypass the SearchBar frontend fix.
    if (!validation.ticker.includes('.') && KNOWN_INDIAN_TICKERS.has(validation.ticker)) {
      validation.ticker = validation.ticker + '.NS'
      console.log(`[API Normalize] Auto-appended .NS → ${validation.ticker}`)
    }

    // Fetch and transform data
    const rawData = await fetchStockData(validation.ticker)
    const data = transformYahooData(rawData.ticker, {
      quote: rawData.quote,
      summary: rawData.summary,
    })

    // ─── NSE XBRL Fallback for Indian Equities ─────────────────────────────
    const isIndianTicker = validation.ticker.endsWith('.NS') || validation.ticker.endsWith('.BO')
	console.log(`[API Check] ${validation.ticker}: isIndian=${isIndianTicker}`)

    if (isIndianTicker) {
      const needsDebtToEquity = data.debtToEquity === null || data.debtToEquity === undefined
      const needsROE = data.roe === null || data.roe === undefined
      const needsCurrentRatio = data.currentRatio === null || data.currentRatio === undefined
      const needsPriceToBook = data.priceToBook === null || data.priceToBook === undefined

      if (needsDebtToEquity || needsROE || needsCurrentRatio || needsPriceToBook) {
        try {
          const nseSymbol = validation.ticker.replace('.NS', '').replace('.BO', '')
          const nseUrl = `https://www.nseindia.com/api/company-filings?symbol=${nseSymbol}&filingType=xbrl`
          const xbrlXml = await fetchNSEData(nseUrl)

          if (xbrlXml) {
            const xbrlMetrics = parseIndASXBRL(xbrlXml)

            if (!xbrlMetrics.error) {
              const marketData = {
                currentPrice: data.price || 0,
                sharesOutstanding: data.sharesOutstanding || 0,
                marketCap: data.marketCap || 0,
              }

              const calculatedRatios = calculateRatiosFromXBRL(xbrlMetrics, marketData)

              // DEBUG: Log XBRL metrics
              console.log(`[NSE XBRL Debug] ${validation.ticker}:`, {
                hasNetIncome: !!xbrlMetrics.netIncome,
                hasTotalEquity: !!xbrlMetrics.totalEquity,
                netIncome: xbrlMetrics.netIncome,
                totalEquity: xbrlMetrics.totalEquity,
                calculatedROE: calculatedRatios.roe,
              })

              if (needsDebtToEquity && calculatedRatios.debtToEquity !== null) {
                data.debtToEquity = calculatedRatios.debtToEquity
              }
              if (needsROE && calculatedRatios.roe !== null) {
                data.roe = calculatedRatios.roe / 100
                console.log(`[NSE XBRL] ${validation.ticker}: ROE set to ${data.roe}`)
              }
              if (needsCurrentRatio && calculatedRatios.currentRatio !== null) {
                data.currentRatio = calculatedRatios.currentRatio
              }
              if (needsPriceToBook && calculatedRatios.priceToBook !== null) {
                data.priceToBook = calculatedRatios.priceToBook
              }

              // Fill raw XBRL metrics
              if (!data.revenue && xbrlMetrics.revenueFromOperations) {
                data.revenue = xbrlMetrics.revenueFromOperations
              }
              if (!data.totalDebt && xbrlMetrics.totalDebt) {
                data.totalDebt = xbrlMetrics.totalDebt
              }
              if (!data.totalEquity && xbrlMetrics.totalEquity) {
                data.totalEquity = xbrlMetrics.totalEquity
              }
              if (!data.netIncome && xbrlMetrics.netIncome) {
                data.netIncome = xbrlMetrics.netIncome
              }

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
          console.warn('NSE XBRL fetch failed:', nseError.message)
          data._xbrlError = nseError.message
        }
      }
    }

    // ─── Screener.in Peer & Ratio Data ─────────────────────────────────────
    if (isIndianTicker && isScreenerEligible(validation.ticker)) {
      try {
        const screenerResult = await fetchScreenerData(validation.ticker)
        if (screenerResult) {
          Object.assign(data, mergeScreenerData(data, screenerResult))
          console.log(`[Screener Result] ${validation.ticker}: ROE=${data.roe}, Source=${data._dataSources?.roe || 'none'}`)
        }
      } catch (screenerError) {
        console.warn('Screener data fetch failed:', screenerError.message)
      }
    }

    // ─── TradingView Fallback ────────────────────────────────────────────
	// Only trigger if 3+ critical fields are missing.
	// EV/EBITDA formula + Screener cover most gaps — TradingView is truly last-resort.
	const hasMissingROE = data.roe === null || data.roe === undefined || data.roe === 0
	const missingCritical = [
		data.pe, data.priceToBook, data.debtToEquity,
		data.currentRatio, data.evToEbitda,
		].filter(v => v === null || v === undefined).length + (hasMissingROE ? 1 : 0)

	if (missingCritical >= 3) {
      try {
        const tv = tickerToTradingView(validation.ticker)
        if (tv) {
          // 6s cap: safe within Vercel's 10s serverless limit
          const tvTimeout = new Promise(resolve => setTimeout(() => resolve(null), 6000))
          const tvFetch = fetchTradingViewData(tv.exchange, tv.symbol)
          const tvData = await Promise.race([tvFetch, tvTimeout])
          if (tvData) {
            Object.assign(data, mergeTradingViewData(data, tvData))
          }
        }
      } catch (tvError) {
        console.warn('TradingView data fetch failed:', tvError.message)
      }
    }

    // ─── Final ROE Calculation Fallback ──────────────────────────────────
    // If ROE is still missing but we have netIncome and totalEquity, calculate it
    if ((data.roe === null || data.roe === undefined) && data.netIncome && data.totalEquity && data.totalEquity > 0) {
      data.roe = data.netIncome / data.totalEquity
      console.log(`[ROE Final Fallback] ${validation.ticker}: ROE = ${data.netIncome} / ${data.totalEquity} = ${data.roe}`)
      if (!data._dataSources) data._dataSources = {}
      data._dataSources.roe = 'calculated_from_equity'
    }

    return NextResponse.json(
      { success: true, data, error: null },
      { status: 200, headers }
    )

  } catch (error) {
    logError('stock', error, { url: request.url })

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
