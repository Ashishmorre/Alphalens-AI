/**
 * NSE XBRL Parser — Ind-AS Financial Data Extraction
 * Handles NSE India XBRL data fetching and parsing with session management
 *
 * @module nse-xbrl-parser
 */

// ─── Configuration ─────────────────────────────────────────────────────────
const NSE_BASE_URL = 'https://www.nseindia.com'
const MAX_RETRIES = 3
const BASE_DELAY = 1000 // 1 second

// Browser-like headers to avoid 403 errors
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

// ─── Session Management ─────────────────────────────────────────────────────

/**
 * Session cookie storage for NSE requests
 * @type {Map<string, string>}
 */
const sessionCookies = new Map()

/**
 * Extract nsit session cookie from response headers
 * @param {Headers} headers - Response headers
 * @returns {string | null} - Session cookie value or null
 */
function extractSessionCookie(headers) {
  const setCookie = headers.get('set-cookie')
  if (!setCookie) return null

  // Extract nsit cookie from Set-Cookie header
  const nsitMatch = setCookie.match(/nsit=([^;]+)/)
  return nsitMatch ? nsitMatch[1] : null
}

/**
 * Get or create session cookie for NSE requests
 * @returns {Promise<string>} - Session cookie value
 */
async function getSessionCookie() {
  // Check if we have a valid session cookie
  const existingCookie = sessionCookies.get('nsit')
  if (existingCookie) {
    return existingCookie
  }

  try {
    // Visit NSE homepage to get session cookie
    const response = await fetch(NSE_BASE_URL, {
      method: 'GET',
      headers: BROWSER_HEADERS,
      redirect: 'follow',
    })

    if (!response.ok) {
      console.warn(`Failed to get session cookie: ${response.status}`)
      return ''
    }

    const cookie = extractSessionCookie(response.headers)
    if (cookie) {
      sessionCookies.set('nsit', cookie)
      return cookie
    }

    return ''
  } catch (error) {
    console.warn('Error getting session cookie:', error.message)
    return ''
  }
}

/**
 * Clear session cookies (useful for testing or forced refresh)
 */
export function clearSessionCookies() {
  sessionCookies.clear()
}

// ─── Retry Logic ───────────────────────────────────────────────────────────

/**
 * Sleep for specified duration
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Exponential backoff delay
 * @param {number} attempt - Current attempt number (0-indexed)
 * @returns {number} - Delay in milliseconds
 */
function getBackoffDelay(attempt) {
  return BASE_DELAY * Math.pow(2, attempt)
}

/**
 * Check if error is retryable
 * @param {Error} error - Error to check
 * @returns {boolean} - True if error is retryable
 */
function isRetryableError(error) {
  if (!error?.message) return false

  const retryablePatterns = [
    '403',
    '503',
    '502',
    'timeout',
    'network',
    'rate limit',
    'ECONNRESET',
    'ETIMEDOUT',
  ]

  const lowerMessage = error.message.toLowerCase()
  return retryablePatterns.some(pattern => lowerMessage.includes(pattern))
}

// ─── NSE Data Fetching ─────────────────────────────────────────────────────

/**
 * Fetch data from NSE with session management and retry logic
 *
 * @param {string} url - NSE API endpoint URL
 * @param {{ maxRetries?: number, timeout?: number }} options - Configuration options
 * @returns {Promise<string>} - Response text
 * @throws {Error} - If all retry attempts fail
 *
 * @example
 * const xmlData = await fetchNSEData('https://www.nseindia.com/api/data')
 */
export async function fetchNSEData(url, options = {}) {
  const { maxRetries = MAX_RETRIES, timeout = 30000 } = options

  let lastError = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Get session cookie
      const sessionCookie = await getSessionCookie()

      // Prepare headers with session cookie
      const headers = {
        ...BROWSER_HEADERS,
        'Cookie': sessionCookie ? `nsit=${sessionCookie}` : '',
      }

      // Create abort controller for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      // Make request
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
        redirect: 'follow',
      })

      clearTimeout(timeoutId)

      // Handle 403/503 errors with retry
      if (response.status === 403 || response.status === 503) {
        const error = new Error(`NSE returned ${response.status} status`)
        if (attempt < maxRetries - 1) {
          console.warn(`Attempt ${attempt + 1}/${maxRetries} failed with ${response.status}, retrying...`)
          await sleep(getBackoffDelay(attempt))
          // Clear session cookie and try again
          clearSessionCookies()
          continue
        }
        throw error
      }

      if (!response.ok) {
        throw new Error(`NSE request failed with status ${response.status}`)
      }

      // Return response text
      return await response.text()
    } catch (error) {
      lastError = error

      // Don't retry non-retryable errors
      if (!isRetryableError(error)) {
        throw error
      }

      // If this was the last attempt, throw the error
      if (attempt === maxRetries - 1) {
        throw error
      }

      // Wait before retrying
      console.warn(`Attempt ${attempt + 1}/${maxRetries} failed: ${error.message}, retrying...`)
      await sleep(getBackoffDelay(attempt))
    }
  }

  // This should never be reached, but just in case
  throw lastError || new Error('NSE data fetch failed')
}

