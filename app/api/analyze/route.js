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
  const price = d.price?.toFixed?.(2) || 'N/A'
  const currency = d.currency || 'USD'

  return {
    system: 'You are a Tier-1 Institutional Equity Analyst. You MUST return ONLY a valid JSON object. You are strictly forbidden from hallucinating illogical math.',
    user: `Analyze ${ticker} (${d.name}), trading at ${price} ${currency}.

Financials: Market Cap ${fmtNumber(d.marketCap)}, P/E ${d.pe?.toFixed?.(1) || 'N/A'}, Fwd P/E ${d.forwardPE?.toFixed?.(1) || 'N/A'}
Revenue ${fmtNumber(d.revenue)}, EBITDA ${fmtNumber(d.ebitda)}, FCF ${fmtNumber(d.freeCashFlow)}
Margins: Net ${fmtPercent(d.profitMargin)}, Gross ${fmtPercent(d.grossMargin)}, ROE ${fmtPercent(d.roe)}
Growth: Revenue ${fmtPercent(d.revenueGrowth)}, Beta ${d.beta?.toFixed?.(2) || 'N/A'}
Sector: ${d.sector || 'N/A'}, Industry: ${d.industry || 'N/A'}

CRITICAL MATH RULES - VIOLATION IS STRICTLY FORBIDDEN:
1. Target Price MUST be a realistic 12-month projection based on historical multiples and analyst consensus. DO NOT guess.
2. Confidence score MUST be an integer between 60 and 95 based on data clarity. DO NOT output numbers like 0.6, 5, or 100.
3. The verdict (BUY/HOLD/SELL) MUST logically match the target vs current price ratio:
   - If target > current: verdict must be BUY or HOLD (upside available)
   - If target < current: verdict must be SELL or HOLD (downside risk)
   - NEVER say BUY when target is lower than current price (logical impossibility).
4. comparisonPeers MUST be real companies strictly operating in the ${d.sector || 'same'} sector/industry. NEVER hallucinate random tickers.
5. All case probabilities (bull + base + bear) should sum to approximately 100.
6. upsideDownside MUST be calculated as: ((targetPrice - ${price === 'N/A' ? 0 : price}) / ${price === 'N/A' ? 1 : price}) * 100
7. If current price is ${price}, then:
   - A target of ₹422.50 on ₹399.35 is +5.8% upside, NOT +0.0%
   - A target below current is negative upside (downside)

Return ONLY JSON matching this structure:
{
  "verdict": "BUY|HOLD|SELL",
  "confidence": 85,
  "targetPrice": 422.50,
  "upsideDownside": 5.8,
  "timeHorizon": "12-Month",
  "thesisSummary": "...",
  "bullCase": { "title": "...", "targetPrice": 480, "probability": 30, "points": ["..."] },
  "bearCase": { "title": "...", "targetPrice": 350, "probability": 20, "points": ["..."] },
  "baseCase": { "title": "...", "targetPrice": 422.50, "probability": 50 },
  "keyDrivers": [{"driver": "...", "detail": "...", "impact": "POSITIVE|NEGATIVE"}],
  "moatRating": 4,
  "moatType": "Wide Moat",
  "growthQuality": "High Quality",
  "catalysts": ["..."],
  "risks": ["..."],
  "positionSizing": "Medium",
  "comparisonPeers": ["PEER1", "PEER2"]
}

ABSOLUTE REQUIREMENT: ALL NUMBERS MUST BE MATHEMATICALLY CONSISTENT AND LOGICALLY VALID.`,
  }
}

