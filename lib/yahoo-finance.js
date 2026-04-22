/**
 * Yahoo Finance Utilities
 * Shared helpers for fetching stock data from Yahoo Finance
 */

import { getOrSet, CACHE_TTL } from './cache.js'
import { dedupe } from './dedupe.js'

// Standard headers for Yahoo Finance requests
export const YAHOO_HEADERS = {
	'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
	'Accept': 'application/json, text/plain, */*',
	'Accept-Language': 'en-US,en;q=0.9',
	'Accept-Encoding': 'gzip, deflate, br',
	'Origin': 'https://finance.yahoo.com',
	'Referer': 'https://finance.yahoo.com/',
	'Cache-Control': 'no-cache',
}

/**
 * Get Yahoo Finance authentication crumb and cookie
 * @returns {Promise<{ crumb: string, cookie: string }>}
 */
export async function getYahooCrumb() {
	try {
		const cookieRes = await fetch('https://fc.yahoo.com', {
			headers: YAHOO_HEADERS,
			redirect: 'follow',
		})

		const cookies = cookieRes.headers.get('set-cookie') || ''
		const a3Cookie = cookies.match(/A3=[^;]+/)?.[0] || ''

		const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
			headers: { ...YAHOO_HEADERS, Cookie: a3Cookie },
		})

		const crumb = await crumbRes.text()
		return { crumb: crumb.trim(), cookie: a3Cookie }
	} catch {
		return { crumb: '', cookie: '' }
	}
}

/**
 * Generate ticker variants to try (e.g., RELIANCE → RELIANCE.NS, RELIANCE.BO)
 * @param {string} ticker
 * @returns {string[]}
 */
export function getTickerVariants(ticker) {
	const variants = [ticker]

	// For Indian stocks without exchange suffix
	if (!ticker.includes('.')) {
		variants.push(`${ticker}.NS`, `${ticker}.BO`)
	}

	return variants
}

/**
 * Fetch stock chart data from Yahoo
 * @param {string} ticker
 * @param {string} crumb
 * @param {Object} headers
 * @returns {Promise<{ meta?: Object }>}
 */
async function fetchChartData(ticker, crumb, headers) {
	const crumbParam = crumb ? `&crumb=${encodeURIComponent(crumb)}` : ''
	const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d${crumbParam}`

	const res = await fetch(url, { headers, cache: 'no-store' })

	if (!res.ok) return null

	const json = await res.json()
	return json?.chart?.result?.[0]?.meta
}

/**
 * Fetch stock summary data from Yahoo
 * @param {string} ticker
 * @param {string} crumb
 * @param {Object} headers
 * @returns {Promise<Object>}
 */
async function fetchSummaryData(ticker, crumb, headers) {
	const crumbParam = crumb ? `&crumb=${encodeURIComponent(crumb)}` : ''
	// UPDATED: Added balanceSheetHistory, incomeStatementHistory and cashflowStatementHistory
	// These are CRITICAL for calculating FCF and ROE manually when Yahoo doesn't provide them directly
	const modules = [
		'financialData',
		'defaultKeyStatistics',
		'assetProfile',
		'summaryDetail',
		'incomeStatementHistory',
		'cashflowStatementHistory',
		'balanceSheetHistory',
	].join(',')

	const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=${modules}${crumbParam}`

	const res = await fetch(url, { headers, cache: 'no-store' })

	if (!res.ok) return {}

	const json = await res.json()
	const result = json?.quoteSummary?.result?.[0] || {}

	// DEBUG: Log module availability
	if (process.env.NODE_ENV === 'development') {
		console.log(`[Yahoo] ${ticker} modules:`, {
			hasFinancialData: !!result?.financialData,
			hasCashflowHistory: !!result?.cashflowStatementHistory?.cashflowStatements?.length,
			hasIncomeHistory: !!result?.incomeStatementHistory?.incomeStatementHistory?.length,
			hasBalanceSheetHistory: !!result?.balanceSheetHistory?.balanceSheetStatements?.length,
		})
	}

	return result
}

/**
 * Fetch fallback chart data from query2
 * @param {string} ticker
 * @returns {Promise<{ meta?: Object }>}
 */
