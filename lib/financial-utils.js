/**
 * Financial Calculation Utilities
 * Centralized financial math operations with strict validation
 */

/**
 * Terminal Year Convergence Logic
 * Balances CapEx and Depreciation in the Terminal Year to prevent Valuation Decay
 * This is standard institutional practice: in steady state, CapEx ≈ Depreciation.
 * @param {number} depreciation - Depreciation expense for terminal year
 * @param {number} baseCapEx - Base CapEx calculation before adjustment
 * @param {number} convergenceFactor - How much to adjust toward parity (0-1, default 0.9)
 * @returns {number} Adjusted CapEx that converges toward Depreciation
 */
export function calculateTerminalCapEx(depreciation, baseCapEx, convergenceFactor = 0.9) {
  if (!depreciation || !baseCapEx) return baseCapEx || 0
  // In terminal year, CapEx should approximate Depreciation (maintenance mode)
  // convergenceFactor determines how close to parity (0 = no change, 1 = full parity)
  const targetCapEx = depreciation
  const convergedCapEx = baseCapEx * (1 - convergenceFactor) + targetCapEx * convergenceFactor
  return Math.abs(convergedCapEx) // Return positive value
}

/**
 * Calculates the true percentage spread between current price and intrinsic value.
 * FIXES THE INVERTED UPSIDE BUG.
 * Formula: ((Target - Current) / Current) * 100
 * @param {number} intrinsicValue - Target/intrinsic value
 * @param {number} currentPrice - Current market price
 * @returns {number} Percentage spread, fixed to 2 decimals
 */
export function calculateValuationSpread(currentPrice, intrinsicValue) {
  if (!currentPrice || currentPrice <= 0 || !intrinsicValue) return 0
  const spread = ((intrinsicValue - currentPrice) / currentPrice) * 100
  // Guard against infinity/NaN
  if (!isFinite(spread)) return 0
  return Number(spread.toFixed(2))
}

/**
 * Legacy upside calculation - delegates to calculateValuationSpread
 * @param {number} intrinsicValue - DCF intrinsic value per share
 * @param {number} currentPrice - Current market price
 * @returns {number} Percentage upside (positive) or downside (negative)
 */
export function calculateUpside(intrinsicValue, currentPrice) {
  return calculateValuationSpread(currentPrice, intrinsicValue)
}

/**
 * Determines the strictly derived valuation verdict based on the spread.
 * @param {number} currentPrice - Current market price
 * @param {number} intrinsicValue - Target/intrinsic value
 * @returns {Object} Verdict object with label, color, and isPositive flag
 */
export function getValuationVerdict(currentPrice, intrinsicValue) {
  const spread = calculateValuationSpread(currentPrice, intrinsicValue)
  if (spread > 5) return { label: 'UNDERVALUED', color: 'text-green-500', isPositive: true }
  if (spread < -5) return { label: 'OVERVALUED', color: 'text-red-500', isPositive: false }
  return { label: 'FAIR VALUE', color: 'text-yellow-500', isPositive: null }
}

/**
 * Dynamic Assumption Engine
 * Calculates WACC based on stock risk profile
 * @param {Object} params - Stock parameters
 * @param {number} params.beta - Stock beta (default: 1.0)
 * @param {number} params.pe - P/E ratio
 * @param {string} params.sector - Stock sector
 * @param {number} baseRate - Risk-free rate (default: 4.5%)
 * @returns {number} WACC percentage (e.g., 8.5 for 8.5%)
 */
export function calculateDynamicWACC({ beta = 1.0, pe, sector, baseRate = 4.5 }) {
  // Base market risk premium (typically 5-6%)
  const marketRiskPremium = 5.5

  // Adjust beta for sector risk
  let sectorBeta = beta
  if (sector?.toLowerCase().includes('utility')) sectorBeta = Math.max(beta, 0.8)
  if (sector?.toLowerCase().includes('tech')) sectorBeta = Math.max(beta, 1.1)
  if (sector?.toLowerCase().includes('finance')) sectorBeta = Math.max(beta, 1.2)

  // Calculate base WACC using CAPM-inspired logic
  let wacc = baseRate + (sectorBeta * marketRiskPremium)

  // Adjust for P/E (growth stocks get lower WACC due to stability premium)
  if (pe > 30) wacc -= 1.0 // High growth premium
  else if (pe > 20) wacc -= 0.5 // Moderate growth
  else if (pe < 10) wacc += 0.5 // Value trap premium

  // Floor and ceiling
  return Math.max(7.0, Math.min(12.0, wacc))
}

/**
 * Dynamic CapEx Calculator
 * Adjusts CapEx % based on growth stage and sector
 * @param {Object} params - Stock parameters
 * @param {number} params.revenueGrowth - Revenue growth rate
 * @param {string} params.sector - Stock sector
 * @param {number} params.capexIntensity - Historical CapEx/Revenue ratio
 * @returns {number} CapEx as % of revenue (negative for cash outflow)
 */
