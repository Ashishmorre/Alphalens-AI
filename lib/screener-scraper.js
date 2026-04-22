/**
 * Screener.in Web Scraper
 * Extracts peer comparison data and top-level ratios for Indian equities
 * @module screener-scraper
 */

import * as cheerio from 'cheerio'

const SCREENER_BASE_URL = 'https://www.screener.in'
const REQUEST_TIMEOUT = 15000

// Browser-like headers to avoid 403 blocks
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Cache-Control': 'max-age=0',
}

/**
 * Clean ticker for Screener.in URL (strip .NS/.BO suffixes)
 * @param {string} ticker - Raw ticker like TATAPOWER.NS
 * @returns {string} Clean ticker like TATAPOWER
 */
function cleanTicker(ticker) {
  if (!ticker) return ''
  return ticker.replace(/\.(NS|BO|ns|bo)$/, '').toUpperCase()
}

/**
 * Extract numeric value from text (handles formats like "₹1,234.56", "12.5%", etc.)
 * @param {string} text - Raw text value
 * @returns {number|null} Parsed number or null
 */
function extractNumber(text) {
  if (!text) return null
  const cleaned = text.replace(/[₹$,]/g, '').replace(/%/g, '').trim()
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

/**
 * Parse market cap string (handles Cr, L, T suffixes)
 * @param {string} text - Raw market cap like "₹1,234.56 Cr"
 * @returns {number|null} Value in base currency or null
 */
function parseMarketCap(text) {
  if (!text) return null
  const cleaned = text.replace(/[₹,]/g, '').trim()
  const match = cleaned.match(/^([\d.]+)\s*(Cr|L|T)?$/i)
  if (!match) return null

  const value = parseFloat(match[1])
  const suffix = (match[2] || '').toUpperCase()

  if (isNaN(value)) return null

  switch (suffix) {
    case 'T': return value * 1e12  // Trillion
    case 'CR': return value * 1e7  // Crore = 10 million
    case 'L': return value * 1e5   // Lakh = 100 thousand
    default: return value
  }
}

/**
 * Extract top-level ratios from Screener.in page
 * @param {CheerioAPI} $ - Cheerio loaded page
 * @returns {Object} Extracted ratios
 */
function extractTopRatios($) {
  const ratios = {
    stockPE: null,
    roce: null,
    roe: null,
    evToEbitda: null,
    debtToEquity: null,
    priceToBook: null,
    dividendYield: null,
    eps: null,
    industryPE: null,
    marketCap: null,
    faceValue: null,
    bookValue: null,
    salesGrowth: null,
    profitGrowth: null,
    opm: null,
  }

  try {
    // #top-ratios contains the main ratios
    $('#top-ratios li').each((_, el) => {
      const labelEl = $(el).find('.name')
      const valueEl = $(el).find('.number')

      if (!labelEl.length || !valueEl.length) return

      const label = labelEl.text().trim().toLowerCase()
      const valueText = valueEl.text().trim()

      // Map labels to ratio fields
      if (label.includes('stock p/e') || label.includes('p/e')) {
        ratios.stockPE = extractNumber(valueText)
      } else if (label.includes('roce')) {
        ratios.roce = extractNumber(valueText)
      } else if (label.includes('roe')) {
        ratios.roe = extractNumber(valueText)
        console.log(`[Screener] Found ROE: ${ratios.roe}%`)
      } else if (label.includes('ev/ebitda') || label.includes('ev / ebitda')) {
        ratios.evToEbitda = extractNumber(valueText)
        console.log(`[Screener] Found EV/EBITDA: ${ratios.evToEbitda}`)
      } else if (label.includes('debt to equity')) {
        ratios.debtToEquity = extractNumber(valueText)
      } else if (label.includes('price to book') || label.includes('p/b')) {
        ratios.priceToBook = extractNumber(valueText)
      } else if (label.includes('dividend yield')) {
        ratios.dividendYield = extractNumber(valueText)
      } else if (label.includes('eps')) {
        ratios.eps = extractNumber(valueText)
      } else if (label.includes('industry pe') || label.includes('sector p/e')) {
        ratios.industryPE = extractNumber(valueText)
      } else if (label.includes('market cap')) {
        ratios.marketCap = parseMarketCap(valueText)
      } else if (label.includes('face value')) {
        ratios.faceValue = extractNumber(valueText)
      } else if (label.includes('book value')) {
        ratios.bookValue = extractNumber(valueText)
      } else if (label.includes('sales growth')) {
        ratios.salesGrowth = extractNumber(valueText)
      } else if (label.includes('profit growth')) {
        ratios.profitGrowth = extractNumber(valueText)
      } else if (label.includes('opm') || label.includes('operating profit margin')) {
        ratios.opm = extractNumber(valueText)
      }
    })
  } catch (err) {
    console.warn('Error extracting top ratios:', err.message)
  }

  return ratios
}

/**
 * Extract peer comparison table from Screener.in
 * @param {CheerioAPI} $ - Cheerio loaded page
 * @returns {Array} Array of peer objects
 */
function extractPeers($) {
  const peers = []

  try {
    const table = $('#peers-table, #peers table').first()
    if (!table.length) {
      // Try alternative selector
      const altTable = $('table:has(th:contains("Name")):has(th:contains("CMP"))').first()
      if (!altTable.length) return peers
    }

    const rows = table.find('tbody tr, tr').slice(0, 6) // Header + top 5 peers

    rows.each((i, row) => {
      if (i === 0) return // Skip header row

      const cells = $(row).find('td')
      if (cells.length < 4) return

      const name = $(cells[0]).text().trim()
      const cmpText = $(cells[1]).text().trim()
      const peText = $(cells[2]).text().trim()
      const marketCapText = $(cells[3]).text().trim()

      if (!name) return

      const peer = {
        name,
        ticker: name.replace(/\s+/g, '').toUpperCase(), // Generate ticker from name
        cmp: extractNumber(cmpText),
        pe: extractNumber(peText),
        marketCap: parseMarketCap(marketCapText),
      }

      peers.push(peer)
    })
  } catch (err) {
    console.warn('Error extracting peers:', err.message)
  }

  return peers.slice(0, 5) // Return max 5 peers
}

/**
 * Fetch data from Screener.in for a given ticker
 * @param {string} ticker - Stock ticker (e.g., TATAPOWER.NS)
 * @returns {Promise<{screenerRatios: Object, screenerPeers: Array}|null>} Scraped data or null on failure
 * @example
 * const data = await fetchScreenerData('TATAPOWER.NS')
 * if (data) {
 *   console.log('P/E:', data.screenerRatios.stockPE)
 *   console.log('Peers:', data.screenerPeers)
 * }
 */
export async function fetchScreenerData(ticker) {
  const cleanSymbol = cleanTicker(ticker)
  if (!cleanSymbol) {
    console.warn('Screener scraper: No valid ticker provided')
    return null
  }

  const url = `${SCREENER_BASE_URL}/company/${cleanSymbol}/consolidated/`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

    const response = await fetch(url, {
      method: 'GET',
      headers: BROWSER_HEADERS,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`Screener: Company ${cleanSymbol} not found`)
      } else {
        console.warn(`Screener: HTTP ${response.status} for ${cleanSymbol}`)
      }
      return null
    }

    const html = await response.text()

    // Check for rate limiting or bot detection
    if (html.includes('cf-challenge') || html.includes('captcha') || html.includes('Access Denied')) {
      console.warn('Screener: Access blocked (bot detection)')
      return null
    }

    const $ = cheerio.load(html)

    // Verify we loaded a valid company page
    const title = $('title').text()
    if (!title.includes('Screener') || title.includes('404') || title.includes('Not Found')) {
      console.warn(`Screener: Invalid page for ${cleanSymbol}`)
      return null
    }

    const screenerRatios = extractTopRatios($)
			console.log(`[Screener Debug] Extracted ratios:`, screenerRatios)
    const screenerPeers = extractPeers($)

    // Return null if we couldn't extract any meaningful data
    if (!Object.values(screenerRatios).some(v => v !== null) && screenerPeers.length === 0) {
      console.warn(`Screener: No data extracted for ${cleanSymbol}`)
      return null
    }

    return {
      screenerRatios,
      screenerPeers,
      _source: 'screener.in',
      _ticker: cleanSymbol,
    }
  } catch (error) {
    // Graceful failure - don't crash the app
    if (error.name === 'AbortError') {
      console.warn(`Screener: Request timeout for ${cleanSymbol}`)
    } else {
      console.warn('Screener fetch failed:', error.message)
    }
    return null
  }
}

