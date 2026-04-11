/**
 * Validation Utilities
 * Shared validation logic for API routes
 */

/**
 * Validate ticker symbol
 * @param {string} ticker
 * @returns {{ valid: boolean, ticker?: string, error?: string }}
 */
export function validateTicker(ticker) {
  if (!ticker || typeof ticker !== 'string') {
    return { valid: false, error: 'Ticker symbol is required' }
  }

  const trimmed = ticker.trim()

  if (trimmed.length === 0) {
    return { valid: false, error: 'Ticker symbol cannot be empty' }
  }

  if (trimmed.length > 20) {
    return { valid: false, error: 'Ticker symbol too long (max 20 characters)' }
  }

  // Allow letters, numbers, dots (for exchange suffixes like .NS), and dashes
  if (!/^[A-Z0-9.-]+$/i.test(trimmed)) {
    return { valid: false, error: 'Ticker contains invalid characters' }
  }

  return { valid: true, ticker: trimmed.toUpperCase() }
}

/**
 * Validate analysis type
 * @param {string} analysisType
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateAnalysisType(analysisType) {
  const VALID_TYPES = ['thesis', 'dcf', 'risk', 'news']

  if (!analysisType || typeof analysisType !== 'string') {
    return { valid: false, error: 'analysisType is required' }
  }

  if (!VALID_TYPES.includes(analysisType)) {
    return { valid: false, error: `analysisType must be one of: ${VALID_TYPES.join(', ')}` }
  }

  return { valid: true }
}

/**
 * Validate analyze request body
 * @param {Object} body
 * @returns {{ valid: boolean, data?: Object, error?: string }}
 */
export function validateAnalyzeRequest(body) {
  const errors = []

  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' }
  }

  const { ticker, analysisType, stockData } = body

  const tickerValidation = validateTicker(ticker)
  if (!tickerValidation.valid) {
    errors.push(tickerValidation.error)
  }

  const typeValidation = validateAnalysisType(analysisType)
  if (!typeValidation.valid) {
    errors.push(typeValidation.error)
  }

  if (!stockData || typeof stockData !== 'object') {
    errors.push('stockData is required')
  } else if (typeof stockData.price !== 'number' || isNaN(stockData.price)) {
    errors.push('stockData.price must be a valid number')
  }

  if (errors.length > 0) {
    return { valid: false, error: errors.join('; ') }
  }

  return {
    valid: true,
    data: {
      ticker: ticker.toUpperCase().trim(),
      analysisType,
      stockData,
    },
  }
}

/**
 * Validate compare request body
 * @param {Object} body
 * @returns {{ valid: boolean, data?: Object, error?: string }}
 */
export function validateCompareRequest(body) {
  const errors = []

  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' }
  }

  const { stock1, stock2 } = body

  if (!stock1 || typeof stock1 !== 'object') {
    errors.push('stock1 is required')
  } else {
    const s1Validation = validateTicker(stock1.ticker)
    if (!s1Validation.valid) {
      errors.push(`stock1.${s1Validation.error}`)
    }
    if (typeof stock1.price !== 'number' || isNaN(stock1.price)) {
      errors.push('stock1.price must be a valid number')
    }
  }

  if (!stock2 || typeof stock2 !== 'object') {
    errors.push('stock2 is required')
  } else {
    const s2Validation = validateTicker(stock2.ticker)
    if (!s2Validation.valid) {
      errors.push(`stock2.${s2Validation.error}`)
    }
    if (typeof stock2.price !== 'number' || isNaN(stock2.price)) {
      errors.push('stock2.price must be a valid number')
    }
  }

  if (stock1?.ticker?.toUpperCase() === stock2?.ticker?.toUpperCase()) {
    errors.push('Cannot compare a stock with itself')
  }

  if (errors.length > 0) {
    return { valid: false, error: errors.join('; ') }
  }

  return {
    valid: true,
    data: {
      stock1: { ...stock1, ticker: stock1.ticker.toUpperCase().trim() },
      stock2: { ...stock2, ticker: stock2.ticker.toUpperCase().trim() },
    },
  }
}
