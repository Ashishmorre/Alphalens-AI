/**
 * Compare API Validation Schemas
 * Zod schemas for /api/compare endpoint
 */

import { z } from 'zod';
import { stockDataSchema } from './analysis.schema';

/**
 * Request body for POST /api/compare
 */
export const compareRequestSchema = z.object({
  stock1: stockDataSchema.refine(
    (data) => typeof data.price === 'number' && !isNaN(data.price) && data.ticker,
    {
      message: 'stock1 must have valid ticker and price',
      path: ['price'],
    }
  ),
  stock2: stockDataSchema.refine(
    (data) => typeof data.price === 'number' && !isNaN(data.price) && data.ticker,
    {
      message: 'stock2 must have valid ticker and price',
      path: ['price'],
    }
  ),
}).refine(
  (data) => data.stock1.ticker !== data.stock2.ticker,
  {
    message: 'Cannot compare a stock with itself',
    path: ['stock2', 'ticker'],
  }
);

export type CompareRequest = z.infer<typeof compareRequestSchema>;

/**
 * Comparison dimension schema
 */
export const comparisonDimensionSchema = z.object({
  dimension: z.string(),
  winner: z.string().or(z.literal('TIE')),
  stock1Score: z.number().min(0).max(10),
  stock2Score: z.number().min(0).max(10),
  detail: z.string(),
});

export type ComparisonDimension = z.infer<typeof comparisonDimensionSchema>;

/**
 * Head to head metric schema
 */
export const headToHeadMetricSchema = z.object({
  metric: z.string(),
  stock1Value: z.string(),
  stock2Value: z.string(),
  advantage: z.string().or(z.literal('TIE')),
});

export type HeadToHeadMetric = z.infer<typeof headToHeadMetricSchema>;

/**
 * Investment recommendation schema
 */
export const investmentRecommendationSchema = z.object({
  forGrowthInvestors: z.string(),
  growthRationale: z.string(),
  forValueInvestors: z.string(),
  valueRationale: z.string(),
  forIncomeInvestors: z.string(),
  incomeRationale: z.string(),
});

export type InvestmentRecommendation = z.infer<typeof investmentRecommendationSchema>;

/**
 * Full comparison response schema
 */
export const compareResponseSchema = z.object({
  winner: z.string().or(z.literal('TIE')),
  winnerRationale: z.string(),
  comparisonDimensions: z.array(comparisonDimensionSchema),
  headToHead: z.array(headToHeadMetricSchema),
  stock1Strengths: z.array(z.string()),
  stock2Strengths: z.array(z.string()),
  stock1Weaknesses: z.array(z.string()),
  stock2Weaknesses: z.array(z.string()),
  recommendation: investmentRecommendationSchema,
  portfolioContext: z.string(),
});

export type CompareResponse = z.infer<typeof compareResponseSchema>;
