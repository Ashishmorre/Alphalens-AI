/**
 * TradingView Financial Statistics Scraper — Browserless.io Edition
 *
 * Uses Browserless.io (cloud Chrome) instead of local Playwright,
 * making it fully compatible with Vercel serverless deployment.
 *
 * Connection: playwright-core → wss://production-sfo.browserless.io → TradingView
 *
 * ENV REQUIRED: BROWSERLESS_TOKEN
 *
 * @module tradingview-scraper
 */

// ─── Ticker → TradingView Exchange Mapping ──────────────────────────────────

/**
 * Convert a Yahoo-style ticker to TradingView exchange + symbol.
 * e.g. "TATAPOWER.NS" → { exchange: "NSE", symbol: "TATAPOWER" }
 *      "AAPL"          → { exchange: "NASDAQ", symbol: "AAPL" }
 * @param {string} ticker
 * @returns {{ exchange: string, symbol: string } | null}
 */
export function tickerToTradingView(ticker) {
  if (!ticker) return null
  const upper = ticker.toUpperCase()
  if (upper.endsWith('.NS'))  return { exchange: 'NSE',    symbol: upper.replace(/\.NS$/, '') }
  if (upper.endsWith('.BO'))  return { exchange: 'BSE',    symbol: upper.replace(/\.BO$/, '') }
  if (upper.endsWith('.L'))   return { exchange: 'LSE',    symbol: upper.replace(/\.L$/, '')  }
  if (upper.endsWith('.T'))   return { exchange: 'TSE',    symbol: upper.replace(/\.T$/, '')  }
  if (upper.endsWith('.HK'))  return { exchange: 'HKEX',   symbol: upper.replace(/\.HK$/, '') }
  return { exchange: 'NASDAQ', symbol: upper }
}

// ─── Value Normalization ─────────────────────────────────────────────────────

/**
 * Parse TradingView value strings → numbers.
 * Handles: "1.23T", "456.78B", "12.3M", "12.3K", "12.5%", "—", "-"
 * @param {string} text
 * @returns {number|null}
 */
function parseValue(text) {
  if (!text || text === '—' || text === '-' || text === 'N/A') return null
  const clean = text.replace(/[₹$,\s]/g, '')
  const match = clean.match(/^(-?[\d.]+)([KMBT%]?)$/i)
  if (!match) return null
  const num = parseFloat(match[1])
  const suffix = match[2].toUpperCase()
  if (isNaN(num)) return null
  switch (suffix) {
    case 'T': return num * 1e12
    case 'B': return num * 1e9
    case 'M': return num * 1e6
    case 'K': return num * 1e3
    case '%': return num / 100
    default:  return num
  }
}

// ─── Label → Field Name Mapping ─────────────────────────────────────────────

const LABEL_MAP = {
  'market cap':             'marketCap',
  'market capitalization':  'marketCap',
  'enterprise value':       'enterpriseValue',
  'p/e ratio':              'pe',
  'price to earnings':      'pe',
  'pe ratio':               'pe',
  'trailing p/e':           'pe',
  'forward p/e':            'forwardPE',
  'price to book':          'priceToBook',
  'p/b ratio':              'priceToBook',
  'price to sales':         'priceToSales',
  'ev/ebitda':              'evToEbitda',
  'ev/revenue':             'evRevenue',
  'dividend yield':         'dividendYield',
  'annual dividend':        'dividendRate',
  'net margin':             'netProfitMargin',
  'profit margin':          'netProfitMargin',
  'gross margin':           'grossMargin',
  'operating margin':       'operatingMargin',
  'return on equity':       'roe',
  'roe':                    'roe',
  'return on assets':       'roa',
  'roa':                    'roa',
  'return on invested':     'roic',
  'debt to equity':         'debtToEquity',
  'debt/equity':            'debtToEquity',
  'd/e ratio':              'debtToEquity',
  'current ratio':          'currentRatio',
  'quick ratio':            'quickRatio',
  'interest coverage':      'interestCoverage',
  'revenue growth':         'revenueGrowth',
  'earnings growth':        'earningsGrowth',
  'eps growth':             'epsGrowth',
  'eps':                    'eps',
  'book value per share':   'bookValuePerShare',
  'cash per share':         'cashPerShare',
  'average volume':         'avgVolume',
  'volume':                 'volume',
  'beta':                   'beta',
  '52 week high':           'weekHigh52',
  '52 week low':            'weekLow52',
  'rsi':                    'rsi14',
}

function labelToField(rawLabel) {
  const label = rawLabel.toLowerCase().trim()
  for (const [key, field] of Object.entries(LABEL_MAP)) {
    if (label.includes(key)) return field
  }
  return null
}

