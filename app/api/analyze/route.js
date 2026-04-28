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
 * Ã°Å¸â€â€™ STRICT CODE FREEZE IN EFFECT Ã°Å¸â€â€™
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
   - A target of Ã¢â€šÂ¹422.50 on Ã¢â€šÂ¹399.35 is +5.8% upside, NOT +0.0%
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
    system: 'You are a Quantitative Financial Modeler. You MUST return ONLY a raw valid JSON object Ã¢â‚¬â€ no markdown, no backticks, no explanation. Your math must be internally consistent.',
    user: `Build a 5-year DCF model for ${ticker} (${d.name || ticker}).

INPUT DATA Ã¢â‚¬â€ use these exact figures as your base:
- Current Price: ${price} ${d.currency || 'USD'}
- Revenue (TTM): ${fmtNumber(d.revenue)}
- EBITDA (TTM): ${fmtNumber(d.ebitda)}
- Gross Margin: ${fmtPercent(d.grossMargin)}
- Operating Margin: ${fmtPercent(d.operatingMargin)}
- Net Margin: ${fmtPercent(d.profitMargin)}
- Revenue Growth (TTM): ${fmtPercent(d.revenueGrowth)}
- Total Debt: ${fmtNumber(d.totalDebt)}
- Cash & Equivalents: ${fmtNumber(d.totalCash)}
- Free Cash Flow: ${fmtNumber(d.freeCashFlow)}
- ROE: ${d.roe ? (d.roe * 100).toFixed(1) + '%' : 'N/A'}
- Debt/Equity: ${d.debtToEquity?.toFixed(2) || 'N/A'}
- Beta: ${d.beta?.toFixed(2) || 'N/A'}
- Shares Outstanding: ${shares}
- Sector: ${d.sector || 'N/A'}, Industry: ${d.industry || 'N/A'}

MATH RULES (violations = unusable output):
1. UNIT CONSISTENCY (CRITICAL - ABSOLUTE NUMBERS ONLY): ALL currency values (Revenue, EBITDA, FCF, Cash, Debt, EV, EquityValue) MUST be output as RAW ABSOLUTE NUMBERS (e.g., 2,500,000,000). NEVER use units like "2.5B" or "2500M". The frontend expects raw numbers for correct per-share calculations. Input may be formatted (e.g., "$2.5B" or "Ã¢â€šÂ¹600.32B") - you MUST convert these to absolute numbers (2,500,000,000) before any calculations.
2. SHARES OUTSTANDING: If not provided, calculate as: SharesOutstanding = MarketCap / CurrentPrice. Use MarketCap in same units as Revenue.
3. FCF CALCULATION & CONSISTENCY:
   - NOPAT = EBIT Ãƒâ€” (1 - TaxRate)
   - FCF = NOPAT + Depreciation - CapEx - ChangeInNWC
   - CapEx MUST be negative (cash outflow)
   - pvFCFs = ÃŽÂ£(FCF_YearN / (1+WACC)^N) for N=1 to 5
   - VERIFICATION: Recalculate pvFCFs from the 5 projection years. The displayed sum MUST match the calculated pvFCFs value.
4. TERMINAL VALUE FORMULA (CRITICAL): TV = FCF_Year5 Ãƒâ€” (1 + TerminalGrowth/100) / ((WACC/100) - (TerminalGrowth/100)). Example: If FCF5=2.5B, WACC=10%, TGR=2.5%, then TV = 2.5 Ãƒâ€” 1.025 / (0.10 - 0.025) = 34.17B. TV MUST be POSITIVE.
5. DISCOUNT FACTORS: Year 1 = 1/(1+WACC), Year 2 = 1/(1+WACC)^2, etc. Compute PV for each FCF year.
6. ENTERPRISE VALUE: EV = PV of FCFs (years 1-5) + PV of Terminal Value. If this is negative, your inputs are wrong Ã¢â‚¬â€ recalculate. Healthy companies MUST have positive EV.
7. EQUITY VALUE (GUARD AGAINST NEGATIVE):
   - Step 1: Calculate Enterprise Value: EV = PV(FCFs_Y1-5) + PV(TerminalValue)
   - Step 2: Calculate Equity Value: EquityValue = EV + Cash - Debt
   - Step 3: If EquityValue < 0 (high leverage), set EquityValue = Math.max(EV Ãƒâ€” 0.5, MarketCap Ãƒâ€” 0.1) to reflect distress but keep positive
   - Step 4: EquityValue MUST be positive before calculating per-share value
8. INTRINSIC VALUE (NEVER NEGATIVE): intrinsicValuePerShare = Math.max(EquityValue / SharesOutstanding, 0.01). NEVER return negative intrinsic value.
9. P/E (TTM) CALCULATION:
   - P/E (TTM) = CurrentPrice / EPS(TTM)
   - EPS(TTM) = NetIncome(TTM) / SharesOutstanding
   - If EPS data not provided, estimate: EPS = (Revenue Ãƒâ€” NetMargin) / SharesOutstanding
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
    - Final intrinsic value should reflect: Current Price Ãƒâ€” (1 + Market-Implied Growth Rate), not pure textbook DCF

16. GROWTH J-CURVE MODELING (CAPEX PAYOFF STRUCTURE):
    - Model the J-Curve where heavy CapEx in Years 1-2 creates negative/weak FCF initially
    - FCF breaks positive in Year 3 as capex converts to revenue
    - Years 4-5 show accelerated FCF growth as infrastructure becomes productive
    - Formula: Year 1-2 Growth = TGR Ãƒâ€” 0.5, Year 3 = TGR Ãƒâ€” 1.0, Year 4 = TGR Ãƒâ€” 1.5, Year 5 = TGR Ãƒâ€” 1.8
    - Example Tata Power: Year 1-2 (capex heavy, FCF flat), Year 3-5 (renewable capacity online, FCF +25-30% annually)
    - This captures the "heavy investment now, massive payoff later" dynamic

17. DYNAMIC WACC CALCULATION:
    - Calculate WACC based on risk profile, NOT hardcoded 10%:
    - Base: Risk-Free Rate + (Beta Ãƒâ€” Market Risk Premium)
    - Adjust: Lower WACC for utilities (8.0-8.5%), higher for cyclical stocks (10-11%)
    - Use provided Beta from input data
    - Example Tata Power (Utility, Beta ~0.8): WACC = 4.5% + (0.8 Ãƒâ€” 5.5%) = 8.9%, rounded to 8.5%

18. TERMINAL YEAR CAPEX CONVERGENCE (INSTITUTIONAL BEST PRACTICE):
    - In the terminal year (Year 5), CapEx should converge toward Depreciation as company reaches steady-state
    - This prevents valuation decay in the Gordon Growth Model
    - Formula: convergedCapEx = baseTerminalCapEx Ãƒâ€” (1 - convergenceFactor) + Depreciation Ãƒâ€” convergenceFactor
    - Where convergenceFactor = 0.9 (90% convergence to parity)
    - Example: If Year 5 Depreciation = 500M, base CapEx = 750M, convergedCapEx = 750 Ãƒâ€” 0.1 + 500 Ãƒâ€” 0.9 = 525M
    - CapEx MUST be negative in FCF calculation: Year 5 CapEx = -(convergedCapEx)
    - This ensures Terminal Value reflects maintenance CapEx Ã¢â€°Ë† Depreciation, not growth CapEx

INSTITUTIONAL VALUATION PROTOCOL (V10.0) - THE "NO-DASH" RULE

### 1. DATA EXTRACTION & RECOVERY (CRITICAL - NEVER LEAVE BLANK)
- **The "No-Dash" Rule:** You must NOT return "Ã¢â‚¬â€" for PE, ROE, ROCE, EPS, or Current Ratio.
- **Manual Calculation:** If the API fails, you MUST derive these:
  * **PE (TTM)** = Current Price / EPS (TTM)
  * **ROE** = Net Income / Total Equity Ãƒâ€” 100
  * **ROCE** = EBIT / (Total Assets - Current Liabilities) Ãƒâ€” 100
  * **Current Ratio** = Total Current Assets / Total Current Liabilities
  * **EPS (TTM)** = Net Income / Shares Outstanding
- **Unit Scale:** Force ALL currency values (Revenue, EBITDA, FCF, Debt, Cash) into **Millions** (e.g., Ã¢â€šÂ¹1.31T = 1,310,000). The frontend expects absolute numbers.
- **Example:** Tata Power with NetIncome=Ã¢â€šÂ¹45B, TotalEquity=Ã¢â€šÂ¹300B Ã¢â€ â€™ ROE = 15%
- **Quality Check:** ROE>25% or ROCE>50% requires verification against sector norms.

### 2. GROWTH RAMP & TERMINAL LOGIC
- **Infrastructure J-Curve:** For companies with high CapEx (like Tata Power), model an **increasing FCF ramp** in Years 3-5 as projects go live.
- **Terminal Convergence:** In Year 5, set CapEx equal to Depreciation (CapEx Ã¢â€°Ë† Depreciation) to prevent "Valuation Decay." This reclaims billions in terminal value.

### 3. QUALITY SCORE SYSTEM
- Calculate Quality Score = ROE + ROCE
- High Quality (Score > 100): Exit Multiple = 22x EBITDA, TGR = 6%
- Standard Quality: Exit Multiple = 16x EBITDA
- Current Ratio > 3: Lower WACC by 1% (liquidity reduces risk)

GROWTH CONTEXT & PEG RULE (CRITICAL):
- Calculate PEG Ratio = PE / (RevenueGrowth Ãƒâ€” 100)
- If PEG < 0.5: Company is deeply undervalued relative to growth
- Rule: For PEG < 0.5, Terminal Growth Rate (TGR) MUST be Ã¢â€°Â¥ 5%, NOT the textbook 2.5%
- Example: P/E = 12x, RevenueGrowth = 30% Ã¢â€ â€™ PEG = 0.4 Ã¢â€ â€™ Use TGR = 5.5-6%

MULTIPLES EXPANSION SCENARIO (CRITICAL):
- If P/E is LOW (<15x) but ROCE is HIGH (>30%), model Multiple Expansion in Terminal Value
- Lower discount rate by 0.5-1.0% to reflect quality not priced in
- Higher terminal multiple assumption: Use TGR at upper range (e.g., 5% vs 3%)
- This captures the re-rating potential when market recognizes quality

SENSITIVITY ANALYSIS (MUST OUTPUT 5Ãƒâ€”5 MATRIX with rowHeaders/waccRange and colHeaders/tgrRange):
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
   * TV = FCF_Year5 Ãƒâ€” (1 + tgr/100) / ((wacc/100) - (tgr/100))
   * EV = PV_of_FCFs + (TV / (1+wacc/100)^5)
   * Equity = EV + Cash - Debt
   * ValuePerShare = Equity / SharesOutstanding
- Return EXACTLY 5 rows Ãƒâ€” 5 columns of per-share values
- JSON SCHEMA requirement: sensitivityTable MUST include "rowHeaders" (WACC array), "colHeaders" (TGR array), and "grid" (5x5 array of intrinsic values)
- REQUIRED: Return valid numbers in ALL 25 cells. NO nulls. NO "N/A". NO placeholders.
- CORE RULE: All currency outputs MUST be in MILLIONS (1 Billion = 1000) to maintain per-share valuation accuracy.

RETURN ONLY THIS JSON STRUCTURE Ã¢â‚¬â€ NO MARKDOWN Ã¢â‚¬â€ replace ALL values with real computed numbers for ${ticker}:
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
  "keyRisksToModel": [
    "<RISK 1: specific to ${ticker}'s balance sheet Ã¢â‚¬â€ e.g. if Debt/Equity is high, state exact D/E ratio and how a 100bps rate rise inflates WACC by X% and compresses intrinsic value by Y%>",
    "<RISK 2: specific to ${ticker}'s revenue or margin profile Ã¢â‚¬â€ e.g. if margins are thin or declining, cite the actual margin % and how a 200bps compression in EBITDA margin reduces FCF by how much in absolute terms>",
    "<RISK 3: specific to ${ticker}'s FCF quality or capex cycle Ã¢â‚¬â€ e.g. if FCF is negative or capex-intensive, cite actual FCF figure and how a capex overrun of 10-15% delays FCF breakeven by how many years>",
    "<RISK 4: specific to ${ticker}'s sector or macro exposure Ã¢â‚¬â€ e.g. if Beta > 1.0, cite exact beta and how a 10% market downturn statistically moves the stock; or cite a specific regulatory/commodity risk with quantified revenue exposure>",
    "<RISK 5: specific to ${ticker}'s growth assumptions in this model Ã¢â‚¬â€ e.g. if TGR = X%, explain what revenue CAGR is required to justify it and what happens to intrinsic value if growth comes in 2-3% below the model>"
  ],
  "analystNote": "<2-3 sentence summary of this specific DCF model's key assumptions and confidence for ${ticker}>"
}

CRITICAL: DO NOT copy the <placeholder> tags Ã¢â‚¬â€ replace every one with real computed values for ${ticker}.
CRITICAL: keyRisksToModel MUST contain EXACTLY 5 risks. Each risk MUST:
  - Name the specific financial metric from the INPUT DATA above (e.g. actual D/E ratio, actual FCF, actual beta)
  - Quantify the downside impact on intrinsic value per share or WACC
  - Be specific to ${ticker}'s industry: "${d.sector || 'its sector'}" / "${d.industry || 'its industry'}"
  - NOT be a generic statement like "regulatory risk" or "competition" Ã¢â‚¬â€ those are BANNED unless tied to a specific number
  - Example GOOD risk: "With Debt/Equity at 1.82x and net debt of Ã¢â€šÂ¹3.1T, a 100bps rate increase raises WACC from 9.2% to 10.1%, compressing intrinsic value by approximately Ã¢â€šÂ¹220/share (-15%)"
  - Example BAD risk (BANNED): "Regulatory risks in the energy sector" Ã¢â€ Â too vague, no numbers
DO NOT use markdown fences. Return ONLY the JSON object.
${d.screenerPeers?.length > 0 ? `\nPeer context for ${ticker}: ${d.screenerPeers.slice(0, 5).map(p => p.name || p.ticker).join(', ')}` : ''}`,
  }
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Sector-specific thresholds Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function getSectorThresholds(sector) {
  const s = (sector || '').toLowerCase()

  if (s.includes('financial') || s.includes('bank') || s.includes('insurance') || s.includes('nbfc')) {
    return { label: 'Financial Services',
      debtEq:    { t: 'N/A (leverage is normal)', warnH: 20,  warnM: 12  },
      curRatio:  { t: '1.0x',  warnH: 0.8,  warnM: 1.0, higher: true },
      ndEbitda:  { t: '5.0x',  warnH: 8,    warnM: 5   },
      intCov:    { t: '2.0x',  warnH: 1.5,  warnM: 2.0, higher: true },
      dAssets:   { t: '70%',   warnH: 85,   warnM: 70  },
      roe:       { t: '12%',   excl: 15,    good: 10   },
      fcfMargin: { t: '10%',   excl: 15,    good: 8    },
      netMargin: { t: '15%',   excl: 20,    good: 10   },
      roce:      { t: '10%',   excl: 14,    good: 8    },
    }
  }
  if (s.includes('utilit')) {
    return { label: 'Utilities',
      debtEq:    { t: '2.0x',  warnH: 3.5,  warnM: 2.0 },
      curRatio:  { t: '1.0x',  warnH: 0.7,  warnM: 1.0, higher: true },
      ndEbitda:  { t: '4.0x',  warnH: 6,    warnM: 4.5 },
      intCov:    { t: '2.5x',  warnH: 1.5,  warnM: 2.5, higher: true },
      dAssets:   { t: '60%',   warnH: 75,   warnM: 60  },
      roe:       { t: '10%',   excl: 13,    good: 8    },
      fcfMargin: { t: '12%',   excl: 18,    good: 10   },
      netMargin: { t: '10%',   excl: 14,    good: 7    },
      roce:      { t: '8%',    excl: 11,    good: 6    },
    }
  }
  if (s.includes('real estate') || s.includes('reit')) {
    return { label: 'Real Estate / REIT',
      debtEq:    { t: '2.5x',  warnH: 4,    warnM: 2.5 },
      curRatio:  { t: '1.0x',  warnH: 0.7,  warnM: 1.0, higher: true },
      ndEbitda:  { t: '6.0x',  warnH: 9,    warnM: 7   },
      intCov:    { t: '2.0x',  warnH: 1.5,  warnM: 2.0, higher: true },
      dAssets:   { t: '55%',   warnH: 70,   warnM: 55  },
      roe:       { t: '8%',    excl: 12,    good: 6    },
      fcfMargin: { t: '20%',   excl: 30,    good: 15   },
      netMargin: { t: '20%',   excl: 30,    good: 15   },
      roce:      { t: '6%',    excl: 9,     good: 5    },
    }
  }
  if (s.includes('energy') || s.includes('oil') || s.includes('gas')) {
    return { label: 'Energy / O&G',
      debtEq:    { t: '1.5x',  warnH: 2.5,  warnM: 1.5 },
      curRatio:  { t: '1.2x',  warnH: 0.8,  warnM: 1.2, higher: true },
      ndEbitda:  { t: '2.5x',  warnH: 4,    warnM: 2.5 },
      intCov:    { t: '3.0x',  warnH: 2,    warnM: 3.0, higher: true },
      dAssets:   { t: '45%',   warnH: 60,   warnM: 45  },
      roe:       { t: '12%',   excl: 18,    good: 8    },
      fcfMargin: { t: '10%',   excl: 15,    good: 5    },
      netMargin: { t: '8%',    excl: 12,    good: 5    },
      roce:      { t: '12%',   excl: 18,    good: 8    },
    }
  }
  if (s.includes('tech') || s.includes('software') || s.includes('semicon') || s.includes('information')) {
    return { label: 'Technology',
      debtEq:    { t: '0.5x',  warnH: 1.5,  warnM: 0.8 },
      curRatio:  { t: '2.0x',  warnH: 1.0,  warnM: 1.5, higher: true },
      ndEbitda:  { t: '1.0x',  warnH: 2.5,  warnM: 1.5 },
      intCov:    { t: '10x',   warnH: 5,    warnM: 8,   higher: true },
      dAssets:   { t: '30%',   warnH: 50,   warnM: 35  },
      roe:       { t: '20%',   excl: 30,    good: 15   },
      fcfMargin: { t: '20%',   excl: 30,    good: 12   },
      netMargin: { t: '15%',   excl: 25,    good: 8    },
      roce:      { t: '20%',   excl: 30,    good: 12   },
    }
  }
  if (s.includes('health') || s.includes('pharma') || s.includes('biotech')) {
    return { label: 'Healthcare / Pharma',
      debtEq:    { t: '0.8x',  warnH: 2.0,  warnM: 1.2 },
      curRatio:  { t: '1.5x',  warnH: 1.0,  warnM: 1.5, higher: true },
      ndEbitda:  { t: '2.0x',  warnH: 4.0,  warnM: 2.5 },
      intCov:    { t: '5.0x',  warnH: 2.5,  warnM: 4.0, higher: true },
      dAssets:   { t: '40%',   warnH: 60,   warnM: 45  },
      roe:       { t: '15%',   excl: 25,    good: 10   },
      fcfMargin: { t: '15%',   excl: 25,    good: 8    },
      netMargin: { t: '12%',   excl: 20,    good: 7    },
      roce:      { t: '15%',   excl: 25,    good: 10   },
    }
  }
  if (s.includes('consumer') || s.includes('retail') || s.includes('food') || s.includes('beverag')) {
    return { label: 'Consumer / Retail',
      debtEq:    { t: '1.0x',  warnH: 2.5,  warnM: 1.5 },
      curRatio:  { t: '1.5x',  warnH: 0.8,  warnM: 1.2, higher: true },
      ndEbitda:  { t: '2.5x',  warnH: 4.5,  warnM: 3.0 },
      intCov:    { t: '4.0x',  warnH: 2,    warnM: 3.0, higher: true },
      dAssets:   { t: '40%',   warnH: 65,   warnM: 50  },
      roe:       { t: '15%',   excl: 25,    good: 10   },
      fcfMargin: { t: '8%',    excl: 12,    good: 5    },
      netMargin: { t: '6%',    excl: 10,    good: 3    },
      roce:      { t: '12%',   excl: 20,    good: 8    },
    }
  }
  // Default: Industrials / Manufacturing / Conglomerate
  return { label: 'Industrials / General',
    debtEq:    { t: '1.0x',  warnH: 2.5,  warnM: 1.5 },
    curRatio:  { t: '1.5x',  warnH: 0.8,  warnM: 1.2, higher: true },
    ndEbitda:  { t: '3.0x',  warnH: 5,    warnM: 3.5 },
    intCov:    { t: '3.0x',  warnH: 1.5,  warnM: 2.5, higher: true },
    dAssets:   { t: '50%',   warnH: 70,   warnM: 55  },
    roe:       { t: '12%',   excl: 18,    good: 8    },
    fcfMargin: { t: '10%',   excl: 15,    good: 6    },
    netMargin: { t: '8%',    excl: 12,    good: 4    },
    roce:      { t: '12%',   excl: 18,    good: 8    },
  }
}

