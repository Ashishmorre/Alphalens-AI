/**
 * ============================================================================
 * DCF ORCHESTRATOR v16.0
 * Production-Grade Architecture
 * ============================================================================
 *
 * FLOW: Yahoo → DB → Validation → Macro → Historical → Projections → DCF → Output
 *                                                (AI assists only)
 *
 * KEY IMPROVEMENTS:
 * 1. ✅ No AI for projections (pure JS math)
 * 2. ✅ Data validation layer (reject garbage)
 * 3. ✅ Macro data layer (RBI rates, dynamic)
 * 4. ✅ Historical trends (5-10 year analysis)
 * 5. ✅ Database persistence (tracking + learning)
 */

import { fetchStockData, transformYahooData } from './yahoo-finance'
import { fetchNSEData, parseIndASXBRL } from './nse-xbrl-parser'
import { calculateProjections } from './projections/projection-engine'
import { validateStockData } from './validation/data-validator'
import { analyzeTrends, detectMoatFromTrends } from './historical/trends-service'
import { getWACCInputsFromMacro } from './macro/rbi-service'
import {
  saveStockSnapshot,
  saveValuation,
  getLatestSnapshot,
  calculateCAGRs,
  logValidationIssue,
} from './db/client'
import {
  calculateCleanTerminalValue,
  calculatePVTerminalValue,
  calculateIntrinsicValuePerShare,
} from './dcf-clean'

// ============================================================================
// MAIN ORCHESTRATION
// ============================================================================

/**
 * Complete DCF workflow with production architecture
 * Coordinating all layers: Data → Validation → Projections → Valuation
 */
