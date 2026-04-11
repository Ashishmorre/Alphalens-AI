import { NextResponse } from 'next/server'
import {
  getClientIP,
  checkRateLimit,
  RATE_LIMIT_PRESETS,
  createRateLimitHeaders,
} from '@/lib/rate-limit'
import { validateAnalyzeRequest } from '@/lib/validation'
import { safeParseJSON } from '@/lib/json-parser'
import {
  checkBodySize,
  parseJSONBody,
  logError,
  callAIWithRetry,
} from '@/lib/api-utils'
import { fmtNumber, fmtPercent } from '@/lib/yahoo-finance'
import { SECURITY_HEADERS, checkRequestSafety } from '@/lib/security'

const RATE_LIMIT = RATE_LIMIT_PRESETS.aiAnalysis

/**
 * Build analysis prompt based on type
 */
function buildPrompt(ticker, data, analysisType) {
  switch (analysisType) {
    case 'thesis':
      return buildThesisPrompt(ticker, data)
    case 'dcf':
      return buildDCFPrompt(ticker, data)
    case 'risk':
      return buildRiskPrompt(ticker, data)
    case 'news':
      return buildNewsPrompt(ticker, data)
    default:
      throw new Error(`Unknown analysis type: ${analysisType}`)
  }
}

function buildThesisPrompt(ticker, d) {
  return {
    system: 'You are a senior equity analyst at a top hedge fund. Return ONLY valid JSON with no markdown.',
    user: `Analyze ${ticker} (${d.name}), trading at ${d.price?.toFixed?.(2) || 'N/A'} ${d.currency || 'USD'}.

Financials: Market Cap ${fmtNumber(d.marketCap)}, P/E ${d.pe?.toFixed?.(1) || 'N/A'}, Fwd P/E ${d.forwardPE?.toFixed?.(1) || 'N/A'}
Revenue ${fmtNumber(d.revenue)}, EBITDA ${fmtNumber(d.ebitda)}, FCF ${fmtNumber(d.freeCashFlow)}
Margins: Net ${fmtPercent(d.profitMargin)}, Gross ${fmtPercent(d.grossMargin)}, ROE ${fmtPercent(d.roe)}
Growth: Revenue ${fmtPercent(d.revenueGrowth)}, Beta ${d.beta?.toFixed?.(2) || 'N/A'}
Sector: ${d.sector || 'N/A'}, Industry: ${d.industry || 'N/A'}

Return ONLY JSON with: verdict, confidence, targetPrice, upsideDownside, timeHorizon, thesisSummary, bullCase, bearCase, baseCase, keyDrivers, moatRating, moatType, growthQuality, catalysts, risks, positionSizing, comparisonPeers.`,
  }
}

function buildDCFPrompt(ticker, d) {
  const price = d.price?.toFixed?.(2) || 100
  return {
    system: 'You are a CFA charterholder. Return ONLY valid JSON with no markdown.',
    user: `Build a 5-year DCF model for ${ticker}.

Current: ${d.currency || 'USD'} ${price}, Revenue ${fmtNumber(d.revenue)}, EBITDA ${fmtNumber(d.ebitda)}
Margins: Gross ${fmtPercent(d.grossMargin)}, Operating ${fmtPercent(d.operatingMargin)}
Balance: Debt ${fmtNumber(d.totalDebt)}, Cash ${fmtNumber(d.totalCash)}

Return ONLY JSON with: assumptions (wacc, terminalGrowthRate, taxRate, revenueGrowthRates[], ebitdaMargins[]), projections[5 years], pvFCFs, terminalValue, pvTerminalValue, enterpriseValue, equityValue, intrinsicValuePerShare, marginOfSafety, upside, dcfRating, sensitivityTable, keyRisksToModel, analystNote.`,
  }
}