/**
 * Check if Screener.in data is available for a ticker
 * @param {string} ticker - Stock ticker
 * @returns {boolean} True if ticker is eligible for Screener.in lookup
 */
export function isScreenerEligible(ticker) {
  if (!ticker) return false
  const upper = ticker.toUpperCase()
  // Also auto-detect Indian stocks by common patterns
  const indianIndicators = ['TATA', 'RELIANCE', 'INFY', 'HDFC', 'ICICI', 'SBIN', 'ADANI', 'POWER', 'NTPC', 'ONGC', 'BPCL', 'HPCL', 'WIPRO', 'TCS', 'BHARTI', 'MARUTI', 'HUL', 'ITC']
  const hasIndianIndicator = indianIndicators.some(ind => upper.includes(ind))
  return upper.endsWith('.NS') || upper.endsWith('.BO') || hasIndianIndicator
}

/**
 * Merge Screener.in data with Yahoo Finance data
 * Prioritizes Screener peers over Yahoo peers for Indian equities
 * @param {Object} yahooData - Yahoo Finance data object
 * @param {Object|null} screenerData - Screener.in data object
 * @returns {Object} Merged data object
 */
export function mergeScreenerData(yahooData, screenerData) {
  if (!screenerData) return yahooData

  const merged = { ...yahooData }

  // Add Screener-specific fields with prefix to avoid collisions
  if (screenerData.screenerRatios) {
    merged.screenerRatios = screenerData.screenerRatios

    // Use Screener ratios to fill gaps in Yahoo data
    const sr = screenerData.screenerRatios || {}

    // Only override if Yahoo data is missing (null/undefined)
    if (merged.pe === null || merged.pe === undefined) {
      merged.pe = sr.stockPE
    }
    if ((merged.roe === null || merged.roe === undefined || merged.roe === 0) && sr.roe) {
      merged.roe = sr.roe ? sr.roe / 100 : null // Convert percentage to decimal
    }
    if (merged.debtToEquity === null || merged.debtToEquity === undefined) {
      merged.debtToEquity = sr.debtToEquity
    }
    if (merged.priceToBook === null || merged.priceToBook === undefined) {
      merged.priceToBook = sr.priceToBook
    }
    // Fill EV/EBITDA from Screener if Yahoo didn't have it
    if ((merged.evToEbitda === null || merged.evToEbitda === undefined) && sr.evToEbitda) {
      merged.evToEbitda = sr.evToEbitda
    }
  }

  // Add Screener peers if available
  if (screenerData.screenerPeers?.length > 0) {
    merged.screenerPeers = screenerData.screenerPeers
  }

  merged._dataSources = [...(yahooData._dataSources || []), 'screener']
	console.log(`[Screener Merge] Final ROE: ${merged.roe}`)

  return merged
}

export default {
  fetchScreenerData,
  isScreenerEligible,
  mergeScreenerData,
}
