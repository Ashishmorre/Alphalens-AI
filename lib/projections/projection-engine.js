/**
 * ============================================================================
 * PROJECTION ENGINE v1.0
 * Production-grade financial projections - NO AI REQUIRED
 * ============================================================================
 *
 * This engine calculates all DCF projections from raw inputs.
 * AI is only used for qualitative insights, NOT calculations.
 *
 * ARCHITECTURE:
 * Yahoo Finance Data → Validation → Projection Engine → DCF Core → AI Assist → Output
 */

import { calculateFinancialMetrics } from '@/lib/financial-utils'
import { getWACCInputsFromMacro, getSectorRiskAdjustment } from '@/lib/macro/rbi-service'
import { getHistoricalData, calculateCAGRs } from '@/lib/db/client'

// ============================================================================
// PROJECTION CONFIGURATION
// ============================================================================

const CONFIG = {
  PROJECTION_YEARS: 5,

  // Fade rates by moat type (percentage points per year)
  FADE_RATES: {
    WIDE: { start: 0, fade: 2 },
    MODERATE: { start: 0, fade: 4 },
    NARROW: { start: 0, fade: 6 },
    NONE: { start: 0, fade: 8 },
  },

  // CapEx strategies by growth pattern
  CAPEX_STRATEGIES: {
    HIGH_GROWTH: [0.25, 0.28, 0.22, 0.18, 0.15], // Heavy early, then taper
    MEDIUM_GROWTH: [0.15, 0.18, 0.15, 0.12, 0.10],
    MATURE: [0.08, 0.10, 0.10, 0.09, 0.08],
  },

  // Tax rate by country
  TAX_RATES: {
    IN: 25.0, // India corporate tax
    US: 21.0,
  },

  // NWC as % of revenue change
  NWC_RATE: 0.03,

  // Depreciation rate (straight line over asset life)
  DEPRECIATION_LIFE: 10,
}

// ============================================================================
// CORE PROJECTION ENGINE
// ============================================================================

/**
 * Main entry point: Generate complete 5-year projections
 * Input: Raw Yahoo data + Settings
 * Output: Complete projection model + WACC + Assumptions
 */
export async function calculateProjections(ticker, rawData, settings = {}) {
  // 1. Get historical context (if available)
  const historicalData = await getHistoricalData(ticker, new Date().getFullYear() - 6, new Date().getFullYear() - 1)
  const cagrs = await calculateCAGRs(ticker)

  // 2. Get macro data for WACC
  const macroInputs = await getWACCInputsFromMacro()

  // 3. Determine projections inputs
  const inputs = determineProjectionInputs(rawData, cagrs, historicalData, settings)

  // 4. Calculate WACC
  const wacc = calculateWACC(rawData, macroInputs, settings)

  // 5. Generate 5-year projections
  const projections = generateYearlyProjections(rawData, inputs, wacc)

  // 6. Calculate terminal value inputs
  const terminal = calculateTerminalInputs(projections, wacc, inputs.moat)

  return {
    ticker,
    currentData: {
      price: rawData.price,
      revenue: rawData.revenue,
      ebitda: rawData.ebitda,
      marketCap: rawData.marketCap,
      sharesOutstanding: rawData.sharesOutstanding,
      debt: rawData.totalDebt,
      cash: rawData.totalCash,
    },
    projections,
    assumptions: {
      wacc: wacc.wacc,
      costOfEquity: wacc.costOfEquity,
      costOfDebt: wacc.costOfDebt,
      terminalGrowthRate: terminal.growthRate,
      taxRate: inputs.taxRate,
      revenueGrowth: inputs.revenueGrowth,
      targetEbitdaMargin: inputs.targetEbitdaMargin,
      fadeRate: inputs.fadeRate,
      capexStrategy: inputs.capexStrategy,
      moat: inputs.moat,
    },
    wacc,
    terminal,
  }
}

/**
 * Determine projection inputs based on available data
 */
