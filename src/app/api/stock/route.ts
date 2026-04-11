/**
 * Stock API Route
 * Secure, validated stock data fetching from Yahoo Finance
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { safeParseAsync, createResponse, createErrorResponse } from '@/lib/error-handler';
import { checkRateLimit, createRateLimitHeaders } from '@/lib/rate-limiter';
import { getStockQuerySchema } from '@/validators/stock.schema';

// Yahoo Finance headers for scraping
const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Origin': 'https://finance.yahoo.com',
  'Referer': 'https://finance.yahoo.com/',
  'Cache-Control': 'no-cache',
};

/**
 * Get authentication crumb for Yahoo Finance API
 */
async function getYahooCrumb(): Promise<{ crumb: string; cookie: string }> {
  try {
    const cookieRes = await fetch('https://fc.yahoo.com', {
      headers: YAHOO_HEADERS,
      redirect: 'follow',
    });

    const cookies = cookieRes.headers.get('set-cookie') || '';
    const a3Cookie = cookies.match(/A3=[^;]+/)?.[0] || '';

    const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { ...YAHOO_HEADERS, Cookie: a3Cookie },
    });

    const crumb = await crumbRes.text();
    return { crumb: crumb.trim(), cookie: a3Cookie };
  } catch {
    return { crumb: '', cookie: '' };
  }
}

/**
 * Fetch stock data from Yahoo Finance
 */
