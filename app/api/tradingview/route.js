/**
 * GET /api/tradingview?exchange=NSE&symbol=TATAPOWER
 * POST /api/tradingview  body: { ticker: "TATAPOWER.NS" }
 *
 * Standalone TradingView financial statistics endpoint.
 * Can be called directly from the frontend or used internally.
 */
import { NextResponse } from 'next/server'
import { fetchTradingViewData, tickerToTradingView } from '@/lib/tradingview-scraper'
import { SECURITY_HEADERS, checkRequestSafety } from '@/lib/security'
import { getClientIP, checkRateLimit, RATE_LIMIT_PRESETS, createRateLimitHeaders } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Separate rate limit — Playwright scraping is expensive
const RATE_LIMIT = RATE_LIMIT_PRESETS.stockData

export async function GET(request) {
  const safety = checkRequestSafety(request)
  if (!safety.safe) {
    return NextResponse.json({ success: false, error: safety.reason }, { status: 403, headers: SECURITY_HEADERS })
  }

  const rateLimit = checkRateLimit(`tradingview:${getClientIP(request)}`, RATE_LIMIT)
  const headers = { ...SECURITY_HEADERS, ...createRateLimitHeaders(rateLimit) }
  if (!rateLimit.allowed) {
    return NextResponse.json({ success: false, error: 'Rate limit exceeded' }, { status: 429, headers })
  }

  const { searchParams } = new URL(request.url)
  let exchange = searchParams.get('exchange')?.toUpperCase()
  let symbol   = searchParams.get('symbol')?.toUpperCase()
  const ticker = searchParams.get('ticker')

  // Allow ?ticker=TATAPOWER.NS shorthand
  if (ticker && (!exchange || !symbol)) {
    const tv = tickerToTradingView(ticker)
    if (!tv) {
      return NextResponse.json({ success: false, error: 'Invalid ticker format' }, { status: 400, headers })
    }
    exchange = tv.exchange
    symbol   = tv.symbol
  }

  if (!exchange || !symbol) {
    return NextResponse.json(
      { success: false, error: 'Provide ?exchange=NSE&symbol=TATAPOWER or ?ticker=TATAPOWER.NS' },
      { status: 400, headers }
    )
  }

  try {
    const data = await fetchTradingViewData(exchange, symbol)
    if (!data) {
      return NextResponse.json(
        { success: false, error: `No data found for ${exchange}:${symbol} on TradingView` },
        { status: 404, headers }
      )
    }
    return NextResponse.json({ success: true, data }, { status: 200, headers })
  } catch (err) {
    console.error('[/api/tradingview] Error:', err.message)
    return NextResponse.json(
      { success: false, error: 'TradingView scrape failed. TradingView may be blocking requests.' },
      { status: 500, headers }
    )
  }
}

export async function POST(request) {
  const safety = checkRequestSafety(request)
  if (!safety.safe) {
    return NextResponse.json({ success: false, error: safety.reason }, { status: 403, headers: SECURITY_HEADERS })
  }

  const rateLimit = checkRateLimit(`tradingview:${getClientIP(request)}`, RATE_LIMIT)
  const headers = { ...SECURITY_HEADERS, ...createRateLimitHeaders(rateLimit) }
  if (!rateLimit.allowed) {
    return NextResponse.json({ success: false, error: 'Rate limit exceeded' }, { status: 429, headers })
  }

  let body
  try { body = await request.json() } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400, headers })
  }

  const tv = tickerToTradingView(body.ticker || body.exchange + ':' + body.symbol)
  if (!tv) {
    return NextResponse.json({ success: false, error: 'Invalid ticker' }, { status: 400, headers })
  }

  try {
    const data = await fetchTradingViewData(tv.exchange, tv.symbol)
    if (!data) {
      return NextResponse.json(
        { success: false, error: `No data found for ${tv.exchange}:${tv.symbol}` },
        { status: 404, headers }
      )
    }
    return NextResponse.json({ success: true, data }, { status: 200, headers })
  } catch (err) {
    console.error('[/api/tradingview] POST Error:', err.message)
    return NextResponse.json({ success: false, error: 'TradingView scrape failed' }, { status: 500, headers })
  }
}
