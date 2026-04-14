/**
 * Historical Data Layer
 * Analyzes 5-10 year trends for better projections
 */

import {
  getHistoricalData,
  calculateCAGRs,
  saveHistoricalData,
  getSnapshotsForTrend
} from '@/lib/db/client'

// ============================================================================
// TREND ANALYSIS
// ============================================================================

/**
 * Complete trend analysis for a stock
 * Returns trends for all key metrics
 */
export async function analyzeTrends(ticker, years = 5) {
  const historicalData = await getHistoricalData(
    ticker,
    new Date().getFullYear() - years,
    new Date().getFullYear() - 1
  )

  if (historicalData.length < 3) {
    return { insufficientData: true, message: 'Need at least 3 years of data for trends' }
  }

  return {
    revenue: await analyzeRevenueTrend(historicalData),
    profitability: await analyzeProfitabilityTrend(historicalData),
    cashFlow: await analyzeCashFlowTrend(historicalData),
    balanceSheet: await analyzeBalanceSheetTrend(historicalData),
    efficiency: await analyzeEfficiencyTrend(historicalData),
    growth: await analyzeGrowthQuality(historicalData),
    cycles: await detectCycles(historicalData), // Cyclical stocks
  }
}

/**
 * Analyze revenue trend
 * Detects: growth rate, cyclicality, acceleration/deceleration
 */
function analyzeRevenueTrend(data) {
  const revenues = data.map(d => d.revenue).filter(r => r > 0)
  if (revenues.length < 3) return { insufficient: true }

  // Calculate year-over-year growth rates
  const growthRates = []
  for (let i = 1; i < revenues.length; i++) {
    const rate = ((revenues[i] - revenues[i-1]) / revenues[i-1]) * 100
    growthRates.push(rate)
  }

  // CAGR
  const cagr = ((revenues[revenues.length - 1] / revenues[0]) ** (1/(revenues.length-1)) - 1) * 100

  // Volatility
  const avg = growthRates.reduce((a,b) => a+b, 0) / growthRates.length
  const variance = growthRates.reduce((acc, r) => acc + (r - avg)**2, 0) / growthRates.length
  const volatility = Math.sqrt(variance)

  // Trend direction
  const recentAvg = growthRates.slice(-3).reduce((a,b) => a+b, 0) / 3
  const earlyAvg = growthRates.slice(0, 3).reduce((a,b) => a+b, 0) / Math.min(3, growthRates.length)
  const accelerating = recentAvg > earlyAvg + 2
  const decelerating = recentAvg < earlyAvg - 2

  return {
    cagr: Math.round(cagr * 10) / 10,
    averageGrowth: Math.round(avg * 10) / 10,
    volatility: Math.round(volatility * 10) / 10,
    accelerating,
    decelerating,
    stable: !accelerating && !decelerating && volatility < 10,
    cycleAmplitude: Math.max(...growthRates) - Math.min(...growthRates),
    recentGrowth: Math.round(recentAvg * 10) / 10,
  }
}

/**
 * Analyze profitability trends
 */
function analyzeProfitabilityTrend(data) {
  const margins = data.map(d =>
    d.ebitda && d.revenue ? (d.ebitda / d.revenue) * 100 : null
  ).filter(Boolean)

  if (margins.length < 3) return { insufficient: true }

  // Expanding, contracting, or stable?
  const first = margins[0]
  const last = margins[margins.length - 1]
  const change = last - first

  // Trend consistency
  const expansions = margins.slice(1).filter((m, i) => m > margins[i]).length
  const contractions = margins.length - 1 - expansions

  return {
    current: Math.round(last * 10) / 10,
    trend: Math.abs(change) < 1 ? 'stable' : change > 0 ? 'expanding' : 'contracting',
    change: Math.round(change * 10) / 10,
    consistency: Math.round((expansions / (margins.length - 1)) * 100),
    average: Math.round(margins.reduce((a,b) => a+b, 0) / margins.length * 10) / 10,
  }
}

/**
 * Analyze cash flow trends
 */
function analyzeCashFlowTrend(data) {
  const fcfData = data.map(d => ({
    fcf: d.freeCashFlow,
    revenue: d.revenue,
    ocf: d.operatingCashFlow
  })).filter(d => d.fcf !== undefined)

  if (fcfData.length < 3) return { insufficient: true }

  // FCF conversion rate trend
  const conversionRates = fcfData.map(d =>
    d.revenue > 0 ? (d.fcf / d.revenue) * 100 : null
  ).filter(Boolean)

  // FCF stability
  const fcfValues = fcfData.map(d => d.fcf).filter(f => f > -Infinity)
  const positiveFCF = fcfValues.filter(f => f > 0).length
  const fcfStability = positiveFCF / fcfValues.length

  return {
    fcfConversion: Math.round(conversionRates.reduce((a,b) => a+b, 0) / conversionRates.length * 10) / 10,
    fcfStability: Math.round(fcfStability * 100),
    fcfCagr: calculateCAGR(
      fcfValues.filter(f => f !== 0),
      'fcf'
    ),
    consistentPositive: fcfStability > 0.8,
  }
}