// ─── Browserless.io WebSocket Endpoints ─────────────────────────────────────
// /playwright/chromium → use chromium.connect()      (Playwright Wire Protocol)
// /?token=...          → use chromium.connectOverCDP()  (raw CDP)
// Mixing these causes "Protocol error (Browser.getVersion): undefined"

function getBrowserlessPlaywrightEndpoint() {
  const token = process.env.BROWSERLESS_TOKEN
  if (!token) throw new Error('BROWSERLESS_TOKEN environment variable is not set')
  // Use chromium.connect() with this endpoint (Playwright Wire Protocol)
  return `wss://production-sfo.browserless.io/playwright/chromium?token=${token}`
}

function getBrowserlessCDPEndpoint() {
  const token = process.env.BROWSERLESS_TOKEN
  if (!token) throw new Error('BROWSERLESS_TOKEN environment variable is not set')
  // Use chromium.connectOverCDP() with this endpoint (raw CDP)
  return `wss://production-sfo.browserless.io/?token=${token}`
}

// ─── Main Scraper ────────────────────────────────────────────────────────────

/**
 * Scrape financial statistics from TradingView via Browserless.io.
 * @param {string} exchange - TradingView exchange code (NSE, NASDAQ, etc.)
 * @param {string} symbol   - Stock symbol (TATAPOWER, AAPL, etc.)
 * @returns {Promise<Object|null>} Normalized data or null on failure
 */
export async function fetchTradingViewData(exchange, symbol) {
  if (!exchange || !symbol) return null

  let browser
  try {
    // playwright-core only — no bundled Chromium, connects to Browserless
    const { chromium } = await import('playwright-core')

    console.log(`[TradingView] Connecting to Browserless for ${exchange}:${symbol}`)

    // Use chromium.connect() with the /playwright/chromium endpoint.
    // connectOverCDP() only works with the raw CDP endpoint (/?token=...).
    // Mixing them causes "Protocol error (Browser.getVersion): undefined".
    try {
      browser = await chromium.connect(getBrowserlessPlaywrightEndpoint())
    } catch (connectErr) {
      // Fallback: version mismatch on native connect — try raw CDP endpoint
      console.warn(`[TradingView] Native connect failed (${connectErr.message}), retrying over CDP...`)
      browser = await chromium.connectOverCDP(getBrowserlessCDPEndpoint())
    }

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/New_York',
    })

    const page = await context.newPage()

    // Block heavy resources to save bandwidth on Browserless (billed by usage)
    await page.route('**/*', route => {
      const rt  = route.request().resourceType()
      const url = route.request().url()
      if (
        rt === 'image' || rt === 'stylesheet' || rt === 'font' || rt === 'media' ||
        url.includes('.jpg') || url.includes('.png') || url.includes('.gif') ||
        url.includes('.svg') || url.includes('.css') || url.includes('.woff')
      ) {
        return route.abort()
      }
      return route.continue()
    })

    // ── Scrape Financials / Statistics page ──────────────────────────────
    const statsUrl = `https://in.tradingview.com/symbols/${exchange}-${symbol}/financials-statistics-and-ratios/`
    console.log(`[TradingView] → ${statsUrl}`)
    await page.goto(statsUrl, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(2500)

    // 404 check
    const notFound = await page.locator('text=/Page not found|Symbol not found|404/i').first().isVisible().catch(() => false)
    if (notFound) {
      console.warn(`[TradingView] ${exchange}:${symbol} not found`)
      await browser.close()
      return null
    }

    const rawStats = await page.evaluate(() => {
      const result = {}
      // Method 1: Standard HTML table rows
      document.querySelectorAll('tr').forEach(row => {
        const cells = row.querySelectorAll('td')
        if (cells.length >= 2) {
          const label = cells[0].textContent.trim()
          const value = cells[1].textContent.trim()
          if (label && value && !['__proto__', 'constructor', 'prototype'].includes(label)) result[label] = value
        }
      })
      // Method 2: Key-value rows with data attributes
      document.querySelectorAll('[class*="row"], [class*="item"], [class*="stat"]').forEach(el => {
        const spans = el.querySelectorAll('span, div')
        if (spans.length >= 2) {
          const label = spans[0].textContent.trim()
          const value = spans[1].textContent.trim()
          if (label && value && label !== value && !['__proto__', 'constructor', 'prototype'].includes(label)) result[label] = value
        }
      })
      // Method 3: Regex on full body text for common metrics
      const body = document.body.innerText
      const extractMetric = (patterns) => {
        for (const p of patterns) {
          const m = body.match(p)
          if (m) return m[1].trim()
        }
        return null
      }
      const mcap     = extractMetric([/Market\s*Cap(?:italization)?[\s:\n]*([\d,.]+\s*[TGMKB]?)/i])
      const pe       = extractMetric([/P\/E(?:\s*Ratio)?[\s:\n]*([\d,.]+)/i, /Trailing P\/E[\s:\n]*([\d,.]+)/i])
      const rsi      = extractMetric([/RSI(?:\s*\(14\))?[\s:]*([\d.]+)/i])
      const consensus= body.match(/(Strong Buy|Buy|Hold|Sell|Strong Sell)/i)?.[1]
      if (mcap)      result['Market Cap (body)'] = mcap
      if (pe)        result['P/E Ratio (body)']  = pe
      if (rsi)       result['RSI (body)']         = rsi
      if (consensus) result['Consensus (body)']   = consensus
      return result
    })

    // ── Optionally scrape Technicals page for RSI if missing ─────────────
    let rsiValue = null
    if (!rawStats['RSI (body)']) {
      try {
        const techUrl = `https://in.tradingview.com/symbols/${exchange}-${symbol}/technicals/`
        await page.goto(techUrl, { waitUntil: 'networkidle', timeout: 25000 })
        await page.waitForTimeout(1500)
        rsiValue = await page.evaluate(() => {
          const body = document.body.innerText
          const m = body.match(/RSI(?:\s*\(14\))?[\s:]*([\d.]+)/i)
          return m ? m[1] : null
        })
      } catch { /* ignore */ }
    }

    await browser.close()
    browser = null

    // ── Normalize raw key-value pairs → structured fields ────────────────
    const normalized = {
      _source:     'tradingview',
      _exchange:   exchange,
      _symbol:     symbol,
      _url:        statsUrl,
      _scrapedAt:  new Date().toISOString(),
    }

    for (const [rawLabel, rawValue] of Object.entries(rawStats)) {
      const field = labelToField(rawLabel)
      if (!field) continue
      const num = parseValue(rawValue)
      if (num === null) continue
      // Normalize ROE/ROA/ROIC: if > 1, assume it's a percentage, convert to decimal
      if (['roe', 'roa', 'roic'].includes(field)) {
        normalized[field] = Math.abs(num) > 1 ? num / 100 : num
      } else {
        normalized[field] = num
      }
    }

    // RSI — keep as raw number (0-100 scale)
    if (rawStats['RSI (body)']) normalized.rsi14 = parseFloat(rawStats['RSI (body)'])
    if (rsiValue)               normalized.rsi14 = parseFloat(rsiValue)
    if (rawStats['Consensus (body)']) normalized.analystConsensus = rawStats['Consensus (body)']

    const hasData = Object.keys(normalized).some(k => !k.startsWith('_'))
    if (!hasData) {
      console.warn(`[TradingView] No useful data extracted for ${exchange}:${symbol}`)
      return null
    }

    console.log(`[TradingView] ✓ ${exchange}:${symbol} — ${Object.keys(normalized).filter(k => !k.startsWith('_')).length} fields`)
    return normalized

  } catch (err) {
    console.warn(`[TradingView] Scrape failed for ${exchange}:${symbol}:`, err.message)
    return null
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}

