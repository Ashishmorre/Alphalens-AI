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

    const [quoteRes, summaryRes] = await Promise.all([
      fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`, { headers }),
      fetch(`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=financialData,defaultKeyStatistics,assetProfile,summaryProfile`, { headers }),
    ])

    if (!quoteRes.ok) {
      return NextResponse.json({ error: `Ticker "${ticker}" not found. Please check the symbol.` }, { status: 404 })
    }

    const quoteJson = await quoteRes.json()
    const summaryJson = summaryRes.ok ? await summaryRes.json() : {}

    const meta = quoteJson?.chart?.result?.[0]?.meta
    if (!meta) {
      return NextResponse.json({ error: `No data found for "${ticker}".` }, { status: 404 })
    }

    const summary = summaryJson?.quoteSummary?.result?.[0] || {}
    const fd = summary.financialData || {}
    const ks = summary.defaultKeyStatistics || {}
    const ap = summary.assetProfile || summary.summaryProfile || {}

    const price = meta.regularMarketPrice
    const prevClose = meta.chartPreviousClose || meta.previousClose
    const change = prevClose ? price - prevClose : 0
    const changePercent = prevClose ? (change / prevClose) * 100 : 0

    return NextResponse.json({
      ticker,
      name: meta.longName || meta.shortName || ticker,
      price,
      change,
      changePercent,
      previousClose: prevClose,
      open: meta.regularMarketOpen,
      dayHigh: meta.regularMarketDayHigh,
      dayLow: meta.regularMarketDayLow,
      volume: meta.regularMarketVolume,
      avgVolume: meta.averageDailyVolume3Month,
      marketCap: fd.marketCap?.raw || meta.marketCap,
      pe: fd.trailingPE?.raw,
      forwardPE: fd.forwardPE?.raw || ks.forwardPE?.raw,
      eps: ks.trailingEps?.raw,
      weekHigh52: meta.fiftyTwoWeekHigh,
      weekLow52: meta.fiftyTwoWeekLow,
      beta: ks.beta?.raw,
      roe: fd.returnOnEquity?.raw,
      roa: fd.returnOnAssets?.raw,
      debtToEquity: fd.debtToEquity?.raw,
      profitMargin: fd.profitMargins?.raw,
      grossMargin: fd.grossMargins?.raw,
      operatingMargin: fd.operatingMargins?.raw,
      revenue: fd.totalRevenue?.raw,
      ebitda: fd.ebitda?.raw,
      freeCashFlow: fd.freeCashflow?.raw,
      operatingCashFlow: fd.operatingCashflow?.raw,
      totalCash: fd.totalCash?.raw,
      totalDebt: fd.totalDebt?.raw,
      currentRatio: fd.currentRatio?.raw,
      quickRatio: fd.quickRatio?.raw,
      revenueGrowth: fd.revenueGrowth?.raw,
      earningsGrowth: fd.earningsGrowth?.raw,
      priceToBook: ks.priceToBook?.raw,
      priceToSales: ks.priceToSalesTrailing12Months?.raw,
      enterpriseValue: ks.enterpriseValue?.raw,
      evToEbitda: ks.enterpriseToEbitda?.raw,
      evToRevenue: ks.enterpriseToRevenue?.raw,
      dividendYield: ks.dividendYield?.raw,
      dividendRate: ks.dividendRate?.raw,
      payoutRatio: ks.payoutRatio?.raw,
      sharesOutstanding: ks.sharesOutstanding?.raw,
      floatShares: ks.floatShares?.raw,
      shortRatio: ks.shortRatio?.raw,
      shortPercentOfFloat: ks.shortPercentOfFloat?.raw,
      bookValuePerShare: ks.bookValue?.raw,
      targetHighPrice: fd.targetHighPrice?.raw,
      targetLowPrice: fd.targetLowPrice?.raw,
      targetMeanPrice: fd.targetMeanPrice?.raw,
      targetMedianPrice: fd.targetMedianPrice?.raw,
      recommendationMean: fd.recommendationMean?.raw,
      recommendationKey: fd.recommendationKey,
      numberOfAnalysts: fd.numberOfAnalystOpinions?.raw,
      sector: ap.sector,
      industry: ap.industry,
      description: ap.longBusinessSummary,
      employees: ap.fullTimeEmployees,
      country: ap.country,
      website: ap.website,
      currency: meta.currency,
      exchange: meta.fullExchangeName || meta.exchangeName,
      quoteType: meta.instrumentType,
      marketState: meta.marketState,
      fiftyDayAverage: meta.fiftyDayAverage,
      twoHundredDayAverage: meta.twoHundredDayAverage,
      fiftyTwoWeekChange: ks.fiftyTwoWeekChange?.raw,
    })
  } catch (error) {
    console.error('[stock/route] Error:', error.message)
    return NextResponse.json(
      { error: 'Failed to fetch market data. Please try again.' },
      { status: 500 }
    )
  }
}
