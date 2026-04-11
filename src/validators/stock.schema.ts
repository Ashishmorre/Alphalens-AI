/**
 * Stock API Validation Schemas
 * Zod schemas for /api/stock endpoint
 */

import { z } from 'zod';

/**
 * Query parameter validation for GET /api/stock
 * Validates the ticker symbol from URL search params
 */
export const getStockQuerySchema = z.object({
  ticker: z
    .string({
      required_error: 'ticker query parameter is required',
      invalid_type_error: 'ticker must be a string',
    })
    .min(1, 'Ticker cannot be empty')
    .max(20, 'Ticker cannot exceed 20 characters')  // Slightly larger for exchange suffixes like .NS, .TO
    .regex(
      /^[A-Z][A-Z0-9.-]*$/i,
      'Ticker must start with a letter and contain only letters, numbers, dots, and dashes'
    )
    .transform((val) => val.toUpperCase().trim()),
});

export type GetStockQuery = z.infer<typeof getStockQuerySchema>;

/**
 * Stock price data from Yahoo Finance
 * Used internally for validation of fetched data
 */
export const yahooQuoteSchema = z.object({
  ticker: z.string(),
  symbol: z.string().optional(),
  name: z.string(),
  shortName: z.string().optional(),
  longName: z.string().optional(),
  exchanged: z.string().optional(),
  exchange: z.string().optional(),
  exchangeTimezoneName: z.string().optional(),
  currency: z.string().optional(),
  quoteType: z.enum(['EQUITY', 'ETF', 'INDEX', 'MUTUALFUND', 'CURRENCY', 'CRYPTOCURRENCY']).optional(),
  marketState: z.enum(['OPEN', 'CLOSED', 'REGULAR', 'PRE', 'POST', 'EXTENDED']).optional(),

  // Price data
  price: z.number().nonnegative(),
  regularMarketPrice: z.number().nonnegative().optional(),
  previousClose: z.number().nonnegative().optional(),
  chartPreviousClose: z.number().nonnegative().optional(),
  open: z.number().nonnegative().optional(),
  regularMarketOpen: z.number().nonnegative().optional(),
  dayHigh: z.number().nonnegative().optional(),
  regularMarketDayHigh: z.number().nonnegative().optional(),
  dayLow: z.number().nonnegative().optional(),
  regularMarketDayLow: z.number().nonnegative().optional(),
  change: z.number().optional(),
  changePercent: z.number().optional(),
  regularMarketChange: z.number().optional(),
  regularMarketChangePercent: z.number().optional(),

  // Volume
  volume: z.number().nonnegative().optional(),
  regularMarketVolume: z.number().nonnegative().optional(),
  averageDailyVolume: z.number().nonnegative().optional(),
  averageDailyVolume3Month: z.number().nonnegative().optional(),
  averageDailyVolume10Day: z.number().nonnegative().optional(),

  // Market cap & multiples
  marketCap: z.number().nonnegative().optional(),
  trailingPE: z.number().positive().optional(),
  forwardPE: z.number().positive().optional(),
  trailingEps: z.number().optional(),

  // 52-week data
  fiftyTwoWeekHigh: z.number().positive().optional(),
  fiftyTwoWeekLow: z.number().positive().optional(),
  fiftyWeekChange: z.number().optional(),

  // Moving averages
  fiftyDayMovingAverage: z.number().positive().optional(),
  twoHundredDayMovingAverage: z.number().positive().optional(),
  fiftyDayAverage: z.number().positive().optional(),
  twoHundredDayAverage: z.number().positive().optional(),

  // Beta & risk
  beta: z.number().optional(),

  // Company info
  sector: z.string().max(200).optional(),
  industry: z.string().max(300).optional(),
  country: z.string().max(100).optional(),
  fullTimeEmployees: z.number().nonnegative().optional(),
  summary: z.string().max(15000).optional(),
  longBusinessSummary: z.string().max(15000).optional(),
});

export type YahooQuoteData = z.infer<typeof yahooQuoteSchema>;

/**
 * Yahoo Financial Data Schema
 */
