/**
 * AI Response Normalizer
 * Handles inconsistent AI output formats and prevents UI crashes
 * Ensures all analysis components receive structured data with sensible defaults
 */

// ─────────────────────────────────────────────────────────────────────────────
// THESIS NORMALIZATION
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_THESIS_DATA = {
  verdict: 'NEUTRAL',
  confidence: 50,
  targetPrice: null,
  upsideDownside: 0,
  timeHorizon: 'N/A',
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
}

const DEFAULT_CASE = {
  title: 'N/A',
  targetPrice: null,
  probability: 33,
  points: [],
}

/**
 * Normalize thesis analysis data from various AI response formats
 * @param {*} raw - Can be the API response object, raw string, nested data, or null
 * @returns {Object} Normalized thesis data structure
 */
export function normalizeThesisData(raw) {
  if (!raw) return { ...DEFAULT_THESIS_DATA }

  // Unwrap API response: { success: true, data: {...} }
  let data = raw
  if (raw.success && typeof raw.data === 'object') {
    data = raw.data
  }

  // Handle stringified JSON
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      return { ...DEFAULT_THESIS_DATA }
    }
  }

  // Handle nested { content } or { analysis } wrappers
  if (typeof data === 'object' && data !== null) {
    if (data.content && typeof data.content === 'object') {
      data = data.content
    } else if (data.analysis && typeof data.analysis === 'object') {
      data = data.analysis
    }
  }

  // Ensure we have an object
  if (typeof data !== 'object' || data === null) {
    return { ...DEFAULT_THESIS_DATA }
  }

  return {
    verdict: normalizeVerdict(data.verdict),
    confidence: normalizeNumber(data.confidence, 0, 100, 50),
    targetPrice: normalizePrice(data.targetPrice),
    upsideDownside: normalizeNumber(data.upsideDownside, -100, 100, 0),
    timeHorizon: normalizeString(data.timeHorizon, DEFAULT_THESIS_DATA.timeHorizon),
    thesisSummary: normalizeString(data.thesisSummary, DEFAULT_THESIS_DATA.thesisSummary),
    bullCase: normalizeCase(data.bullCase),
    bearCase: normalizeCase(data.bearCase),
    baseCase: normalizeCase(data.baseCase),
    keyDrivers: normalizeArray(data.keyDrivers).map(normalizeDriver),
    moatRating: normalizeNumber(data.moatRating, 0, 5, 0),
    moatType: normalizeString(data.moatType, DEFAULT_THESIS_DATA.moatType),
    growthQuality: normalizeString(data.growthQuality, DEFAULT_THESIS_DATA.growthQuality),
    catalysts: normalizeStringArray(data.catalysts),
    risks: normalizeStringArray(data.risks),
    positionSizing: normalizeString(data.positionSizing, DEFAULT_THESIS_DATA.positionSizing),
    comparisonPeers: normalizeStringArray(data.comparisonPeers),
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

const DEFAULT_PROJECTION = {
  year: 1,
  revenue: 0,
  ebitda: 0,
  ebit: 0,
  nopat: 0,
  capex: 0,
  nwcChange: 0,
  fcf: 0,
}

/**
 * Normalize DCF valuation data from various AI response formats
 * @param {*} raw - Can be the API response object, raw string, nested data, or null
 * @returns {Object} Normalized DCF data structure
 */
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

  return {
    intrinsicValuePerShare: normalizePrice(data.intrinsicValuePerShare),
    currentPrice: normalizePrice(data.currentPrice),
    upside: normalizeNumber(data.upside, -100, 100, 0),
    assumptions: normalizeAssumptions(data.assumptions),
    projections: normalizeArray(data.projections).map(normalizeProjection),
    pvFCFs: normalizeNumber(data.pvFCFs, 0, null, 0),
    terminalValue: normalizeNumber(data.terminalValue, 0, null, 0),
    pvTerminalValue: normalizeNumber(data.pvTerminalValue, 0, null, 0),
    enterpriseValue: normalizeNumber(data.enterpriseValue, 0, null, 0),
    equityValue: normalizeNumber(data.equityValue, 0, null, 0),
    marginOfSafety: normalizeNumber(data.marginOfSafety, -100, 100, 0),
    dcfRating: normalizeRating(data.dcfRating),
    sensitivityTable: normalizeSensitivityTable(data.sensitivityTable),
    keyRisksToModel: normalizeStringArray(data.keyRisksToModel),
    analystNote: normalizeString(data.analystNote, DEFAULT_DCF_DATA.analystNote),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RISK/RATIOS NORMALIZATION
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

/**
 * Normalize risk and ratios data from various AI response formats
 * @param {*} raw - Can be the API response object, raw string, nested data, or null
 * @returns {Object} Normalized risk data structure
 */
export function normalizeRiskData(raw) {
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

  return {
    valuationRatios: normalizeArray(data.valuationRatios).map(normalizeRatio),
    qualityRatios: normalizeArray(data.qualityRatios).map(normalizeRatio),
    leverageRatios: normalizeArray(data.leverageRatios).map(normalizeRatio),
    technicals: normalizeTechnicals(data.technicals),
    riskFactors: normalizeArray(data.riskFactors).map(normalizeRiskFactor),
    overallRiskScore: normalizeNumber(data.overallRiskScore, 1, 10, 5),
    overallQualityScore: normalizeNumber(data.overallQualityScore, 1, 10, 5),
    riskSummary: normalizeString(data.riskSummary, DEFAULT_RISK_DATA.riskSummary),
    peerBenchmarks: normalizeArray(data.peerBenchmarks).map(normalizePeerBenchmark),
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

/**
 * Normalize news and sentiment data from various AI response formats
 * @param {*} raw - Can be the API response object, raw string, nested data, or null
 * @returns {Object} Normalized news data structure
 */
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

/**
 * Normalize stock comparison data from various AI response formats
 * @param {*} raw - Can be the API response object, raw string, nested data, or null
 * @returns {Object} Normalized comparison data structure
 */
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

function normalizeCase(val) {
  if (!val || typeof val !== 'object') return { ...DEFAULT_CASE }
  return {
    title: normalizeString(val.title, DEFAULT_CASE.title),
    targetPrice: normalizePrice(val.targetPrice),
    probability: normalizeNumber(val.probability, 0, 100, 33),
    points: normalizeStringArray(val.points),
  }
}

function normalizeDriver(val) {
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
    wacc: normalizeNumber(val.wacc, 0, 50, DEFAULT_ASSUMPTIONS.wacc),
    terminalGrowthRate: normalizeNumber(val.terminalGrowthRate, -5, 10, DEFAULT_ASSUMPTIONS.terminalGrowthRate),
    taxRate: normalizeNumber(val.taxRate, 0, 100, DEFAULT_ASSUMPTIONS.taxRate),
    revenueGrowthRates: normalizeArray(val.revenueGrowthRates).map(v => normalizeNumber(v, -50, 100, 10)),
    ebitdaMargins: normalizeArray(val.ebitdaMargins).map(v => normalizeNumber(v, -50, 100, 20)),
  }
}

function normalizeProjection(val) {
  if (!val || typeof val !== 'object') return { ...DEFAULT_PROJECTION }
  return {
    year: normalizeNumber(val.year, 1, 10, 1),
    revenue: normalizeNumber(val.revenue, 0, null, 0),
    ebitda: normalizeNumber(val.ebitda, null, null, 0),
    ebit: normalizeNumber(val.ebit, null, null, 0),
    nopat: normalizeNumber(val.nopat, null, null, 0),
    capex: normalizeNumber(val.capex, null, null, 0),
    nwcChange: normalizeNumber(val.nwcChange, null, null, 0),
    fcf: normalizeNumber(val.fcf, null, null, 0),
  }
}

function normalizeSensitivityTable(val) {
  if (!val || typeof val !== 'object') return null
  return {
    waccRange: normalizeArray(val.waccRange).map(v => normalizeNumber(v, 0, 50, 10)),
    tgrRange: normalizeArray(val.tgrRange).map(v => normalizeNumber(v, -5, 10, 2.5)),
    values: normalizeArray(val.values).map(row => normalizeArray(row).map(normalizeNumber)),
  }
}

function normalizeRatio(val) {
  if (!val || typeof val !== 'object') return { name: 'N/A', value: '—', benchmark: null }
  return {
    name: normalizeString(val.name, 'N/A'),
    value: normalizeString(val.value, '—'),
    benchmark: normalizeString(val.benchmark, null),
  }
}

function normalizeTechnicals(val) {
  if (!val || typeof val !== 'object') return { ...DEFAULT_TECHNICALS }
  return {
    trend: normalizeString(val.trend, DEFAULT_TECHNICALS.trend),
    rsi: normalizeNumber(val.rsi, 0, 100, 50),
    support: normalizePrice(val.support),
    resistance: normalizePrice(val.resistance),
    volumeSignal: normalizeString(val.volumeSignal, DEFAULT_TECHNICALS.volumeSignal),
  }
}

function normalizeRiskFactor(val) {
  if (!val || typeof val !== 'object') {
    if (typeof val === 'string' && val) return { factor: val, severity: 'Medium', description: null }
    return { factor: 'Unknown Risk', severity: 'Medium', description: null }
  }
  return {
    factor: normalizeString(val.factor, 'Unknown Risk'),
    severity: normalizeString(val.severity, 'Medium'),
    description: normalizeString(val.description, null),
  }
}

function normalizePeerBenchmark(val) {
  if (!val || typeof val !== 'object') return null
  return {
    ticker: normalizeString(val.ticker, null),
    metric: normalizeString(val.metric, 'N/A'),
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
  if (['HIGH', 'HIGH'].includes(v)) return 'High'
  if (['LOW', 'LOW'].includes(v)) return 'Low'
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
  if (!val || typeof val !== 'object') return { dimension: 'N/A', winner: 'TIE', stock1Score: 5, stock2Score: 5, detail: '' }
  return {
    dimension: normalizeString(val.dimension, 'N/A'),
    winner: normalizeString(val.winner, 'TIE'),
    stock1Score: normalizeNumber(val.stock1Score, 0, 10, 5),
    stock2Score: normalizeNumber(val.stock2Score, 0, 10, 5),
    detail: normalizeString(val.detail, ''),
  }
}

function normalizeHeadToHead(val) {
  if (!val || typeof val !== 'object') return { metric: 'N/A', stock1Value: '—', stock2Value: '—', advantage: 'TIE' }
  return {
    metric: normalizeString(val.metric, 'N/A'),
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

/**
 * Universally normalize any AI analysis response
 * Delegates to appropriate normalizer based on analysis type
 * @param {*} raw - Raw API response, string, or nested data
 * @param {string} type - Analysis type: 'thesis' | 'dcf' | 'risk' | 'news' | 'compare'
 * @returns {Object} Normalized data structure
 */
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
      // Unknown type: try to unwrap and return as-is with sensible defaults
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