function buildDCFPrompt(ticker, d) {
  const price = d.price?.toFixed?.(2) || 100
  const intrinsicValue = d.intrinsicValuePerShare?.toFixed?.(2) || 0
  const upside = d.upside?.toFixed?.(1) || 0
  const dcfRating = d.dcfRating || 'NEUTRAL'

  return {
    system: 'You are a Senior Financial Analyst. Return ONLY valid JSON. NEVER use markdown backticks.',
    user: `Provide DCF analysis commentary and risk assessment for ${ticker}.

INJECTED CALCULATIONS (these are mathematically complete - use them for context):
- Current Price: ${price}
- Intrinsic Value: ${intrinsicValue}
- Upside: ${upside}%
- DCF Rating: ${dcfRating}
- WACC: ${d.assumptions?.wacc || 10}%
- Terminal Growth: ${d.assumptions?.terminalGrowthRate || 2.5}%

CRITICAL RULES:
1. The math is ALREADY DONE in JavaScript. DO NOT recalculate. Focus on qualitative analysis.
2. REPLACE all '0' and empty strings with HIGHLY SPECIFIC, sector-relevant content.
3. keyRisksToModel MUST contain exactly 3 sector-specific risks (e.g., "Coal price volatility compressing margins"). Generic risks like "market risk" are FORBIDDEN.
4. analystNote MUST explain WHY intrinsic value differs from market price in exactly 3 sentences.

Return ONLY JSON matching this exact structure:
{
  "assumptions": {
    "wacc": ${d.assumptions?.wacc || 0},
    "terminalGrowthRate": ${d.assumptions?.terminalGrowthRate || 0},
    "taxRate": ${d.assumptions?.taxRate || 0}
  },
  "projections": [
    {"year": 1, "revenue": 0, "ebitda": 0, "fcf": 0}
  ],
  "intrinsicValuePerShare": ${intrinsicValue},
  "marginOfSafety": ${d.marginOfSafety || 0},
  "upside": ${upside},
  "dcfRating": "${dcfRating}",
  "keyRisksToModel": [
    "Provide 3 highly specific, sector-relevant risks to this DCF model (e.g., Margin compression due to coal prices for utilities)."
  ],
  "analystNote": "Write a 3-sentence institutional analyst commentary explaining why the intrinsic value deviates from the current market price based on the fundamental cash flows."
}`
  }
}

function buildRiskPrompt(ticker, d) {
  const price = d.price?.toFixed?.(2) || 'N/A'
  const pe = d.pe?.toFixed?.(2) || '—'
  const fwdPe = d.forwardPE?.toFixed?.(2) || '—'
  const evEbitda = d.evToEbitda?.toFixed?.(2) || '—'
  const debtEq = d.debtToEquity?.toFixed?.(2) || '—'
  const roe = d.roe ? (d.roe * 100).toFixed(2) + '%' : '—'
  const currentRatio = d.currentRatio?.toFixed?.(2) || '—'

  // Technicals injection
  const ma50 = d.fiftyDayAverage?.toFixed?.(2) || 'calculated'
  const ma200 = d.twoHundredDayAverage?.toFixed?.(2) || 'calculated'
  const weekHigh52 = d.weekHigh52?.toFixed?.(2) || 'N/A'
  const weekLow52 = d.weekLow52?.toFixed?.(2) || 'N/A'
  const rsi = d.rsi || 'approximate'
  const volumeSignal = d.avgVolume && d.volume
    ? (d.volume > d.avgVolume * 1.2 ? 'Above Average' : d.volume < d.avgVolume * 0.8 ? 'Below Average' : 'Normal')
    : 'N/A'

  return {
    system: 'You are a Quantitative Risk Analyst. Return ONLY valid JSON. NEVER use markdown backticks.',
    user: `Analyze risk metrics and financial health for ${ticker}.

INJECTED CALCULATIONS (use these, do not invent):
- Current Price: ${price}
- P/E (TTM): ${pe}
- Forward P/E: ${fwdPe}
- EV/EBITDA: ${evEbitda}
- Debt to Equity: ${debtEq}
- ROE: ${roe}
- Current Ratio: ${currentRatio}
- 50-Day MA: ${ma50}
- 200-Day MA: ${ma200}
- 52W High: ${weekHigh52}
- 52W Low: ${weekLow52}
- Volume Signal: ${volumeSignal}
- Beta: ${d.beta?.toFixed?.(2) || '—'}

CRITICAL RULES:
1. USE the injected calculation values. DO NOT invent new numbers.
2. REPLACE all '0' and empty strings with HIGHLY ACCURATE analysis.
3. technicals.support should use 50-Day MA or 52W Low as fallback.
4. technicals.resistance should use 200-Day MA or 52W High as fallback.
5. riskFactors MUST include Liquidity Risk (based on Current Ratio), Leverage Risk (based on Debt/Equity), and Valuation Risk (based on P/E vs sector).
6. overallRiskScore & overallQualityScore MUST be integers 1-10.

Return ONLY JSON matching this exact structure:
{
  "overallRiskScore": 0,
  "overallQualityScore": 0,
  "riskSummary": "Provide a 2-sentence institutional summary of the risk profile.",
  "technicals": {
    "trend": "BULLISH|BEARISH|NEUTRAL",
    "rsi": ${rsi === 'approximate' ? 50 : rsi},
    "support": ${ma50 !== 'calculated' ? ma50 : (weekLow52 !== 'N/A' ? weekLow52 : 0)},
    "resistance": ${ma200 !== 'calculated' ? ma200 : (weekHigh52 !== 'N/A' ? weekHigh52 : 0)},
    "volumeSignal": "${volumeSignal}"
  },
  "valuationRatios": [
    {"name": "P/E", "value": "${pe}x", "benchmark": "0.0x"}
  ],
  "qualityRatios": [
    {"name": "ROE", "value": "${roe}", "benchmark": "0.0%"},
    {"name": "Current Ratio", "value": "${currentRatio}x", "benchmark": "0.0x"}
  ],
  "leverageRatios": [
    {"name": "D/E", "value": "${debtEq}x", "benchmark": "0.0x"}
  ],
  "riskFactors": [
    {"factor": "Liquidity Risk", "severity": "High|Medium|Low", "description": "Analyze based on Current Ratio of ${currentRatio}."},
    {"factor": "Leverage Risk", "severity": "High|Medium|Low", "description": "Analyze based on D/E of ${debtEq}."},
    {"factor": "Valuation Risk", "severity": "High|Medium|Low", "description": "Analyze based on P/E of ${pe} vs sector."}
  ],
  "peerBenchmarks": [
    {"ticker": "PEER1", "metric": "P/E", "value": "0.0x"}
  ]
}`
  }
}