function determineProjectionInputs(rawData, cagrs, historicalData, settings) {
  const sector = (rawData.sector || '').toLowerCase()

  return {
    // Base year from current data
    baseRevenue: rawData.revenue,
    baseEbitda: rawData.ebitda,

    // Calculate revenue growth from historical or use default
    revenueGrowth: calculateRevenueGrowth(rawData, cagrs, historicalData, settings),

    // Determine margin target
    targetEbitdaMargin: calculateTargetEBITDAMargin(rawData, historicalData, settings),

    // Fade rate based on moat
    fadeRate: calculateFadeRate(settings.moat || 'MODERATE'),

    // CapEx strategy based on growth phase
    capexStrategy: selectCapExStrategy(rawData, historicalData),

    // Tax rate
    taxRate: settings.taxRate || CONFIG.TAX_RATES.IN,

    // Moat
    moat: settings.moat || 'MODERATE',

    // Sector
    sector,
  }
}

/**
 * Calculate realistic revenue growth rate
 */
function calculateRevenueGrowth(rawData, cagrs, historicalData, settings) {
  // Priority 1: User override
  if (settings.revenueGrowth !== undefined) {
    return settings.revenueGrowth
  }

  // Priority 2: Historical CAGR
  if (cagrs?.revenueCAGR !== null && cagrs.revenueCAGR > -100 && cagrs.revenueCAGR < 200) {
    // Fade CAGR towards GDP growth over projection period
    const gdpGrowth = 7.0 // India GDP
    const faded = cagrs.revenueCAGR * (1 - CONFIG.FADE_RATES[settings.moat || 'MODERATE'].fade / 100)
    // Blend with GDP growth
    return Math.min(25, Math.max(3, (faded + gdpGrowth) / 2))
  }

  // Priority 3: Current revenue growth from Yahoo
  if (rawData.revenueGrowth > -50 && rawData.revenueGrowth < 200) {
    return Math.min(25, Math.max(3, rawData.revenueGrowth))
  }

  // Priority 4: Sector-based default
  const sectorDefaults = {
    'technology': 18,
    'software': 20,
    'saas': 22,
    'utilities': 8,
    'power': 9,
    'renewable': 15,
    'pharma': 12,
    'healthcare': 10,
    'fmcg': 10,
    'consumer': 9,
    'bank': 12,
    'financial': 11,
    'manufacturing': 8,
    'default': 10,
  }

  const sector = (rawData.sector || '').toLowerCase()
  for (const [key, value] of Object.entries(sectorDefaults)) {
    if (sector.includes(key)) return value
  }
  return sectorDefaults.default
}

/**
 * Calculate target EBITDA margin with fade to sector average
 */
function calculateTargetEBITDAMargin(data, historicalData, settings) {
  // Start with current margin
  const currentMargin = data.ebitda && data.revenue
    ? (data.ebitda / data.revenue) * 100
    : 15

  // Historical average if available
  let historicalAvg = currentMargin
  if (historicalData?.length > 0) {
    const margins = historicalData.filter(h => h.revenue > 0).map(h =>
      h.ebitda ? (h.ebitda / h.revenue) * 100 : null
    ).filter(Boolean)
    if (margins.length > 0) {
      historicalAvg = margins.reduce((a, b) => a + b, 0) / margins.length
    }
  }

  // Sector average
  const sectorAverages = {
    'technology': 25,
    'software': 28,
    'saas': 30,
    'utilities': 35,
    'power': 32,
    'renewable': 30,
    'pharma': 22,
    'healthcare': 18,
    'fmcg': 18,
    'consumer': 16,
    'manufacturing': 15,
    'default': 18,
  }

  const sector = (data.sector || '').toLowerCase()
  let sectorAvg = sectorAverages.default
  for (const [key, value] of Object.entries(sectorAverages)) {
    if (sector.includes(key)) {
      sectorAvg = value
      break
    }
  }

  // Blend: 60% historical, 40% sector (regression to mean)
  const blended = historicalAvg * 0.6 + sectorAvg * 0.4

  // Apply moat premium
  const moatPremiums = { WIDE: 5, MODERATE: 2, NARROW: 0, NONE: -2 }
  const premium = moatPremiums[settings.moat || 'MODERATE'] || 0

  return Math.min(70, Math.max(5, blended + premium))
}

