/**
 * Database Client - Production-Grade Data Persistence Layer
 * Handles: Stock data, historical records, valuations, macro data
 */

import { PrismaClient } from '@prisma/client'

// Prisma client singleton pattern
const globalForPrisma = globalThis

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// ============================================================================
// STOCK OPERATIONS
// ============================================================================

/**
 * Get or create a stock record
 */
export async function getOrCreateStock(ticker, data = {}) {
  const normalizedTicker = ticker.toUpperCase().trim()

  let stock = await prisma.stock.findUnique({
    where: { ticker: normalizedTicker }
  })

  if (!stock) {
    stock = await prisma.stock.create({
      data: {
        ticker: normalizedTicker,
        name: data.name || normalizedTicker,
        sector: data.sector,
        industry: data.industry,
        exchange: data.exchange,
        currency: data.currency || 'INR',
        country: data.country || 'IN',
      }
    })
  }

  return stock
}

/**
 * Update stock metadata
 */
export async function updateStockMetadata(ticker, metadata) {
  const normalizedTicker = ticker.toUpperCase().trim()

  return prisma.stock.update({
    where: { ticker: normalizedTicker },
    data: {
      ...metadata,
      updatedAt: new Date()
    }
  })
}

// ============================================================================
// SNAPSHOT OPERATIONS (Daily data)
// ============================================================================

/**
 * Save daily stock snapshot
 */
export async function saveStockSnapshot(ticker, data) {
  const normalizedTicker = ticker.toUpperCase().trim()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Get or create stock
  const stock = await getOrCreateStock(normalizedTicker, data)

  // Upsert snapshot
  return prisma.stockSnapshot.upsert({
    where: {
      ticker_date: { ticker: normalizedTicker, date: today }
    },
    create: {
      stockId: stock.id,
      ticker: normalizedTicker,
      date: today,
      price: data.price,
      marketCap: data.marketCap,
      sharesOutstanding: data.sharesOutstanding,
      revenue: data.revenue,
      ebitda: data.ebitda,
      ebit: data.ebit,
      netIncome: data.netIncome,
      freeCashFlow: data.freeCashFlow,
      totalCash: data.totalCash,
      totalDebt: data.totalDebt,
      pe: data.pe,
      forwardPE: data.forwardPE,
      pb: data.pb,
      roe: data.roe,
      roce: data.roce,
      roa: data.roa,
      beta: data.beta,
      grossMargin: data.grossMargin,
      operatingMargin: data.operatingMargin,
      profitMargin: data.profitMargin,
      revenueGrowth: data.revenueGrowth,
      earningsGrowth: data.earningsGrowth,
    },
    update: {
      price: data.price,
      marketCap: data.marketCap,
      sharesOutstanding: data.sharesOutstanding,
      revenue: data.revenue,
      ebitda: data.ebitda,
      ebit: data.ebit,
      netIncome: data.netIncome,
      freeCashFlow: data.freeCashFlow,
      totalCash: data.totalCash,
      totalDebt: data.totalDebt,
      pe: data.pe,
      forwardPE: data.forwardPE,
      pb: data.pb,
      roe: data.roe,
      roce: data.roce,
      roa: data.roa,
      beta: data.beta,
      grossMargin: data.grossMargin,
      operatingMargin: data.operatingMargin,
      profitMargin: data.profitMargin,
      revenueGrowth: data.revenueGrowth,
      earningsGrowth: data.earningsGrowth,
    }
  })
}

/**
 * Get latest stock snapshot
 */
export async function getLatestSnapshot(ticker) {
  const normalizedTicker = ticker.toUpperCase().trim()

  return prisma.stockSnapshot.findFirst({
    where: { ticker: normalizedTicker },
    orderBy: { date: 'desc' }
  })
}

/**
 * Get snapshots for trend analysis
 */
export async function getSnapshotsForTrend(ticker, days = 252) {
  const normalizedTicker = ticker.toUpperCase().trim()
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)

  return prisma.stockSnapshot.findMany({
    where: {
      ticker: normalizedTicker,
      date: { gte: cutoffDate }
    },
    orderBy: { date: 'asc' }
  })
}

// ============================================================================
// HISTORICAL DATA OPERATIONS (Multi-year)
// ============================================================================

/**
 * Save annual financial data
 */