async function fetchFallbackChartData(ticker) {
	const url = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`

	const res = await fetch(url, {
		headers: YAHOO_HEADERS,
		cache: 'no-store',
	})

	if (!res.ok) return null

	const json = await res.json()
	return json?.chart?.result?.[0]?.meta
}

/**
 * Fetch complete stock data with fallbacks
 * @param {string} ticker
 * @returns {Promise<{ ticker: string, quote: Object, summary: Object }>}
 * @throws {Error} If data cannot be fetched
 */
export async function fetchStockData(ticker) {
	// Use caching + deduplication for stock data
	return getOrSet(
		`yahoo:${ticker}`,
		() => dedupe(`fetch:${ticker}`, () => fetchStockDataInternal(ticker)),
		CACHE_TTL.stockData
	)
}

/**
 * Internal implementation of stock data fetching
 * (Actual logic extracted for caching wrapper)
 */
async function fetchStockDataInternal(ticker) {
	const { crumb, cookie } = await getYahooCrumb()
	const authHeaders = { ...YAHOO_HEADERS, ...(cookie ? { Cookie: cookie } : {}) }

	const variants = getTickerVariants(ticker)
	let lastError

	// Try primary endpoint for all variants
	for (const variant of variants) {
		try {
			const meta = await fetchChartData(variant, crumb, authHeaders)

			if (meta?.regularMarketPrice) {
				const summaryData = await fetchSummaryData(variant, crumb, authHeaders)
				return {
					ticker: variant,
					quote: meta,
					summary: summaryData,
				}
			}
		} catch (error) {
			lastError = error
			continue
		}
	}

	// Fallback to query2 endpoint
	for (const variant of variants) {
		try {
			const meta = await fetchFallbackChartData(variant)

			if (meta?.regularMarketPrice) {
				return {
					ticker: variant,
					quote: meta,
					summary: {},
				}
			}
		} catch (error) {
			lastError = error
			continue
		}
	}

	throw lastError || new Error(`Could not fetch data for "${ticker}"`)
}

/**
 * Extract numeric value from Yahoo's raw format
 * @param {...any} values
 * @returns {number|null}
 */
export function pickNumber(...values) {
	for (const v of values) {
		if (v == null || Number.isNaN(v)) continue
		const num = typeof v === 'object' ? v?.raw : v
		if (num != null && !Number.isNaN(num)) return num
	}
	return null
}

/**
 * Format large numbers (millions, billions, trillions)
 * @param {number|null} n
 * @param {number} decimals
 * @returns {string}
 */
export function fmtNumber(n, decimals = 2) {
	if (n == null || isNaN(n)) return 'N/A'
	const abs = Math.abs(n)
	if (abs >= 1e12) return `$${(n / 1e12).toFixed(decimals)}T`
	if (abs >= 1e9) return `$${(n / 1e9).toFixed(decimals)}B`
	if (abs >= 1e6) return `$${(n / 1e6).toFixed(decimals)}M`
	return `$${n.toFixed(decimals)}`
}

/**
 * Format percentage value
 * @param {number|null} n
 * @param {number} decimals
 * @returns {string}
 */
export function fmtPercent(n, decimals = 1) {
	if (n == null || Number.isNaN(n)) return 'N/A'
	return `${(n * 100).toFixed(decimals)}%`
}

/**
 * Transform raw Yahoo data to API response format
 * @param {string} ticker
 * @param {Object} data - Raw data from Yahoo
 * @returns {Object} Cleaned data object
 */
export function transformYahooData(ticker, { quote, summary }) {
	const fd = summary?.financialData || {}
	const ks = summary?.defaultKeyStatistics || {}
	const ap = summary?.assetProfile || {}
	const sd = summary?.summaryDetail || {}

	// Get balance sheet and income statement data for formula calculations
	const bs = summary?.balanceSheetHistory?.balanceSheetStatements?.[0] || {}
	const is = summary?.incomeStatementHistory?.incomeStatementHistory?.[0] || {}

	const price = Number(quote.regularMarketPrice) || 0
	const prevClose = Number(quote.chartPreviousClose || quote.previousClose || price)
	const change = price - prevClose
	const changePercent = prevClose ? (change / prevClose) * 100 : 0

	// Extract values with fallbacks
	const netIncomeForROE = pickNumber(fd.netIncome?.raw, is.netIncome?.raw)
	const stockholderEquity = bs.stockholdersEquity?.raw ?? bs.totalStockholderEquity?.raw

	// DEBUG: Log ROE calculation inputs
	if (process.env.NODE_ENV === 'development') {
		console.log(`[ROE Debug] ${ticker}:`, {
			netIncomeYahoo: fd.netIncome?.raw,
			netIncomeStatement: is.netIncome?.raw,
			netIncomeFinal: netIncomeForROE,
			stockholderEquity: stockholderEquity,
			balanceSheetKeys: Object.keys(bs),
			calculatedROE: (netIncomeForROE && stockholderEquity) ? netIncomeForROE / stockholderEquity : null,
		})
	}

	return {
		ticker,
		name: String(quote.longName || quote.shortName || ticker),
		price,
		change,
		changePercent,
		previousClose: prevClose || null,
		open: Number(quote.regularMarketOpen) || null,
		dayHigh: Number(quote.regularMarketDayHigh) || null,
		dayLow: Number(quote.regularMarketDayLow) || null,
		volume: Number(quote.regularMarketVolume) || null,
		avgVolume: pickNumber(sd.averageDailyVolume3Month?.raw, sd.averageDailyVolume10Day?.raw, quote.averageDailyVolume3Month),
		marketCap: pickNumber(sd.marketCap?.raw, fd.marketCap?.raw, quote.marketCap),
		pe: pickNumber(fd.trailingPE?.raw, ks.trailingPE?.raw, fd.forwardPE?.raw, ks.forwardPE?.raw),
		forwardPE: pickNumber(fd.forwardPE?.raw, ks.forwardPE?.raw),
		eps: pickNumber(ks.trailingEps?.raw),
		weekHigh52: Number(quote.fiftyTwoWeekHigh) || null,
		weekLow52: Number(quote.fiftyTwoWeekLow) || null,
		beta: pickNumber(ks.beta?.raw),
		// FIXED: ROE with multiple fallbacks:
		// 1. Direct ROE from Yahoo
		// 2. Formula: Net Income / Total Equity from balance sheet
		roe: pickNumber(
			fd.returnOnEquity?.raw,
			ks.returnOnEquity?.raw,
			(netIncomeForROE && stockholderEquity) ? netIncomeForROE / stockholderEquity : null
		),
		roa: fd.returnOnAssets?.raw ?? null,
		netIncome: netIncomeForROE,
		debtToEquity: fd.debtToEquity?.raw ?? null,
		profitMargin: fd.profitMargins?.raw ?? null,
		grossMargin: fd.grossMargins?.raw ?? null,
		operatingMargin: fd.operatingMargins?.raw ?? null,
		revenue: fd.totalRevenue?.raw ?? null,
		ebitda: fd.ebitda?.raw ?? null,
		// FIXED: Calculate FCF with multiple fallbacks:
		// 1. Direct FCF from Yahoo
		// 2. Formula from cashflow statement: OCF - CapEx
		// 3. Formula from EBITDA: EBITDA × 0.6 (rough approximation)
		freeCashFlow: fd.freeCashflow?.raw
			?? calculateManualFCF(summary?.cashflowStatementHistory)
			?? (fd.ebitda?.raw ? fd.ebitda.raw * 0.6 : null),
		operatingCashFlow: fd.operatingCashflow?.raw ?? summary?.cashflowStatementHistory?.cashflowStatements?.[0]?.totalCashFromOperatingActivities?.raw ?? null,
		capitalExpenditures: summary?.cashflowStatementHistory?.cashflowStatements?.[0]?.capitalExpenditures?.raw ?? null,
		totalCash: fd.totalCash?.raw ?? null,
		totalDebt: fd.totalDebt?.raw ?? null,
		currentRatio: fd.currentRatio?.raw ?? null,
		revenueGrowth: fd.revenueGrowth?.raw ?? null,
		earningsGrowth: fd.earningsGrowth?.raw ?? null,
		priceToBook: pickNumber(ks.priceToBook?.raw),
		priceToSales: ks.priceToSalesTrailing12Months?.raw ?? null,
		enterpriseValue: ks.enterpriseValue?.raw ?? null,
		evToEbitda: ks.enterpriseToEbitda?.raw
			?? (ks.enterpriseValue?.raw && fd.ebitda?.raw && fd.ebitda.raw > 0
				? ks.enterpriseValue.raw / fd.ebitda.raw
				: null),
		evToRevenue: ks.enterpriseToRevenue?.raw ?? null,
		dividendYield: pickNumber(ks.dividendYield?.raw),
		dividendRate: pickNumber(ks.dividendRate?.raw),
		payoutRatio: ks.payoutRatio?.raw ?? null,
		sharesOutstanding: ks.sharesOutstanding?.raw ?? null,
		targetHighPrice: fd.targetHighPrice?.raw ?? null,
		targetLowPrice: fd.targetLowPrice?.raw ?? null,
		targetMeanPrice: fd.targetMeanPrice?.raw ?? null,
		recommendationMean: fd.recommendationMean?.raw ?? null,
		recommendationKey: fd.recommendationKey ?? null,
		numberOfAnalysts: fd.numberOfAnalystOpinions?.raw ?? null,
		sector: ap.sector ?? null,
		industry: ap.industry ?? null,
		description: ap.longBusinessSummary ?? null,
		employees: ap.fullTimeEmployees ?? null,
		country: ap.country ?? null,
		currency: String(quote.currency || 'USD'),
		exchange: String(quote.fullExchangeName || quote.exchangeName) || null,
		marketState: String(quote.marketState) || null,
		fiftyDayAverage: Number(quote.fiftyDayAverage) || pickNumber(sd.fiftyDayAverage?.raw) || null,
		twoHundredDayAverage: Number(quote.twoHundredDayAverage) || pickNumber(sd.twoHundredDayAverage?.raw) || null,
		fiftyTwoWeekChange: ks.fiftyTwoWeekChange?.raw ?? sd.fiftyTwoWeekChange?.raw ?? null,
		ma50: Number(quote.fiftyDayAverage) || pickNumber(sd.fiftyDayAverage?.raw) || null,
		ma200: Number(quote.twoHundredDayAverage) || pickNumber(sd.twoHundredDayAverage?.raw) || null,
		// DEBUG: Track which data sources were used
		_dataSources: {
			fcf: fd.freeCashflow?.raw
				? 'yahoo_direct'
				: summary?.cashflowStatementHistory?.cashflowStatements?.[0]?.totalCashFromOperatingActivities?.raw
					? 'calculated_from_cashflow'
					: fd.ebitda?.raw ? 'formula_ebitda_0.6' : null,
			pe: fd.trailingPE?.raw ? 'financialData' : ks.trailingPE?.raw ? 'keyStatistics' : fd.forwardPE?.raw ? 'forwardPE_fallback' : null,
			roe: fd.returnOnEquity?.raw ? 'financialData' : ks.returnOnEquity?.raw ? 'keyStatistics' : (netIncomeForROE && stockholderEquity) ? 'balance_sheet_formula' : null,
		},
		// Period information for FCF and statement data
		_fcfPeriod: summary?.cashflowStatementHistory?.cashflowStatements?.[0]?.endDate
			? new Date(summary.cashflowStatementHistory.cashflowStatements[0].endDate * 1000).getFullYear()
			: null,
		// Debug info for troubleshooting missing values
		_debug: {
			hasNetIncome: !!netIncomeForROE,
			hasStockholderEquity: !!stockholderEquity,
			netIncomeValue: netIncomeForROE,
			stockholderEquityValue: stockholderEquity,
			calculatedROE: (netIncomeForROE && stockholderEquity) ? netIncomeForROE / stockholderEquity : null,
		},
	}
}

/**
 * Calculate Free Cash Flow manually from cashflow statement history
 * FCF = Operating Cash Flow - |Capital Expenditures|
 * @param {Object} cashflowHistory - Yahoo cashflowStatementHistory
 * @returns {number|null} Calculated FCF or null if data unavailable
 */
function calculateManualFCF(cashflowHistory) {
	if (!cashflowHistory?.cashflowStatements?.length) {
		return null
	}

	// Get most recent statement (index 0) - this is the TTM or latest fiscal year
	const latest = cashflowHistory.cashflowStatements[0]

	// Get operating cash flow (positive = cash inflow)
	const ocf = pickNumber(
		latest?.totalCashFromOperatingActivities?.raw,
		latest?.operatingCashFlow?.raw
	)

	// Get capital expenditures (typically negative = cash outflow)
	let capex = pickNumber(
		latest?.capitalExpenditures?.raw,
		latest?.purchaseOfFixedAssets?.raw
	)

	// Yahoo sometimes reports CapEx as positive, sometimes negative
	// We need it as a negative number (cash outflow)
	if (capex !== null && capex > 0) {
		capex = -capex
	}

	if (ocf !== null && capex !== null) {
		const fcf = ocf + capex // Adding because capex is negative
		console.log(`[FCF Calculation] OCF: ${ocf}, CapEx: ${capex}, FCF: ${fcf}`)
		return fcf
	}

	return null
}
