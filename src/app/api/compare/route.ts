/**
 * Compare API Route
 * Secure stock comparison with validation and rate limiting
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { env, hasCerebrasKey, hasGroqKey } from '@/lib/env';
import {
  createResponse,
  createErrorResponse,
  safeParseAsync,
  AppError,
  ExternalServiceError,
} from '@/lib/error-handler';
import { checkRateLimit, createRateLimitHeaders } from '@/lib/rate-limiter';
import { compareRequestSchema } from '@/validators/compare.schema';

// AI Provider configurations (same as analyze)
const CEREBRAS_CONFIG = {
  endpoint: 'https://api.cerebras.ai/v1/chat/completions',
  model: 'llama3.1-8b',
  maxTokens: 3000,
  temperature: 0.7,
};

const GROQ_CONFIG = {
  endpoint: 'https://api.groq.com/openai/v1/chat/completions',
  model: 'llama-3.3-70b-versatile',
  maxTokens: 3000,
  temperature: 0.7,
};

/**
 * Format number helper
 */
function fmt(n: number | null | undefined, d = 2): string {
  if (n == null || Number.isNaN(n)) return 'N/A';
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(d)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(d)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(d)}M`;
  return n.toFixed(d);
}

function pct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return 'N/A';
  return `${(n * 100).toFixed(1)}%`;
}

/**
 * Call AI provider
 */
async function callAI(prompt: string): Promise<Record<string, unknown>> {
  // Try Cerebras first
  if (hasCerebrasKey && env.CEREBRAS_API_KEY) {
    try {
      const res = await fetch(CEREBRAS_CONFIG.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.CEREBRAS_API_KEY}`,
        },
        body: JSON.stringify({
          model: CEREBRAS_CONFIG.model,
          stream: false,
          messages: [
            { role: 'system', content: 'You are a senior portfolio manager. Return ONLY valid JSON with no markdown.' },
            { role: 'user', content: prompt },
          ],
          temperature: CEREBRAS_CONFIG.temperature,
          max_completion_tokens: CEREBRAS_CONFIG.maxTokens,
        }),
      });

      const data = await res.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };

      if (res.ok && data.choices?.[0]?.message?.content) {
        return parseAIResponse(data.choices[0].message.content);
      }

      throw new Error(data.error?.message || 'Cerebras API error');
    } catch (err) {
      console.log('[Compare AI] Cerebras failed, falling back to Groq:', err);
    }
  }

  // Fallback to Groq
  if (hasGroqKey && env.GROQ_API_KEY) {
    const res = await fetch(GROQ_CONFIG.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_CONFIG.model,
        messages: [
          { role: 'system', content: 'You are a senior portfolio manager. Return ONLY valid JSON with no markdown.' },
          { role: 'user', content: prompt },
        ],
        temperature: GROQ_CONFIG.temperature,
        max_tokens: GROQ_CONFIG.maxTokens,
      }),
    });

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };

    if (!res.ok) {
      throw new ExternalServiceError('Groq', data.error?.message || 'API error');
    }

    return parseAIResponse(data.choices?.[0]?.message?.content || '');
  }

  throw new AppError(
    'No AI provider configured. Add CEREBRAS_API_KEY or GROQ_API_KEY.',
    500,
    'MISSING_AI_CONFIG'
  );
}

/**
 * Parse AI response JSON
 */
function parseAIResponse(text: string): Record<string, unknown> {
  const clean = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('No valid JSON found in AI response');
  }

  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch (err) {
    throw new Error(`Failed to parse AI response JSON: ${err instanceof Error ? err.message : 'unknown error'}`);
  }
}

/**
 * Build comparison prompt
 */
