/**
 * AI Response Normalizer
 * Handles inconsistent AI output formats and prevents UI crashes
 * Ensures all analysis components receive structured data with sensible defaults
 */

// ─────────────────────────────────────────────────────────────────────────────
// THESIS NORMALIZATION
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const MIN_CONFIDENCE_THRESHOLD = 20 // Minimum confidence % for valid analysis
export const MAX_CONFIDENCE_THRESHOLD = 100
export const DEFAULT_CURRENCY = 'USD'

const DEFAULT_THESIS_DATA = {
  verdict: 'INSUFFICIENT_DATA',
  confidence: 0,
  targetPrice: null,
  currentPrice: null,
  upsideDownside: 0,
  timeHorizon: null,
  thesisSummary: 'Analysis unavailable. Please retry.',
  bullCase: null,
  bearCase: null,
  baseCase: null,
  keyDrivers: [],
  moatRating: 0,
  moatType: 'Unknown',
  growthQuality: null,
  catalysts: [],
  risks: [],
  positionSizing: 'Medium',
  comparisonPeers: [],
  isValid: false,
  validationErrors: [],
}

const DEFAULT_CASE = {
  title: null,
  targetPrice: null,
  probability: null,
  points: [],
}

// Flexible field extractors - support multiple naming conventions
function extractField(obj, ...keys) {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) {
      return obj[key]
    }
  }
  return undefined
}

function extractFieldNested(obj, ...paths) {
  for (const path of paths) {
    const parts = path.split('.')
    let current = obj
    for (const part of parts) {
      if (current && typeof current === 'object') {
        current = current[part]
      } else {
        current = undefined
        break
      }
    }
    if (current !== undefined && current !== null) {
      return current
    }
  }
  return undefined
}

