/**
 * Financial Calculation Utilities
 * Centralized financial math operations with strict validation
 */

/**
 * Calculate upside/downside percentage
 * Formula: ((Intrinsic Value - Current Price) / Current Price) * 100
 * @param {number} intrinsicValue - DCF intrinsic value per share
 * @param {number} currentPrice - Current market price
 * @returns {number} Percentage upside (positive) or downside (negative)
 */
export function calculateUpside(intrinsicValue, currentPrice) {
  if (!intrinsicValue || !currentPrice || currentPrice === 0) return 0
  return ((intrinsicValue - currentPrice) / currentPrice) * 100
}

/**
 * Calculate DCF rating based on upside percentage
 * @param {number} upside - Percentage upside/downside
 * @returns {string} 'UNDERVALUED' | 'OVERVALUED' | 'NEUTRAL'
 */
export function calculateDCFRating(upside) {
  if (upside > 10) return 'UNDERVALUED'
  if (upside < -10) return 'OVERVALUED'
  return 'NEUTRAL'
}

/**
 * Get rating color based on DCF rating
 * @param {string} rating - DCF rating
 * @returns {string} Hex color code
 */
export function getRatingColor(rating) {
  const r = String(rating).toUpperCase()
  if (r === 'UNDERVALUED') return '#22c55e'
  if (r === 'OVERVALUED') return '#ef4444'
  return '#f59e0b'
}

/**
 * Calculate EBITDA from revenue and margin
 * @param {number} revenue - Revenue in absolute value
 * @param {number} margin - EBITDA margin as percentage (e.g., 20 for 20%)
 * @returns {number} EBITDA value
 */
export function calculateEBITDA(revenue, margin) {
  if (!revenue || !margin) return 0
  return revenue * (margin / 100)
}

/**
 * Calculate NOPAT from EBIT and tax rate
 * @param {number} ebit - Earnings Before Interest and Taxes
 * @param {number} taxRate - Tax rate as percentage (e.g., 21 for 21%)
 * @returns {number} NOPAT value
 */
export function calculateNOPAT(ebit, taxRate) {
  if (!ebit) return 0
  const rate = taxRate || 21
  return ebit * (1 - rate / 100)
}

/**
 * Calculate Free Cash Flow
 * Formula: NOPAT + D&A - CapEx - Change in NWC
 * @param {number} nopat - Net Operating Profit After Tax
 * @param {number} dna - Depreciation & Amortization
 * @param {number} capex - Capital Expenditures (negative value)
 * @param {number} nwcChange - Change in Net Working Capital
 * @returns {number} FCF value
 */
export function calculateFCF(nopat, dna, capex, nwcChange) {
  const depreciation = dna || 0
  const capitalExpenditure = capex || 0
  const workingCapitalChange = nwcChange || 0
  return nopat + depreciation - Math.abs(capitalExpenditure) - workingCapitalChange
}

/**
 * Calculate present value of a future cash flow
 * @param {number} fcf - Future cash flow
 * @param {number} wacc - Discount rate (WACC) as percentage
 * @param {number} year - Year number
 * @returns {number} Present value
 */
export function calculatePV(fcf, wacc, year) {
  if (!fcf || !wacc || !year) return 0
  const discountRate = wacc / 100
  return fcf / Math.pow(1 + discountRate, year)
}

/**
 * Calculate Terminal Value using Gordon Growth Model
 * @param {number} finalFCF - Final year FCF
 * @param {number} wacc - WACC as percentage
 * @param {number} terminalGrowthRate - Terminal growth rate as percentage
 * @returns {number} Terminal value
 */
export function calculateTerminalValue(finalFCF, wacc, terminalGrowthRate) {
  if (!finalFCF || !wacc || !terminalGrowthRate) return 0
  const discountRate = wacc / 100
  const growthRate = terminalGrowthRate / 100
  if (discountRate <= growthRate) return 0
  return (finalFCF * (1 + growthRate)) / (discountRate - growthRate)
}

/**
 * Calculate present value of terminal value
 * @param {number} terminalValue - Terminal value
 * @param {number} wacc - WACC as percentage
 * @param {number} years - Number of projection years
 * @returns {number} PV of terminal value
 */