/**
 * Calculate fade rate based on moat strength
 */
function calculateFadeRate(moat) {
  const rates = {
    WIDE: 2.0,      // Slow fade (competitive advantage persists)
    MODERATE: 4.0,  // Moderate fade
    NARROW: 6.0,    // Faster fade
    NONE: 8.0,      // Fast fade (no moat)
  }
  return rates[moat] || rates.MODERATE
}

/**
 * Select CapEx strategy based on growth phase
 */
function selectCapExStrategy(data, historicalData) {
  // Determine if high-growth, mature, or declining
  const revenueGrowth = data.revenueGrowth || 0
  const pe = data.pe || 20

  if (revenueGrowth > 20 || pe > 40) {
    return CONFIG.CAPEX_STRATEGIES.HIGH_GROWTH
  } else if (revenueGrowth < 5 && pe < 15) {
    return CONFIG.CAPEX_STRATEGIES.MATURE
  } else {
    return CONFIG.CAPEX_STRATEGIES.MEDIUM_GROWTH
  }
}

/**
 * Calculate WACC from first principles
 */
function calculateWACC(data, macro, settings) {
  // Target capital structure (default 70/30)
  const structure = settings.capitalStructure || { debt: 30, equity: 70 }

  // Cost of Equity (CAPM)
  const beta = data.beta || 1.0
  const riskFreeRate = macro.riskFreeRate || 6.8
  const marketRiskPremium = macro.marketRiskPremium || 5.5
  const sectorAdjustment = getSectorRiskAdjustment(data.sector)

  // Formula: Ke = Rf + β * (Market Risk Premium) + Sector adjustment
  const costOfEquity = riskFreeRate + beta * marketRiskPremium + sectorAdjustment

  // Cost of Debt
  const costOfDebt = settings.costOfDebt ||
    (data.totalDebt > 0 && data.interestExpense > 0
      ? (data.interestExpense / data.totalDebt) * 100
      : 8.0) // Default for India corporates

  // Tax rate
  const taxRate = settings.taxRate || CONFIG.TAX_RATES.IN

  // WACC Formula: (E/V * Ke) + (D/V * Kd * (1 - T))
  const wacc = (
    (structure.equity / 100) * costOfEquity +
    (structure.debt / 100) * costOfDebt * (1 - taxRate / 100)
  )

  return {
    wacc: Math.round(wacc * 100) / 100,
    costOfEquity: Math.round(costOfEquity * 100) / 100,
    costOfDebt: Math.round(costOfDebt * 100) / 100,
    structure,
    beta,
    riskFreeRate,
    marketRiskPremium,
    taxRate,
  }
}

/**
 * Generate 5-year detailed projections
 */
