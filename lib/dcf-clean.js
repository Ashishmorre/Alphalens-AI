import crypto from 'crypto'

/**
 * CLEAN DCF MODEL v13.0
 * Professional-grade DCF with institutional best practices
 *
 * CORE REFINEMENTS:
 * 1. Dynamic Capital Structure WACC (sector-based: Tech 90/10, Utility 50/50, etc.)
 * 2. Linked Depreciation (PP&E/CapEx based, not fixed % of revenue)
 * 3. Historical NWC Rate (company-specific, not fixed 3%)
 *
 * ADVANCED FEATURES:
 * 4. Multiple Scenario Modeling (Bear/Base/Bull cases)
 * 5. Reverse DCF ("What growth is the market pricing in?")
 * 6. Gordon Growth Terminal Value (no exit multiple inflation)
 * 7. Mid-Year Discounting (professional standard)
 * 8. ROIC Validation (value creating vs destroying)
 *
 * REMOVED (Institutional Best Practice):
 * - MAX(TV methods) - Exit multiples inflate value
 * - Quality Premiums - Double count good ROE
 * - SOTP Buffers - Unrealistic floor prices
 * - FCF Multipliers - No theoretical basis
 */

/**
 * Sector-Based Target Capital Structures
 * Different industries have different optimal leverage based on:
 * - Asset intensity (PPE-heavy industries can carry more debt)
 * - Cash flow stability (utilities, consumer staples)
 * - Regulatory constraints (financials, healthcare)
 * - Business model (software requires less debt than manufacturing)
 */
export const SECTOR_CAPITAL_STRUCTURES = {
  tech: { equityPct: 90, debtPct: 10, description: 'Tech/Software - Asset-light, high cash flow' },
  software: { equityPct: 90, debtPct: 10, description: 'Software - Minimal fixed assets' },
  saas: { equityPct: 92, debtPct: 8, description: 'SaaS - Recurring revenue, low capex' },
  utility: { equityPct: 50, debtPct: 50, description: 'Utilities - Stable cash flows support high debt' },
  power: { equityPct: 55, debtPct: 45, description: 'Power - Regulated returns, stable cash' },
  manufacturing: { equityPct: 60, debtPct: 40, description: 'Manufacturing - Moderate leverage' },
  industrial: { equityPct: 60, debtPct: 40, description: 'Industrials - Asset-heavy operations' },
  chemical: { equityPct: 55, debtPct: 45, description: 'Chemicals - Capital intensive' },
  financial: { equityPct: 85, debtPct: 15, description: 'Financials - Regulatory constraints on leverage' },
  bank: { equityPct: 88, debtPct: 12, description: 'Banks - Basel capital requirements' },
  insurance: { equityPct: 82, debtPct: 18, description: 'Insurance - Regulatory capital' },
  realEstate: { equityPct: 40, debtPct: 60, description: 'Real Estate - Heavy leverage typical' },
  reit: { equityPct: 45, debtPct: 55, description: 'REITs - Distribution requirements' },
  infrastructure: { equityPct: 45, debtPct: 55, description: 'Infrastructure - Project finance structure' },
  renewable: { equityPct: 50, debtPct: 50, description: 'Renewables - Long-term PPAs, stable cash' },
  retail: { equityPct: 70, debtPct: 30, description: 'Retail - Moderate leverage' },
  ecommerce: { equityPct: 85, debtPct: 15, description: 'E-commerce - Asset-light, high growth' },
  consumer: { equityPct: 75, debtPct: 25, description: 'Consumer Staples - Stable cash flow' },
  fmcg: { equityPct: 76, debtPct: 24, description: 'FMCG - Strong brands, stable margins' },
  healthcare: { equityPct: 80, debtPct: 20, description: 'Healthcare - R&D heavy, low debt' },
  pharma: { equityPct: 78, debtPct: 22, description: 'Pharma - Patent cliff risk' },
  biotech: { equityPct: 85, debtPct: 15, description: 'Biotech - Clinical trial risk' },
  energy: { equityPct: 55, debtPct: 45, description: 'Energy - Capital intensive, volatile' },
  oil: { equityPct: 50, debtPct: 50, description: 'Oil & Gas - Commodity price exposure' },
  mining: { equityPct: 58, debtPct: 42, description: 'Mining - Cyclical, asset-heavy' },
  telecom: { equityPct: 62, debtPct: 38, description: 'Telecom - Infrastructure investment' },
  auto: { equityPct: 65, debtPct: 35, description: 'Auto - Cyclical, capital intensive' },
  aviation: { equityPct: 70, debtPct: 30, description: 'Aviation - Asset-heavy but cyclical' },
  logistics: { equityPct: 68, debtPct: 32, description: 'Logistics - Asset-heavy, stable demand' },
  media: { equityPct: 75, debtPct: 25, description: 'Media - Content investment, moderate leverage' },
  entertainment: { equityPct: 78, debtPct: 22, description: 'Entertainment - Hit-driven, moderate debt' },
  default: { equityPct: 70, debtPct: 30, description: 'Default - Balanced capital structure' },
}

/**
 * Get sector-appropriate capital structure
 * @param {string} sector - Industry sector
 * @returns {Object} Target structure {equityPct, debtPct, description}
 */
export function getSectorCapitalStructure(sector = '') {
  const sectorLower = sector.toLowerCase().replace(/\s+/g, '')

  // Check for sector matches (try exact match first, then partial)
  const keys = Object.keys(SECTOR_CAPITAL_STRUCTURES).filter(k => k !== 'default')

  // First: exact match
  if (SECTOR_CAPITAL_STRUCTURES[sectorLower]) {
    return SECTOR_CAPITAL_STRUCTURES[sectorLower]
  }

  // Second: partial match
  for (const key of keys) {
    if (sectorLower.includes(key) || key.includes(sectorLower)) {
      return SECTOR_CAPITAL_STRUCTURES[key]
    }
  }

  return SECTOR_CAPITAL_STRUCTURES.default
}

/**
 * Import helper for Yahoo Finance normalization
 */
function normalizeToAbsolute(value) {
  if (value == null) return 0
  if (typeof value === 'number') return value
  const str = String(value).replace(/[$,\s]/g, '').toUpperCase()
  const match = str.match(/^([\d.]+)([KMBT]?)$/)
  if (!match) return Number(str) || 0
  const num = parseFloat(match[1])
  const unit = match[2]
  const multipliers = { '': 1, 'K': 1e3, 'M': 1e6, 'B': 1e9, 'T': 1e12 }
  return num * (multipliers[unit] || 1)
}

/**
 * PROPER WACC CALCULATION
 * Formula: WACC = (E/(D+E)) × Ke + (D/(D+E)) × Kd × (1 - T)
 * Where:
 * Ke = Rf + β × (Rm - Rf) [Cost of Equity via CAPM]
 * Kd = Interest Expense / Total Debt [Cost of Debt]
 * E = Market Cap, D = Total Debt
 *
 * REFINEMENT: Uses TARGET CAPITAL STRUCTURE (not current market weights)
 * Example: 70% equity / 30% debt for stable firms
 * This is more stable than market-cap-based weights that fluctuate daily
 *
 * @param {Object} params
 * @param {number} params.beta - Stock beta
 * @param {number} params.marketCap - Market cap (current equity value, optional)
 * @param {number} params.totalDebt - Total debt
 * @param {number} params.interestExpense - Annual interest expense
 * @param {number} params.taxRate - Tax rate (default 21%)
 * @param {number} params.riskFreeRate - Risk-free rate (India: ~7% for 10Y bond)
 * @param {number} params.marketRiskPremium - Market premium (default 5.5%)
 * @param {Object} params.targetStructure - Target capital structure {equityPct, debtPct}
 *                                          Default: {equityPct: 70, debtPct: 30} for stable firms
 * @returns {number} WACC as percentage
 */
export function calculateProperWACC({
  beta = 1.0,
  marketCap,
  totalDebt = 0,
  interestExpense = 0,
  taxRate = 21,
  riskFreeRate = 7.0, // India 10Y bond ~7%
  marketRiskPremium = 5.5,
  targetStructure = null, // If null, use sector-based
  sector = '',
}) {
  // Use sector-based structure if no explicit structure provided
  const structure = targetStructure || getSectorCapitalStructure(sector)
  const E_pct = structure.equityPct / 100
  const D_pct = structure.debtPct / 100

  // Cost of Equity (CAPM)
  const Ke = riskFreeRate + beta * marketRiskPremium

  // Cost of Debt (can use implied cost or actual)
  const Kd = D_pct > 0 && interestExpense && totalDebt
    ? (interestExpense / totalDebt) * 100
    : 6.0 // Default for India corporates

  // WACC Formula with TARGET weights
  const wacc = E_pct * Ke + D_pct * Kd * (1 - taxRate / 100)

  return wacc
}

/**
 * CLEAN TERMINAL GROWTH RATE
 * Stable, conservative rates:
 * - Developed markets: 2-3%
 * - India/emerging markets: 3-4% max
 * @param {number} gdpGrowth - Country GDP growth (default 6% for India)
 * @param {number} inflation - Inflation rate (default 5% for India)
 * @param {number} realGrowth - Real sustainable growth (default 1-2%)
 * @returns {number} Terminal growth rate
 */
export function calculateCleanTGR({
  gdpGrowth = 6.0, // India GDP ~6%
  inflation = 5.0, // India inflation ~5%
  realGrowth = 1.5, // Real sustainable growth
}) {
  // TGR = min(4%, GDP growth, Inflation + Real Growth)
  const tgr = Math.min(
    4.0,
    gdpGrowth,
    inflation + realGrowth
  )
  return tgr
}