/**
 * Merge TradingView data into the main stock data object.
 * Only fills fields that are null/undefined in the primary data.
 * @param {Object} stockData - Existing normalized stock data
 * @param {Object|null} tvData - TradingView scraped data
 * @returns {Object} Merged data
 */
export function mergeTradingViewData(stockData, tvData) {
  if (!tvData) return stockData
  const merged = { ...stockData }

  const fillableFields = [
    'marketCap', 'pe', 'forwardPE', 'priceToBook', 'priceToSales',
    'evToEbitda', 'evRevenue', 'debtToEquity', 'currentRatio', 'quickRatio',
    'roe', 'roa', 'grossMargin', 'operatingMargin', 'netProfitMargin',
    'dividendYield', 'eps', 'beta', 'weekHigh52', 'weekLow52',
    'avgVolume', 'bookValuePerShare', 'revenueGrowth', 'earningsGrowth',
    'rsi14', 'analystConsensus',
  ]

  let filledCount = 0
  for (const field of fillableFields) {
    if ((merged[field] === null || merged[field] === undefined) && tvData[field] != null) {
      merged[field] = tvData[field]
      filledCount++
    }
  }

  if (filledCount > 0) {
    merged._tvEnhanced = true
    merged._tvFilledFields = filledCount
    merged._dataSources = [...(stockData._dataSources || ['yahoo']), 'tradingview']
    console.log(`[TradingView] Filled ${filledCount} missing fields`)
  }

  return merged
}

export default { fetchTradingViewData, mergeTradingViewData, tickerToTradingView }
