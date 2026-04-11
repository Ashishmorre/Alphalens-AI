import { NextResponse } from 'next/server'
import {
  getClientIP,
  checkRateLimit,
  RATE_LIMIT_PRESETS,
  createRateLimitHeaders,
} from '@/lib/rate-limit'
import { validateCompareRequest } from '@/lib/validation'
import { safeParseJSON } from '@/lib/json-parser'
import {
  checkBodySize,
  parseJSONBody,
  logError,
  callAIWithRetry,
} from '@/lib/api-utils'
import { fmtNumber, fmtPercent } from '@/lib/yahoo-finance'
import { SECURITY_HEADERS, checkRequestSafety } from '@/lib/security'

const RATE_LIMIT = RATE_LIMIT_PRESETS.compare

function buildPrompt(stock1, stock2) {
  const fmt = fmtNumber
  const pct = fmtPercent

  return {
    system: 'You are a senior portfolio manager. Return ONLY valid JSON with no markdown.',
    user: `Compare ${stock1.ticker} vs ${stock2.ticker} for investment.

${stock1.ticker} (${stock1.name}): Price ${stock1.price?.toFixed(2)} ${stock1.currency || 'USD'}, MCap ${fmt(stock1.marketCap)}, P/E ${stock1.pe?.toFixed(1) || 'N/A'}, EV/EBITDA ${stock1.evToEbitda?.toFixed(1) || 'N/A'}, Revenue ${fmt(stock1.revenue)}, Growth ${pct(stock1.revenueGrowth)}, Net Margin ${pct(stock1.profitMargin)}, ROE ${pct(stock1.roe)}, Beta ${stock1.beta?.toFixed(2) || 'N/A'}

${stock2.ticker} (${stock2.name}): Price ${stock2.price?.toFixed(2)} ${stock2.currency || 'USD'}, MCap ${fmt(stock2.marketCap)}, P/E ${stock2.pe?.toFixed(1) || 'N/A'}, EV/EBITDA ${stock2.evToEbitda?.toFixed(1) || 'N/A'}, Revenue ${fmt(stock2.revenue)}, Growth ${pct(stock2.revenueGrowth)}, Net Margin ${pct(stock2.profitMargin)}, ROE ${pct(stock2.roe)}, Beta ${stock2.beta?.toFixed(2) || 'N/A'}

Return ONLY this JSON:
{
  "winner": "${stock1.ticker}",
  "winnerRationale": "2-3 sentence rationale",
  "comparisonDimensions": [
    { "dimension": "Valuation", "winner": "${stock1.ticker}", "stock1Score": 7, "stock2Score": 6, "detail": "brief detail" },
    { "dimension": "Growth", "winner": "${stock2.ticker}", "stock1Score": 6, "stock2Score": 8, "detail": "brief detail" },
    { "dimension": "Profitability", "winner": "${stock1.ticker}", "stock1Score": 8, "stock2Score": 7, "detail": "brief detail" },
    { "dimension": "Financial Health", "winner": "TIE", "stock1Score": 7, "stock2Score": 7, "detail": "brief detail" },
    { "dimension": "Momentum", "winner": "${stock2.ticker}", "stock1Score": 6, "stock2Score": 7, "detail": "brief detail" },
    { "dimension": "Income", "winner": "${stock1.ticker}", "stock1Score": 7, "stock2Score": 5, "detail": "brief detail" }
  ],
  "headToHead": [
    { "metric": "P/E Ratio", "stock1Value": "28x", "stock2Value": "32x", "advantage": "${stock1.ticker}" },
    { "metric": "Revenue Growth", "stock1Value": "12%", "stock2Value": "18%", "advantage": "${stock2.ticker}" },
    { "metric": "Net Margin", "stock1Value": "25%", "stock2Value": "20%", "advantage": "${stock1.ticker}" },
    { "metric": "ROE", "stock1Value": "35%", "stock2Value": "28%", "advantage": "${stock1.ticker}" },
    { "metric": "Beta (Risk)", "stock1Value": "1.2", "stock2Value": "1.5", "advantage": "${stock1.ticker}" },
    { "metric": "Dividend Yield", "stock1Value": "1.2%", "stock2Value": "0.5%", "advantage": "${stock1.ticker}" }
  ],
  "stock1Strengths": ["strength1", "strength2", "strength3" ],
  "stock2Strengths": ["strength1", "strength2", "strength3" ],
  "stock1Weaknesses": ["weakness1", "weakness2" ],
  "stock2Weaknesses": ["weakness1", "weakness2" ],
  "recommendation": {
    "forGrowthInvestors": "${stock2.ticker}",
    "growthRationale": "rationale",
    "forValueInvestors": "${stock1.ticker}",
    "valueRationale": "rationale",
    "forIncomeInvestors": "${stock1.ticker}",
    "incomeRationale": "rationale"
  },
  "portfolioContext": "2-3 sentences on portfolio fit"
}`,
  }
}

/**
 * POST /api/compare
 * Compare two stocks using AI analysis
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
  const rateLimit = checkRateLimit(`compare:${clientIP}`, RATE_LIMIT)
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
  const validation = validateCompareRequest(bodyResult.data)
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
    const { stock1, stock2 } = validation.data

    // Build and call AI
    const prompt = buildPrompt(stock1, stock2)
    const rawResponse = await callAIWithRetry({
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      modelConfig: { maxTokens: 3000 },
    })

    // Parse JSON response
    const comparisonData = safeParseJSON(rawResponse)

    return NextResponse.json(
      { success: true, data: comparisonData, error: null },
      { status: 200, headers }
    )
  } catch (error) {
    logError('compare', error, { body: bodyResult.data?.stock1?.ticker })

    // Safe error messages
    if (error.message?.includes('JSON') || error.message?.includes('parse')) {
      return NextResponse.json(
        { success: false, error: 'Failed to parse AI response. Please retry.' },
        { status: 500, headers }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Comparison failed. Please try again later.' },
      { status: 500, headers }
    )
  }
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