export async function runCompleteDCF(ticker, options = {}) {
  const startTime = Date.now()
  const signal = options.signal || { aborted: false }

  const workflow = {
    ticker,
    status: 'PENDING',
    stages: [],
  }

  try {
    // -------------------------------------------------------------------------
    // STAGE 1: Data Layer - Fetch from Yahoo + Database
    // -------------------------------------------------------------------------
    workflow.stages.push({ name: 'data_fetch', status: 'RUNNING' })

    const [yahooData, historical] = await Promise.all([
      fetchWithFallback(ticker, signal),
      calculateCAGRs(ticker), // From DB
    ])

    if (signal.aborted) throw new Error('Request aborted')

    if (!yahooData) {
      return { error: 'NO_DATA', message: `No financial data found for ${ticker}` }
    }

    // Save snapshot for tracking
    await saveStockSnapshot(ticker, yahooData).catch(e =>
      console.warn('Failed to save snapshot:', e.message)
    )

    workflow.stages[0].status = 'COMPLETED'
    workflow.stages[0].dataPoints = Object.keys(yahooData).filter(k => yahooData[k]).length

    // -------------------------------------------------------------------------
    // STAGE 2: Validation Layer - Check data quality
    // -------------------------------------------------------------------------
    workflow.stages.push({ name: 'validation', status: 'RUNNING' })

    const validation = await validateStockData(ticker, yahooData)

    if (validation.errors.length > 0) {
      // Log validation failures
      await Promise.all(validation.errors.map(e =>
        logValidationIssue(ticker, e)
      ))
      workflow.stages[1].status = 'FAILED'
      workflow.stages[1].errors = validation.errors.length

      return {
        error: 'VALIDATION_FAILED',
        message: 'Data validation failed',
        details: validation.errors,
        dataQuality: validation.dataQuality,
      }
    }

    // Use clean data
    const cleanData = validation.cleanData
    workflow.stages[1].status = 'COMPLETED'
    workflow.stages[1].quality = validation.dataQuality

    // -------------------------------------------------------------------------
    // STAGE 3: Historical Trends - 5-10 year analysis
    // -------------------------------------------------------------------------
    workflow.stages.push({ name: 'historical', status: 'RUNNING' })

    const trends = await analyzeTrends(ticker, 5)
    const inferredMoat = detectMoatFromTrends(trends)

    // Override user moat if not specified
    const moat = options.moat || inferredMoat || 'MODERATE'

    workflow.stages[2].status = 'COMPLETED'
    workflow.stages[2].years = trends.revenue?.cagr ? '5-year' : 'insufficient'

    // ------------------------------------------------------------------------
    // STAGE 4: Macro Data - Dynamic WACC inputs
    // ------------------------------------------------------------------------
    workflow.stages.push({ name: 'macro', status: 'RUNNING' })

    const macroInputs = await getWACCInputsFromMacro()

    workflow.stages[3].status = 'COMPLETED'
    workflow.stages[3].riskFreeRate = macroInputs.riskFreeRate

    // ------------------------------------------------------------------------
    // STAGE 5: Projection Engine - 5-year forecasts (NO AI!)
    // ------------------------------------------------------------------------
    workflow.stages.push({ name: 'projections', status: 'RUNNING' })

    const projectionSettings = {
      moat,
      taxRate: options.taxRate || 25,
      capitalStructure: options.capitalStructure || { debt: 30, equity: 70 },
      revenueGrowth: options.revenueGrowth, // User override
    }

    const projectionResult = await calculateProjections(
      ticker,
      cleanData,
      projectionSettings
    )

    workflow.stages[4].status = 'COMPLETED'
    workflow.stages[4].years = 5

    // ------------------------------------------------------------------------
    // STAGE 6: DCF Valuation - Terminal value, PV calculations
    // ------------------------------------------------------------------------
    workflow.stages.push({ name: 'valuation', status: 'RUNNING' })

    const { projections } = projectionResult
    const { assumptions } = projectionResult
    const wacc = assumptions.wacc
    const terminalGrowth = assumptions.terminalGrowthRate

    // Calculate components
    const finalFCF = projections[projections.length - 1].fcf
    const finalEBITDA = projections[projections.length - 1].ebitda

    // Terminal Value using Gordon Growth
    const terminalValue = calculateCleanTerminalValue(finalFCF, wacc, terminalGrowth)
    const pvTerminalValue = calculatePVTerminalValue(terminalValue, wacc, 5)

    // PV of FCFs (already calculated in projections)
    const pvFCFs = projections.reduce((sum, p) => sum + p.pvFCF, 0)

    // Enterprise Value
const enterpriseValue = pvFCFs + pvTerminalValue

	// Equity Value
	const totalCash = cleanData.totalCash || 0
	const totalDebt = cleanData.totalDebt || 0

	const equityValue = enterpriseValue + totalCash - totalDebt

    // Intrinsic Value per Share
    const sharesOutstanding = cleanData.sharesOutstanding
    const intrinsicValuePerShare = calculateIntrinsicValuePerShare(
      equityValue,
      sharesOutstanding
    )

    // Valuation metrics
    const currentPrice = cleanData.price
    const upside = ((intrinsicValuePerShare - currentPrice) / currentPrice) * 100
    const marginOfSafety = ((intrinsicValuePerShare - currentPrice) / intrinsicValuePerShare) * 100

    // Verdict
    const verdict = upside > 10 ? 'UNDERVALUED' : upside < -10 ? 'OVERVALUED' : 'NEUTRAL'

    workflow.stages[5].status = 'COMPLETED'
    workflow.stages[5].upside = Math.round(upside * 10) /

    // Handle completion
    await handleValuationCompletion(
      ticker,
      currentPrice,
      intrinsicValuePerShare,
      options,
      projections,
      assumptions,
      valuationsGenerated
    )

    // ------------------------------------------------------------------------
    // STAGE 7: AI Assist - Only for qualitative insights
    // ------------------------------------------------------------------------
    workflow.stages.push({ name: 'ai_assist', status: options.includeAI ? 'RUNNING' : 'SKIPPED' })

    let aiInsights = null
    if (options.includeAI !== false) {
      aiInsights = await getAIInsights(ticker, cleanData, projections, {
        moat,
        verdict,
        upside,
        confidence: validation.dataQuality,
      })
      workflow.stages[6].status = 'COMPLETED'
    }

    // ------------------------------------------------------------------------
    // STAGE 8: Persistence - Save to database
    // ------------------------------------------------------------------------
    workflow.stages.push({ name: 'persistence', status: 'RUNNING' })

    const valuationData = {
      ticker,
      name: cleanData.name,
      wacc,
      terminalGrowthRate: terminalGrowth,
      taxRate: assumptions.taxRate,
      projectionYears: 5,
      currentPrice,
      intrinsicValue: intrinsicValuePerShare,
      upside,
      verdict,
      pvFCFs,
      terminalValue,
      pvTerminalValue,
      enterpriseValue,
      equityValue,
      totalCash,
      totalDebt,
      scenario: moat.toLowerCase(),
      dataQuality: validation.dataQuality,
      confidence: validation.dataQuality,
      aiAssisted: !!aiInsights,
      projections: projections.map(p => ({
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
        revenueGrowth: p.growthRate,
        ebitdaMargin: p.ebitdaMargin,
      })),
      assumptions,
    }

    await saveValuation(ticker, valuationData).catch(e =>
      console.warn('Failed to save valuation:', e.message)
    )

    workflow.stages[7].status = 'COMPLETED'

    // -------------------------------------------------------------------------
    // Return complete result
    // -------------------------------------------------------------------------
    const duration = Date.now() - startTime

    return {
      ticker,
      status: 'SUCCESS',
      duration,
      workflow,

      // Core valuation
      currentPrice,
      intrinsicValue: intrinsicValuePerShare,
      upside: Math.round(upside * 10) / 10,
      marginOfSafety: Math.round(marginOfSafety * 10) / 10,
      verdict,

      // Components
      projections,
      assumptions,

      // Summary values
      pvFCFs,
      terminalValue,
      pvTerminalValue,
      enterpriseValue,
      equityValue,

      // Quality metrics
      dataQuality: validation.dataQuality,
      moat,

      // AI insights (optional)
      aiInsights,

      // Historical context
      trends,

      // Actionable info
      recommendation: generateRecommendation(upside, moat, validation.dataQuality),
    }

  } catch (error) {
    workflow.status = 'FAILED'
    return {
      ticker,
      status: 'FAILED',
      error: error.message,
      workflow,
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Fetch data with fallback: Yahoo first, then alternatives
 */
async function fetchWithFallback(ticker, signal) {
  // Try Yahoo Finance first
  let rawData = await fetchStockData(ticker)
if (signal?.aborted) throw new Error("Request aborted")
let data = transformYahooData(rawData.ticker, { quote: rawData.quote, summary: rawData.summary })

  // Fallback to NSE if available
  if (!data || !data.revenue) {
    try {
      const nseData = await fetchNSEData(ticker)
      if (nseData) {
        data = { ...data, ...nseData }
      }
    } catch (e) {
      console.warn('NSE fallback failed:', e.message)
    }
  }

  return data
}

/**
 * Get AI insights (lightweight - only qualitative)
 */
async function getAIInsights(ticker, cleanData, projections, context) {
  // In production: Call AI API for qualitative insights
  // For now, return structured prompt
  return {
    thesis: `Analysis of ${ticker}`,
    keyRisks: [],
    catalysts: [],
    confidence: context.confidence,
    // This would be populated by AI call
    qualitative: true,
  }
}

/**
 * Generate actionable recommendation
 */
function generateRecommendation(upside, moat, dataQuality) {
  if (dataQuality < 50) {
    return {
      action: 'HOLD',
      reason: 'Insufficient data quality for reliable valuation',
      confidence: 'LOW',
    }
  }

  if (upside > 20 && ['WIDE', 'MODERATE'].includes(moat)) {
    return {
      action: 'BUY',
      reason: `Strong upside (${upside.toFixed(1)}%) with ${moat.toLowerCase()} moat`,
      confidence: 'HIGH',
    }
  }

  if (upside > 10) {
    return {
      action: 'ACCUMULATE',
      reason: `Moderate upside (${upside.toFixed(1)}%)`,
      confidence: 'MEDIUM',
    }
  }

  if (upside < -15) {
    return {
      action: 'SELL',
      reason: `Significant overvaluation (${upside.toFixed(1)}%)`,
      confidence: 'MEDIUM',
    }
  }

  return {
    action: 'HOLD',
    reason: 'Fairly valued or insufficient margin of safety',
    confidence: 'MEDIUM',
  }
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Run DCF for multiple stocks
 */
export async function runBatchDCF(tickers, options = {}) {
  const results = []
  const errors = []

  // Process in batches of 5 to avoid rate limits
  const batchSize = 5
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize)

    const batchResults = await Promise.all(
      batch.map(t => runCompleteDCF(t, options).catch(e => ({
        ticker: t,
        error: e.message,
        status: 'FAILED',
      })))
    )

    for (const result of batchResults) {
      if (result.error) {
        errors.push(result)
      } else {
        results.push(result)
      }
    }

    // Rate limit delay
    if (i + batchSize < tickers.length) {
      await new Promise(r => setTimeout(r, 2000))
    }
  }

  return {
    successful: results.length,
    failed: errors.length,
    results: results.sort((a, b) => (b.upside || 0) - (a.upside || 0)),
    errors,
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  runCompleteDCF,
  runBatchDCF,
}