/**
 * Analyze balance sheet strength trends
 */
function analyzeBalanceSheetTrend(data) {
  const ratios = data.map(d => ({
    cashToDebt: d.cashAndEquivalents && d.totalDebt
      ? d.cashAndEquivalents / d.totalDebt
      : null,
    debtToEquity: d.totalDebt && d.totalEquity
      ? d.totalDebt / d.totalEquity
      : null,
    currentRatio: d.currentAssets && d.currentLiabilities
      ? d.currentAssets / d.currentLiabilities
      : null,
  })).filter(r => r.cashToDebt !== null)

  if (ratios.length < 3) return { insufficient: true }

  const first = ratios[0]
  const last = ratios[ratios.length - 1]

  return {
    cashToDebt: { current: last.cashToDebt, trend: last.cashToDebt > first.cashToDebt ? 'improving' : 'worsening' },
    debtToEquity: { current: last.debtToEquity, trend: last.debtToEquity < first.debtToEquity ? 'improving' : 'worsening' },
    currentRatio: last.currentRatio,
    strengthening: last.cashToDebt > first.cashToDebt && last.debtToEquity < first.debtToEquity,
  }
}

/**
 * Analyze capital efficiency trends
 */
function analyzeEfficiencyTrend(data) {
  // ROIC trend
  const roics = data.map(d => {
    if (!d.netIncome || !d.totalAssets) return null
    const investedCapital = d.totalAssets - (d.accountsPayable || d.totalLiabilities * 0.3)
    return investedCapital > 0 ? (d.netIncome / investedCapital) * 100 : null
  }).filter(Boolean)

  // Asset turnover
  const turnovers = data.map(d =>
    d.revenue && d.totalAssets
      ? d.revenue / d.totalAssets
      : null
  ).filter(Boolean)

  return {
    roic: {
      current: roics.length ? Math.round(roics[roics.length - 1] * 10) / 10 : null,
      trend: roics.length > 1
        ? roics[roics.length - 1] > roics[0] ? 'improving' : 'declining'
        : 'unknown',
    },
    assetTurnover: {
      current: turnovers.length ? Math.round(turnovers[turnovers.length - 1] * 100) / 100 : null,
      average: turnovers.length
        ? Math.round(turnovers.reduce((a,b) => a+b, 0) / turnovers.length * 100) / 100
        : null,
    },
  }
}

/**
 * Analyze growth quality
 * High quality = growing revenues AND cash flows, improving margins
 */
function analyzeGrowthQuality(data) {
  if (data.length < 4) return { insufficient: true }

  const revenueGrowing = data[data.length - 1].revenue > data[0].revenue
  const marginsImproving = data[data.length - 1].ebitda / data[data.length - 1].revenue >
    data[0].ebitda / data[0].revenue
  const fcfPositive = data.slice(-2).every(d => d.freeCashFlow && d.freeCashFlow > 0)

  const scores = {
    revenueGrowth: revenueGrowing ? 40 : 0,
    marginImprovement: marginsImproving ? 30 : 0,
    fcfPositive: fcfPositive ? 30 : 0,
  }

  return {
    qualityScore: scores.revenueGrowth + scores.marginImprovement + scores.fcfPositive,
    isHighQuality: scores.revenueGrowth + scores.marginImprovement + scores.fcfPositive >= 80,
    breakdown: scores,
  }
}

/**
 * Detect cyclical patterns in revenue
 */
function detectCycles(data) {
  const revenues = data.map(d => d.revenue).filter(r => r > 0)
  if (revenues.length < 5) return { insufficient: true }

  // Calculate YoY changes
  const changes = []
  for (let i = 1; i < revenues.length; i++) {
    changes.push(revenues[i] - revenues[i-1])
  }

  // Count direction changes (peaks and troughs)
  let directionChanges = 0
  for (let i = 1; i < changes.length; i++) {
    if ((changes[i] > 0 && changes[i-1] < 0) || (changes[i] < 0 && changes[i-1] > 0)) {
      directionChanges++
    }
  }

  const cycleScore = directionChanges / Math.max(1, changes.length - 1)

  return {
    isCyclical: cycleScore > 0.4,
    cycleSeverity: cycleScore < 0.2 ? 'low' : cycleScore < 0.5 ? 'moderate' : 'high',
    detections: directionChanges,
  }
}

