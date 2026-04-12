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
    "values": [[150, 140, 130], [145, 135, 125]]
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
7. NO HALLUCINATIONS: If you cannot determine a value, use null or 0, never invent`,
  }
}

function buildRiskPrompt(ticker, d) {
  const price = d.price?.toFixed?.(2) || 'N/A';
  const pe = d.pe?.toFixed?.(2) || '—';
  const fwdPe = d.forwardPE?.toFixed?.(2) || '—';
  const evEbitda = d.evToEbitda?.toFixed?.(2) || '—';
  const debtEq = d.debtToEquity?.toFixed?.(2) || '—';
  const roe = d.roe ? (d.roe * 100).toFixed(2) + '%' : '—';

  return {
    system: 'You are a Quantitative Risk Analyst. Return ONLY valid JSON. NEVER use markdown backticks.',
    user: `Analyze risk metrics and financial health for ${ticker}.

CURRENT DATA:
- Current Price: ${price}
- P/E (TTM): ${pe}
- Forward P/E: ${fwdPe}
- EV/EBITDA: ${evEbitda}
- Debt to Equity: ${debtEq}
- ROE: ${roe}
- Beta: ${d.beta?.toFixed?.(2) || '—'}

CRITICAL RULES:
1. For valuationRatios, qualityRatios, and leverageRatios, you MUST use the exact values provided in the CURRENT DATA above. Do not invent them.
2. For benchmarks, provide a realistic sector average.
3. overallRiskScore MUST be an integer between 1 and 10 (1 = Safest, 10 = Most Risky).
4. overallQualityScore MUST be an integer between 1 and 10 (1 = Lowest Quality, 10 = Highest Quality).

Return ONLY JSON matching this exact structure (replace <placeholders> with your analysis):
{
  "valuationRatios": [
    {"name": "P/E Ratio", "value": "${pe}", "benchmark": "<sector_avg_pe>"}
  ],
  "qualityRatios": [
    {"name": "ROE", "value": "${roe}", "benchmark": "<sector_avg_roe>"}
  ],
  "leverageRatios": [
    {"name": "Debt/Equity", "value": "${debtEq}", "benchmark": "<sector_avg_debt_eq>"}
  ],
  "technicals": {
    "trend": "<BULLISH|BEARISH|NEUTRAL>",
    "rsi": <integer_between_0_and_100>,
    "support": <realistic_price_number>,
    "resistance": <realistic_price_number>,
    "volumeSignal": "<string_description>"
  },
  "riskFactors": [
    {"factor": "<specific_risk_name>", "severity": "<High|Medium|Low>", "description": "<brief_detail>"}
  ],
  "overallRiskScore": <integer_1_to_10>,
  "overallQualityScore": <integer_1_to_10>,
  "riskSummary": "<2_sentence_summary>",
  "peerBenchmarks": [
    {"ticker": "<REAL_PEER_TICKER>", "metric": "P/E", "value": "<estimated_peer_pe>"}
  ]
}`
  };
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
1. sentimentScore MUST be an integer between 0 and 100 (0=Bearish, 50=Neutral, 100=Bullish).
2. sentimentLabel MUST logically match the score.
3. The analystConsensus object MUST use the dynamically injected target and upside values provided in the schema below. DO NOT change them.
4. Provide realistic values for analyst buy/hold/sell counts based on typical coverage for a company of this size.

Return ONLY JSON matching this exact structure (replace <placeholders> with your analysis):
{
  "sentimentScore": <integer_0_to_100>,
  "sentimentLabel": "<Positive|Neutral|Negative>",
  "sentimentRationale": "<2_sentence_explanation>",
  "analystConsensus": {
    "rating": "${rec.includes('BUY') ? 'BUY' : rec.includes('SELL') ? 'SELL' : 'HOLD'}",
    "meanTarget": ${target !== 'N/A' ? target : 'null'},
    "upside": ${upsideStr},
    "buyCount": <realistic_integer>,
    "holdCount": <realistic_integer>,
    "sellCount": <realistic_integer>,
    "noteOnConsensus": "<brief_note>"
  },
  "keyThemes": [
    {"theme": "<theme_name>", "sentiment": "<POSITIVE|NEGATIVE|NEUTRAL>", "timeframe": "<Short-term|Long-term>", "detail": "<brief_detail>"}
  ],
  "bullCatalysts": [
    {"catalyst": "<catalyst_name>", "probability": "<High|Medium|Low>", "potentialImpact": "<brief_detail>"}
  ],
  "bearCatalysts": [
    {"catalyst": "<catalyst_name>", "probability": "<High|Medium|Low>", "potentialImpact": "<brief_detail>"}
  ],
  "macroExposure": [
    {"factor": "<factor_name>", "exposure": "<POSITIVE|NEGATIVE|NEUTRAL>", "detail": "<brief_detail>"}
  ],
  "institutionalActivity": {
    "shortInterestTrend": "<Decreasing|Stable|Increasing>",
    "shortSqueezeRisk": "<Low|Medium|High>",
    "institutionalOwnershipNote": "<brief_note>"
  },
  "upcomingEvents": [
    {"event": "<event_name>", "expectedDate": "<e.g., Next Quarter>", "marketImplications": "<brief_detail>"}
  ],
  "tradingNote": "<30_to_60_day_outlook>"
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