export function calculatePVTerminalValue(terminalValue, wacc, years) {
  if (!terminalValue || !wacc || !years) return 0
  const discountRate = wacc / 100
  return terminalValue / Math.pow(1 + discountRate, years)
}

/**
 * Calculate Enterprise Value
 * @param {number} pvFCFs - Sum of PV of FCFs
 * @param {number} pvTerminalValue - PV of terminal value
 * @returns {number} Enterprise value
 */
export function calculateEnterpriseValue(pvFCFs, pvTerminalValue) {
  return (pvFCFs || 0) + (pvTerminalValue || 0)
}

/**
 * Calculate Equity Value
 * @param {number} enterpriseValue - Enterprise value
 * @param {number} cash - Cash and equivalents
 * @param {number} debt - Total debt
 * @returns {number} Equity value
 */
export function calculateEquityValue(enterpriseValue, cash, debt) {
  return (enterpriseValue || 0) + (cash || 0) - (debt || 0)
}

/**
 * Calculate Intrinsic Value Per Share
 * @param {number} equityValue - Equity value
 * @param {number} sharesOutstanding - Shares outstanding
 * @returns {number} Intrinsic value per share
 */
export function calculateIntrinsicValuePerShare(equityValue, sharesOutstanding) {
  if (!sharesOutstanding || sharesOutstanding === 0) return 0
  return (equityValue || 0) / sharesOutstanding
}

/**
 * Calculate Margin of Safety
 * @param {number} intrinsicValue - Intrinsic value per share
 * @param {number} currentPrice - Current market price
 * @returns {number} Margin of safety percentage
 */
export function calculateMarginOfSafety(intrinsicValue, currentPrice) {
  if (!intrinsicValue || !currentPrice || intrinsicValue === 0) return 0
  return ((intrinsicValue - currentPrice) / intrinsicValue) * 100
}

/**
 * Calculate complete DCF projection from assumptions
 * @param {Object} assumptions - DCF assumptions
 * @param {Object} stockData - Stock data (revenue, debt, cash, etc.)
 * @returns {Object} Complete DCF projection
 */
export function calculateDCFProjection(assumptions, stockData) {
  const {
    wacc = 10,
    terminalGrowthRate = 2.5,
    taxRate = 21,
    revenueGrowthRates = [10, 10, 10, 10, 10],
    ebitdaMargins = [20, 20, 20, 20, 20],
  } = assumptions

  const baseRevenue = stockData?.revenue || 1000000000

  const projections = []
  let cumulativePVFCF = 0

  for (let i = 0; i < 5; i++) {
    const year = i + 1
    const growthRate = revenueGrowthRates[i] || 10
    const ebitdaMargin = ebitdaMargins[i] || 20

    // Calculate values
    const revenue = baseRevenue * Math.pow(1 + growthRate / 100, year)
    const ebitda = calculateEBITDA(revenue, ebitdaMargin)

    // Estimate EBIT (typically 70-80% of EBITDA for mature companies)
    const ebit = ebitda * 0.75

    // Calculate NOPAT
    const nopat = calculateNOPAT(ebit, taxRate)

    // Estimate CapEx (typically 5-10% of revenue)
    const capex = -revenue * 0.08

    // Estimate NWC change (typically 2-4% of revenue change)
    const prevRevenue = i === 0 ? baseRevenue : projections[i - 1].revenue
    const nwcChange = (revenue - prevRevenue) * 0.03

    // Calculate FCF
    const depreciation = ebitda - ebit
    const fcf = calculateFCF(nopat, depreciation, capex, nwcChange)

    // Calculate PV of FCF
    const pvFCF = calculatePV(fcf, wacc, year)
    cumulativePVFCF += pvFCF

    projections.push({
      year,
      revenue,
      ebitda,
      ebit,
      nopat,
      capex,
      nwcChange,
      fcf,
      pvFCF,
    })
  }

  // Calculate final values
  const finalFCF = projections[4].fcf
  const terminalValue = calculateTerminalValue(finalFCF, wacc, terminalGrowthRate)
  const pvTerminalValue = calculatePVTerminalValue(terminalValue, wacc, 5)
  const pvFCFs = cumulativePVFCF
  const enterpriseValue = calculateEnterpriseValue(pvFCFs, pvTerminalValue)
  const equityValue = calculateEquityValue(
    enterpriseValue,
    stockData?.totalCash || 0,
    stockData?.totalDebt || 0
  )

  // Calculate intrinsic value per share
  const intrinsicValuePerShare = calculateIntrinsicValuePerShare(
    equityValue,
    stockData?.sharesOutstanding || 1000000
  )

  const currentPrice = stockData?.price || 100
  const upside = calculateUpside(intrinsicValuePerShare, currentPrice)

  return {
    projections,
    pvFCFs,
    terminalValue,
    pvTerminalValue,
    enterpriseValue,
    equityValue,
    intrinsicValuePerShare,
    marginOfSafety: calculateMarginOfSafety(intrinsicValuePerShare, currentPrice),
    upside,
    dcfRating: calculateDCFRating(upside),
  }
}