/**
 * Calculate CAGR for any metric
 */
function calculateCAGR(values, name) {
  if (!values || values.length < 2) return null
  const first = values[0]
  const last = values[values.length - 1]
  if (!first || first === 0) return null
  return Math.round(((last / first) ** (1/(values.length-1)) - 1) * 100 * 10) / 10
}

// ============================================================================
// UTILITIES FOR PROJECTIONS
// ============================================================================

/**
 * Get consensus growth estimate from trends
 * Uses multiple signals to determine reasonable growth
 */
export function getConsensusGrowth(trends, currentGrowth) {
  if (trends.insufficientData) return currentGrowth

  const signals = []

  // Signal 1: Revenue trend
  if (trends.revenue && !trends.revenue.insufficient) {
    signals.push(trends.revenue.cagr)
    if (trends.revenue.accelerating) signals.push(trends.revenue.recentGrowth * 1.2)
    if (trends.revenue.decelerating) signals.push(trends.revenue.recentGrowth * 0.8)
  }

  // Signal 2: Current TTM growth (blend)
  if (currentGrowth > -100 && currentGrowth < 200) {
    signals.push(currentGrowth)
  }

  // Calculate weighted average
  if (signals.length === 0) return 10 // Default

  const consensus = signals.reduce((a, b) => a + b, 0) / signals.length

  // Apply sanity bounds
  return Math.min(30, Math.max(3, consensus))
}

/**
 * Determine moat strength from trends
 */
export function detectMoatFromTrends(trends) {
  if (trends.insufficientData) return 'MODERATE'

  const scores = {
    profitability: trends.profitability?.trend === 'expanding' ? 2 : 0,
    cashFlow: trends.cashFlow?.consistentPositive ? 2 : 0,
    quality: trends.growth?.isHighQuality ? 2 : 0,
    efficiency: trends.efficiency?.roic?.trend === 'improving' ? 1 : 0,
  }

  const total = Object.values(scores).reduce((a, b) => a + b, 0)

  if (total >= 6) return 'WIDE'
  if (total >= 4) return 'MODERATE'
  if (total >= 2) return 'NARROW'
  return 'NONE'
}

/**
 * Get margin trend confidence
 */
export function getMarginConfidence(trends) {
  if (!trends.profitability || trends.profitability.insufficient) {
    return { reliable: false, volatility: 'high' }
  }

  return {
    reliable: trends.profitability.consistency > 60,
    volatility: trends.profitability.change < 2 ? 'low' : 'moderate',
    direction: trends.profitability.trend,
  }
}

// ============================================================================
// STOCK COMPARISONS
// ============================================================================

/**
 * Compare stock to sector peers
 */
export async function compareToPeers(ticker, sectorTickers, metric = 'revenueCAGR') {
  const comparisons = []

  for (const peer of sectorTickers) {
    const cagr = await calculateCAGRs(peer)
    if (cagr) {
      comparisons.push({
        ticker: peer,
        value: cagr[metric] || cagr.revenueCAGR,
      })
    }
  }

  if (comparisons.length === 0) return null

  const targetCagr = await calculateCAGRs(ticker)
  const targetValue = targetCagr?.[metric] || targetCagr?.revenueCAGR

  const sorted = comparisons.sort((a, b) => b.value - a.value)
  const percentile = sorted.findIndex(c => c.value <= targetValue) / sorted.length

  return {
    peerCount: comparisons.length,
    percentile: Math.round(percentile * 100),
    median: sorted[Math.floor(sorted.length / 2)].value,
    targetValue,
    topQuartile: percentile >= 0.75,
  }
}

// ============================================================================
// DATA IMPORT (from Yahoo or other sources)
// ============================================================================

/**
 * Import historical data from data source
 * Called when fetching for a stock
 */
export async function importHistoricalData(ticker, yearsOfData = 5) {
  // In production: Fetch from Yahoo Finance API or other source
  // For now, this is a placeholder

  const currentYear = new Date().getFullYear()

  for (let year = currentYear - yearsOfData; year < currentYear; year++) {
    // Would fetch from: Yahoo Finance, Alpha Vantage, etc.
    // const data = await fetchAnnualData(ticker, year)

    // Placeholder - would be populated from API
    await saveHistoricalData(ticker, year, {
      // Data structure matches HistoricalData model
      revenue: null,
      ebitda: null,
      // ... other fields
    })
  }
}

// ============================================================================
// EXPORTS FOR DCF INTEGRATION
// ============================================================================

export {
  calculateCAGR,
}