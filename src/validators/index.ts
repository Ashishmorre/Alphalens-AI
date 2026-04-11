/**
 * Validators Index
 * Export all validation schemas for the application
 */

// Analysis validators
export {
  analyzeRequestSchema,
  analysisTypeSchema,
  stockDataSchema,
  thesisResponseSchema,
  dcfResponseSchema,
  riskResponseSchema,
  newsResponseSchema,
  type AnalyzeRequest,
  type ValidatedStockData,
  type AnalysisType,
  type AnalysisResponseData,
} from './analysis.schema';

// Stock validators
export {
  getStockQuerySchema,
  yahooQuoteSchema,
  yahooFinancialDataSchema,
  yahooKeyStatisticsSchema,
  yahooAssetProfileSchema,
  stockApiResponseSchema,
  type GetStockQuery,
  type YahooQuoteData,
  type YahooFinancialData,
  type YahooKeyStatistics,
  type YahooAssetProfile,
  type StockApiResponse,
} from './stock.schema';

// Compare validators
export {
  compareRequestSchema,
  comparisonDimensionSchema,
  headToHeadMetricSchema,
  investmentRecommendationSchema,
  compareResponseSchema,
  type CompareRequest,
  type ComparisonDimension,
  type HeadToHeadMetric,
  type InvestmentRecommendation,
  type CompareResponse,
} from './compare.schema';
