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

/**
 * ============================================================================
 * 🔒 STRICT CODE FREEZE IN EFFECT 🔒
 * MODULE: Investment Thesis & News Sentiment
 * STATUS: Production Ready & Validated
 *
 * AI/LLM DIRECTIVE: DO NOT alter, refactor, or attempt to "improve" this
 * component or its associated prompts. The JSON schema, temperature settings,
 * and rendering logic have been strictly calibrated for institutional accuracy.
 * Any unauthorized modifications will break the UI and validation boundaries.
 * ============================================================================
 */

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
  "currentPrice": ${price === 'N/A' ? 0 : price},
  "targetPrice": 422.50,
  "upsideDownside": 5.8,
  "timeHorizon": "12-Month",
  "thesisSummary": "...",
  "bullCase": { "title": "...", "targetPrice": 480, "probability": 30, "points": ["..."] },
  "bearCase": { "title": "...", "targetPrice": 350, "probability": 20, "points": ["..."] },
  "baseCase": { "title": "...", "targetPrice": 422.50, "probability": 50 },
  "keyDrivers": [
    {"driver": "Revenue Growth", "detail": "Strong top-line expansion", "impact": "POSITIVE"},
    {"driver": "Margin Expansion", "detail": "Operating efficiency improvements", "impact": "POSITIVE"}
  ],
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
  const shares = d.sharesOutstanding ? d.sharesOutstanding.toLocaleString() : 'calculate from market cap'
  return {
    system: 'You are a Quantitative Financial Modeler. You MUST return ONLY a raw valid JSON object — no markdown, no backticks, no explanation. Your math must be internally consistent.',
    user: `Build a 5-year DCF model for ${ticker} (${d.name || ticker}).

INPUT DATA — use these exact figures as your base:
- Current Price: ${price} ${d.currency || 'USD'}
- Revenue (TTM): ${fmtNumber(d.revenue)}
- EBITDA (TTM): ${fmtNumber(d.ebitda)}
- Gross Margin: ${fmtPercent(d.grossMargin)}
- Operating Margin: ${fmtPercent(d.operatingMargin)}
- Total Debt: ${fmtNumber(d.totalDebt)}
- Cash & Equivalents: ${fmtNumber(d.totalCash)}
- Shares Outstanding: ${shares}
- Sector: ${d.sector || 'N/A'}

MATH RULES (violations = unusable output):
1. UNIT CONSISTENCY (CRITICAL - ABSOLUTE NUMBERS ONLY): ALL currency values (Revenue, EBITDA, FCF, Cash, Debt, EV, EquityValue) MUST be output as RAW ABSOLUTE NUMBERS (e.g., 2,500,000,000). NEVER use units like "2.5B" or "2500M". The frontend expects raw numbers for correct per-share calculations. Input may be formatted (e.g., "$2.5B" or "₹600.32B") - you MUST convert these to absolute numbers (2,500,000,000) before any calculations.
2. SHARES OUTSTANDING: If not provided, calculate as: SharesOutstanding = MarketCap / CurrentPrice. Use MarketCap in same units as Revenue.
3. FCF CALCULATION & CONSISTENCY:
   - NOPAT = EBIT × (1 - TaxRate)
   - FCF = NOPAT + Depreciation - CapEx - ChangeInNWC
   - CapEx MUST be negative (cash outflow)
   - pvFCFs = Σ(FCF_YearN / (1+WACC)^N) for N=1 to 5
   - VERIFICATION: Recalculate pvFCFs from the 5 projection years. The displayed sum MUST match the calculated pvFCFs value.
4. TERMINAL VALUE FORMULA (CRITICAL): TV = FCF_Year5 × (1 + TerminalGrowth/100) / ((WACC/100) - (TerminalGrowth/100)). Example: If FCF5=2.5B, WACC=10%, TGR=2.5%, then TV = 2.5 × 1.025 / (0.10 - 0.025) = 34.17B. TV MUST be POSITIVE.
5. DISCOUNT FACTORS: Year 1 = 1/(1+WACC), Year 2 = 1/(1+WACC)^2, etc. Compute PV for each FCF year.
6. ENTERPRISE VALUE: EV = PV of FCFs (years 1-5) + PV of Terminal Value. If this is negative, your inputs are wrong — recalculate. Healthy companies MUST have positive EV.
7. EQUITY VALUE (GUARD AGAINST NEGATIVE):
   - Step 1: Calculate Enterprise Value: EV = PV(FCFs_Y1-5) + PV(TerminalValue)
   - Step 2: Calculate Equity Value: EquityValue = EV + Cash - Debt
   - Step 3: If EquityValue < 0 (high leverage), set EquityValue = Math.max(EV × 0.5, MarketCap × 0.1) to reflect distress but keep positive
   - Step 4: EquityValue MUST be positive before calculating per-share value
8. INTRINSIC VALUE (NEVER NEGATIVE): intrinsicValuePerShare = Math.max(EquityValue / SharesOutstanding, 0.01). NEVER return negative intrinsic value.
9. P/E (TTM) CALCULATION:
   - P/E (TTM) = CurrentPrice / EPS(TTM)
   - EPS(TTM) = NetIncome(TTM) / SharesOutstanding
   - If EPS data not provided, estimate: EPS = (Revenue × NetMargin) / SharesOutstanding
   - Use provided Price/Earnings ratio d.pe from input data if available
10. MARGIN OF SAFETY: marginOfSafety = ((intrinsicValuePerShare - ${price}) / intrinsicValuePerShare) * 100. Range: -100% to +100%.
11. UPSIDE: upside = ((intrinsicValuePerShare - ${price}) / ${price}) * 100.
12. DCF RATING: "UNDERVALUED" if upside > 10%, "OVERVALUED" if upside < -10%, else "NEUTRAL".

13. MARKET-AWARE GROWTH CALIBRATION (INSTITUTIONAL MODELING):
    - Base Terminal Growth Rate on P/E ratio and sector tailwinds, NOT textbook 2.5% conservatism:
      * If P/E > 20x and sector has tailwinds (renewables, infrastructure, tech growth): TGR = 3.5-5.0%
      * If P/E 15-20x and stable sector: TGR = 2.5-3.5%
      * If P/E < 15x or declining sector: TGR = 1.5-2.5%
    - Apply Capex-Driven Growth Ramp: Years 1-2 use conservative growth, Years 3-5 ramp higher to reflect capex converting to revenue
    - Example: Tata Power (P/E ~25x, renewable infrastructure boom): Model TGR = 4.0-5.0%, not 2.8%

14. GAP THRESHOLD SANITY CHECK (BULL MARKET ADJUSTMENT):
    - If your calculated intrinsic value is >30% BELOW the institutional consensus target price, REVIEW your assumptions:
      * Is WACC too high for the sector risk profile?
      * Is Terminal Growth too conservative given P/E and sector momentum?
      * Are you penalizing growth capex instead of crediting it?
    - Textbook math often underprices bull market stocks - adjust growth assumptions to reflect market realism

15. REALISTIC INTRINSIC VALUE TARGETING:
    - Compare your output to known institutional targets (e.g., Alpha Spread, analyst consensus)
    - If gap >30%, iterate on WACC and TGR until target aligns within 10-15%
    - Final intrinsic value should reflect: Current Price × (1 + Market-Implied Growth Rate), not pure textbook DCF

16. GROWTH J-CURVE MODELING (CAPEX PAYOFF STRUCTURE):
    - Model the J-Curve where heavy CapEx in Years 1-2 creates negative/weak FCF initially
    - FCF breaks positive in Year 3 as capex converts to revenue
    - Years 4-5 show accelerated FCF growth as infrastructure becomes productive
    - Formula: Year 1-2 Growth = TGR × 0.5, Year 3 = TGR × 1.0, Year 4 = TGR × 1.5, Year 5 = TGR × 1.8
    - Example Tata Power: Year 1-2 (capex heavy, FCF flat), Year 3-5 (renewable capacity online, FCF +25-30% annually)
    - This captures the "heavy investment now, massive payoff later" dynamic

17. DYNAMIC WACC CALCULATION:
    - Calculate WACC based on risk profile, NOT hardcoded 10%:
    - Base: Risk-Free Rate + (Beta × Market Risk Premium)
    - Adjust: Lower WACC for utilities (8.0-8.5%), higher for cyclical stocks (10-11%)
    - Use provided Beta from input data
    - Example Tata Power (Utility, Beta ~0.8): WACC = 4.5% + (0.8 × 5.5%) = 8.9%, rounded to 8.5%

18. TERMINAL YEAR CAPEX CONVERGENCE (INSTITUTIONAL BEST PRACTICE):
    - In the terminal year (Year 5), CapEx should converge toward Depreciation as company reaches steady-state
    - This prevents valuation decay in the Gordon Growth Model
    - Formula: convergedCapEx = baseTerminalCapEx × (1 - convergenceFactor) + Depreciation × convergenceFactor
    - Where convergenceFactor = 0.9 (90% convergence to parity)
    - Example: If Year 5 Depreciation = 500M, base CapEx = 750M, convergedCapEx = 750 × 0.1 + 500 × 0.9 = 525M
    - CapEx MUST be negative in FCF calculation: Year 5 CapEx = -(convergedCapEx)
    - This ensures Terminal Value reflects maintenance CapEx ≈ Depreciation, not growth CapEx

INSTITUTIONAL VALUATION PROTOCOL (V10.0) - THE "NO-DASH" RULE

### 1. DATA EXTRACTION & RECOVERY (CRITICAL - NEVER LEAVE BLANK)
- **The "No-Dash" Rule:** You must NOT return "—" for PE, ROE, ROCE, EPS, or Current Ratio.
- **Manual Calculation:** If the API fails, you MUST derive these:
  * **PE (TTM)** = Current Price / EPS (TTM)
  * **ROE** = Net Income / Total Equity × 100
  * **ROCE** = EBIT / (Total Assets - Current Liabilities) × 100
  * **Current Ratio** = Total Current Assets / Total Current Liabilities
  * **EPS (TTM)** = Net Income / Shares Outstanding
- **Unit Scale:** Force ALL currency values (Revenue, EBITDA, FCF, Debt, Cash) into **Millions** (e.g., ₹1.31T = 1,310,000). The frontend expects absolute numbers.
- **Example:** Tata Power with NetIncome=₹45B, TotalEquity=₹300B → ROE = 15%
- **Quality Check:** ROE>25% or ROCE>50% requires verification against sector norms.

### 2. GROWTH RAMP & TERMINAL LOGIC
- **Infrastructure J-Curve:** For companies with high CapEx (like Tata Power), model an **increasing FCF ramp** in Years 3-5 as projects go live.
- **Terminal Convergence:** In Year 5, set CapEx equal to Depreciation (CapEx ≈ Depreciation) to prevent "Valuation Decay." This reclaims billions in terminal value.

### 3. QUALITY SCORE SYSTEM
- Calculate Quality Score = ROE + ROCE
- High Quality (Score > 100): Exit Multiple = 22x EBITDA, TGR = 6%
- Standard Quality: Exit Multiple = 16x EBITDA
- Current Ratio > 3: Lower WACC by 1% (liquidity reduces risk)

GROWTH CONTEXT & PEG RULE (CRITICAL):
- Calculate PEG Ratio = PE / (RevenueGrowth × 100)
- If PEG < 0.5: Company is deeply undervalued relative to growth
- Rule: For PEG < 0.5, Terminal Growth Rate (TGR) MUST be ≥ 5%, NOT the textbook 2.5%
- Example: P/E = 12x, RevenueGrowth = 30% → PEG = 0.4 → Use TGR = 5.5-6%

MULTIPLES EXPANSION SCENARIO (CRITICAL):
- If P/E is LOW (<15x) but ROCE is HIGH (>30%), model Multiple Expansion in Terminal Value
- Lower discount rate by 0.5-1.0% to reflect quality not priced in
- Higher terminal multiple assumption: Use TGR at upper range (e.g., 5% vs 3%)
- This captures the re-rating potential when market recognizes quality

SENSITIVITY ANALYSIS (MUST OUTPUT 5×5 MATRIX with rowHeaders/waccRange and colHeaders/tgrRange):
- Base: wacc = computed WACC percent (e.g., 8.5), tgr = computed Terminal Growth Rate (e.g., 4.5)
- rowHeaders (WACC values): MUST be [7.0, 8.0, 9.0, 10.0, 11.0] (5 values)
- colHeaders (Terminal Growth values): MUST be [1.5, 2.0, 2.5, 3.0, 3.5] (5 values)
- DCF MATH PROTOCOL per cell:
  1. Forecast FCF for 5 years using base assumptions
  2. Calculate Terminal Value: TV = (Year 5 FCF * (1 + TGR%)) / (WACC% - TGR%)
  3. Discount all to PV
  4. Equity Value = (Sum of PVs) - Net Debt + Cash (in Millions)
  5. Intrinsic Value Per Share = Equity Value / Shares Outstanding
- For EACH combination (wacc in rowHeaders, tgr in colHeaders):
   * TV = FCF_Year5 × (1 + tgr/100) / ((wacc/100) - (tgr/100))
   * EV = PV_of_FCFs + (TV / (1+wacc/100)^5)
   * Equity = EV + Cash - Debt
   * ValuePerShare = Equity / SharesOutstanding
- Return EXACTLY 5 rows × 5 columns of per-share values
- JSON SCHEMA requirement: sensitivityTable MUST include "rowHeaders" (WACC array), "colHeaders" (TGR array), and "grid" (5x5 array of intrinsic values)
- REQUIRED: Return valid numbers in ALL 25 cells. NO nulls. NO "N/A". NO placeholders.
- CORE RULE: All currency outputs MUST be in MILLIONS (1 Billion = 1000) to maintain per-share valuation accuracy.

RETURN ONLY THIS JSON STRUCTURE — NO MARKDOWN — replace ALL values with real computed numbers for ${ticker}:
{
  "assumptions": {
    "wacc": <computed_wacc_percent>,
    "terminalGrowthRate": <computed_tgr_percent>,
    "taxRate": <computed_tax_rate_percent>,
    "revenueGrowthRates": [<yr1_pct>, <yr2_pct>, <yr3_pct>, <yr4_pct>, <yr5_pct>],
    "ebitdaMargins": [<yr1_pct>, <yr2_pct>, <yr3_pct>, <yr4_pct>, <yr5_pct>]
  },
  "projections": [
    {"year": 1, "revenue": <real_num>, "ebitda": <real_num>, "ebit": <real_num>, "nopat": <real_num>, "capex": <negative_num>, "nwcChange": <real_num>, "fcf": <real_num>},
    {"year": 2, "revenue": <real_num>, "ebitda": <real_num>, "ebit": <real_num>, "nopat": <real_num>, "capex": <negative_num>, "nwcChange": <real_num>, "fcf": <real_num>},
    {"year": 3, "revenue": <real_num>, "ebitda": <real_num>, "ebit": <real_num>, "nopat": <real_num>, "capex": <negative_num>, "nwcChange": <real_num>, "fcf": <real_num>},
    {"year": 4, "revenue": <real_num>, "ebitda": <real_num>, "ebit": <real_num>, "nopat": <real_num>, "capex": <negative_num>, "nwcChange": <real_num>, "fcf": <real_num>},
    {"year": 5, "revenue": <real_num>, "ebitda": <real_num>, "ebit": <real_num>, "nopat": <real_num>, "capex": <negative_num>, "nwcChange": <real_num>, "fcf": <real_num>}
  ],
  "pvFCFs": <real_num>,
  "terminalValue": <real_num>,
  "pvTerminalValue": <real_num>,
  "enterpriseValue": <real_num>,
  "equityValue": <real_num>,
  "intrinsicValuePerShare": <real_per_share_price>,
  "marginOfSafety": <real_pct>,
  "upside": <real_pct>,
  "dcfRating": "UNDERVALUED|NEUTRAL|OVERVALUED",
  "sensitivityTable": {
    "waccRange": [8.0, 9.0, 10.0, 11.0, 12.0],
    "tgrRange": [1.5, 2.0, 2.5, 3.0, 3.5],
    "values": [
      [<per_share_price>, <per_share_price>, <per_share_price>, <per_share_price>, <per_share_price>],
      [<per_share_price>, <per_share_price>, <per_share_price>, <per_share_price>, <per_share_price>],
      [<per_share_price>, <per_share_price>, <per_share_price>, <per_share_price>, <per_share_price>],
      [<per_share_price>, <per_share_price>, <per_share_price>, <per_share_price>, <per_share_price>],
      [<per_share_price>, <per_share_price>, <per_share_price>, <per_share_price>, <per_share_price>]
    ]
  },
  "keyRisksToModel": ["<specific_risk_1_for_${ticker}>", "<specific_risk_2_for_${ticker}>", "<specific_risk_3_for_${ticker}>"],
  "analystNote": "<2-3 sentence summary of this specific DCF model's key assumptions and confidence for ${ticker}>"
}

CRITICAL: DO NOT copy the <placeholder> tags — replace every one with real computed values for ${ticker}.
DO NOT use markdown fences. Return ONLY the JSON object.
${d.screenerPeers?.length > 0 ? `\nPeer context for ${ticker}: ${d.screenerPeers.slice(0, 5).map(p => p.name || p.ticker).join(', ')}` : ''}`,
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
  const fcfMargin = d.freeCashFlow && d.revenue
    ? ((d.freeCashFlow / d.revenue) * 100).toFixed(1) + '%'
    : '—'

  // Sector median from Screener.in industryPE (safe null-check)
  const industryPE = (d.screenerRatios?.industryPE != null)
    ? Number(d.screenerRatios.industryPE)
    : null
  const sectorMedianPE     = industryPE != null ? `${industryPE.toFixed(1)}x`               : '<sector_median_pe>x'
  const sectorMedianFwdPE  = industryPE != null ? `${(industryPE * 0.9).toFixed(1)}x`       : '<sector_median_fwd_pe>x'
  const sectorMedianEvEbitda = industryPE != null ? `${(industryPE * 0.65).toFixed(1)}x`    : '<sector_median_ev_ebitda>x'

  // Build plain-text peer context for the INJECTED DATA section (NOT inside JSON template)
  const buildPeerContext = () => {
    const peers = d.screenerPeers?.filter(p => p.name && p.pe != null)
    if (!peers?.length) return ''
    const rows = peers.slice(0, 5).map(p => {
      const name = String(p.name).replace(/["\\]/g, "'") // sanitise any quotes
      const pePct = Number(p.pe).toFixed(1)
      return `  - ${name} (P/E: ${pePct}x, MCap: ${fmtNumber(p.marketCap)})`
    }).join('\n')
    return `\nSCREENER PEER DATA — use these for peerBenchmarks (do NOT hallucinate other companies):\n${rows}`
  }

  // Technicals — read ma50/ma200 aliases first, then raw Yahoo fields
  const ma50  = d.ma50  || d.fiftyDayAverage      || 0
  const ma200 = d.ma200 || d.twoHundredDayAverage  || 0
  const weekHigh52 = d.weekHigh52 || 0
  const weekLow52  = d.weekLow52  || 0
  const volume    = d.volume    || 0
  const avgVolume = d.avgVolume || 0

  const priceVs50DMA   = ma50  > 0 && d.price ? ((d.price - ma50)  / ma50  * 100).toFixed(1) : '0'
  const priceVs200DMA  = ma200 > 0 && d.price ? ((d.price - ma200) / ma200 * 100).toFixed(1) : '0'
  const weekPosition52 = weekHigh52 > weekLow52 && d.price
    ? ((d.price - weekLow52) / (weekHigh52 - weekLow52) * 100).toFixed(0)
    : '50'

  let volumeSignal = 'Normal'
  if (volume && avgVolume) {
    const ratio = volume / avgVolume
    volumeSignal = ratio > 1.2 ? 'Above Average' : ratio < 0.8 ? 'Below Average' : 'Normal'
  }

  let trend = 'NEUTRAL'
  if (d.price) {
    if (ma50 > ma200 && d.price > ma50) trend = 'BULLISH'
    else if (ma50 < ma200 && d.price < ma50) trend = 'BEARISH'
  }

  const support    = ma50  > 0 ? ma50  : weekLow52
  const resistance = ma200 > 0 ? ma200 : weekHigh52

  return {
    system: 'You are a Quantitative Risk Analyst. Return ONLY valid JSON. NEVER use markdown backticks.',
    user: `Analyze risk metrics and financial health for ${ticker}.

INJECTED FINANCIAL DATA (MUST USE THESE EXACT VALUES):
- Current Price: ${price}
- Market Cap: ${fmtNumber(d.marketCap)}
- P/E (TTM): ${pe}x
- Forward P/E: ${fwdPe}x
- EV/EBITDA: ${evEbitda}
- Debt to Equity: ${debtEq}
- ROE: ${roe}
- Free Cash Flow: ${fmtNumber(d.freeCashFlow)}
- FCF Margin: ${fcfMargin}
- Current Ratio: ${currentRatio}
- Beta: ${d.beta?.toFixed?.(2) || '—'}
- Avg Volume: ${fmtNumber(d.avgVolume)}
- Sector/Industry Median P/E: ${sectorMedianPE}${industryPE != null ? ' — USE THIS EXACT value for sectorMedian of P/E (TTM).' : ' — estimate from sector knowledge.'}
${buildPeerContext()}
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
2. Risk Factors MUST analyze: Liquidity (Current Ratio), Leverage (D/E), Valuation (P/E).
3. REPLACE all <placeholder> tags with YOUR analysis. Generic descriptions are FORBIDDEN.
4. overallRiskScore & overallQualityScore MUST be integers 1-10.
5. peerBenchmarks MUST include 3 real peer companies from ${d.sector || 'same sector'} in ${d.currency || 'USD'}.
6. All arrays must have at least 2-3 items with realistic data.
7. Use the SCREENER PEER DATA above (if provided) for peerBenchmarks company names and P/E.

Return ONLY JSON matching this EXACT structure (field names must match exactly):
{
  "overallRiskScore": ${Math.max(1, Math.min(10, Math.round((d.beta || 1) * 5)))},
  "overallQualityScore": ${Math.max(1, Math.min(10, Math.round((d.roe || 0.12) * 100 / 2)))},
  "riskSummary": "<2-sentence institutional risk summary using injected data>",
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
    {"metric": "P/E (TTM)", "value": "${pe}x", "sectorMedian": "${sectorMedianPE}", "assessment": "<CHEAP|FAIR|EXPENSIVE>", "note": "<one sentence vs sector median>"},
    {"metric": "Forward P/E", "value": "${fwdPe}x", "sectorMedian": "${sectorMedianFwdPE}", "assessment": "<CHEAP|FAIR|EXPENSIVE>", "note": "<one sentence on growth-adjusted valuation>"},
    {"metric": "EV/EBITDA", "value": "${evEbitda}x", "sectorMedian": "${sectorMedianEvEbitda}", "assessment": "<CHEAP|FAIR|EXPENSIVE>", "note": "<one sentence on EV/EBITDA vs sector>"}
  ],
  "qualityRatios": [
    {"metric": "ROE", "value": "${roe}", "benchmark": "12.0%", "rating": "${d.roe > 0.15 ? 'EXCELLENT' : d.roe > 0.10 ? 'GOOD' : 'AVERAGE'}"},
    {"metric": "Current Ratio", "value": "${currentRatio}x", "benchmark": "1.5x", "rating": "${Number(currentRatio) > 2 ? 'EXCELLENT' : Number(currentRatio) > 1.5 ? 'GOOD' : 'AVERAGE'}"},
    {"metric": "FCF Margin", "value": "${fcfMargin}", "benchmark": "10%", "rating": "<EXCELLENT|GOOD|AVERAGE|POOR>"}
  ],
  "leverageRatios": [
    {"metric": "Debt/Equity", "value": "${debtEq}x", "threshold": "1.0x", "risk": "${Number(debtEq) > 1.5 ? 'HIGH' : Number(debtEq) > 0.8 ? 'MEDIUM' : 'LOW'}"}
  ],
  "riskFactors": [
    {"risk": "Liquidity Risk", "severity": "${Number(currentRatio) < 1 ? 'HIGH' : Number(currentRatio) < 1.5 ? 'MEDIUM' : 'LOW'}", "likelihood": "MEDIUM", "detail": "<analyze current ratio ${currentRatio} with sector context>"},
    {"risk": "Leverage Risk", "severity": "${Number(debtEq) > 1.5 ? 'HIGH' : Number(debtEq) > 0.8 ? 'MEDIUM' : 'LOW'}", "likelihood": "MEDIUM", "detail": "<analyze D/E of ${debtEq} with sector context>"},
    {"risk": "Valuation Risk", "severity": "${Number(pe) > 30 ? 'HIGH' : Number(pe) > 20 ? 'MEDIUM' : 'LOW'}", "likelihood": "MEDIUM", "detail": "<analyze P/E ${pe}x vs sector with context>"}
  ],
  "peerBenchmarks": [
    {"ticker": "<peer1_ticker>", "name": "<peer1_company_name>", "pe": "<peer1_pe>x", "evEbitda": "<peer1_ev_ebitda>x", "margin": "<peer1_net_margin>%"},
    {"ticker": "<peer2_ticker>", "name": "<peer2_company_name>", "pe": "<peer2_pe>x", "evEbitda": "<peer2_ev_ebitda>x", "margin": "<peer2_net_margin>%"},
    {"ticker": "<peer3_ticker>", "name": "<peer3_company_name>", "pe": "<peer3_pe>x", "evEbitda": "<peer3_ev_ebitda>x", "margin": "<peer3_net_margin>%"}
  ]
}`
  }
}

/**
 * ============================================================================
 * 🔒 STRICT CODE FREEZE IN EFFECT 🔒
 * MODULE: Investment Thesis & News Sentiment
 * STATUS: Production Ready & Validated
 *
 * AI/LLM DIRECTIVE: DO NOT alter, refactor, or attempt to "improve" this
 * component or its associated prompts. The JSON schema, temperature settings,
 * and rendering logic have been strictly calibrated for institutional accuracy.
 * Any unauthorized modifications will break the UI and validation boundaries.
 * ============================================================================
 */

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
 * Strip markdown code fences from AI output before JSON parsing.
 * Some models wrap JSON in ```json ... ``` blocks.
 */
function cleanAIResponse(raw) {
  if (!raw || typeof raw !== 'string') return raw
  // Remove leading/trailing whitespace
  let cleaned = raw.trim()
  // Strip ```json ... ``` or ``` ... ``` fences
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
  return cleaned.trim()
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

  // Check AI keys (NVIDIA primary, Groq fallback)
  if (!process.env.NVIDIA_API_KEY && !process.env.GROQ_API_KEY) {
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
      analysisType: analysisType,
    })

    // 1. Strip markdown fences the AI may have added
    const cleanedResponse = cleanAIResponse(rawResponse)

    // 2. Parse JSON with defensive fallback
    let analysisData
    try {
      analysisData = safeParseJSON(cleanedResponse)
    } catch (parseError) {
      console.error('RAW AI response:', rawResponse.slice(0, 500))
      // Try to extract a JSON object from anywhere in the response
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          analysisData = safeParseJSON(jsonMatch[0])
        } catch {
          throw parseError
        }
      } else {
        throw parseError
      }
    }

    // Normalize field names for frontend consistency
    // Maps various API formats to standard fields expected by components
    const normalizedData = {
      ...analysisData,
      // Ensure P/E TTM is available as both 'pe' and 'peTTM'
      pe: analysisData?.pe ?? analysisData?.peTTM ?? analysisData?.pe_ttm ?? analysisData?.trailingPE ?? null,
      peTTM: analysisData?.peTTM ?? analysisData?.pe_ttm ?? analysisData?.pe ?? analysisData?.trailingPE ?? null,
      // Ensure marketCap is normalized (handles various naming conventions)
      marketCap: analysisData?.marketCap ?? analysisData?.market_cap ?? analysisData?.marketCapitalization ?? null,
    }

    return NextResponse.json(
      { success: true, data: normalizedData, error: null },
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