function generateYearlyProjections(rawData, inputs, wacc) {
  const projections = []
  let prevRevenue = inputs.baseRevenue
  let ppAndE = rawData.totalAssets * 0.4 || inputs.baseRevenue * 0.5 // Estimate PP&E

  // Calculate year-by-year fade
  const yearGrowths = calculateFadedGrowth(inputs.revenueGrowth, inputs.fadeRate, CONFIG.PROJECTION_YEARS)
  const yearMargins = calculateFadedMargin(
    (inputs.baseEbitda / inputs.baseRevenue) * 100,
    inputs.targetEbitdaMargin,
    inputs.fadeRate,
    CONFIG.PROJECTION_YEARS,
    inputs.moat
  )

  for (let year = 1; year <= CONFIG.PROJECTION_YEARS; year++) {
    // Revenue projection
    const growthRate = yearGrowths[year - 1]
    const revenue = prevRevenue * (1 + growthRate / 100)

    // EBITDA with margin fade
    const ebitdaMargin = yearMargins[year - 1]
    const ebitda = revenue * (ebitdaMargin / 100)

    // Depreciation (straight line based on PP&E/asset life)
    const depreciation = (ppAndE / CONFIG.DEPRECIATION_LIFE) || revenue * 0.05

    // EBIT
    const ebit = ebitda - depreciation

    // NOPAT
    const taxRate = inputs.taxRate / 100
    const nopat = ebit * (1 - taxRate)

    // CapEx
    const capexRate = inputs.capexStrategy[year - 1] || 0.12
    const capex = -revenue * capexRate // Negative for cash outflow

    // Update PP&E
    ppAndE = Math.max(0, ppAndE + (-capex) - depreciation)

    // Change in NWC
    const nwcChange = (revenue - prevRevenue) * CONFIG.NWC_RATE

    // Free Cash Flow
    const fcf = nopat + depreciation + capex - nwcChange

    // Present Value
    const discountFactor = 1 / Math.pow(1 + wacc.wacc / 100, year)
    const pvFCF = fcf * discountFactor

    projections.push({
      year,
      revenue: Math.round(revenue),
      ebitda: Math.round(ebitda),
      ebit: Math.round(ebit),
      nopat: Math.round(nopat),
      depreciation: Math.round(depreciation),
      capex: Math.round(capex),
      nwcChange: Math.round(nwcChange),
      fcf: Math.round(fcf),
      pvFCF: Math.round(pvFCF),
      growthRate: Math.round(growthRate * 100) / 100,
      ebitdaMargin: Math.round(ebitdaMargin * 100) / 100,
      discountFactor: Math.round(discountFactor * 10000) / 10000,
    })

    prevRevenue = revenue
  }

  return projections
}

/**
 * Fade growth rate towards terminal rate over projection period
 */
function calculateFadedGrowth(startRate, fadeRate, years) {
  const rates = []
  const terminalRate = 7.0 // India GDP

  for (let i = 0; i < years; i++) {
    // Fade starts after year 2
    const fadeStart = 2
    if (i < fadeStart) {
      rates.push(startRate)
    } else {
      const fadeYears = i - fadeStart + 1
      // Fade towards GDP growth
      const faded = startRate - (fadeRate * fadeYears)
      rates.push(Math.max(terminalRate * 0.5, faded))
    }
  }

  return rates
}

/**
 * Fade margin towards target over projection period
 */
function calculateFadedMargin(startMargin, targetMargin, fadeRate, years, moat) {
  const margins = []

  // Moat affects how quickly margins converge
  const convergenceSpeed = { WIDE: 0.3, MODERATE: 0.5, NARROW: 0.7, NONE: 0.9 }
  const speed = convergenceSpeed[moat] || 0.5

  for (let i = 0; i < years; i++) {
    // Move towards target margin
    const current = margins.length > 0 ? margins[margins.length - 1] : startMargin
    const next = current + (targetMargin - current) * speed
    margins.push(next)
  }

  return margins
}

/**
 * Calculate terminal value inputs
 */
function calculateTerminalInputs(projections, wacc, moat) {
  const finalFCF = projections[projections.length - 1].fcf

  // Terminal growth from macro + moat
  const baseTGR = 3.5 //% near GDP
  const moatAdjustments = { WIDE: 1.0, MODERATE: 0.5, NARROW: 0, NONE: -0.5 }
  const growthRate = baseTGR + (moatAdjustments[moat] || 0)

  // Cap at WACC - 1%
  const cappedTGR = Math.min(growthRate, wacc.wacc - 1.0)

  return {
    finalFCF,
    growthRate: Math.max(2.5, cappedTGR),
    wacc: wacc.wacc,
  }
}

// ============================================================================
// EXPORT Functions for API Integration
// ============================================================================

export { CONFIG }