async function fetchStockData(ticker: string): Promise<Record<string, unknown>> {
  const { crumb, cookie } = await getYahooCrumb();
  const authHeaders = { ...YAHOO_HEADERS, ...(cookie ? { Cookie: cookie } : {}) };
  const crumbParam = crumb ? `&crumb=${encodeURIComponent(crumb)}` : '';

  const tickersToTry = [ticker];
  if (!ticker.includes('.')) {
    // Try Indian exchanges for non-suffixed tickers
    tickersToTry.push(`${ticker}.NS`, `${ticker}.BO`);
  }

  let lastError: Error | null = null;

  for (const t of tickersToTry) {
    try {
      // Try chart API first (most reliable)
      const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${t}?interval=1d&range=1d${crumbParam}`;
      const chartRes = await fetch(chartUrl, { headers: authHeaders });

      if (chartRes.ok) {
        const chartJson = await chartRes.json() as { chart?: { result?: Array<{ meta?: Record<string, unknown> }> } };
        const meta = chartJson?.chart?.result?.[0]?.meta;

        if (meta?.regularMarketPrice) {
          // Fetch additional data from quoteSummary
          const summaryData = await fetchQuoteSummary(t, crumb, authHeaders);

          return {
            ticker: t,
            quote: meta,
            summary: summaryData,
          };
        }
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      continue;
    }
  }

  // Fallback to query2 endpoint
  for (const t of tickersToTry) {
    try {
      const url = `https://query2.finance.yahoo.com/v8/finance/chart/${t}?interval=1d&range=1d`;
      const res = await fetch(url, { headers: YAHOO_HEADERS });

      if (res.ok) {
        const json = await res.json() as { chart?: { result?: Array<{ meta?: Record<string, unknown> }> } };
        const meta = json?.chart?.result?.[0]?.meta;

        if (meta?.regularMarketPrice) {
          return {
            ticker: t,
            quote: meta,
            summary: {},
          };
        }
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      continue;
    }
  }

  throw lastError || new Error(`Could not fetch data for "${ticker}"`);
}

/**
 * Fetch quote summary with additional data
 */
async function fetchQuoteSummary(
  ticker: string,
  crumb: string,
  headers: Record<string, string>
): Promise<Record<string, unknown>> {
  try {
    const crumbParam = crumb ? `&crumb=${encodeURIComponent(crumb)}` : '';
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=financialData,defaultKeyStatistics,assetProfile,summaryDetail${crumbParam}`;
    const res = await fetch(url, { headers });

    if (!res.ok) return {};

    const json = await res.json() as { quoteSummary?: { result?: Array<Record<string, unknown>>; error?: unknown } };
    return json?.quoteSummary?.result?.[0] || {};
  } catch {
    return {};
  }
}

/**
 * Transform Yahoo Finance data to our API format
 */
function transformStockData(
  ticker: string,
  data: { quote: Record<string, unknown>; summary: Record<string, unknown> }
): Record<string, unknown> {
  const meta = data.quote;
  const summary = data.summary;

  const fd = (summary?.financialData as Record<string, { raw?: number }>) || {};
  const ks = (summary?.defaultKeyStatistics as Record<string, { raw?: number }>) || {};
  const ap = (summary?.assetProfile as Record<string, string | number>) || {};
  const sd = (summary?.summaryDetail as Record<string, { raw?: number }>) || {};

  const price = Number(meta.regularMarketPrice) || 0;
  const prevClose = Number(meta.chartPreviousClose || meta.previousClose || price);
  const change = price - prevClose;
  const changePercent = prevClose ? (change / prevClose) * 100 : 0;

  // Helper to extract raw values from Yahoo format
  const pick = (...vals: (number | { raw?: number } | undefined)[]): number | null => {
    for (const v of vals) {
      if (v == null || Number.isNaN(v)) continue;
      const num = typeof v === 'object' ? v?.raw : v;
      if (num != null && !Number.isNaN(num)) return num;
    }
    return null;
  };

  return {
    ticker,
    name: String(meta.longName || meta.shortName || ticker),
    price,
    change,
    changePercent,
    previousClose: prevClose || null,
    open: Number(meta.regularMarketOpen) || null,
    dayHigh: Number(meta.regularMarketDayHigh) || null,
    dayLow: Number(meta.regularMarketDayLow) || null,
    volume: Number(meta.regularMarketVolume) || null,
    avgVolume: Number(meta.averageDailyVolume3Month) || null,
    marketCap: pick(fd.marketCap?.raw, meta.marketCap),
    pe: pick(fd.trailingPE?.raw, sd.trailingPE?.raw),
    forwardPE: pick(fd.forwardPE?.raw, ks.forwardPE?.raw),
    eps: pick(ks.trailingEps?.raw),
    weekHigh52: Number(meta.fiftyTwoWeekHigh) || null,
    weekLow52: Number(meta.fiftyTwoWeekLow) || null,
    beta: pick(ks.beta?.raw),
    roe: fd.returnOnEquity?.raw ?? null,
    roa: fd.returnOnAssets?.raw ?? null,
    debtToEquity: fd.debtToEquity?.raw ?? null,
    profitMargin: fd.profitMargins?.raw ?? null,
    grossMargin: fd.grossMargins?.raw ?? null,
    operatingMargin: fd.operatingMargins?.raw ?? null,
    revenue: fd.totalRevenue?.raw ?? null,
    ebitda: fd.ebitda?.raw ?? null,
    freeCashFlow: fd.freeCashflow?.raw ?? null,
    operatingCashFlow: fd.operatingCashflow?.raw ?? null,
    totalCash: fd.totalCash?.raw ?? null,
    totalDebt: fd.totalDebt?.raw ?? null,
    currentRatio: fd.currentRatio?.raw ?? null,
    quickRatio: fd.quickRatio?.raw ?? null,
    revenueGrowth: fd.revenueGrowth?.raw ?? null,
    earningsGrowth: fd.earningsGrowth?.raw ?? null,
    priceToBook: pick(ks.priceToBook?.raw),
    priceToSales: ks.priceToSalesTrailing12Months?.raw ?? null,
    enterpriseValue: ks.enterpriseValue?.raw ?? null,
    evToEbitda: ks.enterpriseToEbitda?.raw ?? null,
    evToRevenue: ks.enterpriseToRevenue?.raw ?? null,
    dividendYield: pick(ks.dividendYield?.raw, sd.dividendYield?.raw),
    dividendRate: pick(ks.dividendRate?.raw, sd.dividendRate?.raw),
    payoutRatio: ks.payoutRatio?.raw ?? null,
    sharesOutstanding: ks.sharesOutstanding?.raw ?? null,
    floatShares: ks.floatShares?.raw ?? null,
    shortRatio: ks.shortRatio?.raw ?? null,
    shortPercentOfFloat: ks.shortPercentOfFloat?.raw ?? null,
    bookValuePerShare: ks.bookValue?.raw ?? null,
    targetHighPrice: fd.targetHighPrice?.raw ?? null,
    targetLowPrice: fd.targetLowPrice?.raw ?? null,
    targetMeanPrice: fd.targetMeanPrice?.raw ?? null,
    targetMedianPrice: fd.targetMedianPrice?.raw ?? null,
    recommendationMean: fd.recommendationMean?.raw ?? null,
    recommendationKey: fd.recommendationKey || null,
    numberOfAnalysts: fd.numberOfAnalystOpinions?.raw ?? null,
    sector: ap.sector || null,
    industry: ap.industry || null,
    description: ap.longBusinessSummary || null,
    employees: ap.fullTimeEmployees || null,
    country: ap.country || null,
    currency: String(meta.currency) || 'USD',
    exchange: String(meta.fullExchangeName || meta.exchangeName) || null,
    marketState: String(meta.marketState) || null,
    fiftyDayAverage: Number(meta.fiftyDayAverage) || null,
    twoHundredDayAverage: Number(meta.twoHundredDayAverage) || null,
    fiftyTwoWeekChange: ks.fiftyTwoWeekChange?.raw ?? null,
  };
}

/**
 * GET /api/stock - Fetch stock data
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // Rate limit check first (before any other processing)
    const rateLimit = await checkRateLimit(req, 'stock-data');

    // Parse and validate query params
    const { searchParams } = new URL(req.url);
    const params = Object.fromEntries(searchParams.entries());

    const parsed = await safeParseAsync(getStockQuerySchema, Promise.resolve(params));

    if (!parsed.success) {
      return parsed.response;
    }

    const { ticker } = parsed.data;

    // Fetch stock data
    const rawData = await fetchStockData(ticker);
    const transformed = transformStockData(rawData.ticker as string, {
      quote: rawData.quote as Record<string, unknown>,
      summary: rawData.summary as Record<string, unknown>,
    });

    // Add rate limit headers to response
    const headers = createRateLimitHeaders(rateLimit);

    return NextResponse.json(
      { success: true, data: transformed, error: null },
      { status: 200, headers }
    );

  } catch (error) {
    console.error('[Stock API] Error:', error);

    if (error instanceof z.ZodError) {
      return createErrorResponse(
        `Validation error: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        400
      );
    }

    if (error instanceof Error && error.message.includes('rate limit')) {
      return createErrorResponse(
        'Rate limit exceeded. Please try again later.',
        429
      );
    }

    // Check if it's a "not found" error
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('not found') || msg.includes('could not fetch')) {
        return createErrorResponse(
          `Could not find stock data for the requested ticker. Please verify the ticker symbol.`,
          404
        );
      }
    }

    return createErrorResponse(
      'Failed to fetch stock data. Please try again later.',
      500
    );
  }
}

// Export config for Next.js
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