function buildRiskPrompt(ticker, d) {
  return {
    system: 'You are a quantitative risk analyst. Return ONLY valid JSON with no markdown.',
    user: `Analyze risk and ratios for ${ticker}.

Valuation: P/E ${d.pe?.toFixed?.(1) || 'N/A'}, EV/EBITDA ${d.evToEbitda?.toFixed?.(1) || 'N/A'}
Quality: ROE ${fmtPercent(d.roe)}, ROA ${fmtPercent(d.roa)}, Margins ${fmtPercent(d.profitMargin)}
Leverage: D/E ${d.debtToEquity?.toFixed?.(2) || 'N/A'}, Current ${d.currentRatio?.toFixed?.(2) || 'N/A'}

Return ONLY JSON with: valuationRatios[], qualityRatios[], leverageRatios[], technicals, riskFactors[], overallRiskScore, overallQualityScore, riskSummary, peerBenchmarks[].`,
  }
}

function buildNewsPrompt(ticker, d) {
  return {
    system: 'You are a market intelligence analyst. Return ONLY valid JSON.',
    user: `Analyze market sentiment for ${ticker}.

Price: ${d.price?.toFixed?.(2) || 'N/A'}, Consensus: ${d.recommendationKey || 'N/A'}, Target: ${d.targetMeanPrice?.toFixed?.(2) || 'N/A'}
Sector: ${d.sector || 'N/A'}

Return ONLY JSON with: sentimentScore, sentimentLabel, sentimentRationale, analystConsensus, keyThemes[], bullCatalysts[], bearCatalysts[], macroExposure[], institutionalActivity, upcomingEvents[], tradingNote.`,
  }
}

/**
 * POST /api/analyze
 * Generate AI analysis for a stock
 */
export async function POST(request) {
  // Security check
  const safety = checkRequestSafety(request)
  if (!safety.safe) {
    return NextResponse.json(
      { success: false, error: safety.reason },
      { status: 403, headers: SECURITY_HEADERS }
    )
  }

  const clientIP = getClientIP(request)

  // Rate limiting
  const rateLimit = checkRateLimit(`analyze:${clientIP}`, RATE_LIMIT)
  const headers = { ...SECURITY_HEADERS, ...createRateLimitHeaders(rateLimit) }

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: 'Rate limit exceeded. Please try again later.',
      },
      { status: 429, headers: { ...headers, 'Retry-After': String(rateLimit.retryAfter) } }
    )
  }

  // Check body size
  const sizeCheck = checkBodySize(request)
  if (!sizeCheck.ok) {
    return NextResponse.json(
      { success: false, error: 'Request body too large' },
      { status: 413, headers }
    )
  }

  // Parse JSON body
  const bodyResult = await parseJSONBody(request)
  if (!bodyResult.ok) {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON in request body' },
      { status: 400, headers }
    )
  }

  // Validate input
  const validation = validateAnalyzeRequest(bodyResult.data)
  if (!validation.valid) {
    return NextResponse.json(
      { success: false, error: validation.error },
      { status: 400, headers }
    )
  }

  // Check AI keys
  if (!process.env.CEREBRAS_API_KEY && !process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'Service temporarily unavailable' },
      { status: 503, headers }
    )
  }

  try {
    const { ticker, analysisType, stockData } = validation.data

    // Build and call AI
    const prompt = buildPrompt(ticker, stockData, analysisType)
    const rawResponse = await callAIWithRetry({
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      modelConfig: { maxTokens: 4096 },
    })

    // Parse JSON response
    const analysisData = safeParseJSON(rawResponse)

    return NextResponse.json(
      { success: true, data: analysisData, error: null },
      { status: 200, headers }
    )

  } catch (error) {
    logError('analyze', error, { body: bodyResult.data?.ticker })

    // Safe error messages
    if (error.message?.includes('JSON') || error.message?.includes('parse')) {
      return NextResponse.json(
        { success: false, error: 'Failed to parse AI response. Please retry.' },
        { status: 500, headers }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Analysis failed. Please try again later.' },
      { status: 500, headers }
    )
  }
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