export function normalizeThesisData(raw) {
  if (!raw) return { ...DEFAULT_THESIS_DATA }

  let data = raw
  if (raw.success && typeof raw.data === 'object') {
    data = raw.data
  }

  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      return { ...DEFAULT_THESIS_DATA }
    }
  }

  if (typeof data === 'object' && data !== null) {
    if (data.content && typeof data.content === 'object') {
      data = data.content
    } else if (data.analysis && typeof data.analysis === 'object') {
      data = data.analysis
    }
  }

  if (typeof data !== 'object' || data === null) {
    return { ...DEFAULT_THESIS_DATA }
  }

  // Flexible field extraction with multiple key variants
  const verdict = extractField(data, 'verdict', 'investmentVerdict', 'recommendation')
  const confidence = extractField(data, 'confidence', 'confidenceScore', 'confidenceLevel')
  const targetPrice = normalizePrice(extractField(data, 'targetPrice', 'target', 'priceTarget', 'fairValue'))
  const currentPrice = normalizePrice(extractField(data, 'currentPrice', 'price', 'marketPrice', 'lastPrice'))
  const timeHorizon = extractField(data, 'timeHorizon', 'timeHorizon', 'horizon', 'timeline')
  const thesisSummary = extractField(data, 'thesisSummary', 'summary', 'investmentSummary', 'analysis')
  const bullCase = extractField(data, 'bullCase', 'bull_case', 'bull', 'bullScenario', 'optimisticCase')
  const bearCase = extractField(data, 'bearCase', 'bear_case', 'bear', 'bearScenario', 'pessimisticCase')
  const baseCase = extractField(data, 'baseCase', 'base_case', 'base', 'baseScenario', 'neutralCase')
  const keyDrivers = extractField(data, 'keyDrivers', 'key_drivers', 'drivers', 'investmentDrivers')
  const moatRating = extractField(data, 'moatRating', 'moat_rating', 'moatScore', 'competitiveMoat')
  const moatType = extractField(data, 'moatType', 'moat_type', 'moat', 'competitiveAdvantage')
  const growthQuality = extractField(data, 'growthQuality', 'growth_quality', 'growth')
  const catalysts = extractField(data, 'catalysts', 'keyCatalysts', 'catalyst')
  const risks = extractField(data, 'risks', 'riskFactors', 'keyRisks')
  const positionSizing = extractField(data, 'positionSizing', 'position_size', 'sizing', 'position')
  const comparisonPeers = extractField(data, 'comparisonPeers', 'comparison_peers', 'peers', 'comparableCompanies')

  // ─────────────────────────────────────────────────────────────────────────────
  // STRICT DERIVED CALCULATIONS & VALIDATION
  // ─────────────────────────────────────────────────────────────────────────────

  // Calculate upside/downside strictly from prices: ((TP - CP) / CP) * 100
  // Never use API-provided upside value - always recalculate
  let upsideDownside = 0
  if (targetPrice !== null && currentPrice !== null && currentPrice !== 0) {
    upsideDownside = ((targetPrice - currentPrice) / currentPrice) * 100
  }

  // Normalize confidence - reject ridiculously low values (likely API errors)
  const normalizedConfidence = normalizeNumber(confidence, 0, 100, 0)

  // Build validation errors array
  const validationErrors = []
  if (normalizedConfidence < MIN_CONFIDENCE_THRESHOLD) {
    validationErrors.push(`Confidence ${normalizedConfidence.toFixed(1)}% below minimum threshold ${MIN_CONFIDENCE_THRESHOLD}%`)
  }
  if (targetPrice === null) {
    validationErrors.push('Target price missing')
  }
  if (currentPrice === null) {
    validationErrors.push('Current price missing')
  }

  // Determine validity: all critical checks must pass
  const isValid = validationErrors.length === 0

  // Determine final verdict - INVALID if validation fails
  const finalVerdict = isValid ? normalizeVerdict(verdict) : 'INSUFFICIENT_DATA'

  return {
    verdict: finalVerdict,
    confidence: normalizedConfidence,
    targetPrice,
    currentPrice,
    upsideDownside,
    isValid,
    validationErrors,
    timeHorizon: normalizeString(timeHorizon, DEFAULT_THESIS_DATA.timeHorizon),
    thesisSummary: isValid
      ? normalizeString(thesisSummary, DEFAULT_THESIS_DATA.thesisSummary)
      : `Analysis insufficient: ${validationErrors.join('; ')}`,
    bullCase: isValid ? normalizeCase(bullCase) : DEFAULT_CASE,
    bearCase: isValid ? normalizeCase(bearCase) : DEFAULT_CASE,
    baseCase: isValid ? normalizeCase(baseCase) : DEFAULT_CASE,
    keyDrivers: safeArray(keyDrivers),
    moatRating: normalizeNumber(moatRating, 0, 5, 0),
    moatType: normalizeString(moatType, DEFAULT_THESIS_DATA.moatType),
    growthQuality: normalizeString(growthQuality, DEFAULT_THESIS_DATA.growthQuality),
    catalysts: safeArray(catalysts),
    risks: safeArray(risks),
    positionSizing: isValid
      ? normalizeString(positionSizing, DEFAULT_THESIS_DATA.positionSizing)
      : 'None',
    comparisonPeers: normalizeStringArray(comparisonPeers),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DCF NORMALIZATION
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_DCF_DATA = {
  intrinsicValuePerShare: null,
  currentPrice: null,
  upside: 0,
  assumptions: null,
  projections: [],
  pvFCFs: null,
  terminalValue: null,
  pvTerminalValue: null,
  enterpriseValue: null,
  equityValue: null,
  marginOfSafety: 0,
  dcfRating: 'NEUTRAL',
  sensitivityTable: null,
  keyRisksToModel: [],
  analystNote: null,
}

const DEFAULT_ASSUMPTIONS = {
  wacc: 10,
  terminalGrowthRate: 2.5,
  taxRate: 21,
  revenueGrowthRates: [10, 10, 10, 10, 10],
  ebitdaMargins: [20, 20, 20, 20, 20],
}

/**
 * Normalize percentage values from AI which may return decimals (0.1) or whole numbers (10)
 * @param {number} val - Raw percentage value
 * @param {number} [defaultValue] - Default if invalid
 * @returns {number} Normalized percentage (whole number)
 */
function normalizePercentage(val, defaultValue = 0) {
  if (val === null || val === undefined) return defaultValue
  let num = Number(val)
  if (isNaN(num)) return defaultValue
  // If value is likely a decimal (e.g., 0.1 for 10%), convert to percentage
  // Heuristic: if |num| < 1 and not zero, it's likely a decimal representation
  if (Math.abs(num) > 0 && Math.abs(num) < 1) {
    num = num * 100
  }
  return Math.round(num * 100) / 100 // Round to 2 decimal places
}

export function normalizeDCFData(raw) {
  if (!raw) return { ...DEFAULT_DCF_DATA }

  let data = raw
  if (raw.success && typeof raw.data === 'object') {
    data = raw.data
  }

  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      return { ...DEFAULT_DCF_DATA }
    }
  }

  if (typeof data !== 'object' || data === null) {
    return { ...DEFAULT_DCF_DATA }
  }

  // Get current price for calculations (from API data or normalized value)
  const currentPrice = toNumber(data.currentPrice)
  const intrinsicValuePerShare = toNumber(data.intrinsicValuePerShare)

  // Calculate upside using strict formula: ((IV - CP) / CP) * 100
  let upside = 0
  if (intrinsicValuePerShare && currentPrice && currentPrice !== 0) {
    upside = ((intrinsicValuePerShare - currentPrice) / currentPrice) * 100
  } else if (data.upside !== undefined && data.upside !== null) {
    // Fallback to provided upside if calculation not possible
    upside = normalizeNumber(data.upside, -100, 100, 0)
  }

  // Calculate rating based on derived upside (not from API)
  let dcfRating = 'NEUTRAL'
  if (upside > 10) dcfRating = 'UNDERVALUED'
  else if (upside < -10) dcfRating = 'OVERVALUED'

  // Calculate margin of safety: ((IV - CP) / IV) * 100
  let marginOfSafety = 0
  if (intrinsicValuePerShare && currentPrice && intrinsicValuePerShare !== 0) {
    marginOfSafety = ((intrinsicValuePerShare - currentPrice) / intrinsicValuePerShare) * 100
  }

  return {
    intrinsicValuePerShare,
    currentPrice,
    upside,
    assumptions: normalizeAssumptions(data.assumptions),
    projections: normalizeArray(data.projections).map(normalizeProjection),
    pvFCFs: toNumber(data.pvFCFs),
    terminalValue: toNumber(data.terminalValue),
    pvTerminalValue: normalizeNumber(data.pvTerminalValue, 0, null, 0),
    enterpriseValue: normalizeNumber(data.enterpriseValue, 0, null, 0),
    equityValue: normalizeNumber(data.equityValue, 0, null, 0),
    marginOfSafety,
    dcfRating,
    sensitivityTable: normalizeSensitivityTable(data.sensitivityTable),
    keyRisksToModel: normalizeStringArray(data.keyRisksToModel),
    analystNote: normalizeString(data.analystNote, DEFAULT_DCF_DATA.analystNote),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RISK NORMALIZATION
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_RISK_DATA = {
  valuationRatios: [],
  qualityRatios: [],
  leverageRatios: [],
  technicals: null,
  riskFactors: [],
  overallRiskScore: 5,
  overallQualityScore: 5,
  riskSummary: 'Risk analysis unavailable.',
  peerBenchmarks: [],
}

const DEFAULT_TECHNICALS = {
  trend: 'NEUTRAL',
  rsi: 50,
  support: null,
  resistance: null,
  volumeSignal: 'Normal',
}

export function normalizeRiskData(raw) {
  // Only return default if raw is completely null/undefined
  if (!raw) return { ...DEFAULT_RISK_DATA }

  let data = raw
  if (raw.success && typeof raw.data === 'object') {
    data = raw.data
  }

  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      return { ...DEFAULT_RISK_DATA }
    }
  }

  if (typeof data !== 'object' || data === null) {
    return { ...DEFAULT_RISK_DATA }
  }

  // Salvage partial JSON - use direct array fallbacks to ensure arrays always return
  // Default overallRiskScore to 5 (neutral) if missing
  return {
    valuationRatios: (data.valuationRatios && Array.isArray(data.valuationRatios))
      ? data.valuationRatios.map(normalizeRatio)
      : [],
    qualityRatios: (data.qualityRatios && Array.isArray(data.qualityRatios))
      ? data.qualityRatios.map(normalizeRatio)
      : [],
    leverageRatios: (data.leverageRatios && Array.isArray(data.leverageRatios))
      ? data.leverageRatios.map(normalizeRatio)
      : [],
    technicals: normalizeTechnicals(data.technicals),
    riskFactors: (data.riskFactors && Array.isArray(data.riskFactors))
      ? data.riskFactors.map(normalizeRiskFactor)
      : [],
    overallRiskScore: normalizeNumber(data.overallRiskScore, 1, 10, 5),
    overallQualityScore: normalizeNumber(data.overallQualityScore, 1, 10, 5),
    riskSummary: normalizeString(data.riskSummary, DEFAULT_RISK_DATA.riskSummary),
    peerBenchmarks: (data.peerBenchmarks && Array.isArray(data.peerBenchmarks))
      ? data.peerBenchmarks.map(normalizePeerBenchmark).filter(Boolean)
      : [],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NEWS/SENTIMENT NORMALIZATION
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_NEWS_DATA = {
  sentimentScore: 50,
  sentimentLabel: 'Neutral',
  sentimentRationale: null,
  analystConsensus: null,
  keyThemes: [],
  bullCatalysts: [],
  bearCatalysts: [],
  macroExposure: [],
  institutionalActivity: null,
  upcomingEvents: [],
  tradingNote: null,
}

const DEFAULT_ANALYST_CONSENSUS = {
  rating: 'HOLD',
  meanTarget: null,
  upside: 0,
  buyCount: 0,
  holdCount: 0,
  sellCount: 0,
  noteOnConsensus: null,
}

export function normalizeNewsData(raw) {
  if (!raw) return { ...DEFAULT_NEWS_DATA }

  let data = raw
  if (raw.success && typeof raw.data === 'object') {
    data = raw.data
  }

  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      return { ...DEFAULT_NEWS_DATA }
    }
  }

  if (typeof data !== 'object' || data === null) {
    return { ...DEFAULT_NEWS_DATA }
  }

  return {
    sentimentScore: normalizeNumber(data.sentimentScore, 0, 100, 50),
    sentimentLabel: normalizeSentimentLabel(data.sentimentLabel),
    sentimentRationale: normalizeString(data.sentimentRationale, DEFAULT_NEWS_DATA.sentimentRationale),
    analystConsensus: normalizeAnalystConsensus(data.analystConsensus),
    keyThemes: normalizeArray(data.keyThemes).map(normalizeTheme),
    bullCatalysts: normalizeArray(data.bullCatalysts).map(normalizeCatalyst),
    bearCatalysts: normalizeArray(data.bearCatalysts).map(normalizeCatalyst),
    macroExposure: normalizeArray(data.macroExposure).map(normalizeMacro),
    institutionalActivity: normalizeInstitutional(data.institutionalActivity),
    upcomingEvents: normalizeArray(data.upcomingEvents).map(normalizeEvent),
    tradingNote: normalizeString(data.tradingNote, DEFAULT_NEWS_DATA.tradingNote),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPARE NORMALIZATION
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_COMPARE_DATA = {
  winner: null,
  winnerRationale: 'Comparison unavailable.',
  comparisonDimensions: [],
  headToHead: [],
  stock1Strengths: [],
  stock2Strengths: [],
  stock1Weaknesses: [],
  stock2Weaknesses: [],
  recommendation: null,
  portfolioContext: null,
}

export function normalizeCompareData(raw) {
  if (!raw) return { ...DEFAULT_COMPARE_DATA }

  let data = raw
  if (raw.success && typeof raw.data === 'object') {
    data = raw.data
  }

  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      return { ...DEFAULT_COMPARE_DATA }
    }
  }

  if (typeof data !== 'object' || data === null) {
    return { ...DEFAULT_COMPARE_DATA }
  }

  return {
    winner: normalizeString(data.winner, DEFAULT_COMPARE_DATA.winner),
    winnerRationale: normalizeString(data.winnerRationale, DEFAULT_COMPARE_DATA.winnerRationale),
    comparisonDimensions: normalizeArray(data.comparisonDimensions).map(normalizeDimension),
    headToHead: normalizeArray(data.headToHead).map(normalizeHeadToHead),
    stock1Strengths: normalizeStringArray(data.stock1Strengths),
    stock2Strengths: normalizeStringArray(data.stock2Strengths),
    stock1Weaknesses: normalizeStringArray(data.stock1Weaknesses),
    stock2Weaknesses: normalizeStringArray(data.stock2Weaknesses),
    recommendation: normalizeRecommendation(data.recommendation),
    portfolioContext: normalizeString(data.portfolioContext, DEFAULT_COMPARE_DATA.portfolioContext),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function normalizeVerdict(val) {
  if (!val || typeof val !== 'string') return 'NEUTRAL'
  const v = val.toUpperCase().trim()
  if (['BUY', 'STRONG_BUY', 'STRONG BUY'].includes(v)) return 'BUY'
  if (['SELL', 'STRONG_SELL', 'STRONG SELL'].includes(v)) return 'SELL'
  if (['HOLD', 'NEUTRAL'].includes(v)) return 'HOLD'
  return 'NEUTRAL'
}

function normalizeRating(val) {
  if (!val || typeof val !== 'string') return 'NEUTRAL'
  const v = val.toUpperCase().trim()
  if (['UNDERVALUED', 'BUY'].includes(v)) return 'UNDERVALUED'
  if (['OVERVALUED', 'SELL'].includes(v)) return 'OVERVALUED'
  return 'NEUTRAL'
}

function normalizeSentimentLabel(val) {
  if (!val || typeof val !== 'string') return 'Neutral'
  const v = val.trim()
  if (/^(positive|bullish|green|↑)/i.test(v)) return 'Positive'
  if (/^(negative|bearish|red|↓)/i.test(v)) return 'Negative'
  return 'Neutral'
}

export function normalizeCase(val) {
  if (!val) return null
  // STRING → convert
  if (typeof val === "string") {
    return { title: val, points: [val], probability: null, targetPrice: null }
  }
  // OBJECT → fix fields
  return {
    title: val.title || "Scenario",
    points: safeArray(val.points),
    probability: val.probability ?? null,
    targetPrice: val.targetPrice ?? null
  }
}

function normalizeDriver(val) {
  // Handle string values from AI
  if (typeof val === 'string' && val.trim()) {
    return { driver: val.trim(), detail: '', impact: 'NEUTRAL' }
  }
  // Handle object values
  if (!val || typeof val !== 'object') return { driver: 'Unknown', detail: '', impact: 'NEUTRAL' }
  return {
    driver: normalizeString(val.driver, 'Unknown'),
    detail: normalizeString(val.detail, ''),
    impact: normalizeImpact(val.impact),
  }
}

function normalizeImpact(val) {
  if (!val || typeof val !== 'string') return 'NEUTRAL'
  const v = val.toUpperCase().trim()
  if (['POSITIVE', 'POS', '+'].includes(v)) return 'POSITIVE'
  if (['NEGATIVE', 'NEG', '-'].includes(v)) return 'NEGATIVE'
  return 'NEUTRAL'
}

function normalizeAssumptions(val) {
  if (!val || typeof val !== 'object') return { ...DEFAULT_ASSUMPTIONS }
  return {
    wacc: normalizePercentage(val.wacc, DEFAULT_ASSUMPTIONS.wacc),
    terminalGrowthRate: normalizePercentage(val.terminalGrowthRate, DEFAULT_ASSUMPTIONS.terminalGrowthRate),
    taxRate: normalizePercentage(val.taxRate, DEFAULT_ASSUMPTIONS.taxRate),
    revenueGrowthRates: normalizeArray(val.revenueGrowthRates).map(v => normalizePercentage(v, 10)),
    ebitdaMargins: normalizeArray(val.ebitdaMargins).map(v => normalizePercentage(v, 20)),
  }
}

function normalizeProjection(val) {
  if (!val || typeof val !== 'object') return { year: 1, revenue: 0, ebitda: 0, ebit: 0, nopat: 0, capex: 0, nwcChange: 0, fcf: 0, pvFCF: 0 }
  return {
    year: normalizeNumber(val.year, 1, 10, 1),
    revenue: normalizeNumber(val.revenue, null, null, 0),
    ebitda: normalizeNumber(val.ebitda, null, null, 0),
    ebit: normalizeNumber(val.ebit, null, null, 0),
    nopat: normalizeNumber(val.nopat, null, null, 0),
    capex: normalizeNumber(val.capex, null, null, 0),
    nwcChange: normalizeNumber(val.nwcChange, null, null, 0),
    fcf: normalizeNumber(val.fcf, null, null, 0),
    pvFCF: normalizeNumber(val.pvFCF, null, null, 0),
  }
}

function normalizeSensitivityTable(val) {
  if (!val || typeof val !== 'object') return null
  const waccRange = normalizeArray(val.waccRange).map(v => normalizeNumber(v, 0, 50, 10))
  const tgrRange = normalizeArray(val.tgrRange).map(v => normalizeNumber(v, -5, 10, 2.5))
  const values = normalizeArray(val.values).map(row =>
    normalizeArray(row).map(v => normalizeNumber(v, null, null, 0))
  )
  if (!tgrRange.length || !waccRange.length || values.length !== tgrRange.length) return null
  return { waccRange, tgrRange, values }
}

function normalizeRatio(val) {
  if (!val || typeof val !== 'object') return { metric: null, name: null, value: '—', benchmark: null }
  // Support both field name conventions
  const metric = normalizeString(val.metric || val.name, null)
  const value = val.value != null ? val.value : '—'
  return {
    // Shared
    metric,
    name: metric,
    value,
    // valuationRatios fields
    sectorMedian: val.sectorMedian != null ? val.sectorMedian : '—',
    assessment: normalizeString(val.assessment, null),
    note: normalizeString(val.note, null),
    // qualityRatios fields
    benchmark: normalizeString(val.benchmark, null),
    rating: normalizeString(val.rating, null),
    // leverageRatios fields
    threshold: normalizeString(val.threshold, null),
    risk: normalizeString(val.risk, null),
  }
}

function normalizeTechnicals(val) {
  if (!val || typeof val !== 'object') return { ...DEFAULT_TECHNICALS }
  return {
    // Legacy fields
    trend: normalizeString(val.trend, DEFAULT_TECHNICALS.trend),
    rsi: normalizeNumber(val.rsi, 0, 100, 50),
    support: normalizePrice(val.support),
    resistance: normalizePrice(val.resistance),
    volumeSignal: normalizeString(val.volumeSignal, DEFAULT_TECHNICALS.volumeSignal),
    // RiskRatios.js expected fields
    momentum: normalizeString(val.momentum, null),
    technicalRating: normalizeString(val.technicalRating, null),
    priceVs50DMA: normalizeString(val.priceVs50DMA, '0'),
    priceVs200DMA: normalizeString(val.priceVs200DMA, '0'),
    weekPosition52: normalizeString(val.weekPosition52, '50'),
    keyLevels: val.keyLevels && typeof val.keyLevels === 'object'
      ? {
          support: val.keyLevels.support != null ? val.keyLevels.support : null,
          resistance: val.keyLevels.resistance != null ? val.keyLevels.resistance : null,
        }
      : { support: null, resistance: null },
  }
}

function normalizeRiskFactor(val) {
  if (!val || typeof val !== 'object') {
    if (typeof val === 'string' && val) return { risk: val, factor: val, severity: 'MEDIUM', likelihood: 'MEDIUM', detail: null, description: null }
    return { risk: 'Unknown Risk', factor: 'Unknown Risk', severity: 'MEDIUM', likelihood: 'MEDIUM', detail: null, description: null }
  }
  // Support both field name conventions: risk/detail (RiskRatios.js) and factor/description (old)
  const riskName = normalizeString(val.risk || val.factor, 'Unknown Risk')
  const detail = normalizeString(val.detail || val.description, null)
  const severity = normalizeString(val.severity, 'MEDIUM').toUpperCase()
  const likelihood = normalizeString(val.likelihood, 'MEDIUM').toUpperCase()
  return {
    risk: riskName,
    factor: riskName,
    severity,
    likelihood,
    detail,
    description: detail,
  }
}

function normalizePeerBenchmark(val) {
  if (!val || typeof val !== 'object') return null
  // Filter out AI placeholder values that should never reach the UI
  const ticker = normalizeString(val.ticker, null)
  const name = normalizeString(val.name, null)
  if (!ticker || ticker.startsWith('PEER') || ticker.startsWith('<')) return null
  if (!name || name.startsWith('Peer Company') || name.startsWith('<')) return null
  // Support both margin/netMargin field names; ignore placeholder "N/A"
  const rawMargin = val.margin ?? val.netMargin ?? '—'
  const margin = (rawMargin === 'N/A' || rawMargin === null) ? '—' : rawMargin
  return {
    ticker,
    name,
    pe: val.pe != null && val.pe !== '<' ? val.pe : '—',
    evEbitda: val.evEbitda != null && val.evEbitda !== '<' ? val.evEbitda : '—',
    margin,
    // Legacy fields
    metric: normalizeString(val.metric, null),
    value: normalizeString(val.value, '—'),
  }
}


function normalizeAnalystConsensus(val) {
  if (!val || typeof val !== 'object') return { ...DEFAULT_ANALYST_CONSENSUS }
  return {
    rating: normalizeRatingText(val.rating),
    meanTarget: normalizePrice(val.meanTarget),
    upside: normalizeNumber(val.upside, -100, 100, 0),
    buyCount: normalizeNumber(val.buyCount, 0, null, 0),
    holdCount: normalizeNumber(val.holdCount, 0, null, 0),
    sellCount: normalizeNumber(val.sellCount, 0, null, 0),
    noteOnConsensus: normalizeString(val.noteOnConsensus, null),
  }
}

function normalizeRatingText(val) {
  if (!val || typeof val !== 'string') return 'HOLD'
  const v = val.toUpperCase().trim()
  if (['BUY', 'STRONG_BUY', 'OUTPERFORM'].includes(v)) return 'BUY'
  if (['SELL', 'STRONG_SELL', 'UNDERPERFORM'].includes(v)) return 'SELL'
  return 'HOLD'
}

function normalizeTheme(val) {
  if (!val || typeof val !== 'object') return { theme: 'Unknown', sentiment: 'NEUTRAL', timeframe: null, detail: '' }
  return {
    theme: normalizeString(val.theme, 'Unknown'),
    sentiment: normalizeImpact(val.sentiment),
    timeframe: normalizeString(val.timeframe, null),
    detail: normalizeString(val.detail, ''),
  }
}

function normalizeCatalyst(val) {
  if (!val || typeof val !== 'object') {
    if (typeof val === 'string' && val) return { catalyst: val, probability: 'Medium', potentialImpact: null }
    return { catalyst: 'Unknown', probability: 'Medium', potentialImpact: null }
  }
  return {
    catalyst: normalizeString(val.catalyst, 'Unknown'),
    probability: normalizeProbability(val.probability),
    potentialImpact: normalizeString(val.potentialImpact, null),
  }
}

function normalizeProbability(val) {
  if (!val || typeof val !== 'string') return 'Medium'
  const v = val.toUpperCase().trim()
  if (['HIGH'].includes(v)) return 'High'
  if (['LOW'].includes(v)) return 'Low'
  return 'Medium'
}

function normalizeMacro(val) {
  if (!val || typeof val !== 'object') return { factor: 'Unknown', exposure: 'NEUTRAL', detail: '' }
  return {
    factor: normalizeString(val.factor, 'Unknown'),
    exposure: normalizeImpact(val.exposure),
    detail: normalizeString(val.detail, ''),
  }
}

function normalizeInstitutional(val) {
  if (!val || typeof val !== 'object') return null
  return {
    shortInterestTrend: normalizeString(val.shortInterestTrend, 'Stable'),
    shortSqueezeRisk: normalizeString(val.shortSqueezeRisk, 'Low'),
    institutionalOwnershipNote: normalizeString(val.institutionalOwnershipNote, null),
  }
}

function normalizeEvent(val) {
  if (!val || typeof val !== 'object') return { event: 'Unknown', expectedDate: 'TBD', marketImplications: '' }
  return {
    event: normalizeString(val.event, 'Unknown'),
    expectedDate: normalizeString(val.expectedDate, 'TBD'),
    marketImplications: normalizeString(val.marketImplications, ''),
  }
}

function normalizeDimension(val) {
  if (!val || typeof val !== 'object') return { dimension: null, winner: 'TIE', stock1Score: 5, stock2Score: 5, detail: '' }
  return {
    dimension: normalizeString(val.dimension, 'N/A'),
    winner: normalizeString(val.winner, 'TIE'),
    stock1Score: normalizeNumber(val.stock1Score, 0, 10, 5),
    stock2Score: normalizeNumber(val.stock2Score, 0, 10, 5),
    detail: normalizeString(val.detail, ''),
  }
}

function normalizeHeadToHead(val) {
  if (!val || typeof val !== 'object') return { metric: null, stock1Value: '—', stock2Value: '—', advantage: 'TIE' }
  return {
    metric: normalizeString(val.metric, null),
    stock1Value: normalizeString(val.stock1Value, '—'),
    stock2Value: normalizeString(val.stock2Value, '—'),
    advantage: normalizeString(val.advantage, 'TIE'),
  }
}

function normalizeRecommendation(val) {
  if (!val || typeof val !== 'object') return null
  return {
    forGrowthInvestors: normalizeString(val.forGrowthInvestors, null),
    growthRationale: normalizeString(val.growthRationale, null),
    forValueInvestors: normalizeString(val.forValueInvestors, null),
    valueRationale: normalizeString(val.valueRationale, null),
    forIncomeInvestors: normalizeString(val.forIncomeInvestors, null),
    incomeRationale: normalizeString(val.incomeRationale, null),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIMITIVE NORMALIZERS
// ─────────────────────────────────────────────────────────────────────────────

export function safeArray(val) {
  if (!val) return []
  if (Array.isArray(val)) return val
  if (typeof val === "string") {
    return val
      .split(/,|\n|•|-/)
      .map(v => v.trim())
      .filter(Boolean)
  }
  return []
}

function normalizeString(val, defaultValue = '') {
  if (val === null || val === undefined) return defaultValue
  if (typeof val === 'string') return val.trim() || defaultValue
  if (typeof val === 'number' || typeof val === 'boolean') return String(val)
  return defaultValue
}

function normalizeNumber(val, min = null, max = null, defaultValue = 0) {
  if (val === null || val === undefined) return defaultValue
  let num = Number(val)
  if (isNaN(num)) return defaultValue
  if (min !== null) num = Math.max(min, num)
  if (max !== null) num = Math.min(max, num)
  return num
}

export function toNumber(val) {
  if (val == null) return null
  if (typeof val === "number") return val
  if (typeof val === "string") {
    const cleaned = val.replace(/[₹$,]/g, "")
    const num = parseFloat(cleaned)
    return isNaN(num) ? null : num
  }
  return null
}

function normalizePrice(val) {
  if (val === null || val === undefined) return null
  const num = Number(val)
  if (isNaN(num)) return null
  return num
}

function normalizeArray(val) {
  if (!val) return []
  if (Array.isArray(val)) return val
  return [val]
}

function normalizeStringArray(val) {
  if (!val) return []
  if (Array.isArray(val)) return val.filter(v => typeof v === 'string' && v.trim()).map(v => v.trim())
  if (typeof val === 'string' && val.trim()) return [val.trim()]
  return []
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED NORMALIZER
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeAIResponse(raw, type) {
  switch (type) {
    case 'thesis':
      return normalizeThesisData(raw)
    case 'dcf':
      return normalizeDCFData(raw)
    case 'risk':
      return normalizeRiskData(raw)
    case 'news':
      return normalizeNewsData(raw)
    case 'compare':
      return normalizeCompareData(raw)
    default:
      if (raw && typeof raw === 'object') {
        if (raw.success && raw.data !== undefined) return raw.data
        return raw
      }
      return {}
  }
}

export default {
  normalizeAIResponse,
  normalizeThesisData,
  normalizeDCFData,
  normalizeRiskData,
  normalizeNewsData,
  normalizeCompareData,
}