export async function saveHistoricalData(ticker, year, data, period = 'ANNUAL') {
  const normalizedTicker = ticker.toUpperCase().trim()
  const stock = await getOrCreateStock(normalizedTicker, data)

  return prisma.historicalData.upsert({
    where: {
      ticker_fiscalYear_period: { ticker: normalizedTicker, fiscalYear: year, period }
    },
    create: {
      stockId: stock.id,
      ticker: normalizedTicker,
      fiscalYear: year,
      period,
      revenue: data.revenue,
      costOfSales: data.costOfSales,
      grossProfit: data.grossProfit,
      ebitda: data.ebitda,
      ebit: data.ebit,
      netIncome: data.netIncome,
      eps: data.eps,
      totalAssets: data.totalAssets,
      currentAssets: data.currentAssets,
      cashAndEquivalents: data.cashAndEquivalents,
      totalLiabilities: data.totalLiabilities,
      currentLiabilities: data.currentLiabilities,
      totalEquity: data.totalEquity,
      bookValue: data.bookValue,
      operatingCashFlow: data.operatingCashFlow,
      investingCashFlow: data.investingCashFlow,
      financingCashFlow: data.financingCashFlow,
      freeCashFlow: data.freeCashFlow,
      capex: data.capex,
      depreciation: data.depreciation,
      accountsReceivable: data.accountsReceivable,
      inventory: data.inventory,
      accountsPayable: data.accountsPayable,
      netWorkingCapital: data.netWorkingCapital,
    },
    update: {
      revenue: data.revenue,
      costOfSales: data.costOfSales,
      grossProfit: data.grossProfit,
      ebitda: data.ebitda,
      ebit: data.ebit,
      netIncome: data.netIncome,
      eps: data.eps,
      totalAssets: data.totalAssets,
      currentAssets: data.currentAssets,
      cashAndEquivalents: data.cashAndEquivalents,
      totalLiabilities: data.totalLiabilities,
      currentLiabilities: data.currentLiabilities,
      totalEquity: data.totalEquity,
      bookValue: data.bookValue,
      operatingCashFlow: data.operatingCashFlow,
      investingCashFlow: data.investingCashFlow,
      financingCashFlow: data.financingCashFlow,
      freeCashFlow: data.freeCashFlow,
      capex: data.capex,
      depreciation: data.depreciation,
      accountsReceivable: data.accountsReceivable,
      inventory: data.inventory,
      accountsPayable: data.accountsPayable,
      netWorkingCapital: data.netWorkingCapital,
    }
  })
}

/**
 * Get historical data for CAGR calculations
 */
export async function getHistoricalData(ticker, startYear, endYear) {
  const normalizedTicker = ticker.toUpperCase().trim()

  return prisma.historicalData.findMany({
    where: {
      ticker: normalizedTicker,
      fiscalYear: { gte: startYear, lte: endYear },
      period: 'ANNUAL'
    },
    orderBy: { fiscalYear: 'asc' }
  })
}

/**
 * Calculate 5-year CAGR for key metrics
 */
export async function calculateCAGRs(ticker) {
  const currentYear = new Date().getFullYear()
  const historicalData = await getHistoricalData(ticker, currentYear - 6, currentYear - 1)

  if (historicalData.length < 2) return null

  const first = historicalData[0]
  const last = historicalData[historicalData.length - 1]
  const years = historicalData.length - 1

  const cagr = (endValue, startValue) => {
    if (!startValue || !endValue || startValue <= 0) return null
    return (Math.pow(endValue / startValue, 1 / years) - 1) * 100
  }

  return {
    revenueCAGR: cagr(last.revenue, first.revenue),
    ebitdaCAGR: cagr(last.ebitda, first.ebitda),
    netIncomeCAGR: cagr(last.netIncome, first.netIncome),
    fcfCAGR: cagr(last.freeCashFlow, first.freeCashFlow),
    years,
    dataPoints: historicalData.length
  }
}

// ============================================================================
// VALUATION OPERATIONS
// ============================================================================

/**
 * Save complete DCF valuation
 */
export async function saveValuation(ticker, valData) {
  const normalizedTicker = ticker.toUpperCase().trim()
  const stock = await getOrCreateStock(normalizedTicker, { name: valData.name })

  // Create valuation record
  const valuation = await prisma.valuation.create({
    data: {
      stockId: stock.id,
      ticker: normalizedTicker,
      wacc: valData.wacc,
      terminalGrowthRate: valData.terminalGrowthRate,
      taxRate: valData.taxRate,
      projectionYears: valData.projectionYears || 5,
      intrinsicValue: valData.intrinsicValue,
      currentPrice: valData.currentPrice,
      upside: valData.upside,
      verdict: valData.verdict,
      pvFCFs: valData.pvFCFs,
      terminalValue: valData.terminalValue,
      pvTerminalValue: valData.pvTerminalValue,
      enterpriseValue: valData.enterpriseValue,
      equityValue: valData.equityValue,
      scenario: valData.scenario || 'base',
      dataQuality: valData.dataQuality,
      confidence: valData.confidence,
      aiAssisted: valData.aiAssisted || false,
      assumptions: valData.assumptions || null,
    }
  })

  // Create projections
  if (valData.projections?.length > 0) {
    await prisma.projection.createMany({
      data: valData.projections.map(p => ({
        valuationId: valuation.id,
        year: p.year,
        revenue: p.revenue,
        ebitda: p.ebitda,
        ebit: p.ebit,
        nopat: p.nopat,
        depreciation: p.depreciation,
        capex: p.capex,
        nwcChange: p.nwcChange,
        fcf: p.fcf,
        pvFCF: p.pvFCF,
        revenueGrowth: p.revenueGrowth,
        ebitdaMargin: p.ebitdaMargin,
      }))
    })
  }

  return valuation
}