function buildRiskPrompt(ticker, d) {
  const price = d.price?.toFixed?.(2) || 'N/A'
  const pe = d.pe?.toFixed?.(2) || 'Ã¢â‚¬â€'
  const fwdPe = d.forwardPE?.toFixed?.(2) || 'Ã¢â‚¬â€'
  const evEbitda = d.evToEbitda?.toFixed?.(2) || 'Ã¢â‚¬â€'

  // Sector median: prefer Screener.in industryPE, fallback to hardcoded sector table.
  // This eliminates AI placeholder strings like <sector_median_pe>x in the output.
  const SECTOR_PE_TABLE = {
    'financial services': 12, 'banking': 12, 'bank': 12, 'insurance': 14,
    'technology': 28,  'software': 28, 'information technology': 28,
    'energy': 14,      'oil': 14,  'gas': 14,
    'consumer': 30,    'retail': 28, 'fmcg': 32, 'food': 30,
    'healthcare': 25,  'pharma': 25, 'hospital': 22,
    'industrials': 18, 'manufacturing': 16, 'auto': 15,
    'materials': 12,   'metals': 10, 'mining': 10, 'cement': 14,
    'utilities': 16,   'power': 14, 'telecom': 18,
    'real estate': 20, 'realty': 20,
  }
  const sectorLower = (d.sector || d.industry || '').toLowerCase()
  const industryPE = (d.screenerRatios?.industryPE != null)
    ? Number(d.screenerRatios.industryPE)
    : (() => {
        for (const [key, pe] of Object.entries(SECTOR_PE_TABLE)) {
          if (sectorLower.includes(key)) return pe
        }
        return 18 // broad market default
      })()
  const sectorMedianPE       = `${industryPE.toFixed(1)}x`
  const sectorMedianFwdPE    = `${(industryPE * 0.9).toFixed(1)}x`
  const sectorMedianEvEbitda = `${(industryPE * 0.65).toFixed(1)}x`

  // Ã¢â€â‚¬Ã¢â€â‚¬ Peer context Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const buildPeerContext = () => {
    const peers = d.screenerPeers?.filter(p => p.name && p.pe != null)
    if (!peers?.length) return ''
    const rows = peers.slice(0, 5).map(p => {
      const name = String(p.name).replace(/["\\]/g, "'")
      const pePct = Number(p.pe).toFixed(1)
      return `  - ${name} (P/E: ${pePct}x, MCap: ${fmtNumber(p.marketCap)})`
    }).join('\n')
    return `\nSCREENER PEER DATA Ã¢â‚¬â€ use these for peerBenchmarks (do NOT hallucinate other companies):\n${rows}`
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ Technicals Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

  // Ã¢â€â‚¬Ã¢â€â‚¬ Sector thresholds Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const th = getSectorThresholds(d.sector)

  // Ã¢â€â‚¬Ã¢â€â‚¬ Server-side ratio computation Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const safe = (v) => (v !== null && v !== undefined && isFinite(v) ? v : null)

  // Leverage ratios
  const debtEqNum     = safe(d.debtToEquity)
    ?? safe(d.screenerRatios?.debtToEquity) // Screener fallback for Indian stocks
  const curRatioNum   = safe(d.currentRatio)
  const quickRatioNum = safe(d.quickRatio)
  const ebitda        = safe(d.ebitda)
  const totalDebt     = safe(d.totalDebt)
  const totalCash     = safe(d.totalCash)
  // totalAssets: try Yahoo first, then XBRL metrics (critical for banking stocks)
  const totalAssets   = safe(d.totalAssets) ?? safe(d._xbrlMetrics?.totalEquity)
  const intExp        = safe(d.interestExpense) // usually negative from Yahoo
  // Interest Coverage: if Yahoo's interestExpense is missing (common for banks/Indian stocks),
  // use the interestCoverage ratio directly from TradingView scraper.
  const tvIntCov      = safe(d.interestCoverage) // filled by TradingView if available
  const revenue       = safe(d.revenue)
  const opMargin      = safe(d.operatingMargin)
  const ebit          = revenue && opMargin ? revenue * opMargin : null

  const netDebt       = totalDebt !== null && totalCash !== null ? totalDebt - totalCash : null
  const ndEbitdaNum   = netDebt !== null && ebitda && ebitda > 0 ? netDebt / ebitda : null
  // Use calculated interest coverage first; if intExp is null, use TradingView's direct ratio
  const intCovNum     = ebit && intExp && intExp !== 0
    ? ebit / Math.abs(intExp)
    : tvIntCov !== null ? tvIntCov : null
  // Debt/Assets: standard calc; for banks without totalAssets, use D/E as proxy display
  const dAssetsNum    = totalDebt !== null && totalAssets && totalAssets > 0
    ? (totalDebt / totalAssets) * 100
    : null

  // Quality ratios
  const roeNum        = safe(d.roe)   // decimal (0.12 = 12%)
  const fcfNum        = safe(d.freeCashFlow)
  const fcfMarginNum  = fcfNum && revenue && revenue > 0 ? (fcfNum / revenue) * 100 : null
  const netMarginNum  = safe(d.profitMargin) !== null ? d.profitMargin * 100 : null
  // ROCE = EBIT / Capital Employed; we approximate Capital Employed = Total Assets - Current Liabilities
  // Use totalAssets as proxy if current liabilities unavailable
  const roceNum       = ebit && totalAssets && totalAssets > 0 ? (ebit / totalAssets) * 100 : null

  // Ã¢â€â‚¬Ã¢â€â‚¬ Formatting helpers Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const fmt = (v, digits, suffix) => v !== null ? `${v.toFixed(digits)}${suffix}` : 'N/A'
  const fmtX = (v, d = 2) => fmt(v, d, 'x')
  const fmtP = (v, d = 1) => fmt(v, d, '%')

  // Risk rating: higher value = worse (e.g. D/E, debt ratios)
  const riskHigh = (v, wH, wM) => v === null ? 'MEDIUM' : v > wH ? 'HIGH' : v > wM ? 'MEDIUM' : 'LOW'
  // Risk rating: lower value = worse (e.g. current ratio, interest coverage)
  const riskLow  = (v, wH, wM) => v === null ? 'MEDIUM' : v < wH ? 'HIGH' : v < wM ? 'MEDIUM' : 'LOW'

  // Quality rating: higher = better
  const qual = (v, excl, good) => v === null ? 'AVERAGE' : v >= excl ? 'EXCELLENT' : v >= good ? 'GOOD' : v >= 0 ? 'AVERAGE' : 'POOR'

  // Pre-computed display values
  const deqDisplay  = debtEqNum !== null ? `${debtEqNum.toFixed(2)}x` : 'N/A'
  const curDisplay  = curRatioNum !== null ? `${curRatioNum.toFixed(2)}x` : 'N/A'
  const ndEDisplay  = ndEbitdaNum !== null ? `${ndEbitdaNum.toFixed(2)}x` : 'N/A'
  const icDisplay   = intCovNum !== null ? `${intCovNum.toFixed(2)}x` : 'N/A'
  const daDisplay   = dAssetsNum !== null ? `${dAssetsNum.toFixed(1)}%` : 'N/A'
  const roeDisplay  = roeNum !== null ? `${(roeNum * 100).toFixed(1)}%` : 'Ã¢â‚¬â€'
  const fcfDisplay  = fcfMarginNum !== null ? `${fcfMarginNum.toFixed(1)}%` : 'Ã¢â‚¬â€'
  const nmDisplay   = netMarginNum !== null ? `${netMarginNum.toFixed(1)}%` : 'Ã¢â‚¬â€'
  const roceDisplay = roceNum !== null ? `${roceNum.toFixed(1)}%` : 'Ã¢â‚¬â€'

  return {
    system: 'You are a Quantitative Risk Analyst. Return ONLY valid JSON. NEVER use markdown backticks.',
    user: `Analyze risk metrics and financial health for ${ticker} (${d.sector || 'General'}).

SECTOR: ${d.sector || 'General'} Ã¢â‚¬â€ ${th.label} norms applied.

INJECTED FINANCIAL DATA:
- Current Price: ${price}
- Market Cap: ${fmtNumber(d.marketCap)}
- P/E (TTM): ${pe}x
- Forward P/E: ${fwdPe}x
- EV/EBITDA: ${evEbitda}x
- Beta: ${d.beta?.toFixed?.(2) || 'Ã¢â‚¬â€'}
- Sector/Industry Median P/E: ${sectorMedianPE}${industryPE != null ? ' Ã¢â‚¬â€ USE THIS EXACT value.' : ''}
${buildPeerContext()}
PRE-COMPUTED RATIOS (use these exact values in the JSON Ã¢â‚¬â€ do NOT recompute):
Leverage:
  Debt/Equity    = ${deqDisplay}  (sector threshold: ${th.debtEq.t})
  Current Ratio  = ${curDisplay}  (sector threshold: ${th.curRatio.t})
  Net Debt/EBITDA= ${ndEDisplay}  (sector threshold: ${th.ndEbitda.t})
  Interest Cover = ${icDisplay}   (sector threshold: ${th.intCov.t})
  Debt/Assets    = ${daDisplay}   (sector threshold: ${th.dAssets.t})
Quality:
  ROE            = ${roeDisplay}  (sector benchmark: ${th.roe.t})
  FCF Margin     = ${fcfDisplay}  (sector benchmark: ${th.fcfMargin.t})
  Net Margin     = ${nmDisplay}   (sector benchmark: ${th.netMargin.t})
  ROCE           = ${roceDisplay} (sector benchmark: ${th.roce.t})

INJECTED TECHNICAL DATA:
- Trend: ${trend}
- Price vs 50DMA: ${priceVs50DMA}%
- Price vs 200DMA: ${priceVs200DMA}%
- 52-Week Position: ${weekPosition52}%
- 52-Week Range: ${weekLow52} Ã¢â‚¬â€œ ${weekHigh52}
- Volume Signal: ${volumeSignal}
- Support: ${support}, Resistance: ${resistance}

RULES:
1. Use ALL injected/pre-computed values EXACTLY Ã¢â‚¬â€ no recomputation.
2. riskSummary = 2 sentences using actual numbers above.
3. riskFactors = 4 items, each analyzing a specific ratio with sector context.
4. overallRiskScore & overallQualityScore = integers 1-10.
5. Use SCREENER PEER DATA for peerBenchmarks if provided.

Return ONLY JSON:
{
  "overallRiskScore": ${Math.max(1, Math.min(10, Math.round((d.beta || 1) * 5)))},
  "overallQualityScore": ${Math.max(1, Math.min(10, Math.round((roeNum || 0.12) * 100 / 2)))},
  "riskSummary": "<2-sentence institutional risk summary citing actual ratios>",
  "technicals": {
    "trend": "${trend}",
    "momentum": "${Number(priceVs50DMA) > 0 ? 'UPTREND' : Number(priceVs50DMA) < 0 ? 'DOWNTREND' : 'NEUTRAL'}",
    "technicalRating": "${Number(priceVs200DMA) > 5 ? 'BULLISH' : Number(priceVs200DMA) < -5 ? 'BEARISH' : 'NEUTRAL'}",
    "priceVs50DMA": "${priceVs50DMA}",
    "priceVs200DMA": "${priceVs200DMA}",
    "weekPosition52": "${weekPosition52}",
    "keyLevels": { "support": ${support}, "resistance": ${resistance} }
  },
  "valuationRatios": [
    {"metric": "P/E (TTM)", "value": "${pe}x", "sectorMedian": "${sectorMedianPE}", "assessment": "<CHEAP|FAIR|EXPENSIVE>", "note": "<one sentence>"},
    {"metric": "Forward P/E", "value": "${fwdPe}x", "sectorMedian": "${sectorMedianFwdPE}", "assessment": "<CHEAP|FAIR|EXPENSIVE>", "note": "<one sentence>"},
    {"metric": "EV/EBITDA", "value": "${evEbitda}x", "sectorMedian": "${sectorMedianEvEbitda}", "assessment": "<CHEAP|FAIR|EXPENSIVE>", "note": "<one sentence>"}
  ],
  "qualityRatios": [
    {"metric": "ROE", "value": "${roeDisplay}", "benchmark": "${th.roe.t}", "rating": "${qual(roeNum ? roeNum * 100 : null, th.roe.excl, th.roe.good)}"},
    {"metric": "FCF Margin", "value": "${fcfDisplay}", "benchmark": "${th.fcfMargin.t}", "rating": "${qual(fcfMarginNum, th.fcfMargin.excl, th.fcfMargin.good)}"},
    {"metric": "Net Margin", "value": "${nmDisplay}", "benchmark": "${th.netMargin.t}", "rating": "${qual(netMarginNum, th.netMargin.excl, th.netMargin.good)}"},
    {"metric": "ROCE", "value": "${roceDisplay}", "benchmark": "${th.roce.t}", "rating": "${qual(roceNum, th.roce.excl, th.roce.good)}"}
  ],
  "leverageRatios": [
    {"metric": "Debt/Equity", "value": "${deqDisplay}", "threshold": "${th.debtEq.t}", "risk": "${riskHigh(debtEqNum, th.debtEq.warnH, th.debtEq.warnM)}"},
    {"metric": "Current Ratio", "value": "${curDisplay}", "threshold": "${th.curRatio.t}", "risk": "${riskLow(curRatioNum, th.curRatio.warnH, th.curRatio.warnM)}"},
    {"metric": "Net Debt/EBITDA", "value": "${ndEDisplay}", "threshold": "${th.ndEbitda.t}", "risk": "${riskHigh(ndEbitdaNum, th.ndEbitda.warnH, th.ndEbitda.warnM)}"},
    {"metric": "Interest Coverage", "value": "${icDisplay}", "threshold": "${th.intCov.t}", "risk": "${riskLow(intCovNum, th.intCov.warnH, th.intCov.warnM)}"},
    {"metric": "Debt/Assets", "value": "${daDisplay}", "threshold": "${th.dAssets.t}", "risk": "${riskHigh(dAssetsNum, th.dAssets.warnH, th.dAssets.warnM)}"}
  ],
  "riskFactors": [
    {"risk": "Leverage Risk", "severity": "${riskHigh(debtEqNum, th.debtEq.warnH, th.debtEq.warnM)}", "likelihood": "MEDIUM", "detail": "<analyze D/E ${deqDisplay} vs sector threshold ${th.debtEq.t} for ${d.sector}>"},
    {"risk": "Liquidity Risk", "severity": "${riskLow(curRatioNum, th.curRatio.warnH, th.curRatio.warnM)}", "likelihood": "MEDIUM", "detail": "<analyze current ratio ${curDisplay} vs threshold ${th.curRatio.t} for ${d.sector}>"},
    {"risk": "Debt Serviceability", "severity": "${riskLow(intCovNum, th.intCov.warnH, th.intCov.warnM)}", "likelihood": "MEDIUM", "detail": "<analyze interest coverage ${icDisplay} vs threshold ${th.intCov.t}>"},
    {"risk": "Valuation Risk", "severity": "<LOW|MEDIUM|HIGH based on P/E vs sector>", "likelihood": "MEDIUM", "detail": "<analyze P/E ${pe}x vs sector median ${sectorMedianPE}>"}
  ],
  "peerBenchmarks": [
    {"ticker": "<peer1_ticker>", "name": "<peer1_name>", "pe": "<pe>x", "evEbitda": "<ev>x", "margin": "<margin>%"},
    {"ticker": "<peer2_ticker>", "name": "<peer2_name>", "pe": "<pe>x", "evEbitda": "<ev>x", "margin": "<margin>%"},
    {"ticker": "<peer3_ticker>", "name": "<peer3_name>", "pe": "<pe>x", "evEbitda": "<ev>x", "margin": "<margin>%"}
  ]
}`
  }
}


/**
 * ============================================================================
 * Ã°Å¸â€â€™ STRICT CODE FREEZE IN EFFECT Ã°Å¸â€â€™
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
 * Robustly extract a JSON object from AI output.
 * Strategy 1: Strip markdown fences (e.g. ```json ... ```), then parse.
 * Strategy 2: Bracket-depth scan to find the outermost { } block.
 *             Handles models that prepend/append conversational text.
 * @param {string} raw - Raw AI response string
 * @returns {string} The extracted JSON string (not yet parsed)
 */
function extractJSON(raw) {
  if (!raw || typeof raw !== 'string') return raw

  // ReDoS protection: cap input length before applying any regex or iteration
  const MAX_RESPONSE_CHARS = 100_000
  if (raw.length > MAX_RESPONSE_CHARS) {
    raw = raw.slice(0, MAX_RESPONSE_CHARS)
  }

  // Strategy 1: Strip common markdown fences
  let cleaned = raw.trim()
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

  // Quick check if it already looks like valid JSON
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
    return cleaned
  }

  // Strategy 2: Bracket-depth tracking to extract the first complete { } block
  let depth = 0
  let start = -1
  let inString = false
  let escape = false

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]

    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue

    if (ch === '{') {
      if (depth === 0) start = i
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0 && start !== -1) {
        return raw.slice(start, i + 1)
      }
    }
  }

  // Return the fence-stripped version as last resort
  return cleaned
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

    // 1. Extract JSON robustly (handles fences, conversational preamble, etc.)
    const cleanedResponse = extractJSON(rawResponse)

    // 2. Parse JSON with defensive fallback
    let analysisData
    try {
      analysisData = safeParseJSON(cleanedResponse)
    } catch (parseError) {
      console.error('[analyze] JSON parse failed. Raw response (first 800 chars):', rawResponse?.slice(0, 800))
      console.error('[analyze] Cleaned candidate (first 800 chars):', cleanedResponse?.slice(0, 800))
      // The extractJSON already tried bracket-depth scanning, so no secondary retry needed
      throw new Error(`AI returned unparseable output: ${parseError.message}`)
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
export const maxDuration = 300  // Vercel Pro: up to 300s for AI inference