function buildNewsPrompt(ticker, d) {
  const price = d.price?.toFixed?.(2) || 'N/A';
  const target = d.targetMeanPrice?.toFixed?.(2) || 'N/A';
  const rec = d.recommendationKey ? d.recommendationKey.toUpperCase() : 'HOLD';

  // Calculate real upside mathematically
  let realUpside = 0;
  if (d.targetMeanPrice && d.price && d.price > 0) {
    realUpside = ((d.targetMeanPrice - d.price) / d.price) * 100;
  }
  const upsideStr = realUpside !== 0 ? realUpside.toFixed(2) : '0.00';

  return {
    system: 'You are a Senior Market Sentiment Analyst. Return ONLY valid JSON. NEVER use markdown backticks.',
    user: `Analyze the market sentiment and news narrative for ${ticker}.

COMPANY CONTEXT:
- Sector: ${d.sector || 'N/A'}
- Industry: ${d.industry || 'N/A'}
- Current Price: ${price}
- Analyst Mean Target: ${target}
- Recommendation: ${rec}

CRITICAL RULES:
1. REPLACE all '0' and empty string '""' values in the template below with your own realistic analysis. DO NOT output 0 unless it is the actual calculated value.
2. sentimentScore MUST be an integer between 0 and 100.
3. The analystConsensus object MUST strictly use the target and upside values already injected into the template. Do not change them.
4. Generate highly realistic, sector-specific themes, catalysts, and events.

Return ONLY JSON matching this exact structure:
{
  "sentimentScore": 0,
  "sentimentLabel": "Neutral",
  "sentimentRationale": "",
  "analystConsensus": {
    "rating": "${rec.includes('BUY') ? 'BUY' : rec.includes('SELL') ? 'SELL' : 'HOLD'}",
    "meanTarget": ${target !== 'N/A' ? target : 'null'},
    "upside": ${upsideStr},
    "buyCount": 0,
    "holdCount": 0,
    "sellCount": 0,
    "noteOnConsensus": ""
  },
  "keyThemes": [
    {"theme": "", "sentiment": "NEUTRAL", "timeframe": "Short-term", "detail": ""}
  ],
  "bullCatalysts": [
    {"catalyst": "", "probability": "Medium", "potentialImpact": ""}
  ],
  "bearCatalysts": [
    {"catalyst": "", "probability": "Medium", "potentialImpact": ""}
  ],
  "macroExposure": [
    {"factor": "", "exposure": "NEUTRAL", "detail": ""}
  ],
  "institutionalActivity": {
    "shortInterestTrend": "Stable",
    "shortSqueezeRisk": "Low",
    "institutionalOwnershipNote": ""
  },
  "upcomingEvents": [
    {"event": "Earnings Call", "expectedDate": "Next Quarter", "marketImplications": ""}
  ],
  "tradingNote": ""
}`
  };
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
      modelConfig: { maxTokens: 4096, temperature: 0.1 },
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