/**
 * Get valuation history for a stock
 */
export async function getValuationHistory(ticker, limit = 10) {
  const normalizedTicker = ticker.toUpperCase().trim()

  return prisma.valuation.findMany({
    where: { ticker: normalizedTicker },
    orderBy: { date: 'desc' },
    take: limit,
    include: {
      projections: {
        orderBy: { year: 'asc' }
      }
    }
  })
}

/**
 * Get latest valuation
 */
export async function getLatestValuation(ticker) {
  const normalizedTicker = ticker.toUpperCase().trim()

  return prisma.valuation.findFirst({
    where: { ticker: normalizedTicker },
    orderBy: { date: 'desc' },
    include: { projections: true }
  })
}

// ============================================================================
// MACRO DATA OPERATIONS
// ============================================================================

/**
 * Save macro data (RBI rates, etc)
 */
export async function saveMacroData(data) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)

  return prisma.macroData.upsert({
    where: {
      country_date: { country: data.country || 'IN', date }
    },
    create: {
      date,
      country: data.country || 'IN',
      repoRate: data.repoRate,
      reverseRepoRate: data.reverseRepoRate,
      tBill91Day: data.tBill91Day,
      tBill364Day: data.tBill364Day,
      gSec10Year: data.gSec10Year,
      inflationCPI: data.inflationCPI,
      inflationWPI: data.inflationWPI,
      gdpGrowth: data.gdpGrowth,
      gdpNominal: data.gdpNominal,
      marketCapToGdp: data.marketCapToGdp,
      rupeeVsUsd: data.rupeeVsUsd,
      source: data.source || 'RBI',
    },
    update: {
      repoRate: data.repoRate,
      reverseRepoRate: data.reverseRepoRate,
      tBill91Day: data.tBill91Day,
      tBill364Day: data.tBill364Day,
      gSec10Year: data.gSec10Year,
      inflationCPI: data.inflationCPI,
      inflationWPI: data.inflationWPI,
      gdpGrowth: data.gdpGrowth,
      gdpNominal: data.gdpNominal,
      marketCapToGdp: data.marketCapToGdp,
      rupeeVsUsd: data.rupeeVsUsd,
    }
  })
}

/**
 * Get latest macro data for WACC calculation
 */
export async function getLatestMacroData(country = 'IN') {
  return prisma.macroData.findFirst({
    where: { country },
    orderBy: { date: 'desc' }
  })
}

// ============================================================================
// PREDICTION TRACKING
// ============================================================================

/**
 * Track a new prediction for later validation
 */
export async function trackPrediction(ticker, prediction) {
  return prisma.predictionAccuracy.create({
    data: {
      ticker: ticker.toUpperCase().trim(),
      predictedPrice: prediction.predictedPrice,
      predictedUpside: prediction.predictedUpside,
      confidence: prediction.confidence,
      timeframeDays: prediction.timeframeDays || 252,
    }
  })
}

/**
 * Mark prediction as complete and calculate accuracy
 */
export async function completePrediction(predictionId, actualPrice) {
  const prediction = await prisma.predictionAccuracy.findUnique({
    where: { id: predictionId }
  })

  if (!prediction) throw new Error('Prediction not found')

  const actualReturn = (actualPrice - prediction.predictedPrice) / prediction.predictedPrice * 100
  const accuracy = Math.abs(prediction.predictedUpside - actualReturn)

  return prisma.predictionAccuracy.update({
    where: { id: predictionId },
    data: {
      actualPrice,
      actualPerformance: actualReturn,
      accuracy,
      isCompleted: true,
      completedAt: new Date()
    }
  })
}

// ============================================================================
// VALIDATION LOGGING
// ============================================================================

/**
 * Log validation issues
 */
export async function logValidationIssue(ticker, issue) {
  return prisma.validationLog.create({
    data: {
      ticker: ticker.toUpperCase().trim(),
      field: issue.field,
      value: issue.value,
      rule: issue.rule,
      severity: issue.severity, // ERROR, WARN, INFO
      message: issue.message,
      threshold: issue.threshold,
      actual: issue.actual,
    }
  })
}

/**
 * Get validation issues for a stock
 */
export async function getValidationIssues(ticker, severity) {
  const where = { ticker: ticker.toUpperCase().trim() }
  if (severity) where.severity = severity

  return prisma.validationLog.findMany({
    where,
    orderBy: { date: 'desc' },
    take: 50
  })
}