export const yahooFinancialDataSchema = z.object({
  totalRevenue: z.object({
    raw: z.number().nonnegative(),
    fmt: z.string().optional(),
    longFmt: z.string().optional(),
  }).optional(),
  revenuePerShare: z.object({
    raw: z.number().positive(),
    fmt: z.string().optional(),
  }).optional(),
  revenueGrowth: z.object({
    raw: z.number(),
    fmt: z.string().optional(),
  }).optional(),
  earningsGrowth: z.object({
    raw: z.number(),
    fmt: z.string().optional(),
  }).optional(),
  profitMargins: z.object({
    raw: z.number().min(0).max(1),
    fmt: z.string().optional(),
  }).optional(),
  grossMargins: z.object({
    raw: z.number().min(0).max(1),
    fmt: z.string().optional(),
  }).optional(),
  operatingMargins: z.object({
    raw: z.number().min(0).max(1),
    fmt: z.string().optional(),
  }).optional(),
  ebitda: z.object({
    raw: z.number(),
    fmt: z.string().optional(),
  }).optional(),
  freeCashflow: z.object({
    raw: z.number(),
    fmt: z.string().optional(),
  }).optional(),
  operatingCashflow: z.object({
    raw: z.number(),
    fmt: z.string().optional(),
  }).optional(),
  totalCash: z.object({
    raw: z.number().nonnegative(),
    fmt: z.string().optional(),
  }).optional(),
  totalDebt: z.object({
    raw: z.number().nonnegative(),
    fmt: z.string().optional(),
  }).optional(),
  totalRevenueGrowth: z.object({
    raw: z.number(),
    fmt: z.string().optional(),
  }).optional(),
  currentPrice: z.object({
    raw: z.number().positive(),
    fmt: z.string().optional(),
  }).optional(),
  currentRatio: z.object({
    raw: z.number().positive(),
    fmt: z.string().optional(),
  }).optional(),
  quickRatio: z.object({
    raw: z.number().positive(),
    fmt: z.string().optional(),
  }).optional(),
  returnOnEquity: z.object({
    raw: z.number(),
    fmt: z.string().optional(),
  }).optional(),
  returnOnAssets: z.object({
    raw: z.number(),
    fmt: z.string().optional(),
  }).optional(),
  debtToEquity: z.object({
    raw: z.number(),
    fmt: z.string().optional(),
  }).optional(),
  totalCashPerShare: z.object({
    raw: z.number().positive(),
    fmt: z.string().optional(),
  }).optional(),
  totalDebtPerShare: z.object({
    raw: z.number().positive(),
    fmt: z.string().optional(),
  }).optional(),
  trailingPE: z.object({
    raw: z.number().positive(),
    fmt: z.string().optional(),
  }).optional(),
  forwardPE: z.object({
    raw: z.number().positive(),
    fmt: z.string().optional(),
  }).optional(),
  targetHighPrice: z.object({
    raw: z.number().positive(),
    fmt: z.string().optional(),
  }).optional(),
  targetLowPrice: z.object({
    raw: z.number().positive(),
    fmt: z.string().optional(),
  }).optional(),
  targetMeanPrice: z.object({
    raw: z.number().positive(),
    fmt: z.string().optional(),
  }).optional(),
  targetMedianPrice: z.object({
    raw: z.number().positive(),
    fmt: z.string().optional(),
  }).optional(),
  recommendationMean: z.object({
    raw: z.number().min(1).max(5),
    fmt: z.string().optional(),
  }).optional(),
  recommendationKey: z.string().optional(),
  numberOfAnalystOpinions: z.object({
    raw: z.number().nonnegative(),
    fmt: z.string().optional(),
  }).optional(),
});

export type YahooFinancialData = z.infer<typeof yahooFinancialDataSchema>;

/**
 * Yahoo Key Statistics Schema
 */
export const yahooKeyStatisticsSchema = z.object({
  trailingEps: z.object({ raw: z.number() }).optional(),
  forwardEps: z.object({ raw: z.number() }).optional(),
  bookValue: z.object({ raw: z.number().positive() }).optional(),
  priceToBook: z.object({ raw: z.number().positive() }).optional(),
  priceToSalesTrailing12Months: z.object({ raw: z.number().positive() }).optional(),
  enterpriseValue: z.object({ raw: z.number().nonnegative() }).optional(),
  enterpriseToEbitda: z.object({ raw: z.number().positive() }).optional(),
  enterpriseToRevenue: z.object({ raw: z.number().positive() }).optional(),
  fiftyTwoWeekChange: z.object({ raw: z.number() }).optional(),
  sharesOutstanding: z.object({ raw: z.number().positive() }).optional(),
  floatShares: z.object({ raw: z.number().nonnegative() }).optional(),
  shortRatio: z.object({ raw: z.number().nonnegative() }).optional(),
  shortPercentOfFloat: z.object({ raw: z.number().min(0).max(1) }).optional(),
  dividendRate: z.object({ raw: z.number().nonnegative() }).optional(),
  dividendYield: z.object({ raw: z.number().min(0).max(1) }).optional(),
  payoutRatio: z.object({ raw: z.number().min(0).max(1) }).optional(),
  fiveYearAvgDividendYield: z.object({ raw: z.number() }).optional(),
  trailingPegRatio: z.object({ raw: z.number() }).optional(),
});

export type YahooKeyStatistics = z.infer<typeof yahooKeyStatisticsSchema>;

/**
 * Yahoo Asset Profile Schema
 */
export const yahooAssetProfileSchema = z.object({
  sector: z.string().max(200).optional(),
  industry: z.string().max(300).optional(),
  fullTimeEmployees: z.number().nonnegative().optional(),
  longBusinessSummary: z.string().max(15000).optional(),
  country: z.string().max(100).optional(),
  website: z.string().url().optional(),
  phone: z.string().optional(),
  fax: z.string().optional(),
  executive: z.array(z.object({ name: z.string(), title: z.string() })).optional(),
});

export type YahooAssetProfile = z.infer<typeof yahooAssetProfileSchema>;

/**
 * Final stock API response schema
 * Normalize to ensure all returned data meets our contract
 */
export const stockApiResponseSchema = z.object({
  ticker: z.string(),
  name: z.string(),
  price: z.number().nonnegative(),
  change: z.number(),
  changePercent: z.number(),
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
  dividendYield: z.number().min(0).max(1).optional(),
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
  recommendationKey: z.string().optional(),
  numberOfAnalysts: z.number().nonnegative().optional(),
  sector: z.string().optional(),
  industry: z.string().optional(),
  description: z.string().optional(),
  employees: z.number().nonnegative().optional(),
  country: z.string().optional(),
  currency: z.string().optional(),
  exchange: z.string().optional(),
  marketState: z.string().optional(),
  fiftyDayAverage: z.number().positive().optional(),
  twoHundredDayAverage: z.number().positive().optional(),
  fiftyTwoWeekChange: z.number().optional(),
});

export type StockApiResponse = z.infer<typeof stockApiResponseSchema>;