// ─── XBRL Parsing ─────────────────────────────────────────────────────────

/**
 * Parse Ind-AS XBRL XML string and extract financial metrics
 *
 * @param {string} xmlString - XBRL XML string from NSE
 * @returns {{
 *   totalEquity?: number,
 *   totalDebt?: number,
 *   netIncome?: number,
 *   revenueFromOperations?: number,
 *   currentAssets?: number,
 *   currentLiabilities?: number,
 *   error?: string
 * }} - Extracted financial metrics
 *
 * @example
 * const metrics = parseIndASXBRL(xmlData)
 * console.log(metrics.totalEquity)
 */
export function parseIndASXBRL(xmlString) {
  // Default result structure
  const result = {
    totalEquity: undefined,
    totalDebt: undefined,
    netIncome: undefined,
    revenueFromOperations: undefined,
    currentAssets: undefined,
    currentLiabilities: undefined,
  }

  try {
    // Basic XML parsing without xml2js dependency
    // This is a simplified parser for Ind-AS XBRL structure
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml')

    // Check for parsing errors
    const parseError = xmlDoc.querySelector('parsererror')
    if (parseError) {
      throw new Error('Invalid XML format')
    }

    // Helper function to extract value by tag name
    const extractValue = (tagName) => {
      const element = xmlDoc.querySelector(tagName)
      if (!element) return undefined

      const value = element.textContent || element.getAttribute('value')
      if (!value) return undefined

      // Parse numeric value
      const numValue = parseFloat(value.replace(/,/g, ''))
      return isNaN(numValue) ? undefined : numValue
    }

    // Extract EquityAndLiabilities metrics
    // Common Ind-AS tag patterns for equity
    const equityTags = [
      'EquityAndLiabilitiesEquity',
      'Equity',
      'TotalEquity',
      'ShareholdersEquity',
      'ifrs-full:Equity',
    ]

    for (const tag of equityTags) {
      const value = extractValue(tag)
      if (value !== undefined) {
        result.totalEquity = value
        break
      }
    }

    // Extract Debt metrics
    // Common Ind-AS tag patterns for debt
    const debtTags = [
      'EquityAndLiabilitiesLiabilities',
      'TotalLiabilities',
      'TotalDebt',
      'Borrowings',
      'ifrs-full:Liabilities',
    ]

    for (const tag of debtTags) {
      const value = extractValue(tag)
      if (value !== undefined) {
        result.totalDebt = value
        break
      }
    }

    // Extract Net Income metrics
    // Common Ind-AS tag patterns for profit/loss
    const incomeTags = [
      'ProfitBeforeTax',
      'ProfitLossForPeriod',
      'NetProfit',
      'NetIncome',
      'ProfitForThePeriod',
      'ifrs-full:ProfitLoss',
    ]

    for (const tag of incomeTags) {
      const value = extractValue(tag)
      if (value !== undefined) {
        result.netIncome = value
        break
      }
    }

    // Extract Revenue metrics
    // Common Ind-AS tag patterns for revenue
    const revenueTags = [
      'RevenueFromOperations',
      'TotalRevenue',
      'Revenue',
      'IncomeFromOperations',
      'ifrs-full:Revenue',
    ]

    for (const tag of revenueTags) {
      const value = extractValue(tag)
      if (value !== undefined) {
        result.revenueFromOperations = value
        break
      }
    }

    // Extract Current Assets metrics
    // Common Ind-AS tag patterns for current assets
    const currentAssetsTags = [
      'CurrentAssets',
      'CurrentAssetsTotal',
      'ifrs-full:CurrentAssets',
      'AssetsCurrent',
    ]

    for (const tag of currentAssetsTags) {
      const value = extractValue(tag)
      if (value !== undefined) {
        result.currentAssets = value
        break
      }
    }

    // Extract Current Liabilities metrics
    // Common Ind-AS tag patterns for current liabilities
    const currentLiabilitiesTags = [
      'CurrentLiabilities',
      'CurrentLiabilitiesTotal',
      'ifrs-full:CurrentLiabilities',
      'LiabilitiesCurrent',
    ]

    for (const tag of currentLiabilitiesTags) {
      const value = extractValue(tag)
      if (value !== undefined) {
        result.currentLiabilities = value
        break
      }
    }

    return result
  } catch (error) {
    console.error('Error parsing XBRL:', error.message)
    return {
      ...result,
      error: error.message,
    }
  }
}

