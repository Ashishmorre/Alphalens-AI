/**
 * Analysis API Validation Schemas
 * Zod schemas for /api/analyze endpoint
 */

import { z } from 'zod';

/**
 * Stock data validation schema
 */
export const stockDataSchema = z.object({
  ticker: z.string().min(1).max(20),
  name: z.string().min(1).max(500).optional(),
  price: z.number().nonnegative('Price must be non-negative'),
  change: z.number().optional(),
  changePercent: z.number().optional(),
  previousClose: z.number().nonnegative().optional(),
  open: z.number().nonnegative().optional(),
  dayHigh: z.number().nonnegative().optional(),
  dayLow: z.number().nonnegative().optional(),
  volume: z.number().nonnegative().optional(),
  avgVolume: z.number().nonnegative().optional(),
  marketCap: z.number().nonnegative().optional(),
  pe: z.number().positive().optional(),
  forwardPE: z.number().positive().optional(),
  eps: z.number().optional(),
  weekHigh52: z.number().positive().optional(),
  weekLow52: z.number().positive().optional(),
  beta: z.number().optional(),
  roe: z.number().optional(),
  roa: z.number().optional(),
  debtToEquity: z.number().optional(),
  profitMargin: z.number().min(-1).max(1).optional(),
  grossMargin: z.number().min(0).max(1).optional(),
  operatingMargin: z.number().min(0).max(1).optional(),
  revenue: z.number().nonnegative().optional(),
  ebitda: z.number().optional(),
  freeCashFlow: z.number().optional(),
  operatingCashFlow: z.number().optional(),
  totalCash: z.number().nonnegative().optional(),
  totalDebt: z.number().nonnegative().optional(),
  currentRatio: z.number().positive().optional(),
  quickRatio: z.number().positive().optional(),
  revenueGrowth: z.number().optional(),
  earningsGrowth: z.number().optional(),
  priceToBook: z.number().positive().optional(),
  priceToSales: z.number().positive().optional(),
  enterpriseValue: z.number().nonnegative().optional(),
  evToEbitda: z.number().positive().optional(),
  evToRevenue: z.number().positive().optional(),
  dividendYield: z.number().nonnegative().optional(),
  dividendRate: z.number().nonnegative().optional(),
  payoutRatio: z.number().min(0).max(1).optional(),
  sharesOutstanding: z.number().positive().optional(),
  floatShares: z.number().nonnegative().optional(),
  shortRatio: z.number().nonnegative().optional(),
  shortPercentOfFloat: z.number().min(0).max(1).optional(),
  bookValuePerShare: z.number().optional(),
  targetHighPrice: z.number().positive().optional(),
  targetLowPrice: z.number().positive().optional(),
  targetMeanPrice: z.number().positive().optional(),
  targetMedianPrice: z.number().positive().optional(),
  recommendationMean: z.number().min(1).max(5).optional(),
  recommendationKey: z.enum(['strong_buy', 'buy', 'hold', 'sell', 'strong_sell']).or(z.string()).optional(),
  numberOfAnalysts: z.number().nonnegative().optional(),
  sector: z.string().min(1).max(200).optional(),
  industry: z.string().min(1).max(300).optional(),
  description: z.string().max(10000).optional(),
  employees: z.number().nonnegative().optional(),
  country: z.string().min(2).max(100).optional(),
  currency: z.string().min(3).max(5).optional(),
  exchange: z.string().min(1).max(100).optional(),
  marketState: z.enum(['OPEN', 'CLOSED', 'REGULAR']).or(z.string()).optional(),
  fiftyDayAverage: z.number().positive().optional(),
  twoHundredDayAverage: z.number().positive().optional(),
  fiftyTwoWeekChange: z.number().optional(),
});

export type ValidatedStockData = z.infer<typeof stockDataSchema>;

/**
 * Analysis type enum
 */
export const analysisTypeSchema = z.enum(['thesis', 'dcf', 'risk', 'news'], {
  required_error: 'analysisType is required',
  invalid_type_error: "analysisType must be one of: 'thesis', 'dcf', 'risk', 'news'",
});

export type AnalysisType = z.infer<typeof analysisTypeSchema>;

/**
 * Request body schema for analysis endpoint
 */
export const analyzeRequestSchema = z.object({
  ticker: z
    .string({ required_error: 'ticker is required' })
    .min(1, 'ticker cannot be empty')
    .max(10, 'ticker must be at most 10 characters')
    .regex(/^[A-Z0-9.-]+$/, 'ticker must contain only uppercase letters, numbers, dots, and dashes')
    .transform((val) => val.toUpperCase().trim()),

  analysisType: analysisTypeSchema,

  stockData: stockDataSchema.refine(
    (data) => typeof data.price === 'number' && !isNaN(data.price),
    {
      message: 'stockData.price is required and must be a valid number',
      path: ['price'],
    }
  ),
});

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;

/**
 * Response data schemas (for type safety)
 */
export const thesisResponseSchema = z.object({
  verdict: z.enum(['BUY', 'HOLD', 'SELL', 'STRONG_BUY', 'STRONG_SELL']),
  confidence: z.number().min(0).max(100),
  targetPrice: z.number().positive(),
  upsideDownside: z.number(),
  timeHorizon: z.string(),
  thesisSummary: z.string(),
  bullCase: z.object({
    title: z.string(),
    points: z.array(z.string()),
    targetPrice: z.number().positive(),
    probability: z.number().min(0).max(100),
  }),
  bearCase: z.object({
    title: z.string(),
    points: z.array(z.string()),
    targetPrice: z.number().positive(),
    probability: z.number().min(0).max(100),
  }),
  baseCase: z.object({
    title: z.string(),
    targetPrice: z.number().positive(),
    probability: z.number().min(0).max(100),
  }),
  keyDrivers: z.array(z.object({
    driver: z.string(),
    impact: z.enum(['POSITIVE', 'NEGATIVE', 'NEUTRAL']),
    detail: z.string(),
  })),
  moatRating: z.number().min(1).max(5),
  moatType: z.string(),
  growthQuality: z.string(),
  catalysts: z.array(z.string()),
  risks: z.array(z.string()),
  positionSizing: z.string(),
  comparisonPeers: z.array(z.string()),
});