/**
 * Calculate depreciation based on PP&E/CapEx history
 *
 * REFINEMENT: Depreciation = % of previous PP&E OR linked to CapEx historically
 * Instead of fixed 5% of revenue (which doesn't work across sectors)
 *
 * @param {Object} params
 * @param {number} params.netPPE - Net Property, Plant & Equipment
 * @param {number} params.grossPPE - Gross PP&E (before accumulated depreciation)
 * @param {number} params.accumulatedDepreciation - Total accumulated depreciation
 * @param {number} params.historicalCapex - Historical average CapEx
 * @param {number} params.assetLife - Average asset life in years (default 10)
 * @param {number} params.revenue - Current revenue (fallback only)
 * @returns {number} Depreciation amount
 */
export function calculateLinkedDepreciation({
  netPPE,
  grossPPE,
  accumulatedDepreciation,
  historicalCapex,
  assetLife = 10,
  revenue,
}) {
  // Method 1: If we have gross PPE and accumulated depreciation
  // New depreciation = (Gross PPE / Asset Life) - Adjustment for aging
  if (grossPPE && assetLife > 0) {
    const baseDepreciation = grossPPE / assetLife

    // If we have accumulated depreciation, adjust for asset age
    if (accumulatedDepreciation && accumulatedDepreciation > 0) {
      // Assets are older, reducing depreciation going forward
      const assetAge = accumulatedDepreciation / (baseDepreciation || 1)
      const ageAdjustment = Math.max(0.6, Math.min(1.2, 1 - (assetAge - 5) * 0.02))
      return baseDepreciation * ageAdjustment
    }

    return baseDepreciation
  }

  // Method 2: If we have historical CapEx, use it to estimate depreciation
  // (CapEx enters the depreciation pool and depreciates over asset life)
  if (historicalCapex && assetLife > 0) {
    // Historical CapEx is already annual average, apply depreciation rate
    return historicalCapex * 0.85 // 85% of CapEx becomes depreciable asset
  }

  // Method 3: Fallback using net PPE with declining balance approach
  if (netPPE && assetLife > 0) {
    // Net PPE is after accumulated depreciation, so depreciation is lower
    return netPPE / assetLife * 0.8
  }

  // Fallback: Use revenue-based estimate (original method, sector-adjusted)
  // This is only used when PP&E data is completely unavailable
  if (revenue) {
    return revenue * 0.05 // 5% of revenue (original fallback)
  }

  return 0
}

/**
 * Calculate NWC Rate from historical data
 *
 * REFINEMENT: NWC % = historical average (company-specific)
 * ΔNWC = ΔRevenue × Historical NWC%
 *
 * Different industries have VERY different NWC needs:
 * - Software/SaaS: 5-10% (low inventory, high receivables)
 * - Manufacturing: 15-25% (high inventory, receivables)
 * - Retail: 5-15% (negative NWC - pay suppliers after receiving cash)
 * - Utilities: 2-5% (prepaid by customers)
 *
 * @param {Object} params
 * @param {number} params.currentAssets - Current assets (current year)
 * @param {number} params.currentLiabilities - Current liabilities
 * @param {number} params.revenue - Annual revenue
 * @param {number} params.cash - Cash (excluded from operating NWC)
 * @param {number} params.shortTermDebt - Short-term debt (excluded)
 * @param {number} params.historicalNWCRate - Historical NWC/Revenue ratio
 * @param {string} params.sector - Industry sector (for defaults)
 * @returns {Object} {nwcRate, nwcAmount, nwcChangeFormula}
 */
export function calculateNWCRate({
  currentAssets,
  currentLiabilities,
  revenue,
  cash = 0,
  shortTermDebt = 0,
  historicalNWCRate,
  sector = '',
}) {
  // If historical rate is provided, use it (most accurate)
  if (historicalNWCRate !== undefined && historicalNWCRate !== null) {
    return {
      nwcRate: historicalNWCRate,
      nwcAmount: revenue * historicalNWCRate,
      source: 'HISTORICAL',
      explanation: `Historical NWC rate: ${(historicalNWCRate * 100).toFixed(1)}% of revenue`,
    }
  }

  // Calculate current NWC from balance sheet
  if (currentAssets || currentLiabilities) {
    const operatingCA = (currentAssets || 0) - (cash || 0) // Exclude excess cash
    const operatingCL = (currentLiabilities || 0) - (shortTermDebt || 0) // Exclude interest-bearing debt
    const currentNWC = operatingCA - operatingCL
    const calculatedRate = revenue > 0 ? currentNWC / revenue : 0.03

    return {
      nwcRate: calculatedRate,
      nwcAmount: currentNWC,
      source: 'BALANCE_SHEET',
      explanation: `Operating NWC = (${operatingCA.toFixed(0)} - ${(cash || 0).toFixed(0)}) - (${operatingCL.toFixed(0)} - ${(shortTermDebt || 0).toFixed(0)}) = ${currentNWC.toFixed(0)}`,
    }
  }

  // Sector-based defaults (last resort)
  let defaultRate = 0.03
  
  if (sectorLower.includes('software') || sectorLower.includes('tech')) {
    defaultRate = 0.08 // High receivables, low inventory
  } else if (sectorLower.includes('manufacturing')) {
    defaultRate = 0.20 // High inventory + receivables
  } else if (sectorLower.includes('retail') || sectorLower.includes('consumer')) {
    defaultRate = 0.05 // Often negative NWC, but conservative 5%
  } else if (sectorLower.includes('utility')) {
    defaultRate = 0.03 // Low NWC needs
  } else if (sectorLower.includes('infrastructure')) {
    defaultRate = -0.05 // Often negative (customer advances)
  }

  return {
    nwcRate: defaultRate,
    nwcAmount: revenue * defaultRate,
    source: 'SECTOR_DEFAULT',
    explanation: `Sector-based rate: ${(defaultRate * 100).toFixed(1)}% for ${sector || 'general'}`,
  }
}

/**
 * CLEAN 5-YEAR PROJECTIONS
 * Simple declining growth, stable margins
 *
 * REFINEMENTS:
 * - Depreciation: Linked to PP&E/CapEx history (not fixed 5% of revenue)
 * - ΔNWC: Uses historical company-specific rate (not fixed 3%)
 *
 * @param {Object} params
 * @param {number} params.baseRevenue - Starting revenue
 * @param {number} params.baseEbitdaMargin - Starting EBITDA margin
 * @param {number} params.year1Growth - Year 1 growth rate
 * @param {number} params.year5Growth - Year 5 growth rate
 * @param {number} params.terminalMargin - Target margin
 * @param {number} params.taxRate - Tax rate
 * @param {number} params.capexRate - CapEx as % of revenue
 * @param {Object} params.nwcParams - NWC calculation parameters (for historicalRate)
 * @param {Object} params.depreciationParams - Depreciation calculation parameters
 * @returns {Array} 5-year projection objects
 */
export function calculateCleanProjections({
  baseRevenue,
  baseEbitdaMargin,
  year1Growth = 15,
  year5Growth = 6,
  terminalGrowth = null, // For terminal fade
  terminalMargin = null,
  taxRate = 21,
  capexRate = 0.08,
  nwcParams = {}, // NEW: Historical NWC parameters
  depreciationParams = {}, // NEW: PP&E/CapEx based depreciation
}) {
  const projections = []
  const targetMargin = terminalMargin || baseEbitdaMargin
  const targetGrowth = terminalGrowth || year5Growth

  // Calculate historical NWC rate once (company-specific)
  const nwcInfo = calculateNWCRate({
    revenue: baseRevenue,
    ...nwcParams,
  })
  const nwcRate = nwcInfo.nwcRate

  // Calculate base depreciation
  const baseDepreciation = calculateLinkedDepreciation({
    revenue: baseRevenue,
    ...depreciationParams,
  })

  let prevRevenue = baseRevenue
  let prevDepreciation = baseDepreciation

  for (let i = 0; i < 5; i++) {
    const year = i + 1
    let growthRate

    // Apply terminal fade in Years 4-5 (smooth transition)
    if (i >= 3 && targetGrowth < year5Growth) {
      // Fade from year5Growth toward terminalGrowth
      const fadeProgress = (i - 3) / 2 // Year 4 = 0.5, Year 5 = 1.0
      growthRate = year5Growth * Math.pow(targetGrowth / year5Growth, fadeProgress)
    } else {
      // Linear decline Years 1-3
      const growthStep = (year1Growth - year5Growth) / 4
      growthRate = year1Growth - (growthStep * i)
    }

    // Revenue with declining growth
    const revenue = prevRevenue * (1 + growthRate / 100)

    // Margin converges to terminal margin
    const marginConvergence = i / 4
    const ebitdaMargin = baseEbitdaMargin + (targetMargin - baseEbitdaMargin) * marginConvergence

    const ebitda = revenue * (ebitdaMargin / 100)

    // REFINED: Linked depreciation based on PP&E/CapEx
    // If we have asset additions, depreciation follows CapEx
    const revenueGrowth = (revenue - prevRevenue) / prevRevenue
    const assetGrowth = Math.max(0, revenueGrowth * 0.8) // CapEx grows with revenue
    const newAssets = revenue * capexRate * (i < 2 ? 1.2 : 0.9) // Front-loaded CapEx

    // Depreciation = previous depreciation plus new asset depreciation (straight-line over assetLife)
    const assetLife = depreciationParams.assetLife || 10
    const depreciationOnNewAssets = newAssets / assetLife
    const depreciation = prevDepreciation * 0.95 + depreciationOnNewAssets // 95% carryover (some assets fully depreciated)

    const ebit = ebitda - depreciation
    const nopat = ebit * (1 - taxRate / 100)

    // Clean CapEx
    let capex = -revenue * capexRate

    // Year 5: Converge CapEx to Depreciation
    if (i === 4) {
      capex = -depreciation
    }

    // REFINED: NWC Change = ΔRevenue × Historical NWC Rate (company-specific)
    const nwcChange = (revenue - prevRevenue) * nwcRate

    // STANDARD FCF (no multipliers)
    const fcf = nopat + depreciation - Math.abs(capex) - nwcChange

    projections.push({
      year,
      revenue,
      ebitdaMargin,
      ebitda,
      depreciation,
      ebit,
      nopat,
      capex,
      nwcChange,
      fcf,
      growthRate,
      // Enhanced metrics
      nwcRate,
      nwcExplanation: i === 0 ? nwcInfo.explanation : undefined,
      depreciationExplanation: i === 0 ? `Depreciation rate: ${(depreciation / revenue * 100).toFixed(1)}% of revenue (PP&E linked)` : undefined,
    })

    prevRevenue = revenue
    prevDepreciation = depreciation
  }

  return projections
}

