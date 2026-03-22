import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const ticker = searchParams.get('ticker')?.toUpperCase().trim()

  if (!ticker) {
    return NextResponse.json({ error: 'Ticker symbol is required' }, { status: 400 })
  }

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    }

    // Try original ticker, then .NS (NSE India), then .BO (BSE India)
    const tickersToTry = [ticker]
    if (!ticker.includes('.')) {
      tickersToTry.push(ticker + '.NS', ticker + '.BO')
    }

    let quoteJson = null
    let summaryJson = {}
    let resolvedTicker = ticker

    for (const t of tickersToTry) {
      const [quoteRes, summaryRes] = await Promise.all([
        fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${t}?interval=1d&range=1d`, { headers }),
        fetch(`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${t}?modules=financialData,defaultKeyStatistics,assetProfile,summaryProfile,price,summaryDetail`, { headers }),
      ])
      if (quoteRes.ok) {
        const j = await quoteRes.json()
        if (j?.chart?.result?.[0]?.meta) {
          quoteJson = j
          summaryJson = summaryRes.ok ? await summaryRes.json() : {}
          resolvedTicker = t
          break
        }
      }
    }

    if (!quoteJson?.chart?.result?.[0]?.meta) {
      return NextResponse.json({ error: `Ticker "${ticker}" not found. Check the symbol and try again.` }, { status: 404 })
    }

    const meta = quoteJson.chart.result[0].meta
    const summary = summaryJson?.quoteSummary?.result?.[0] || {}
    const fd = summary.financialData || {}
    const ks = summary.defaultKeyStatistics || {}
    const ap = summary.assetProfile || summary.summaryProfile || {}
    const pr = summary.price || {}
    const sd = summary.summaryDetail || {}

    const price = meta.regularMarketPrice
    const prevClose = meta.chartPreviousClose || meta.previousClose
    const change = prevClose ? price - prevClose : 0
    const changePercent = prevClose ? (change / prevClose) * 100 : 0

    // Helper: pick first non-null value
    const pick = (...vals) => vals.find(v => v != null && !isNaN(v)) ?? null

    return NextResponse.json({
      ticker: resolvedTicker,
      name: meta.longName || meta.shortName || pr.longName || pr.shortName || resolvedTicker,
      price,
      change,
      changePercent,
      previousClose: prevClose,
      open: meta.regularMarketOpen,
      dayHigh: meta.regularMarketDayHigh,
      dayLow: meta.regularMarketDayLow,
      volume: meta.regularMarketVolume,
      avgVolume: pick(meta.averageDailyVolume3Month, pr.averageDailyVolume3Month?.raw),
      marketCap: pick(fd.marketCap?.raw, pr.marketCap?.raw, meta.marketCap),
      pe: pick(fd.trailingPE?.raw, pr.trailingPE?.raw, sd.trailingPE?.raw),
      forwardPE: pick(fd.forwardPE?.raw, ks.forwardPE?.raw),
      eps: pick(ks.trailingEps?.raw, pr.epsTrailingTwelveMonths),
      weekHigh52: pick(meta.fiftyTwoWeekHigh, sd.fiftyTwoWeekHigh?.raw),
      weekLow52: pick(meta.fiftyTwoWeekLow, sd.fiftyTwoWeekLow?.raw),
      beta: pick(ks.beta?.raw, sd.beta?.raw),
      roe: fd.returnOnEquity?.raw ?? null,
      roa: fd.returnOnAssets?.raw ?? null,
      debtToEquity: fd.debtToEquity?.raw ?? null,
      profitMargin: pick(fd.profitMargins?.raw, pr.profitMargins?.raw),
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
      priceToBook: pick(ks.priceToBook?.raw, sd.priceToBook?.raw),
      priceToSales: ks.priceToSalesTrailing12Months?.raw ?? null,
      enterpriseValue: ks.enterpriseValue?.raw ?? null,
      evToEbitda: ks.enterpriseToEbitda?.raw ?? null,
      evToRevenue: ks.enterpriseToRevenue?.raw ?? null,
      dividendYield: pick(ks.dividendYield?.raw, sd.dividendYield?.raw, pr.dividendYield?.raw),
      dividendRate: pick(ks.dividendRate?.raw, sd.dividendRate?.raw),
      payoutRatio: pick(ks.payoutRatio?.raw, sd.payoutRatio?.raw),
      sharesOutstanding: pick(ks.sharesOutstanding?.raw, pr.sharesOutstanding?.raw),
      floatShares: ks.floatShares?.raw ?? null,
      shortRatio: ks.shortRatio?.raw ?? null,
      shortPercentOfFloat: ks.shortPercentOfFloat?.raw ?? null,
      bookValuePerShare: ks.bookValue?.raw ?? null,
      targetHighPrice: fd.targetHighPrice?.raw ?? null,
      targetLowPrice: fd.targetLowPrice?.raw ?? null,
      targetMeanPrice: fd.targetMeanPrice?.raw ?? null,
      targetMedianPrice: fd.targetMedianPrice?.raw ?? null,
      recommendationMean: fd.recommendationMean?.raw ?? null,
      recommendationKey: fd.recommendationKey || pr.recommendationKey || null,
      numberOfAnalysts: fd.numberOfAnalystOpinions?.raw ?? null,
      sector: ap.sector || null,
      industry: ap.industry || null,
      description: ap.longBusinessSummary || null,
      employees: ap.fullTimeEmployees || null,
      country: ap.country || null,
      website: ap.website || null,
      currency: meta.currency || pr.currency,
      exchange: meta.fullExchangeName || meta.exchangeName || pr.exchangeName,
      quoteType: meta.instrumentType,
      marketState: meta.marketState,
      fiftyDayAverage: pick(meta.fiftyDayAverage, sd.fiftyDayAverage?.raw),
      twoHundredDayAverage: pick(meta.twoHundredDayAverage, sd.twoHundredDayAverage?.raw),
      fiftyTwoWeekChange: ks.fiftyTwoWeekChange?.raw ?? null,
    })
  } catch (error) {
    console.error('[stock/route] Error:', error.message)
    return NextResponse.json(
      { error: 'Failed to fetch market data. Please try again.' },
      { status: 500 }
    )
  }
}