export const dcfResponseSchema = z.object({
  assumptions: z.object({
    wacc: z.number().positive(),
    terminalGrowthRate: z.number(),
    riskFreeRate: z.number().nonnegative(),
    marketRiskPremium: z.number().nonnegative(),
    taxRate: z.number().min(0).max(1),
    capexAsRevenuePercent: z.number().nonnegative(),
    nwcChangeAsRevenuePercent: z.number().nonnegative(),
    revenueGrowthRates: z.array(z.number()),
    ebitdaMargins: z.array(z.number().min(0).max(1)),
    depreciation: z.number().nonnegative(),
  }),
  projections: z.array(z.object({
    year: z.number().positive(),
    revenue: z.number(),
    ebitda: z.number(),
    ebit: z.number(),
    nopat: z.number(),
    capex: z.number(),
    nwcChange: z.number(),
    fcf: z.number(),
  })),
  pvFCFs: z.number(),
  terminalValue: z.number(),
  pvTerminalValue: z.number(),
  enterpriseValue: z.number(),
  equityValue: z.number(),
  intrinsicValuePerShare: z.number().positive(),
  currentPrice: z.number().positive(),
  marginOfSafety: z.number(),
  upside: z.number(),
  dcfRating: z.enum(['UNDERVALUED', 'FAIRLY_VALUED', 'OVERVALUED']),
  sensitivityTable: z.object({
    waccRange: z.array(z.number()),
    tgrRange: z.array(z.number()),
    values: z.array(z.array(z.number())),
  }),
  keyRisksToModel: z.array(z.string()),
  analystNote: z.string(),
});

export const riskResponseSchema = z.object({
  valuationRatios: z.array(z.object({
    metric: z.string(),
    value: z.string(),
    sectorMedian: z.string(),
    assessment: z.enum(['CHEAP', 'UNDERVALUED', 'FAIR', 'EXPENSIVE', 'OVERVALUED']),
    note: z.string(),
  })),
  qualityRatios: z.array(z.object({
    metric: z.string(),
    value: z.string(),
    benchmark: z.string(),
    rating: z.enum(['EXCELLENT', 'GOOD', 'AVERAGE', 'POOR']),
  })),
  leverageRatios: z.array(z.object({
    metric: z.string(),
    value: z.string(),
    threshold: z.string(),
    risk: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  })),
  technicals: z.object({
    priceVs50DMA: z.number(),
    priceVs200DMA: z.number(),
    weekPosition52: z.number().min(0).max(100),
    trend: z.enum(['UPTREND', 'DOWNTREND', 'SIDEWAYS']),
    momentum: z.enum(['STRONG', 'MODERATE', 'WEAK']),
    technicalRating: z.enum(['BULLISH', 'BEARISH', 'NEUTRAL']),
    keyLevels: z.object({
      support: z.number().positive(),
      resistance: z.number().positive(),
    }),
  }),
  riskFactors: z.array(z.object({
    risk: z.string(),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    likelihood: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    detail: z.string(),
  })),
  overallRiskScore: z.number().min(0).max(10),
  overallQualityScore: z.number().min(0).max(10),
  riskSummary: z.string(),
  peerBenchmarks: z.array(z.object({
    ticker: z.string(),
    name: z.string(),
    pe: z.string(),
    evEbitda: z.string(),
    margin: z.string(),
  })),
});

export const newsResponseSchema = z.object({
  sentimentScore: z.number().min(0).max(100),
  sentimentLabel: z.enum(['VERY_BULLISH', 'BULLISH', 'NEUTRAL', 'BEARISH', 'VERY_BEARISH']),
  sentimentRationale: z.string(),
  analystConsensus: z.object({
    rating: z.string(),
    meanTarget: z.number().positive(),
    upside: z.number(),
    numAnalysts: z.number().nonnegative(),
    buyCount: z.number().nonnegative(),
    holdCount: z.number().nonnegative(),
    sellCount: z.number().nonnegative(),
    noteOnConsensus: z.string(),
  }),
  keyThemes: z.array(z.object({
    theme: z.string(),
    sentiment: z.enum(['POSITIVE', 'NEGATIVE', 'NEUTRAL']),
    detail: z.string(),
    timeframe: z.string(),
  })),
  bullCatalysts: z.array(z.object({
    catalyst: z.string(),
    probability: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    potentialImpact: z.string(),
  })),
  bearCatalysts: z.array(z.object({
    catalyst: z.string(),
    probability: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    potentialImpact: z.string(),
  })),
  macroExposure: z.array(z.object({
    factor: z.string(),
    exposure: z.enum(['POSITIVE', 'NEGATIVE', 'NEUTRAL']),
    detail: z.string(),
  })),
  institutionalActivity: z.object({
    shortInterestTrend: z.string(),
    shortSqueezeRisk: z.string(),
    institutionalOwnershipNote: z.string(),
  }),
  upcomingEvents: z.array(z.object({
    event: z.string(),
    expectedDate: z.string(),
    marketImplications: z.string(),
  })),
  tradingNote: z.string(),
});

export type AnalysisResponseData =
  | z.infer<typeof thesisResponseSchema>
  | z.infer<typeof dcfResponseSchema>
  | z.infer<typeof riskResponseSchema>
  | z.infer<typeof newsResponseSchema>;
