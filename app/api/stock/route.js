import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const ticker = searchParams.get('ticker')?.toUpperCase().trim()

  if (!ticker) {
    return NextResponse.json({ error: 'Ticker symbol is required' }, { status: 400 })
  }

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Origin': 'https://finance.yahoo.com',
      'Referer': 'https://finance.yahoo.com/',
    }

    // Try ticker, then .NS, then .BO
    const tickersToTry = [ticker]
    if (!ticker.includes('.')) {
      tickersToTry.push(ticker + '.NS', ticker + '.BO')
    }

    let data = null
    let resolvedTicker = ticker

    for (const t of tickersToTry) {
      // Use v7 quote endpoint - returns all key stats in one call
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${t}&fields=longName,shortName,regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketPreviousClose,regularMarketOpen,regularMarketDayHigh,regularMarketDayLow,regularMarketVolume,averageDailyVolume3Month,marketCap,trailingPE,forwardPE,epsTrailingTwelveMonths,fiftyTwoWeekHigh,fiftyTwoWeekLow,beta,priceToBook,currency,fullExchangeName,sector,industry,fiftyDayAverage,twoHundredDayAverage,trailingAnnualDividendYield,dividendRate,earningsTimestamp`
      
      const res = await fetch(url, { headers })
      if (!res.ok) continue

      const json = await res.json()
      const result = json?.quoteResponse?.result?.[0]
      if (!result || result.regularMarketPrice == null) continue

      data = result
      resolvedTicker = t
      break
    }

    if (!data) {
      return NextResponse.json({ error: `Ticker "${ticker}" not found. Check the symbol and try again.` }, { status: 404 })
    }

    // Try to get extra fundamentals from quoteSummary (may or may not work)
    let fd = {}, ks = {}, ap = {}
    try {
      const summaryRes = await fetch(
        `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${resolvedTicker}?modules=financialData,defaultKeyStatistics,assetProfile`,
        { headers }
      )
      if (summaryRes.ok) {
        const sj = await summaryRes.json()
        const r = sj?.quoteSummary?.result?.[0] || {}
        fd = r.financialData || {}
        ks = r.defaultKeyStatistics || {}
        ap = r.assetProfile || {}
      }
    } catch (_) {}

    const price = data.regularMarketPrice
    const prevClose = data.regularMarketPreviousClose
    const change = data.regularMarketChange ?? (prevClose ? price - prevClose : 0)
    const changePercent = data.regularMarketChangePercent ?? (prevClose ? (change / prevClose) * 100 : 0)

    const pick = (...vals) => vals.find(v => v != null && !isNaN(v) && v !== 0) ?? null

    return NextResponse.json({
      ticker: resolvedTicker,
      name: data.longName || data.shortName || resolvedTicker,
      price,
      change,
      changePercent,
      previousClose: prevClose,
      open: data.regularMarketOpen,
      dayHigh: data.regularMarketDayHigh,
      dayLow: data.regularMarketDayLow,
      volume: data.regularMarketVolume,
      avgVolume: data.averageDailyVolume3Month,
      marketCap: pick(data.marketCap, fd.marketCap?.raw),
      pe: pick(data.trailingPE, fd.trailingPE?.raw),
      forwardPE: pick(data.forwardPE, fd.forwardPE?.raw, ks.forwardPE?.raw),
      eps: pick(data.epsTrailingTwelveMonths, ks.trailingEps?.raw),
      weekHigh52: data.fiftyTwoWeekHigh,
      weekLow52: data.fiftyTwoWeekLow,
      beta: pick(data.beta, ks.beta?.raw),
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
      priceToBook: pick(data.priceToBook, ks.priceToBook?.raw),
      priceToSales: ks.priceToSalesTrailing12Months?.raw ?? null,
      enterpriseValue: ks.enterpriseValue?.raw ?? null,
      evToEbitda: ks.enterpriseToEbitda?.raw ?? null,
      evToRevenue: ks.enterpriseToRevenue?.raw ?? null,
      dividendYield: pick(data.trailingAnnualDividendYield, ks.dividendYield?.raw),
      dividendRate: pick(data.dividendRate, ks.dividendRate?.raw),
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
      recommendationKey: fd.recommendationKey ?? null,
      numberOfAnalysts: fd.numberOfAnalystOpinions?.raw ?? null,
      sector: data.sector || ap.sector || null,
      industry: data.industry || ap.industry || null,
      description: ap.longBusinessSummary || null,
      employees: ap.fullTimeEmployees || null,
      country: ap.country || null,
      website: ap.website || null,
      currency: data.currency,
      exchange: data.fullExchangeName || data.exchange,
      quoteType: data.quoteType,
      marketState: data.marketState,
      fiftyDayAverage: data.fiftyDayAverage,
      twoHundredDayAverage: data.twoHundredDayAverage,
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