export function calculateDynamicCapEx({ revenueGrowth = 10, sector, capexIntensity }) {
  // Base CapEx for maintenance
  let capexPct = -0.05 // 5% of revenue for maintenance

  // Growth CapEx - higher growth = higher CapEx investment
  if (revenueGrowth > 20) capexPct -= 0.12 // Heavy growth: -17%
  else if (revenueGrowth > 15) capexPct -= 0.08 // Strong growth: -13%
  else if (revenueGrowth > 10) capexPct -= 0.05 // Moderate growth: -10%
  else if (revenueGrowth > 5) capexPct -= 0.03 // Slow growth: -8%
  else capexPct -= 0.01 // No growth: -6%

  // Sector adjustments
  if (sector?.toLowerCase().includes('utility')) capexPct -= 0.03 // +3% for infrastructure
  if (sector?.toLowerCase().includes('renewable')) capexPct -= 0.05 // +5% for new capacity
  if (sector?.toLowerCase().includes('infrastructure')) capexPct -= 0.04

  // Historical override if available
  if (capexIntensity && capexIntensity > 0) {
    // Blend historical with projected (60% historical, 40% growth-adjusted)
    const historicalCapex = -capexIntensity / 100 // Convert % to decimal
    capexPct = capexPct * 0.4 + historicalCapex * 0.6
  }

  return capexPct
}

/**
 * Growth J-Curve Calculator
 * Models FCF growth ramp where heavy early CapEx pays off in Years 3-5
 * Also returns revenue growth and EBITDA margin multipliers for operating leverage
 * @param {number} baseFCF - Base FCF (Year 0)
 * @param {number} growthRate - Terminal growth rate
 * @param {number} efficiencyMultiplier - How much early CapEx boosts later FCF (default: 1.5)
 * @returns {Object} Object with fcfMultipliers, revenueGrowthMultipliers, and ebitdaMarginMultipliers
 */