// ─── Failure Handler ───────────────────────────────────────────────────────

/**
 * Gracefully handle NSE fetch failures and return empty results
 *
 * @param {Error} error - Error that occurred
 * @param {string} url - URL that failed
 * @returns {{
 *   success: false,
 *   data: {
 *     totalEquity?: number,
 *     totalDebt?: number,
 *     netIncome?: number,
 *     revenueFromOperations?: number,
 *     currentAssets?: number,
 *     currentLiabilities?: number
 *   },
 *   error: string
 * }} - Empty result structure with error info
 *
 * @example
 * try {
 *   const xmlData = await fetchNSEData(url)
 *   return parseIndASXBRL(xmlData)
 * } catch (error) {
 *   return handleNSEFailure(error, url)
 * }
 */
export function handleNSEFailure(error, url) {
  console.error(`NSE fetch failed for ${url}:`, error.message)

  // Return empty result structure
  return {
    success: false,
    data: {
      totalEquity: undefined,
      totalDebt: undefined,
      netIncome: undefined,
      revenueFromOperations: undefined,
      currentAssets: undefined,
      currentLiabilities: undefined,
    },
    error: error.message || 'Failed to fetch NSE data',
  }
}

// ─── Main Export Function ───────────────────────────────────────────────────

/**
 * Complete workflow: Fetch NSE XBRL data and parse financial metrics
 *
 * @param {string} url - NSE XBRL data URL
 * @param {{ maxRetries?: number, timeout?: number }} options - Configuration options
 * @returns {Promise<{
 *   success: boolean,
 *   data: {
 *     totalEquity?: number,
 *     totalDebt?: number,
 *     netIncome?: number,
 *     revenueFromOperations?: number,
 *     currentAssets?: number,
 *     currentLiabilities?: number
 *   },
 *   error?: string
 * }>} - Parsed financial metrics or error
 *
 * @example
 * const result = await fetchAndParseNSEData('https://www.nseindia.com/api/xbrl/RELIANCE')
 * if (result.success) {
 *   console.log('Total Equity:', result.data.totalEquity)
 * }
 */
export async function fetchAndParseNSEData(url, options = {}) {
  try {
    const xmlData = await fetchNSEData(url, options)
    const parsedData = parseIndASXBRL(xmlData)

    // Check if parsing had errors
    if (parsedData.error) {
      return {
        success: false,
        data: {
          totalEquity: parsedData.totalEquity,
          totalDebt: parsedData.totalDebt,
          netIncome: parsedData.netIncome,
          revenueFromOperations: parsedData.revenueFromOperations,
          currentAssets: parsedData.currentAssets,
          currentLiabilities: parsedData.currentLiabilities,
        },
        error: parsedData.error,
      }
    }

    return {
      success: true,
      data: parsedData,
    }
  } catch (error) {
    return handleNSEFailure(error, url)
  }
}

// ─── Utility Functions ─────────────────────────────────────────────────────

/**
 * Check if NSE service is available
 * @returns {Promise<boolean>} - True if NSE is accessible
 */
export async function checkNSEAvailability() {
  try {
    const response = await fetch(NSE_BASE_URL, {
      method: 'HEAD',
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(5000),
    })
    return response.ok
  } catch (error) {
    return false
  }
}

/**
 * Get session cookie status for debugging
 * @returns {{ hasCookie: boolean, cookieLength: number }}
 */
export function getSessionStatus() {
  const cookie = sessionCookies.get('nsit')
  return {
    hasCookie: !!cookie,
    cookieLength: cookie?.length || 0,
  }
}