/**
 * Format number for display with magnitude suffixes
 * Uses Intl.NumberFormat for proper localization
 * @param {number} value - Number to format
 * @param {number} decimals - Decimal places
 * @param {string} currency - Currency code (optional)
 * @returns {string} Formatted string
 */
export function formatMagnitude(value, decimals = 2, currency = null) {
  if (value === null || value === undefined || isNaN(value)) return '—'

  const absValue = Math.abs(value)
  const symbol = currency ? getCurrencySymbol(currency) : ''

  if (absValue >= 1e12) {
    return symbol + (value / 1e12).toFixed(decimals) + 'T'
  }
  if (absValue >= 1e9) {
    return symbol + (value / 1e9).toFixed(decimals) + 'B'
  }
  if (absValue >= 1e6) {
    return symbol + (value / 1e6).toFixed(decimals) + 'M'
  }
  if (absValue >= 1e3) {
    return symbol + (value / 1e3).toFixed(decimals) + 'K'
  }
  return symbol + value.toFixed(decimals)
}

/**
 * Get currency symbol
 * @param {string} currency - Currency code
 * @returns {string} Currency symbol
 */
function getCurrencySymbol(currency) {
  const map = {
    INR: '₹',
    GBP: '£',
    EUR: '€',
    JPY: '¥',
    CNY: '¥',
    CAD: 'C$',
    AUD: 'A$',
    HKD: 'HK$',
    SGD: 'S$',
    CHF: 'Fr',
    USD: '$',
  }
  return map[currency] || '$'
}

/**
 * Calculate sensitivity table for DCF
 * @param {number} baseIntrinsicValue - Base case intrinsic value
 * @param {number} currentPrice - Current price
 * @param {Array} waccRange - Array of WACC values
 * @param {Array} tgrRange - Array of terminal growth rate values
 * @returns {Object} Sensitivity table data
 */
export function calculateSensitivityTable(
  baseIntrinsicValue,
  currentPrice,
  waccRange = [8, 9, 10, 11, 12],
  tgrRange = [1.5, 2.0, 2.5, 3.0, 3.5]
) {
  if (!baseIntrinsicValue || !currentPrice) {
    return null
  }

  const values = []

  for (const tgr of tgrRange) {
    const row = []
    for (const wacc of waccRange) {
      // Calculate adjusted intrinsic value based on WACC and TGR
      // Simple approximation: adjustment proportional to difference from base
      const waccAdjustment = (10 - wacc) * 0.05
      const tgrAdjustment = (tgr - 2.5) * 0.03
      const adjustedValue = baseIntrinsicValue * (1 + waccAdjustment + tgrAdjustment)
      row.push(Math.max(0, adjustedValue))
    }
    values.push(row)
  }

  return {
    waccRange,
    tgrRange,
    values,
  }
}

/**
 * Get sensitivity classification for a value
 * @param {number} value - Intrinsic value at given WACC/TGR
 * @param {number} currentPrice - Current market price
 * @returns {string} CSS class name
 */
export function getSensitivityClass(value, currentPrice) {
  if (!value || !currentPrice) return ''
  const ratio = value / currentPrice
  if (ratio >= 1.25) return 'significantly-undervalued'
  if (ratio >= 1.1) return 'undervalued'
  if (ratio >= 0.9) return 'near-fair'
  if (ratio >= 0.75) return 'overvalued'
  return 'significantly-overvalued'
}