/**
 * CLEAN TERMINAL VALUE - Gordon Growth ONLY
 * Formula: TV = (FCF5 × (1 + g)) / (WACC - g)
 * @param {number} fcfYear5 - Year 5 FCF
 * @param {number} wacc - WACC as percentage
 * @param {number} tgr - Terminal growth rate as percentage
 * @returns {number} Terminal value
 */
export function calculateCleanTerminalValue(fcfYear5, wacc, tgr) {
  if (!fcfYear5 || !wacc || !tgr) return 0

  const waccDecimal = wacc / 100
  const tgrDecimal = tgr / 100

  if (waccDecimal <= tgrDecimal) return 0

  const tv = (fcfYear5 * (1 + tgrDecimal)) / (waccDecimal - tgrDecimal)
  return tv
}

/**
 * CLEAN EQUITY BRIDGE
 * Simple: Equity = EV + Cash - Debt
 * No SOTP buffer, no floor
 * @param {number} enterpriseValue - Enterprise value
 * @param {number} cash - Cash & equivalents
 * @param {number} debt - Total debt
 * @returns {number} Equity value
 */
export function calculateCleanEquityValue(enterpriseValue, cash, debt) {
  return (enterpriseValue || 0) + (cash || 0) - (debt || 0)
}

/**
 * Calculate ROIC (Return on Invested Capital) - PROFESSIONAL VERSION
 * Formula: ROIC = NOPAT / Book Invested Capital
 * IMPORTANT: Uses book equity (not market cap) for invested capital
 * Where: Invested Capital = Total Debt + Book Equity - Excess Cash
 * @param {number} nopat - Net Operating Profit After Tax
 * @param {number} totalDebt - Total debt
 * @param {number} bookEquity - Book equity from balance sheet (not market cap)
 * @param {number} excessCash - Excess cash (total cash - operating cash)
 * @returns {number} ROIC as percentage
 */
export function calculateROIC(nopat, totalDebt, bookEquity, excessCash) {
  const investedCapital = (totalDebt || 0) + (bookEquity || 0) - (excessCash || 0)
  if (!nopat || investedCapital <= 0) return 0
  return (nopat / investedCapital) * 100
}

/**
 * Calculate Excess Cash (Operating vs Non-Operating separation)
 * Formula: Excess Cash = Total Cash - Operating Cash Reserve
 * Operating Cash ≈ 2% of annual revenue (for working capital needs)
 * @param {number} totalCash - Total cash & equivalents
 * @param {number} revenue - Annual revenue
 * @param {number} operatingCashPct - Operating cash as % of revenue (default 2%)
 * @returns {number} Excess cash available for valuation
 */
export function calculateExcessCash(totalCash, revenue, operatingCashPct = 0.02) {
  const operatingCash = (revenue || 0) * operatingCashPct
  const excessCash = Math.max((totalCash || 0) - operatingCash, 0)
  return excessCash
}

/**
 * Calculate Mid-Year Discount Factor (Professional IB standard)
 * Assumes cash flows occur evenly throughout the year
 * Formula: Discount Factor = 1 / (1 + WACC)^(t - 0.5)
 * @param {number} year - Year number
 * @param {number} wacc - WACC as percentage
 * @returns {number} Present value factor
 */
export function calculateMidYearDiscountFactor(year, wacc) {
  if (!year || !wacc) return 0
  const waccDecimal = wacc / 100
  return 1 / Math.pow(1 + waccDecimal, year - 0.5)
}

/**
 * Apply Terminal Fade (Smooth transition to TGR)
 * Prevents unrealistic "cliff effect" in Years 4-5
 * @param {number} currentGrowth - Current year growth rate
 * @param {number} terminalGrowth - Terminal growth rate (TGR)
 * @param {number} fadeProgress - 0 to 1 (Year 4 = 0.5, Year 5 = 1.0)
 * @returns {number} Faded growth rate
 */
export function applyTerminalFade(currentGrowth, terminalGrowth, fadeProgress) {
  if (!currentGrowth || !terminalGrowth) return currentGrowth
  // Smooth exponential fade
  const faded = currentGrowth * Math.pow(terminalGrowth / currentGrowth, fadeProgress)
  return faded
}

/**
 * Calculate Reinvestment Rate
 * Formula: Reinvestment = Growth Rate / ROIC
 * Links growth to capital required
 * @param {number} growthRate - Revenue growth rate (%)
 * @param {number} roic - Return on invested capital (%)
 * @returns {number} Reinvestment rate as decimal
 */
export function calculateReinvestmentRate(growthRate, roic) {
  if (!growthRate || !roic || roic <= 0) return 0.5 // Default 50% reinvestment
  const reinvestment = (growthRate / 100) / (roic / 100)
  return Math.min(Math.max(reinvestment, 0), 1) // Cap between 0-100%
}

/**
 * Professional Sanity Checks for DCF
 * Validates assumptions before valuation
 * @param {Object} params
 * @param {number} params.wacc - WACC
 * @param {number} params.tgr - Terminal growth rate
 * @param {number} params.terminalValuePct - Terminal value as % of EV
 * @param {number} params.roic - ROIC
 * @returns {Object} Sanity check results with warnings
 */
export function runSanityChecks({ wacc, tgr, terminalValuePct, roic }) {
  const checks = []
  const warnings = []

  // Check 1: TGR < WACC
  if (tgr >= wacc) {
    checks.push({
      name: 'TGR < WACC',
      status: 'FAILED',
      message: `TGR (${tgr}%) must be less than WACC (${wacc}%)`,
    })
    warnings.push('CRITICAL: TGR >= WACC - Gordon Growth undefined')
  } else {
    checks.push({ name: 'TGR < WACC', status: 'PASSED' })
  }

  // Check 2: TGR ≤ 4-5%
  if (tgr > 5) {
    checks.push({
      name: 'TGR ≤ 5%',
      status: 'WARNING',
      message: `TGR (${tgr}%) exceeds conservative 5% max`,
    })
    warnings.push(`TGR ${tgr}% > 5% - may be optimistic for India market`)
  } else {
    checks.push({ name: 'TGR ≤ 5%', status: 'PASSED' })
  }

  // Check 3: WACC between 8-14% (India typical)
  if (wacc < 8 || wacc > 14) {
    checks.push({
      name: 'WACC 8-14%',
      status: 'WARNING',
      message: `WACC (${wacc}%) outside India typical range (8-14%)`,
    })
    warnings.push(`WACC ${wacc}% unusual - India equities typically 8-14%`)
  } else {
    checks.push({ name: 'WACC 8-14%', status: 'PASSED' })
  }

  // Check 4: Terminal Value < 85% of EV
  if (terminalValuePct > 85) {
    checks.push({
      name: 'TV < 85% of EV',
      status: 'WARNING',
      message: `Terminal value (${terminalValuePct.toFixed(1)}%) exceeds 85% threshold`,
    })
    warnings.push('Terminal value dominates - check projections accuracy')
  } else {
    checks.push({ name: 'TV < 85% of EV', status: 'PASSED' })
  }

  // Check 5: ROIC > WACC
  if (roic > 0 && roic < wacc) {
    checks.push({
      name: 'ROIC > WACC',
      status: 'WARNING',
      message: `ROIC (${roic.toFixed(1)}%) < WACC (${wacc}%) - growth destroys value`,
    })
    warnings.push('ROIC < WACC: Consider if company can improve returns')
  } else if (roic > 0) {
    checks.push({ name: 'ROIC > WACC', status: 'PASSED' })
  } else {
    checks.push({ name: 'ROIC > WACC', status: 'SKIPPED' })
  }

  const allPassed = checks.every(c => c.status === 'PASSED')

  return {
    checks,
    warnings,
    allPassed,
    warningCount: warnings.length,
  }
}

/**
 * Advanced Sanity Checks with Output Diagnostics (Professional v2.0)
 * Includes enhanced warnings for IB-quality valuation
 * @param {Object} params
 * @param {number} params.wacc - WACC
 * @param {number} params.tgr - Terminal growth rate
 * @param {number} params.terminalValuePct - Terminal value as % of EV
 * @param {number} params.roic - ROIC
 * @param {number} params.year5Growth - Year 5 revenue growth
 * @param {number} params.revenue - Base revenue
 * @param {number} params.bookEquity - Book equity
 * @returns {Object} Enhanced sanity check results with rich diagnostics
 */
