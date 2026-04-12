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
  return {
    system: 'You are a Quantitative Financial Modeler. You MUST return ONLY a valid JSON object. Your internal math calculations must be flawless.',
    user: `Build a 5-year DCF model for ${ticker}.

CURRENT INPUT DATA (do not deviate from these base numbers):
- Price: ${price} ${d.currency || 'USD'}
- Revenue: ${fmtNumber(d.revenue)}
- EBITDA: ${fmtNumber(d.ebitda)}
- Gross Margin: ${fmtPercent(d.grossMargin)}
- Operating Margin: ${fmtPercent(d.operatingMargin)}
- Total Debt: ${fmtNumber(d.totalDebt)}
- Cash: ${fmtNumber(d.totalCash)}
- Shares Outstanding: ${d.sharesOutstanding || 'estimate based on market cap'}

CRITICAL MATH RULES - ANY VIOLATION RENDERS OUTPUT USELESS:

1. All projections MUST scale logically from the CURRENT DATA provided above.
2. DO NOT jump magnitudes arbitrarily (e.g., if Revenue is in Billions, projections stay in Billions).
3. intrinsicValuePerShare MUST logically correlate with enterpriseValue and outstanding shares.
   Formula: equityValue = enterpriseValue + cash - debt; intrinsicValuePerShare = equityValue / sharesOutstanding
4. marginOfSafety MUST be calculated as: ((intrinsicValuePerShare - ${price}) / intrinsicValuePerShare) * 100
5. upside MUST be calculated as: ((intrinsicValuePerShare - ${price}) / ${price}) * 100
6. dcfRating MUST be UNDERVALUED if intrinsic > current, OVERVALUED if intrinsic < current, NEUTRAL if within 10%
7. If intrinsicValuePerShare = 125.50 and current = 399.35, then:
   - upside = -68.5% (negative, because 125 < 399)
   - dcfRating = OVERVALUED (red)
   - This is NOT Undervalued with +22.6% upside - that is mathematically impossible

Return a SINGLE VALID JSON OBJECT with this exact structure (numbers only):
{
  "assumptions": {
    "wacc": 10.0,
    "terminalGrowthRate": 2.5,
    "taxRate": 21.0,
    "revenueGrowthRates": [10.0, 9.5, 9.0, 8.5, 8.0],
    "ebitdaMargins": [20.0, 21.0, 22.0, 23.0, 24.0]
  },
  "projections": [
    {"year": 1, "revenue": 1000000000, "ebitda": 200000000, "ebit": 150000000, "nopat": 118500000, "capex": -50000000, "nwcChange": -10000000, "fcf": 58500000}
  ],
  "pvFCFs": 280000000,
  "terminalValue": 1500000000,
  "pvTerminalValue": 950000000,
  "enterpriseValue": 1230000000,
  "equityValue": 1000000000,
  "intrinsicValuePerShare": 125.50,
  "marginOfSafety": 15.0,
  "upside": -68.5,
  "dcfRating": "OVERVALUED",
  "sensitivityTable": {
    "waccRange": [8.0, 9.0, 10.0, 11.0, 12.0],
    "tgrRange": [1.5, 2.0, 2.5, 3.0, 3.5],
    "values": [
        [180, 165, 150, 138, 128],
        [175, 160, 145, 134, 124],
        [170, 155, 140, 130, 120],
        [165, 150, 135, 125, 115],
        [160, 145, 130, 120, 110]
      ]
  },
  "keyRisksToModel": ["Risk 1", "Risk 2"],
  "analystNote": "Brief DCF methodology note"
}

REQUIREMENTS:
1. Return ONLY the JSON object, no markdown backticks
2. Use realistic numbers based on ${ticker}'s financials
3. All numeric values must be plain numbers (not strings)
4. WACC in percentage points (e.g., 10.0 for 10%)
5. 5 projection years exactly
6. CRITICAL: Ensure ALL calculations are mathematically consistent
7. CRITICAL: sensitivityTable.values MUST be a 5x5 matrix (5 arrays, each with 5 numbers) matching waccRange.length x tgrRange.length
8. NO HALLUCINATIONS: If you cannot determine a value, use null or 0, never invent`,
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
  const marketCap = fmtNumber(d.marketCap)
  const fcf = fmtNumber(d.freeCashFlow)

  // Calculate technicals from raw data
  const ma50 = d.fiftyDayAverage || 0
  const ma200 = d.twoHundredDayAverage || 0
  const weekHigh52 = d.weekHigh52 || 0
  const weekLow52 = d.weekLow52 || 0
  const volume = d.volume || 0
  const avgVolume = d.avgVolume || 0

  // Calculate momentum indicators
  const priceVs50DMA = ma50 > 0 && d.price ? ((d.price - ma50) / ma50 * 100).toFixed(1) : '0'
  const priceVs200DMA = ma200 > 0 && d.price ? ((d.price - ma200) / ma200 * 100).toFixed(1) : '0'
  const weekPosition52 = weekHigh52 > weekLow52 && d.price ? ((d.price - weekLow52) / (weekHigh52 - weekLow52) * 100).toFixed(0) : '50'

  // Volume signal
  let volumeSignal = 'Normal'
  if (volume && avgVolume) {
    const ratio = volume / avgVolume
    volumeSignal = ratio > 1.2 ? 'Above Average' : ratio < 0.8 ? 'Below Average' : 'Normal'
  }

  // Trend determination
  let trend = 'NEUTRAL'
  if (d.price) {
    if (ma50 > ma200 && d.price > ma50) trend = 'BULLISH'
    else if (ma50 < ma200 && d.price < ma50) trend = 'BEARISH'
  }

  // Support/Resistance levels
  const support = ma50 > 0 ? ma50 : weekLow52
  const resistance = ma200 > 0 ? ma200 : weekHigh52

  return {
    system: 'You are a Quantitative Risk Analyst. Return ONLY valid JSON. NEVER use markdown backticks.',
    user: `Analyze risk metrics and financial health for ${ticker}.

INJECTED FINANCIAL DATA (MUST USE THESE EXACT VALUES):
- Current Price: ${price}
- Market Cap: ${marketCap}
- P/E (TTM): ${pe}x
- Forward P/E: ${fwdPe}x
- EV/EBITDA: ${evEbitda}
- Debt to Equity: ${debtEq}
- ROE: ${roe}
- Free Cash Flow: ${fcf}
- Current Ratio: ${currentRatio}
- Beta: ${d.beta?.toFixed?.(2) || '—'}
- Avg Volume: ${fmtNumber(d.avgVolume)}

INJECTED TECHNICAL DATA (PRE-CALCULATED):
- Trend: ${trend}
- Price vs 50DMA: ${priceVs50DMA}%
- Price vs 200DMA: ${priceVs200DMA}%
- 52-Week Position: ${weekPosition52}%
- 52-Week Range: ${weekLow52} - ${weekHigh52}
- Volume Signal: ${volumeSignal}
- Support Level: ${support}
- Resistance Level: ${resistance}

CRITICAL RULES:
1. USE ALL injected data EXACTLY as provided. Do NOT invent new values.
2. Risk Factors MUST analyze based on: Liquidity (Current Ratio), Leverage (D/E), Valuation (P/E).
3. REPLACE all placeholders with YOUR analysis - generic descriptions are FORBIDDEN.
4. overallRiskScore & overallQualityScore MUST be integers 1-10.
5. Peer tickers MUST support ${d.currency || 'USD'} trading and be in ${d.sector || 'same sector'}.
6. All arrays (valuationRatios, qualityRatios, leverageRatios, riskFactors, peerBenchmarks) MUST have at least 2-3 items with realistic data.
7. peerBenchmarks MUST include at least 3 real peer companies from same sector as ${d.sector || 'the industry'}.

Return ONLY JSON matching this EXACT structure (field names must match):
{
  "overallRiskScore": ${Math.max(1, Math.min(10, Math.round((d.beta || 1) * 5)))},
  "overallQualityScore": ${Math.max(1, Math.min(10, Math.round((d.roe || 0.12) * 100 / 2)))},
  "riskSummary": "Write a 2-sentence institutional summary of risk profile using injected data.",
  "technicals": {
    "trend": "${trend}",
    "momentum": "${Number(priceVs50DMA) > 0 ? 'UPTREND' : Number(priceVs50DMA) < 0 ? 'DOWNTREND' : 'NEUTRAL'}",
    "technicalRating": "${Number(priceVs200DMA) > 5 ? 'BULLISH' : Number(priceVs200DMA) < -5 ? 'BEARISH' : 'NEUTRAL'}",
    "priceVs50DMA": "${priceVs50DMA}",
    "priceVs200DMA": "${priceVs200DMA}",
    "weekPosition52": "${weekPosition52}",
    "keyLevels": {
      "support": ${support},
      "resistance": ${resistance}
    }
  },
  "valuationRatios": [
    {"metric": "P/E (TTM)", "value": "${pe}x", "sectorMedian": "0.0x", "assessment": "FAIR", "note": "Analysis based on sector"},
    {"metric": "Forward P/E", "value": "${fwdPe}x", "sectorMedian": "0.0x", "assessment": "FAIR", "note": "Analysis based on growth"},
    {"metric": "EV/EBITDA", "value": "${evEbitda}x", "sectorMedian": "0.0x", "assessment": "FAIR", "note": "Analysis based on sector multiples"}
  ],
  "qualityRatios": [
    {"metric": "ROE", "value": "${roe}", "benchmark": "12.0%", "rating": "${d.roe > 0.15 ? 'EXCELLENT' : d.roe > 0.10 ? 'GOOD' : 'AVERAGE'}"},
    {"metric": "Current Ratio", "value": "${currentRatio}x", "benchmark": "1.5x", "rating": "${Number(currentRatio) > 2 ? 'EXCELLENT' : Number(currentRatio) > 1.5 ? 'GOOD' : 'AVERAGE'}"},
  {"metric": "FCF Margin", "value": "${d.freeCashFlow && d.revenue ? ((d.freeCashFlow / d.revenue) * 100).toFixed(1) + '%' : '—'}", "benchmark": "10%", "rating": "AVERAGE"}
  ],
  "leverageRatios": [
    {"metric": "Debt/Equity", "value": "${debtEq}x", "threshold": "1.0x", "risk": "${Number(debtEq) > 1.5 ? 'HIGH' : Number(debtEq) > 0.8 ? 'MEDIUM' : 'LOW'}"}
  ],
  "riskFactors": [
    {"risk": "Liquidity Risk", "severity": "${Number(currentRatio) < 1 ? 'HIGH' : Number(currentRatio) < 1.5 ? 'MEDIUM' : 'LOW'}", "likelihood": "MEDIUM", "detail": "Analyze based on current ratio of ${currentRatio}. Provide specific sector context."},
    {"risk": "Leverage Risk", "severity": "${Number(debtEq) > 1.5 ? 'HIGH' : Number(debtEq) > 0.8 ? 'MEDIUM' : 'LOW'}", "likelihood": "MEDIUM", "detail": "Analyze based on debt-to-equity of ${debtEq}. Provide specific sector context."},
    {"risk": "Valuation Risk", "severity": "${Number(pe) > 30 ? 'HIGH' : Number(pe) > 20 ? 'MEDIUM' : 'LOW'}", "likelihood": "MEDIUM", "detail": "Analyze current P/E of ${pe}x vs sector. Provide specific context."}
  ],
  "peerBenchmarks": [
    {"ticker": "PEER1", "name": "Peer Company 1", "pe": "${pe}x", "evEbitda": "${evEbitda}x", "margin": "N/A"},
  {"ticker": "PEER2", "name": "Peer Company 2", "pe": "${Number(pe) * 0.9}x", "evEbitda": "${Number(evEbitda) * 0.95}x", "margin": "N/A"},
  {"ticker": "PEER3", "name": "Peer Company 3", "pe": "${Number(pe) * 1.1}x", "evEbitda": "${Number(evEbitda) * 1.05}x", "margin": "N/A"}
  ]
}`
  }
}

function buildNewsPrompt(ticker, d) {
  const price = d.price?.toFixed?.(2) || 'N/A'
  const target = d.targetMeanPrice?.toFixed?.(2) || 'N/A'
  const rec = d.recommendationKey ? d.recommendationKey.toUpperCase() : 'HOLD'

  // Calculate real upside mathematically
  let realUpside = 0
  if (d.targetMeanPrice && d.price && d.price > 0) {
    realUpside = ((d.targetMeanPrice - d.price) / d.price) * 100
  }
  const upsideStr = realUpside !== 0 ? realUpside.toFixed(2) : '0.00'

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