function buildComparisonPrompt(
  stock1: Record<string, unknown>,
  stock2: Record<string, unknown>
): string {
  const s1 = stock1;
  const s2 = stock2;

  return `Compare ${s1.ticker} vs ${s2.ticker} for investment recommendation.

STOCK 1: ${s1.ticker}
- Price: ${fmt(Number(s1.price))} | Market Cap: ${fmt(Number(s1.marketCap))}
- P/E: ${fmt(Number(s1.pe), 1)} | Forward P/E: ${fmt(Number(s1.forwardPE), 1)}
- EV/EBITDA: ${fmt(Number(s1.evToEbitda), 1)}
- Revenue: ${fmt(Number(s1.revenue))}
- Growth: ${pct(Number(s1.revenueGrowth))}
- Margin: ${pct(Number(s1.profitMargin))}
- ROE: ${pct(Number(s1.roe))}
- Beta: ${fmt(Number(s1.beta), 2)}

STOCK 2: ${s2.ticker}
- Price: ${fmt(Number(s2.price))} | Market Cap: ${fmt(Number(s2.marketCap))}
- P/E: ${fmt(Number(s2.pe), 1)} | Forward P/E: ${fmt(Number(s2.forwardPE), 1)}
- EV/EBITDA: ${fmt(Number(s2.evToEbitda), 1)}
- Revenue: ${fmt(Number(s2.revenue))}
- Growth: ${pct(Number(s2.revenueGrowth))}
- Margin: ${pct(Number(s2.profitMargin))}
- ROE: ${pct(Number(s2.roe))}
- Beta: ${fmt(Number(s2.beta), 2)}

Return exact JSON structure:
{
  "winner": "${s1.ticker}",
  "winnerRationale": "Clear rationale for selection based on valuation, growth, and quality metrics",
  "comparisonDimensions": [
    {"dimension": "Valuation", "winner": "${s1.ticker}", "stock1Score": 7, "stock2Score": 5, "detail": "Lower P/E and EV/EBITDA"},
    {"dimension": "Growth", "winner": "${s2.ticker}", "stock1Score": 5, "stock2Score": 8, "detail": "Higher revenue growth trajectory"},
    {"dimension": "Profitability", "winner": "TIE", "stock1Score": 7, "stock2Score": 7, "detail": "Similar margin profiles"},
    {"dimension": "Financial Health", "winner": "${s1.ticker}", "stock1Score": 7, "stock2Score": 6, "detail": "Lower leverage"},
    {"dimension": "Momentum", "winner": "${s1.ticker}", "stock1Score": 7, "stock2Score": 6, "detail": "Better technical setup"},
    {"dimension": "Income", "winner": "${s1.ticker}", "stock1Score": 6, "stock2Score": 5, "detail": "Higher yield"}
  ],
  "headToHead": [
    {"metric": "P/E Ratio", "stock1Value": "${fmt(Number(s1.pe), 1)}x", "stock2Value": "${fmt(Number(s2.pe), 1)}x", "advantage": "${Number(s1.pe) < Number(s2.pe) ? s1.ticker : Number(s1.pe) > Number(s2.pe) ? s2.ticker : 'TIE'}"},
    {"metric": "Revenue Growth", "stock1Value": "${pct(Number(s1.revenueGrowth))}", "stock2Value": "${pct(Number(s2.revenueGrowth))}", "advantage": "${(Number(s1.revenueGrowth) || 0) > (Number(s2.revenueGrowth) || 0) ? s1.ticker : (Number(s1.revenueGrowth) || 0) < (Number(s2.revenueGrowth) || 0) ? s2.ticker : 'TIE'}"},
    {"metric": "Net Margin", "stock1Value": "${pct(Number(s1.profitMargin))}", "stock2Value": "${pct(Number(s2.profitMargin))}", "advantage": "${(Number(s1.profitMargin) || 0) > (Number(s2.profitMargin) || 0) ? s1.ticker : (Number(s1.profitMargin) || 0) < (Number(s2.profitMargin) || 0) ? s2.ticker : 'TIE'}"},
    {"metric": "ROE", "stock1Value": "${pct(Number(s1.roe))}", "stock2Value": "${pct(Number(s2.roe))}", "advantage": "${(Number(s1.roe) || 0) > (Number(s2.roe) || 0) ? s1.ticker : (Number(s1.roe) || 0) < (Number(s2.roe) || 0) ? s2.ticker : 'TIE'}"},
    {"metric": "Beta (Risk)", "stock1Value": "${fmt(Number(s1.beta), 2)}", "stock2Value": "${fmt(Number(s2.beta), 2)}", "advantage": "${(Number(s1.beta) || 1) < (Number(s2.beta) || 1) ? s1.ticker : (Number(s1.beta) || 1) > (Number(s2.beta) || 1) ? s2.ticker : 'TIE'}"},
    {"metric": "Market Cap", "stock1Value": "${fmt(Number(s1.marketCap))}", "stock2Value": "${fmt(Number(s2.marketCap))}", "advantage": "${(Number(s1.marketCap) || 0) > (Number(s2.marketCap) || 0) ? s1.ticker : 'TIE'}"}
  ],
  "stock1Strengths": ["Strength 1", "Strength 2", "Strength 3"],
  "stock2Strengths": ["Strength 1", "Strength 2", "Strength 3"],
  "stock1Weaknesses": ["Weakness 1", "Weakness 2"],
  "stock2Weaknesses": ["Weakness 1", "Weakness 2"],
  "recommendation": {
    "forGrowthInvestors": "${(Number(s1.revenueGrowth) || 0) > (Number(s2.revenueGrowth) || 0) ? s1.ticker : s2.ticker}",
    "growthRationale": "Higher revenue growth supports longer-term compounding",
    "forValueInvestors": "${Number(s1.pe) < Number(s2.pe) ? s1.ticker : s2.ticker}",
    "valueRationale": "More attractive valuation multiples",
    "forIncomeInvestors": "TIE",
    "incomeRationale": "Similar dividend characteristics"
  },
  "portfolioContext": "Consider position sizing based on sector concentration and risk tolerance. Both are quality companies with different risk/reward profiles."
}`;
}

/**
 * POST /api/compare - Compare two stocks
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Rate limit check first
    const rateLimit = await checkRateLimit(req, 'ai-analysis');

    // Parse and validate
    const body = await req.json();
    const parsed = await safeParseAsync(compareRequestSchema, Promise.resolve(body));

    if (!parsed.success) {
      return parsed.response;
    }

    const { stock1, stock2 } = parsed.data;

    // Build comparison prompt
    const prompt = buildComparisonPrompt(
      stock1 as Record<string, unknown>,
      stock2 as Record<string, unknown>
    );

    // Call AI
    const result = await callAI(prompt);

    // Add rate limit headers
    const headers = createRateLimitHeaders(rateLimit);

    return NextResponse.json(
      { success: true, data: result, error: null },
      { status: 200, headers }
    );

  } catch (error) {
    console.error('[Compare API] Error:', error);

    if (error instanceof z.ZodError) {
      const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return createErrorResponse(`Validation failed: ${messages}`, 400);
    }

    if (error instanceof AppError) {
      return createErrorResponse(error.message, error.statusCode);
    }

    if (error instanceof Error) {
      if (error.message.includes('rate limit')) {
        return createErrorResponse('Rate limit exceeded. Please try again later.', 429);
      }
      if (error.message.includes('JSON') || error.message.includes('parse')) {
        return createErrorResponse('Comparison response format error. Please retry.', 500);
      }
    }

    return createErrorResponse('Comparison failed. Please try again later.', 500);
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