export function runAdvancedSanityChecks({
  wacc,
  tgr,
  terminalValuePct,
  roic,
  year5Growth,
  revenue,
  bookEquity,
}) {
  // Run base checks first
  const baseChecks = runSanityChecks({ wacc, tgr, terminalValuePct, roic })

  // Advanced diagnostics
  const diagnostics = []
  const flags = []

  // Flag 1: High Terminal Dependency
  if (terminalValuePct > 80) {
    diagnostics.push({
      type: 'HIGH_TERMINAL_DEPENDENCY',
      severity: 'WARNING',
      icon: '⚠️',
      message: `Terminal value accounts for ${terminalValuePct.toFixed(1)}% of EV`,
      hint: 'Most value is in the distant future - check near-term projections',
    })
  }

  // Flag 2: Very High Growth Assumptions
  if (year5Growth > 12) {
    diagnostics.push({
      type: 'HIGH_GROWTH_ASSUMPTION',
      severity: 'WARNING',
      icon: '⚠️',
      message: `Year 5 growth (${year5Growth.toFixed(1)}%) exceeds sustainable 12%`,
      hint: 'Very few companies sustain >12% growth long-term',
    })
  }

  // Flag 3: Negative Equity / Book Value Red Flag
  if (bookEquity < 0) {
    diagnostics.push({
      type: 'NEGATIVE_BOOK_EQUITY',
      severity: 'CRITICAL',
      icon: '🚨',
      message: 'Book equity is negative - potential insolvency risk',
      hint: 'Company may be technically insolvent - use liquidation value',
    })
  }

  // Flag 4: ROIC Quality Assessment
  if (roic > 0 && roic < wacc) {
    diagnostics.push({
      type: 'ROIC_BELOW_COST',
      severity: 'WARNING',
      icon: '⚠️',
      message: `ROIC (${roic.toFixed(1)}%) below cost of capital (${wacc}%)`,
      hint: 'Growth is destroying value - challenge reinvestment assumptions',
    })
  } else if (roic > 20) {
    diagnostics.push({
      type: 'HIGH_ROIC',
      severity: 'INFO',
      icon: '✅',
      message: `Strong ROIC (${roic.toFixed(1)}%) indicates competitive moat`,
      hint: 'Company likely has sustainable competitive advantage',
    })
  }

  // Flag 5: TGR vs Growth Consistency
  const growthToTGRGap = year5Growth - tgr
  if (growthToTGRGap > 8) {
    diagnostics.push({
      type: 'GROWTH_CLIFF',
      severity: 'WARNING',
      icon: '⚠️',
      message: `Growth drops from ${year5Growth.toFixed(1)}% to ${tgr}% terminal`,
      hint: 'Sudden deceleration - consider smoother terminal fade',
    })
  }

  // Summary flags for UI
  const hasCritical = diagnostics.some(d => d.severity === 'CRITICAL')
  const hasWarnings = diagnostics.some(d => d.severity === 'WARNING')

  // Trust score (0-100)
  let trustScore = 100
  if (hasCritical) trustScore -= 40
  if (hasWarnings) trustScore -= 20
  if (terminalValuePct > 75) trustScore -= 10
  if (year5Growth > 15) trustScore -= 10
  trustScore = Math.max(trustScore, 0)

  return {
    ...baseChecks,
    diagnostics,
    flags: {
      hasCritical,
      hasWarnings,
      highGrowth: year5Growth > 12,
      highTerminal: terminalValuePct > 75,
    },
    trustScore,
    qualityRating: trustScore >= 80 ? 'HIGH' : trustScore >= 60 ? 'MEDIUM' : 'LOW',
  }
}

/**
 * Calculate Present Value
 * @param {number} fcf - Future cash flow
 * @param {number} wacc - Discount rate (WACC)
 * @param {number} year - Year number
 * @returns {number} Present value
 */
export function calculatePV(fcf, wacc, year) {
  if (!fcf || !wacc || !year) return 0
  const discountRate = wacc / 100
  return fcf / Math.pow(1 + discountRate, year)
}

/**
 * Calculate Present Value of Terminal Value
 * @param {number} terminalValue - Terminal value
 * @param {number} wacc - WACC
 * @param {number} years - Number of years
 * @returns {number} PV of terminal value
 */
export function calculatePVTerminalValue(terminalValue, wacc, years = 5) {
  if (!terminalValue || !wacc || !years) return 0
  const discountRate = wacc / 100
  return terminalValue / Math.pow(1 + discountRate, years)
}

/**
 * Calculate Intrinsic Value Per Share
 * @param {number} equityValue - Total equity value
 * @param {number} sharesOutstanding - Number of shares
 * @returns {number} Intrinsic value per share
 */
export function calculateIntrinsicValuePerShare(equityValue, sharesOutstanding) {
  if (!sharesOutstanding || sharesOutstanding <= 0) return 0
  const value = (equityValue || 0) / sharesOutstanding
  return Math.max(value, 0.01)
}

/**
 * CLEAN SENSITIVITY ANALYSIS
 * @param {number} baseIV - Base intrinsic value
 * @param {number} baseWACC - Base WACC
 * @param {number} baseTGR - Base TGR
 * @returns {Object} Sensitivity table
 */