export function calculateGrowthJCurve({ baseFCF, growthRate = 5.5, efficiencyMultiplier = 1.5 }) {
  // J-Curve: Low growth in Years 1-2 (CapEx heavy), high growth in Years 3-5
  const year1Multiplier = 1.0 + (growthRate * 0.5 / 100)  // Conservative start
  const year2Multiplier = 1.0 + (growthRate * 0.7 / 100)  // Still building
  const year3Multiplier = 1.0 + (growthRate * efficiencyMultiplier / 100) // Payoff begins
  const year4Multiplier = year3Multiplier * (1.0 + (growthRate * 1.2 / 100))
  const year5Multiplier = year4Multiplier * (1.0 + (growthRate * 1.3 / 100))

  // Revenue growth multipliers: scale the growth rate (not cumulative)
  // Year 1: growthRate * 0.5, Year 2: growthRate * 0.7, etc.
  const revenueGrowthMultipliers = [0.5, 0.7, 1.0, 1.2, 1.3]

  // EBITDA margin improvement ramp: start conservative (85-90%), ramp to 100%
  // Starting at 85% of target margin, improving to 100% by Year 5
  const ebitdaMarginMultipliers = [0.85, 0.90, 0.95, 0.98, 1.0]

  return {
    fcfMultipliers: [year1Multiplier, year2Multiplier, year3Multiplier, year4Multiplier, year5Multiplier],
    revenueGrowthMultipliers,
    ebitdaMarginMultipliers
  }
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
 * @param {number} capex - Capital Expenditures (typically negative value from cash flow statement)
 * @param {number} nwcChange - Change in Net Working Capital
 * @returns {number} FCF value
 */
export function calculateFCF(nopat, dna, capex, nwcChange) {
  const nopatVal = nopat || 0
  const depreciation = dna || 0
  // CapEx from Yahoo is usually a negative number (cash outflow)
  // We normalize to positive spending amount for the formula
  const capitalExpenditure = capex || 0
  const capExSpend = capitalExpenditure < 0 ? Math.abs(capitalExpenditure) : capitalExpenditure
  const workingCapitalChange = nwcChange || 0
  // FCF = NOPAT + D&A - CapEx - ΔNWC
  return nopatVal + depreciation - capExSpend - workingCapitalChange
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
 * Calculate Equity Value (always returns positive value)
 * @param {number} enterpriseValue - Enterprise value
 * @param {number} cash - Cash and equivalents
 * @param {number} debt - Total debt
 * @param {number} marketCap - Market cap for distress fallback (optional)
 * @returns {number} Equity value (always positive)
 */
export function calculateEquityValue(enterpriseValue, cash, debt, marketCap) {
  const ev = enterpriseValue || 0
  const c = cash || 0
  const d = debt || 0
  const equityValue = ev + c - d
  // Guard against negative equity value (high leverage scenario)
  // Return at least 10% of EV or 5% of market cap as distress floor
  if (equityValue < 0) {
    const floor = marketCap ? marketCap * 0.05 : Math.abs(ev) * 0.1
    return Math.max(floor, 0.01)
  }
  return equityValue
}

/**
 * Calculate Intrinsic Value Per Share
 * @param {number} equityValue - Equity value
 * @param {number} sharesOutstanding - Shares outstanding
 * @returns {number} Intrinsic value per share (always positive, minimum 0.01)
 */
export function calculateIntrinsicValuePerShare(equityValue, sharesOutstanding) {
  if (!sharesOutstanding || sharesOutstanding === 0) return 0
  // Ensure equity value is positive - use MarketCap * 0.1 as distress floor if negative
  const safeEquityValue = (equityValue || 0) > 0 ? equityValue : Math.abs(equityValue * 0.1)
  const intrinsicValue = safeEquityValue / sharesOutstanding
  // Floor at 0.01 to ensure positive value (distressed equity scenario)
  return Math.max(intrinsicValue, 0.01)
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
/**
 * Normalize any financial value to absolute number (handles formatted strings or numbers)
 * @param {any} value - Financial value (may be number or formatted string like "2.5B")
 * @returns {number} Absolute value in base currency units
 */
export function normalizeToAbsolute(value) {
  if (value == null) return 0
  if (typeof value === 'number') return value
  // Handle string values like "2.5B", "2500M"
  const str = String(value).replace(/[$,\s]/g, '').toUpperCase()
  const match = str.match(/^([\d.]+)([KMBT]?)$/)
  if (!match) return Number(str) || 0
  const num = parseFloat(match[1])
  const unit = match[2]
  const multipliers = { '': 1, 'K': 1e3, 'M': 1e6, 'B': 1e9, 'T': 1e12 }
  return num * (multipliers[unit] || 1)
}

export function calculateDCFProjection(assumptions, stockData) {
  const {
    wacc = 10,
    terminalGrowthRate = 2.5,
    taxRate = 21,
    revenueGrowthRates = [10, 10, 10, 10, 10],
    ebitdaMargins = [20, 20, 20, 20, 20],
  } = assumptions

  // Normalize all financial inputs to absolute numbers
  const baseRevenue = normalizeToAbsolute(stockData?.revenue) || 1000000000
  const totalCash = normalizeToAbsolute(stockData?.totalCash)
  const totalDebt = normalizeToAbsolute(stockData?.totalDebt)

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

    // Terminal Year CapEx Convergence: In steady state, CapEx ≈ Depreciation
    // This prevents valuation decay - institutional best practice
    if (i === 4) {
      const terminalYearDepreciation = depreciation
      const baseTerminalCapEx = Math.abs(capex)
      const convergedCapEx = calculateTerminalCapEx(
        terminalYearDepreciation,
        baseTerminalCapEx,
        0.9 // convergence factor
      )
      // Update the projection with converged CapEx and recalculate FCF
      projections[4].capex = -convergedCapEx
      projections[4].fcf = calculateFCF(nopat, depreciation, -convergedCapEx, nwcChange)
      projections[4].pvFCF = calculatePV(projections[4].fcf, wacc, year)
      // Update cumulative PVFCF
      cumulativePVFCF = cumulativePVFCF - pvFCF + projections[4].pvFCF
    }
  }

  // Calculate final values
  const finalFCF = projections[4].fcf
  const terminalValue = calculateTerminalValue(finalFCF, wacc, terminalGrowthRate)
  const pvTerminalValue = calculatePVTerminalValue(terminalValue, wacc, 5)
  const pvFCFs = cumulativePVFCF
  const enterpriseValue = calculateEnterpriseValue(pvFCFs, pvTerminalValue)
  const equityValue = calculateEquityValue(
    enterpriseValue,
    totalCash,
    totalDebt,
    stockData?.marketCap || 0
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
 * Calculate sensitivity table for DCF with proper per-cell DCF recalculation
 * @param {number} baseIntrinsicValue - Base case intrinsic value (reference, not used in calc)
 * @param {number} currentPrice - Current price
 * @param {Array} waccRange - Array of WACC values
 * @param {Array} tgrRange - Array of terminal growth rate values
 * @param {Object} dcfParams - DCF calculation parameters {fcfYear5, pvFCFsYears1To5, sharesOutstanding, cash, debt}
 * @returns {Object} Sensitivity table data with properly calculated values
 */
export function calculateSensitivityTable(
  baseIntrinsicValue,
  currentPrice,
  waccRange = [8, 9, 10, 11, 12],
  tgrRange = [1.5, 2.0, 2.5, 3.0, 3.5],
  dcfParams = {}
) {
  if (!currentPrice) {
    return null
  }

  const {
    fcfYear5 = 0,
    pvFCFsYears1To5 = 0,
    sharesOutstanding = 1,
    cash = 0,
    debt = 0
  } = dcfParams

  const values = []

  for (const tgr of tgrRange) {
    const row = []
    for (const wacc of waccRange) {
      // Skip invalid combinations where TGR >= WACC (would cause division by zero or negative TV)
      if (tgr >= wacc - 0.5) {
        row.push(0.01)
        continue
      }

      // Proper DCF calculation for this WACC/TGR combination:
      // 1. Calculate Terminal Value using Gordon Growth Model
      const discountRate = wacc / 100
      const growthRate = tgr / 100
      const terminalValue = (fcfYear5 * (1 + growthRate)) / (discountRate - growthRate)

      // 2. Calculate PV of Terminal Value (discounted back 5 years)
      const pvTerminalValue = terminalValue / Math.pow(1 + discountRate, 5)

      // 3. Enterprise Value = PV of FCFs (years 1-5) + PV of Terminal Value
      const enterpriseValue = pvFCFsYears1To5 + pvTerminalValue

      // 4. Equity Value = EV + Cash - Debt
      let equityValue = enterpriseValue + cash - debt

      // Guard against negative equity
      if (equityValue <= 0) {
        equityValue = 0.01 * sharesOutstanding // Minimum value
      }

      // 5. Intrinsic Value per Share
      const intrinsicValuePerShare = equityValue / Math.max(sharesOutstanding, 1)

      row.push(Math.max(0.01, intrinsicValuePerShare))
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
 * Calculate financial ratios from raw XBRL data
 * @param {Object} xbrlData - Raw XBRL extracted data
 * @param {number} xbrlData.netIncome - Net income/profit for period
 * @param {number} xbrlData.totalEquity - Total shareholder equity
 * @param {number} xbrlData.totalDebt - Total debt (borrowings)
 * @param {number} xbrlData.currentAssets - Current assets
 * @param {number} xbrlData.currentLiabilities - Current liabilities
 * @param {Object} marketData - Market data for derived ratios
 * @param {number} marketData.currentPrice - Current stock price
 * @param {number} marketData.sharesOutstanding - Shares outstanding
 * @param {number} marketData.marketCap - Market capitalization
 * @returns {Object} Calculated ratios: { roe, debtToEquity, currentRatio, bookValuePerShare, priceToBook }
 */
export function calculateRatiosFromXBRL(xbrlData, marketData) {
  const result = {
    roe: null,
    debtToEquity: null,
    currentRatio: null,
    bookValuePerShare: null,
    priceToBook: null,
    _source: 'XBRL'
  }

  // ROE: (netIncome / totalEquity) * 100 - returns percentage (e.g., 15 for 15%)
  // Yahoo Finance uses decimal format (0.15), so convert at usage point
  if (xbrlData.netIncome && xbrlData.totalEquity && xbrlData.totalEquity > 0) {
    result.roe = (xbrlData.netIncome / xbrlData.totalEquity) * 100
  }

  // Debt-to-Equity: totalDebt / totalEquity
  if (xbrlData.totalDebt !== undefined && xbrlData.totalEquity && xbrlData.totalEquity > 0) {
    result.debtToEquity = xbrlData.totalDebt / xbrlData.totalEquity
  }

  // Current Ratio: currentAssets / currentLiabilities
  if (xbrlData.currentAssets && xbrlData.currentLiabilities && xbrlData.currentLiabilities > 0) {
    result.currentRatio = xbrlData.currentAssets / xbrlData.currentLiabilities
  }

  // Book Value Per Share: totalEquity / sharesOutstanding
  if (xbrlData.totalEquity && marketData.sharesOutstanding && marketData.sharesOutstanding > 0) {
    result.bookValuePerShare = xbrlData.totalEquity / marketData.sharesOutstanding
  }

  // P/BV: currentPrice / bookValuePerShare
  if (result.bookValuePerShare && marketData.currentPrice && result.bookValuePerShare > 0) {
    result.priceToBook = marketData.currentPrice / result.bookValuePerShare
  }

  return result
}

/**
 * Get sensitivity classification for a value
 * @param {number} value - Intrinsic value at given WACC/TGR
 * @param {number} currentPrice - Current market price
 * @returns {string} CSS class name
 */
export function getSensitivityClass(value, currentPrice) {
  if (!value || !currentPrice || currentPrice <= 0) return ''
  const ratio = value / currentPrice
  if (!isFinite(ratio)) return ''
  if (ratio >= 1.25) return 'significantly-undervalued'
  if (ratio >= 1.1) return 'undervalued'
  if (ratio >= 0.9) return 'near-fair'
  if (ratio >= 0.75) return 'overvalued'
  return 'significantly-overvalued'
}