export function calculateCleanSensitivity(baseIV, baseWACC, baseTGR) {
  const waccRange = [
    Math.max(5, baseWACC - 2),
    Math.max(6, baseWACC - 1),
    baseWACC,
    baseWACC + 1,
    baseWACC + 2
  ]
  const tgrRange = [
    Math.max(1, baseTGR - 1),
    baseTGR - 0.5,
    baseTGR,
    baseTGR + 0.5,
    baseTGR + 1
  ].filter(t => t >= 1)

  const values = []

  for (const tgr of tgrRange) {
    const row = []
    for (const w of waccRange) {
      if (tgr >= w - 0.5) {
        row.push(0.01)
        continue
      }
      // Approximate sensitivity
      const waccAdj = (baseWACC - w) * 0.05
      const tgrAdj = (tgr - baseTGR) * 0.03
      const adjValue = baseIV * (1 + waccAdj + tgrAdj)
      row.push(Math.max(adjValue, 0.01))
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
 * Calculate Valuation Verdict
 * @param {number} currentPrice - Current market price
 * @param {number} intrinsicValue - DCF intrinsic value
 * @returns {Object} Verdict with label and color
 */
export function getCleanVerdict(currentPrice, intrinsicValue) {
  if (!currentPrice || !intrinsicValue || currentPrice <= 0) {
    return { label: 'UNKNOWN', color: 'text-gray-500', spread: 0 }
  }
  const spread = ((intrinsicValue - currentPrice) / currentPrice) * 100

  if (spread > 10) return { label: 'UNDERVALUED', color: 'text-green-600', spread: Number(spread.toFixed(2)) }
  if (spread < -10) return { label: 'OVERVALUED', color: 'text-red-600', spread: Number(spread.toFixed(2)) }
  return { label: 'FAIR VALUE', color: 'text-yellow-600', spread: Number(spread.toFixed(2)) }
}

/**
 * CLEAN DCF VALUATION - Main function
 * Complete DCF with clean, proper formulas + 3 Key Refinements
 *
 * REFINEMENTS:
 * 1. Target Capital Structure WACC (70/30 default)
 * 2. Linked Depreciation (PP&E/CapEx based)
 * 3. Historical NWC Rate (company-specific)
 *
 * @param {Object} stockData - Stock financial data
 * @returns {Object} Complete DCF output
 */
export function calculateCleanDCF(stockData) {
  if (!stockData) return null

  // Normalize inputs
  const revenue = normalizeToAbsolute(stockData.revenue) || 0
  const ebitda = normalizeToAbsolute(stockData.ebitda) || 0
  const totalDebt = normalizeToAbsolute(stockData.totalDebt) || 0
  const totalCash = normalizeToAbsolute(stockData.totalCash) || 0
  const marketCap = normalizeToAbsolute(stockData.marketCap) || 0
  const sharesOutstanding = stockData.sharesOutstanding || 1000000

  if (revenue <= 0) {
    return null
  }

  // Calculate base margin
  const baseEbitdaMargin = revenue > 0 ? (ebitda / revenue) * 100 : 20

  // STEP 1: Calculate WACC with TARGET CAPITAL STRUCTURE (not market weights)
  const wacc = calculateProperWACC({
    beta: stockData.beta || 1.0,
    marketCap,
    totalDebt,
    interestExpense: stockData.interestExpense,
    taxRate: 21,
    riskFreeRate: 7.0, // India 10Y
    marketRiskPremium: 5.5,
    sector: stockData.sector, // Use sector-based structure dynamically
  })

  // STEP 2: Clean TGR (conservative)
  const tgr = calculateCleanTGR({
    gdpGrowth: 6.0,
    inflation: 5.0,
    realGrowth: 1.5,
  })

  // STEP 3: Calculate Excess Cash (Operating vs Non-Operating separation)
  const excessCash = calculateExcessCash(totalCash, revenue, 0.02) // 2% operating cash
  const operatingCash = totalCash - excessCash

  // STEP 4: Historical NWC Rate (company-specific or sector-based)
  const nwcInfo = calculateNWCRate({
    currentAssets: stockData.currentAssets,
    currentLiabilities: stockData.currentLiabilities,
    revenue,
    cash: totalCash,
    shortTermDebt: stockData.shortTermDebt,
    historicalNWCRate: stockData.historicalNWCRate,
    sector: stockData.sector,
  })

  // STEP 5: 5-Year Projections with Terminal Fade
  // Depreciation params - link to PP&E/CapEx history
  const depreciationParams = {
    netPPE: stockData.netPPE,
    grossPPE: stockData.grossPPE,
    accumulatedDepreciation: stockData.accumulatedDepreciation,
    historicalCapex: stockData.historicalCapex,
    assetLife: stockData.assetLife || 10,
    revenue,
  }

  // NWC params - company-specific rate
  const nwcParams = {
    currentAssets: stockData.currentAssets,
    currentLiabilities: stockData.currentLiabilities,
    cash: totalCash,
    shortTermDebt: stockData.shortTermDebt,
    historicalNWCRate: nwcInfo.nwcRate,
    sector: stockData.sector,
  }

  const projections = calculateCleanProjections({
    baseRevenue: revenue,
    baseEbitdaMargin,
    year1Growth: 15,
    year5Growth: 6,
    terminalGrowth: tgr,
    taxRate: 21,
    capexRate: 0.08,
    nwcParams, // NEW: Pass NWC params
    depreciationParams, // NEW: Pass depreciation params
  })

  // STEP 6: Calculate PV of FCFs with Mid-Year Discounting
  let pvFCFs = 0
  projections.forEach((p) => {
    // Professional: Mid-year discounting (cash flows occur throughout year)
    p.pv = p.fcf * calculateMidYearDiscountFactor(p.year, wacc)
    pvFCFs += p.pv
  })

  // STEP 7: Terminal Value (Gordon ONLY)
  const finalFCF = projections[4].fcf
  const terminalValue = calculateCleanTerminalValue(finalFCF, wacc, tgr)
  const pvTerminalValue = calculatePVTerminalValue(terminalValue, wacc, 5)

  // STEP 8: Enterprise Value
  const enterpriseValue = pvFCFs + pvTerminalValue

  // STEP 9: Equity Value (clean bridge - NO SOTP, NO FLOOR)
  // Use EXCESS CASH only (operating cash is part of working capital)
  const equityValue = calculateCleanEquityValue(enterpriseValue, excessCash, totalDebt)

  // STEP 10: Intrinsic Value Per Share
  const intrinsicValuePerShare = calculateIntrinsicValuePerShare(equityValue, sharesOutstanding)

  // STEP 11: Calculate ROIC for quality validation (use BOOK EQUITY, not market cap)
  const year5NOPAT = projections[4].nopat
  const bookEquity = stockData.bookEquity || stockData.totalEquity || marketCap * 0.5 // Fallback
  const roic = calculateROIC(year5NOPAT, totalDebt, bookEquity, excessCash)

  // STEP 12: Calculate Reinvestment Rate (links growth to capital)
  const year5Growth = projections[4].growthRate
  const reinvestmentRate = calculateReinvestmentRate(year5Growth, roic)

  // STEP 13: Sensitivity Analysis
  const sensitivity = calculateCleanSensitivity(intrinsicValuePerShare, wacc, tgr)

  // STEP 14: Professional Sanity Checks with Advanced Diagnostics
  const tvAsPctOfEV = (pvTerminalValue / enterpriseValue) * 100
  const sanityChecks = runAdvancedSanityChecks({
    wacc,
    tgr,
    terminalValuePct: tvAsPctOfEV,
    roic,
    year5Growth,
    revenue,
    bookEquity,
  })

  // STEP 15: Verdict
  const currentPrice = stockData.price || 0
  const verdict = getCleanVerdict(currentPrice, intrinsicValuePerShare)

  return {
    wacc: Number(wacc.toFixed(2)),
    tgr: Number(tgr.toFixed(2)),
    assumptions: {
      wacc,
      terminalGrowthRate: tgr,
      taxRate: 21,
      revenueGrowthRates: projections.map(p => Number(p.growthRate.toFixed(2))),
      ebitdaMargins: projections.map(p => Number(p.ebitdaMargin.toFixed(2))),
      // Key refinements
      targetCapitalStructure: { equityPct: 70, debtPct: 30 },
      nwcRate: Number(nwcInfo.nwcRate.toFixed(4)),
      nwcSource: nwcInfo.source,
      nwcExplanation: nwcInfo.explanation,
    },
    projections: projections.map(p => ({
      year: p.year,
      revenue: Number(p.revenue.toFixed(0)),
      ebitda: Number(p.ebitda.toFixed(0)),
      ebit: Number(p.ebit.toFixed(0)),
      nopat: Number(p.nopat.toFixed(0)),
      capex: Number(p.capex.toFixed(0)),
      nwcChange: Number(p.nwcChange.toFixed(0)),
      fcf: Number(p.fcf.toFixed(0)),
      pv: Number(p.pv.toFixed(0)),
      revenueGrowth: Number(p.growthRate.toFixed(2)),
      ebitdaMargin: Number(p.ebitdaMargin.toFixed(2)),
      // Enhanced metrics
      depreciation: Number(p.depreciation.toFixed(0)),
      nwcExplanation: p.nwcExplanation,
      depreciationExplanation: p.depreciationExplanation,
    })),
    pvFCFs: Number(pvFCFs.toFixed(0)),
    terminalValue: Number(terminalValue.toFixed(0)),
    pvTerminalValue: Number(pvTerminalValue.toFixed(0)),
    enterpriseValue: Number(enterpriseValue.toFixed(0)),
    equityValue: Number(equityValue.toFixed(0)),
    intrinsicValuePerShare: Number(intrinsicValuePerShare.toFixed(2)),
    currentPrice: Number(currentPrice.toFixed(2)),
    upside: verdict.spread,
    spreadPercentage: verdict.spread,
    dcfRating: verdict.label,
    verdict,
    sensitivityTable: sensitivity,
    // Cash breakdown
    totalCash: Number(totalCash.toFixed(0)),
    excessCash: Number(excessCash.toFixed(0)),
    operatingCash: Number(operatingCash.toFixed(0)),
    totalDebt: Number(totalDebt.toFixed(0)),
    // Professional metrics (v2.0)
    roic: Number(roic.toFixed(2)),
    roicAssessment: roic > wacc ? 'VALUE_CREATING' : roic > 0 ? 'VALUE_DESTROYING' : 'UNKNOWN',
    reinvestmentRate: Number(reinvestmentRate.toFixed(2)),
    terminalValuePct: Number(tvAsPctOfEV.toFixed(1)),
    // Advanced Diagnostics
    sanityChecks,
    diagnostics: sanityChecks.diagnostics || [],
    flags: sanityChecks.flags || {},
    trustScore: sanityChecks.trustScore || 0,
    qualityRating: sanityChecks.qualityRating || 'UNKNOWN',
    hasWarnings: !sanityChecks.allPassed,
    warningCount: sanityChecks.warningCount,
    hasCritical: sanityChecks.flags?.hasCritical || false,
  }
}

/**
 * Sector-Specific Growth Ceilings
 * Prevents unrealistic projections by sector
 */
export const SECTOR_GROWTH_CEILINGS = {
  tech: { maxYear1: 25, maxYear5: 12, rationale: 'High growth but maturation risk' },
  software: { maxYear1: 28, maxYear5: 12, rationale: 'SaaS recurring revenue supports growth' },
  saas: { maxYear1: 30, maxYear5: 15, rationale: 'Hyper-growth early stage' },
  utility: { maxYear1: 8, maxYear5: 5, rationale: 'Regulated returns, slow growth' },
  power: { maxYear1: 10, maxYear5: 5, rationale: 'Infrastructure replacement cycle' },
  manufacturing: { maxYear1: 15, maxYear5: 6, rationale: 'GDP-linked, cyclical' },
  industrial: { maxYear1: 12, maxYear5: 5, rationale: 'Capex sensitive' },
  chemical: { maxYear1: 12, maxYear5: 5, rationale: 'Commodity exposure' },
  financial: { maxYear1: 12, maxYear5: 7, rationale: 'Balance sheet constraints' },
  bank: { maxYear1: 12, maxYear5: 6, rationale: 'Credit cycle dependent' },
  insurance: { maxYear1: 10, maxYear5: 5, rationale: 'Premium growth limited' },
  realEstate: { maxYear1: 15, maxYear5: 5, rationale: 'Property cycle' },
  reit: { maxYear1: 8, maxYear5: 3, rationale: 'Distribution focused' },
  infrastructure: { maxYear1: 10, maxYear5: 6, rationale: 'Long-term contracts' },
  renewable: { maxYear1: 18, maxYear5: 10, rationale: 'Policy and capex dependent' },
  retail: { maxYear1: 15, maxYear5: 6, rationale: 'Consumption linked' },
  ecommerce: { maxYear1: 25, maxYear5: 12, rationale: 'Market share gains' },
  consumer: { maxYear1: 12, maxYear5: 6, rationale: 'GDP-linked' },
  fmcg: { maxYear1: 12, maxYear5: 6, rationale: 'Volume + price growth' },
  healthcare: { maxYear1: 15, maxYear5: 8, rationale: 'Demographics support' },
  pharma: { maxYear1: 18, maxYear5: 8, rationale: 'Patent cliff risk' },
  biotech: { maxYear1: 30, maxYear5: 15, rationale: 'Binary outcomes' },
  energy: { maxYear1: 10, maxYear5: 5, rationale: 'Commodity prices' },
  oil: { maxYear1: 10, maxYear5: 4, rationale: 'Energy transition' },
  mining: { maxYear1: 12, maxYear5: 4, rationale: 'Super-cycle dependent' },
  telecom: { maxYear1: 8, maxYear5: 4, rationale: 'Market saturation' },
  auto: { maxYear1: 12, maxYear5: 5, rationale: 'Replacement cycle' },
  aviation: { maxYear1: 15, maxYear5: 8, rationale: 'Leverage to GDP' },
  logistics: { maxYear1: 15, maxYear5: 8, rationale: 'E-commerce tailwind' },
  media: { maxYear1: 12, maxYear5: 6, rationale: 'Digital transition' },
  entertainment: { maxYear1: 15, maxYear5: 8, rationale: 'Hit-driven' },
  default: { maxYear1: 15, maxYear5: 6, rationale: 'Balanced assumptions' },
}

/**
 * Get sector-appropriate growth ceiling
 * @param {string} sector - Industry sector
 * @returns {Object} Max growth {year1, year5, rationale}
 */
export function getSectorGrowthCeiling(sector = '') {
  const sectorLower = sector.toLowerCase().replace(/\s+/g, '')
  const keys = Object.keys(SECTOR_GROWTH_CEILINGS).filter(k => k !== 'default')

  // First: exact match
  if (SECTOR_GROWTH_CEILINGS[sectorLower]) {
    return SECTOR_GROWTH_CEILINGS[sectorLower]
  }

  // Second: partial match
  for (const key of keys) {
    if (sectorLower.includes(key) || key.includes(sectorLower)) {
      return SECTOR_GROWTH_CEILINGS[key]
    }
  }

  return SECTOR_GROWTH_CEILINGS.default
}

/**
 * Apply correlated scenario adjustments
 * Economically links growth, beta, and margins
 * @param {Object} stockData - Original stock data
 * @param {string} scenario - bear|base|bull
 * @returns {Object} Adjusted stock data
 */
export function applyScenarioAdjustments(stockData, scenario = 'base') {
  if (scenario === 'base') return stockData

  const { revenue, ebitda, beta } = stockData
  const baseMargin = revenue > 0 ? (ebitda / revenue) * 100 : 20

  // Scenario correlation matrix
  const adjustments = {
    bear: {
      // Growth slowdown → margin compression → higher risk
      growthFactor: 0.70, // -30%
      marginFactor: 0.90, // -10% relative (spread widens)
      marginDelta: -2, // Absolute -2%
      betaFactor: 1.30, // +30% risk
      betaFloor: 1.0, // Minimum beta in bear case
      // Correlation: Lower growth → more competition → lower margins → higher business risk
      justification: 'Bear: Slowdown crushes margins, risk rises',
    },
    bull: {
      // Growth acceleration → operating leverage → lower risk
      growthFactor: 1.25, // +25%
      marginFactor: 1.05, // +5% relative (operating leverage)
      marginDelta: +2, // Absolute +2%
      betaFactor: 0.85, // -15% risk (scale = stability)
      betaFloor: 0.6, // Cap minimum beta
      // Correlation: Higher growth → operating leverage → better margins → lower risk
      justification: 'Bull: Operating leverage drives margins, risk falls with scale',
    },
  }

  const adj = adjustments[scenario]

  // Calculate correlated adjustments
  const adjustedGrowth = (stockData.year1Growth || 15) * adj.growthFactor

  // Margin adjustment: Base × factor + absolute delta
  // Mechanism: Growth → Operating leverage
  const adjustedMargin = baseMargin * adj.marginFactor + adj.marginDelta

  // Beta adjustment: Risk linked to growth volatility
  // Mechanism: Growth → Uncertainty → Beta
  const adjustedBeta = Math.max(
    (beta || 1) * adj.betaFactor,
    adj.betaFloor
  )

  return {
    ...stockData,
    year1Growth: adjustedGrowth,
    year1GrowthOverride: adjustedGrowth, // Override base projection
    ebitdaMargin: adjustedMargin,
    beta: adjustedBeta,
    scenario: scenario,
    scenarioJustification: adj.justification,
  }
}

/**
 * STEP 16: ADVANCED FEATURE 2 - MULTIPLE SCENARIO MODELING v2.0
 * Run Bear, Base, and Bull cases with ECONOMICALLY CORRELATED adjustments
 * Correlation: Growth ↔ Margins ↔ Beta (all move together logically)
 *
 * @param {Object} stockData - Stock financial data
 * @returns {Object} Three scenario outputs with correlations
 */
export function calculateScenarioDCF(stockData) {
  if (!stockData) return null

  // Apply sector-specific growth ceilings
  const growthCeiling = getSectorGrowthCeiling(stockData.sector)

  // Base case
  const baseCase = calculateCleanDCF(stockData)

  // Bear case: Economic correlation
  // Low growth → ↓Margins + ↑Beta
  const bearAdjusted = applyScenarioAdjustments(stockData, 'bear')
  const bearCase = calculateCleanDCF(bearAdjusted)

  // Bull case: Economic correlation
  // High growth → ↑Margins + ↓Beta
  const bullAdjusted = applyScenarioAdjustments(stockData, 'bull')
  const bullCase = calculateCleanDCF(bullAdjusted)

  return {
    bear: bearCase,
    base: baseCase,
    bull: bullCase,
    summary: {
      bearIV: bearCase?.intrinsicValuePerShare || 0,
      baseIV: baseCase?.intrinsicValuePerShare || 0,
      bullIV: bullCase?.intrinsicValuePerShare || 0,
      currentPrice: stockData.price || 0,
      // Probability-weighted estimate (conservative: 40/40/20)
      weightedIV: (
        (bearCase?.intrinsicValuePerShare || 0) * 0.30 +
        (baseCase?.intrinsicValuePerShare || 0) * 0.50 +
        (bullCase?.intrinsicValuePerShare || 0) * 0.20
      ),
      upsideToBear: bearCase?.intrinsicValuePerShare
        ? ((bearCase.intrinsicValuePerShare - stockData.price) / stockData.price * 100).toFixed(1)
        : 0,
      upsideToBase: baseCase?.intrinsicValuePerShare
        ? ((baseCase.intrinsicValuePerShare - stockData.price) / stockData.price * 100).toFixed(1)
        : 0,
      upsideToBull: bullCase?.intrinsicValuePerShare
        ? ((bullCase.intrinsicValuePerShare - stockData.price) / stockData.price * 100).toFixed(1)
        : 0,
    },
  }
}

/**
 * STEP 17: ADVANCED FEATURE 3 - REVERSE DCF
 * Answer: "What growth is the market pricing in?"
 * Solves for implied growth rate given current stock price
 *
 * This is how professionals actually think about valuation
 *
 * @param {Object} stockData - Stock financial data
 * @param {number} targetPrice - Price to solve for (usually currentPrice)
 * @returns {Object} Implied growth metrics
 */
export function calculateReverseDCF(stockData, targetPrice = null) {
  if (!stockData) return null

  const priceToSolve = targetPrice || stockData.price || 0
  if (priceToSolve <= 0) return null

  // Normalize inputs
  const revenue = normalizeToAbsolute(stockData.revenue) || 0
  const ebitda = normalizeToAbsolute(stockData.ebitda) || 0
  const totalDebt = normalizeToAbsolute(stockData.totalDebt) || 0
  const totalCash = normalizeToAbsolute(stockData.totalCash) || 0
  const sharesOutstanding = stockData.sharesOutstanding || 1000000

  if (revenue <= 0 || sharesOutstanding <= 0) return null

  // Target equity value implied by current price
  const targetEquityValue = priceToSolve * sharesOutstanding

  // Calculate excess cash
  const excessCash = calculateExcessCash(totalCash, revenue, 0.02)

  // Implied enterprise value
  const targetEV = targetEquityValue - excessCash + totalDebt

  // WACC (use sector-based dynamic structure from SECTOR_CAPITAL_STRUCTURES)
  const targetStructure = getSectorCapitalStructure(stockData.sector)

  const wacc = calculateProperWACC({
    beta: stockData.beta || 1.0,
    marketCap: stockData.marketCap,
    totalDebt,
    interestExpense: stockData.interestExpense,
    taxRate: 21,
    riskFreeRate: 7.0,
    marketRiskPremium: 5.5,
    targetStructure,
  })

  // TGR
  const tgr = calculateCleanTGR({
    gdpGrowth: 6.0,
    inflation: 5.0,
    realGrowth: 1.5,
  })

  // Binary search for implied Year 1 growth rate
  // that produces target EV
  let low = -10
  let high = 50
  let mid = 20
  let bestGrowth = 20
  let bestDiff = Infinity

  const baseEbitdaMargin = revenue > 0 ? (ebitda / revenue) * 100 : 20
  const nwcInfo = calculateNWCRate({
    currentAssets: stockData.currentAssets,
    currentLiabilities: stockData.currentLiabilities,
    revenue,
    cash: totalCash,
    shortTermDebt: stockData.shortTermDebt,
    historicalNWCRate: stockData.historicalNWCRate,
    sector: stockData.sector,
  })

  const depreciationParams = {
    netPPE: stockData.netPPE,
    grossPPE: stockData.grossPPE,
    accumulatedDepreciation: stockData.accumulatedDepreciation,
    historicalCapex: stockData.historicalCapex,
    assetLife: stockData.assetLife || 10,
    revenue,
  }

  // Iterate to find implied growth
  for (let i = 0; i < 25; i++) {
    mid = (low + high) / 2

    const projections = calculateCleanProjections({
      baseRevenue: revenue,
      baseEbitdaMargin,
      year1Growth: mid,
      year5Growth: Math.max(tgr + 3, 6),
      terminalGrowth: tgr,
      taxRate: 21,
      capexRate: 0.08,
      nwcParams: {
        currentAssets: stockData.currentAssets,
        currentLiabilities: stockData.currentLiabilities,
        historicalNWCRate: nwcInfo.nwcRate,
        revenue,
      },
      depreciationParams,
    })

    let pvFCFs = 0
    projections.forEach((p) => {
      pvFCFs += p.fcf * calculateMidYearDiscountFactor(p.year, wacc)
    })

    const finalFCF = projections[4].fcf
    const terminalValue = calculateCleanTerminalValue(finalFCF, wacc, tgr)
    const pvTerminal = calculatePVTerminalValue(terminalValue, wacc, 5)
    const calculatedEV = pvFCFs + pvTerminal

    const diff = Math.abs(calculatedEV - targetEV)
    if (diff < bestDiff) {
      bestDiff = diff
      bestGrowth = mid
    }

    if (calculatedEV > targetEV) {
      high = mid
    } else {
      low = mid
    }
  }

  // STABILITY GUARDS for Reverse DCF

  // Guard 1: Ensure TGR < WACC (Gordon Growth condition)
  if (tgr >= wacc - 1) {
    return {
      error: 'INVALID_ASSUMPTIONS',
      message: `TGR (${tgr}%) too close to WACC (${wacc}%). Gordon Growth undefined.`,
      currentPrice: priceToSolve,
      tgr,
      wacc,
      margin: (wacc - tgr).toFixed(2),
      recommendation: 'Check beta assumption or sector classification',
    }
  }

  // Guard 2: Sector-specific growth ceiling
  const sectorCeiling = getSectorGrowthCeiling(stockData.sector)
  const clampedGrowth = Math.max(0, Math.min(bestGrowth, sectorCeiling.maxYear1))

  // Guard 3: Convergence check
  const convergenceTolerance = 0.005 // 0.5% of EV
  const converged = bestDiff / targetEV < convergenceTolerance

  // Guard 4: Growth bounds [0%, 25%] sanity check
  if (bestGrowth > 25) {
    return {
      error: 'GROWTH_TOO_HIGH',
      message: `Implied growth ${bestGrowth.toFixed(1)}% exceeds 25% ceiling. Unrealistic assumption.`,
      currentPrice: priceToSolve,
      impliedGrowth: bestGrowth,
      maxAllowed: 25,
      sectorCeiling: sectorCeiling.maxYear1,
      verdict: 'OVEROPTIMISTIC',
      conclusion: 'Market is pricing in unrealistic growth',
    }
  }

  if (bestGrowth < 0) {
    return {
      error: 'GROWTH_NEGATIVE',
      message: `Implied growth ${bestGrowth.toFixed(1)}% is negative. Stock may be undervalued or declining.`,
      currentPrice: priceToSolve,
      impliedGrowth: bestGrowth,
      verdict: 'DECLINING_BUSINESS',
      conclusion: 'Market expects business to shrink',
    }
  }

  // Use clamped growth for final interpretation
  const finalGrowth = converged ? bestGrowth : clampedGrowth

  // Analyze result
  const impliedYear1Growth = bestGrowth
  const impliedYear5Growth = Math.max(tgr + 3, 6)
  const impliedCagr5Year = Math.pow(1 + impliedYear1Growth/100, 1) * Math.pow(1 + (impliedYear5Growth-impliedYear1Growth)/400, 4) - 1

  // Comparison with base case projections
  const baseProjections = calculateCleanProjections({
    baseRevenue: revenue,
    baseEbitdaMargin,
    year1Growth: 15,
    year5Growth: 6,
    terminalGrowth: tgr,
    taxRate: 21,
    capexRate: 0.08,
    nwcParams: {
      currentAssets: stockData.currentAssets,
      currentLiabilities: stockData.currentLiabilities,
      historicalNWCRate: nwcInfo.nwcRate,
      revenue,
    },
    depreciationParams,
  })
  const baseYear1Growth = 15

  return {
    currentPrice: priceToSolve,
    targetEquityValue,
    targetEnterpriseValue: targetEV,
    wacc,
    tgr,
    impliedAssumptions: {
      year1Growth: Number(impliedYear1Growth.toFixed(2)),
      year5Growth: Number(impliedYear5Growth.toFixed(2)),
      capexRate: 8,
      taxRate: 21,
      ebitdaMargin: baseEbitdaMargin,
    },
    comparison: {
      baseCaseGrowth: baseYear1Growth,
      impliedGrowth: Number(impliedYear1Growth.toFixed(2)),
      growthGap: Number((impliedYear1Growth - baseYear1Growth).toFixed(2)),
    },
    interpretation: {
      verdict: impliedYear1Growth > 20
        ? 'OVEROPTIMISTIC'
        : impliedYear1Growth > 12
        ? 'AGGRESSIVE'
        : impliedYear1Growth > 6
        ? 'REASONABLE'
        : 'CONSERVATIVE',
      conclusion: impliedYear1Growth > 20
        ? `Market pricing in ${impliedYear1Growth.toFixed(1)}% growth - likely overly optimistic`
        : impliedYear1Growth > baseYear1Growth
        ? `Market pricing in ${impliedYear1Growth.toFixed(1)}% vs base ${baseYear1Growth}% - expects higher growth`
        : `Market pricing in ${impliedYear1Growth.toFixed(1)}% vs base ${baseYear1Growth}% - reasonable or cheap`,
    },
    targetStructure, // Show which structure was used
  }
}


// =========================================
// ELITE TIER DCF UPGRADES v14.0
// 5 Sophisticated enhancements for top-tier valuation
// =========================================

// UPGRADE 1: Size Premium and Enhanced WACC
export const SIZE_PREMIUM_TABLE = [
  { min: 0, max: 500, premium: 2.5 },
  { min: 500, max: 2000, premium: 1.8 },
  { min: 2000, max: 10000, premium: 1.2 },
  { min: 10000, max: 50000, premium: 0.5 },
  { min: 50000, max: Infinity, premium: 0.0 },
]

export function calculateSizePremium(marketCap) {
  if (!marketCap || marketCap <= 0) return 2.0
  const marketCapCr = marketCap / 1e7
  for (const bracket of SIZE_PREMIUM_TABLE) {
    if (marketCapCr >= bracket.min && marketCapCr < bracket.max) {
      return bracket.premium
    }
  }
  return 0.0
}

export function calculateEliteWACC({
  beta = 1.0,
  marketCap,
  totalDebt = 0,
  interestExpense = 0,
  taxRate = 25,
  riskFreeRate = 7.0,
  marketRiskPremium = 5.5,
  countryRiskPremium = 0.5,
  projectionYear = 0,
  targetStructure = null,
  sector = '',
}) {
  const structure = targetStructure || getSectorCapitalStructure(sector)
  const E_pct = structure.equityPct / 100
  const D_pct = structure.debtPct / 100
  const sizePremium = calculateSizePremium(marketCap)
  const fadedBeta = projectionYear > 0 ? beta * (1 - Math.min(projectionYear, 10) * 0.02) : beta
  const Ke = riskFreeRate + fadedBeta * marketRiskPremium + sizePremium + countryRiskPremium
  const Kd = D_pct > 0 && interestExpense && totalDebt ? (interestExpense / totalDebt) * 100 : 7.0
  const wacc = E_pct * Ke + D_pct * Kd * (1 - taxRate / 100)
  return { wacc, Ke, Kd, sizePremium, fadedBeta }
}

// UPGRADE 2: Elite Reinvestment Logic
export function calculateEliteReinvestment({ revenue, revenueGrowth, roic, nopat, sector = '' }) {
  if (!roic || roic <= 0 || !nopat) {
    return { reinvestmentRate: 0.5, capex: revenue * 0.05, nwcChange: revenue * (revenueGrowth / 100) * 0.03, consistency: false }
  }
  const growthRate = revenueGrowth / 100
  const roicDecimal = roic / 100
  const reinvestmentRate = growthRate / roicDecimal
  const reinvestmentAmount = nopat * reinvestmentRate
  const sectorLower = sector.toLowerCase()
  const capexIntensity = sectorLower.includes('tech') ? 0.05 : sectorLower.includes('utility') ? 0.12 : 0.08
  const nwcIntensity = sectorLower.includes('retail') ? 0.02 : sectorLower.includes('manufacturing') ? 0.08 : 0.05
  const revenueChange = revenue * growthRate
  const capex = revenue * capexIntensity
  const nwcChange = revenueChange * nwcIntensity
  const totalComponents = capex + nwcChange
  const consistency = Math.abs(totalComponents - reinvestmentAmount) < (nopat * 0.15)
  return { reinvestmentRate, reinvestmentAmount, capex, nwcChange, consistency }
}

// UPGRADE 3: CAP (Competitive Advantage Period)
export const MOAT_RATINGS = {
  WIDE: { capYears: 15, fadeStart: 10, description: 'Strong moat' },
  MODERATE: { capYears: 10, fadeStart: 7, description: 'Moderate moat' },
  NARROW: { capYears: 7, fadeStart: 5, description: 'Weak moat' },
  NONE: { capYears: 5, fadeStart: 3, description: 'No moat' },
}

export function getMoatParameters(roic = 0, roce = 0, sector = '') {
  if (roic > 20 || roce > 25) return { ...MOAT_RATINGS.WIDE, rating: 'WIDE' }
  if (roic > 12 || roce > 15) return { ...MOAT_RATINGS.MODERATE, rating: 'MODERATE' }
  if (roic > 8 || roce > 10) return { ...MOAT_RATINGS.NARROW, rating: 'NARROW' }
  return { ...MOAT_RATINGS.NONE, rating: 'NONE' }
}

// UPGRADE 4: Extended 10-Year Projections
export function calculateExtendedProjections({ baseRevenue, baseEbitdaMargin, moatRating = 'MODERATE', roic = 12, taxRate = 25, sector = '' }) {
  const cap = MOAT_RATINGS[moatRating] || MOAT_RATINGS.MODERATE
  const projections = []
  let prevRevenue = baseRevenue
  const highGrowth = 12
  const fadeGrowth = 7
  const terminalGrowth = 3.5

  for (let i = 0; i < cap.fadeStart; i++) {
    const growthDecay = (highGrowth - fadeGrowth) / cap.fadeStart
    const growthRate = highGrowth - (i * growthDecay)
    const revenue = prevRevenue * (1 + growthRate / 100)
    const ebitdaMargin = baseEbitdaMargin + (i / cap.fadeStart) * 3
    const ebitda = revenue * ebitdaMargin / 100
    const depreciation = ebitda * 0.15
    const ebit = ebitda - depreciation
    const nopat = ebit * (1 - taxRate / 100)
    const reinvestment = calculateEliteReinvestment({ revenue, revenueGrowth: growthRate, roic, nopat, sector })
    const fcf = nopat + depreciation - reinvestment.capex - reinvestment.nwcChange
    projections.push({ year: i + 1, revenue, ebitda, nopat, fcf, growthRate, phase: 'MOAT', reinvestmentRate: reinvestment.reinvestmentRate })
    prevRevenue = revenue
  }

  for (let i = cap.fadeStart; i < cap.capYears; i++) {
    const fadeProgress = (i - cap.fadeStart) / (cap.capYears - cap.fadeStart)
    const growthRate = fadeGrowth * Math.pow(terminalGrowth / fadeGrowth, fadeProgress)
    const revenue = prevRevenue * (1 + growthRate / 100)
    const ebitdaMargin = baseEbitdaMargin + 3
    const ebitda = revenue * ebitdaMargin / 100
    const depreciation = ebitda * 0.15
    const ebit = ebitda - depreciation
    const nopat = ebit * (1 - taxRate / 100)
    const reinvestment = calculateEliteReinvestment({ revenue, revenueGrowth: growthRate, roic, nopat, sector })
    let capex = reinvestment.capex
    if (i === cap.capYears - 1) capex = depreciation
    const fcf = nopat + depreciation - capex - reinvestment.nwcChange
    projections.push({ year: i + 1, revenue, ebitda, nopat, fcf, growthRate, phase: 'FADE', reinvestmentRate: reinvestment.reinvestmentRate })
    prevRevenue = revenue
  }

  return { projections, capYears: cap.capYears, moatRating }
}

// UPGRADE 5: Smart Beta
export function calculateSmartBeta({ leveredBeta = 1.2, currentDebt = 1000, currentEquity = 5000, targetDebt = 1000, targetEquity = 5000, taxRate = 25, projectionYear = 0 }) {
  const currentD_E = currentEquity > 0 ? currentDebt / currentEquity : 0.2
  const targetD_E = targetEquity > 0 ? targetDebt / targetEquity : 0.2
  const taxFactor = 1 - taxRate / 100
  const unleveredBeta = leveredBeta / (1 + taxFactor * currentD_E)
  const fadeFactor = projectionYear > 0 ? Math.min(projectionYear / 10, 1.0) : 0
  const fadedBeta = unleveredBeta * (1 - fadeFactor * 0.3) + 1.0 * (fadeFactor * 0.3)
  const releveredBeta = fadedBeta * (1 + taxFactor * targetD_E)
  return { original: leveredBeta, unlevered: unleveredBeta, faded: fadedBeta, final: releveredBeta }
}

export function calculateEliteDCF(stockData) {
  if (!stockData) return null
  const revenue = normalizeToAbsolute(stockData.revenue) || 0
  const ebitda = normalizeToAbsolute(stockData.ebitda) || 0
  const totalDebt = normalizeToAbsolute(stockData.totalDebt) || 0
  const totalCash = normalizeToAbsolute(stockData.totalCash) || 0
  const marketCap = normalizeToAbsolute(stockData.marketCap) || 0
  const sharesOutstanding = stockData.sharesOutstanding || 1000000
  if (revenue <= 0) return null

  const moat = getMoatParameters(stockData.roic, stockData.roce, stockData.sector)
  const projectionResult = calculateExtendedProjections({ baseRevenue: revenue, baseEbitdaMargin: revenue > 0 ? (ebitda / revenue) * 100 : 20, moatRating: moat.rating, roic: stockData.roic || 12, sector: stockData.sector })
  const { projections, capYears } = projectionResult

  const waccResult = calculateEliteWACC({ beta: stockData.beta || 1.0, marketCap, totalDebt, taxRate: 25, targetStructure: null, sector: stockData.sector })
  const tgr = calculateCleanTGR({})

  let pvFCFs = 0
  projections.forEach((p, i) => {
    const yearWacc = calculateEliteWACC({ beta: stockData.beta || 1.0, marketCap, totalDebt, projectionYear: i + 1, targetStructure: null, sector: stockData.sector }).wacc
    p.pv = p.fcf * calculateMidYearDiscountFactor(p.year, yearWacc)
    pvFCFs += p.pv
  })

  const finalFCF = projections[projections.length - 1].fcf
  const terminalValue = calculateCleanTerminalValue(finalFCF, waccResult.wacc, tgr)
  const pvTerminalValue = calculatePVTerminalValue(terminalValue, waccResult.wacc, capYears)
  const enterpriseValue = pvFCFs + pvTerminalValue
  const excessCash = calculateExcessCash(totalCash, revenue, 0.02)
  const equityValue = calculateCleanEquityValue(enterpriseValue, excessCash, totalDebt)
  const intrinsicValuePerShare = calculateIntrinsicValuePerShare(equityValue, sharesOutstanding)
  const tvAsPctOfEV = (pvTerminalValue / enterpriseValue) * 100

  return {
    intrinsicValuePerShare: Number(intrinsicValuePerShare.toFixed(2)),
    enterpriseValue: Number(enterpriseValue.toFixed(0)),
    equityValue: Number(equityValue.toFixed(0)),
    pvFCFs: Number(pvFCFs.toFixed(0)),
    terminalValue: Number(terminalValue.toFixed(0)),
    pvTerminalValue: Number(pvTerminalValue.toFixed(0)),
    terminalValuePct: Number(tvAsPctOfEV.toFixed(1)),
    targetTVPct: 70,
    tvTargetMet: tvAsPctOfEV < 75,
    capYears,
    moatRating: moat.rating,
    projections: projections.map(p => ({ year: p.year, revenue: Number(p.revenue.toFixed(0)), fcf: Number(p.fcf.toFixed(0)), growthRate: Number(p.growthRate.toFixed(2)), phase: p.phase })),
    wacc: Number(waccResult.wacc.toFixed(2)),
    sizePremium: waccResult.sizePremium,
    fadedBeta: Number(waccResult.fadedBeta.toFixed(3)),
  }
}



export function calculateDilutedShares({ baseShares, esopDilution = 0, equityIssuance = 0, buybacks = 0, years = 10, price = 100 }) {
  const shares = [baseShares]
  for (let i = 1; i <= years; i++) {
    let currentShares = shares[i - 1]
    const esopShares = currentShares * (esopDilution / 100)
    currentShares += esopShares
    if (equityIssuance > 0) {
      const issuanceAmount = (baseShares * price) * (equityIssuance / 100)
      currentShares += issuanceAmount / price
    }
    if (buybacks > 0) {
      const buybackAmount = (baseShares * price) * (buybacks / 100)
      currentShares = Math.max(currentShares - buybackAmount / price, baseShares * 0.5)
    }
    shares.push(currentShares)
  }
  return { yearByYear: shares.map((s, i) => ({ year: i, shares: Math.round(s) })),
    finalShares: Math.round(shares[shares.length - 1]),
    dilutionFactor: shares[shares.length - 1] / baseShares }
}

export function calculateCyclicalAdjustment({ currentMargin = 15, avgMargin = 15, cyclePosition = 0, sector = '' }) {
  const isCyclical = ['metal', 'mining', 'bank', 'real', 'cement', 'auto', 'infra'].some(s =>
    sector.toLowerCase().includes(s))
  if (!isCyclical) return { adjustedMargin: currentMargin, isCyclical: false }
  const marginGap = avgMargin - currentMargin
  const adjustment = marginGap * 0.7 * cyclePosition
  return { adjustedMargin: currentMargin + adjustment, isCyclical: true, adjustment: adjustment.toFixed(2) }
}

export function calculateProbabilityWeightedDCF({ bearCase, baseCase, bullCase, probabilities = { bear: 0.25, base: 0.50, bull: 0.25 } }) {
  const bearIV = bearCase?.intrinsicValuePerShare || 0
  const baseIV = baseCase?.intrinsicValuePerShare || 0
  const bullIV = bullCase?.intrinsicValuePerShare || 0
  const weightedIV = bearIV * probabilities.bear + baseIV * probabilities.base + bullIV * probabilities.bull
  const variance = probabilities.bear * Math.pow(bearIV - weightedIV, 2) +
    probabilities.base * Math.pow(baseIV - weightedIV, 2) +
    probabilities.bull * Math.pow(bullIV - weightedIV, 2)
  const stdDev = Math.sqrt(variance)
  return { weightedIV: Number(weightedIV.toFixed(2)), stdDev: Number(stdDev.toFixed(2)),
    cv: Number((stdDev / weightedIV).toFixed(2)) }
}

export function runMonteCarloDCF(stockData, simulations = 1000) {
  const results = []
  const baseGrowth = stockData.year1Growth || 15
  const baseWACC = stockData.wacc || 10.5
  for (let i = 0; i < simulations; i++) {
    const simData = { ...stockData,
      year1Growth: baseGrowth * (0.8 + (crypto.randomInt ? crypto.randomInt(0, 400) / 1000 : Math.random() * 0.4)),
      wacc: baseWACC * (0.9 + (crypto.randomInt ? crypto.randomInt(0, 200) / 1000 : Math.random() * 0.2)) }
    const result = calculateCleanDCF(simData)
    if (result) results.push(result.intrinsicValuePerShare)
  }
  results.sort((a, b) => a - b)
  const mean = results.reduce((a, b) => a + b, 0) / results.length
  return { simulations, mean: Number(mean.toFixed(2)),
    median: results[Math.floor(results.length / 2)],
    stdDev: Number((Math.sqrt(results.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / results.length)).toFixed(2)),
    p25: results[Math.floor(results.length * 0.25)],
    p75: results[Math.floor(results.length * 0.75)],
    probabilityUndervalued: ((results.filter(r => r > stockData.price).length / results.length) * 100).toFixed(1) + '%' }
}

export default {
  calculateProperWACC, calculateCleanTGR, calculateCleanProjections,
  calculateCleanTerminalValue, calculateCleanEquityValue, calculatePV,
  calculatePVTerminalValue, calculateIntrinsicValuePerShare, calculateCleanSensitivity,
  calculateCleanDCF, getCleanVerdict, calculateScenarioDCF, calculateReverseDCF,
  calculateEliteDCF, calculateEliteWACC, calculateEliteReinvestment, calculateSmartBeta,
  calculateExtendedProjections, getMoatParameters, calculateSizePremium,
  calculateDilutedShares, calculateCyclicalAdjustment, calculateProbabilityWeightedDCF,
  runMonteCarloDCF,
  SECTOR_CAPITAL_STRUCTURES, SECTOR_GROWTH_CEILINGS, SIZE_PREMIUM_TABLE, MOAT_RATINGS,
  getSectorCapitalStructure, getSectorGrowthCeiling, applyScenarioAdjustments,
  calculateNWCRate, calculateLinkedDepreciation,
}
