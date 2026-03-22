import { NextResponse } from 'next/server'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Origin': 'https://finance.yahoo.com',
  'Referer': 'https://finance.yahoo.com/',
  'Cache-Control': 'no-cache',
}

// Step 1: get a session cookie + crumb from Yahoo Finance
async function getCrumb() {
  try {
    const cookieRes = await fetch('https://fc.yahoo.com', {
      headers: HEADERS,
      redirect: 'follow',
    })
    const cookies = cookieRes.headers.get('set-cookie') || ''
    const a3Cookie = cookies.match(/A3=[^;]+/)?.[0] || ''

    const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { ...HEADERS, 'Cookie': a3Cookie },
    })
    const crumb = await crumbRes.text()
    return { crumb: crumb.trim(), cookie: a3Cookie }
  } catch {
    return { crumb: '', cookie: '' }
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const ticker = searchParams.get('ticker')?.toUpperCase().trim()

  if (!ticker) {
    return NextResponse.json({ error: 'Ticker symbol is required' }, { status: 400 })
  }

  try {
    const tickersToTry = [ticker]
    if (!ticker.includes('.')) {
      tickersToTry.push(ticker + '.NS', ticker + '.BO')
    }

    // Get crumb for authenticated requests
    const { crumb, cookie } = await getCrumb()
    const authHeaders = { ...HEADERS, ...(cookie ? { 'Cookie': cookie } : {}) }
    const crumbParam = crumb ? `&crumb=${encodeURIComponent(crumb)}` : ''

    let quoteData = null
    let summaryData = {}
    let resolvedTicker = ticker

    for (const t of tickersToTry) {
      try {
        // Try chart API first (most reliable)
        const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${t}?interval=1d&range=1d${crumbParam}`
        const chartRes = await fetch(chartUrl, { headers: authHeaders })

        if (chartRes.ok) {
          const chartJson = await chartRes.json()
          const meta = chartJson?.chart?.result?.[0]?.meta
          if (meta?.regularMarketPrice) {
            quoteData = meta
            resolvedTicker = t

            // Try to get fundamentals
            try {
              const summaryUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${t}?modules=financialData,defaultKeyStatistics,assetProfile${crumbParam}`
              const summaryRes = await fetch(summaryUrl, { headers: authHeaders })
              if (summaryRes.ok) {
                const sj = await summaryRes.json()
                summaryData = sj?.quoteSummary?.result?.[0] || {}
              }
            } catch (_) {}

            break
          }
        }
      } catch (_) { continue }
    }

    // If chart API failed, try query2 as fallback
    if (!quoteData) {
      for (const t of tickersToTry) {
        try {
          const url = `https://query2.finance.yahoo.com/v8/finance/chart/${t}?interval=1d&range=1d`
          const res = await fetch(url, { headers: HEADERS })
          if (res.ok) {
            const j = await res.json()
            const meta = j?.chart?.result?.[0]?.meta
            if (meta?.regularMarketPrice) {
              quoteData = meta
              resolvedTicker = t
              break
            }
          }
        } catch (_) { continue }
      }
    }

    if (!quoteData) {
      return NextResponse.json({
        error: `Could not fetch data for "${ticker}". Yahoo Finance may be temporarily unavailable. Please try again in a moment.`
      }, { status: 404 })
    }

    const fd = summaryData.financialData || {}
    const ks = summaryData.defaultKeyStatistics || {}
    const ap = summaryData.assetProfile || {}

    const price = quoteData.regularMarketPrice
    const prevClose = quoteData.chartPreviousClose || quoteData.previousClose
    const change = prevClose ? price - prevClose : 0
    const changePercent = prevClose ? (change / prevClose) * 100 : 0

    const pick = (...vals) => vals.find(v => v != null && !isNaN(v)) ?? null

    return NextResponse.json({
      ticker: resolvedTicker,
      name: quoteData.longName || quoteData.shortName || resolvedTicker,
      price,
      change,
      changePercent,
      previousClose: prevClose,
      open: quoteData.regularMarketOpen,
      dayHigh: quoteData.regularMarketDayHigh,
      dayLow: quoteData.regularMarketDayLow,
      volume: quoteData.regularMarketVolume,
      avgVolume: quoteData.averageDailyVolume3Month,
      marketCap: pick(fd.marketCap?.raw, quoteData.marketCap),
      pe: pick(fd.trailingPE?.raw),
      forwardPE: pick(fd.forwardPE?.raw, ks.forwardPE?.raw),
      eps: pick(ks.trailingEps?.raw),
      weekHigh52: quoteData.fiftyTwoWeekHigh,
      weekLow52: quoteData.fiftyTwoWeekLow,
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
      dividendYield: pick(ks.dividendYield?.raw),
      dividendRate: pick(ks.dividendRate?.raw),
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
      sector: ap.sector ?? null,
      industry: ap.industry ?? null,
      description: ap.longBusinessSummary ?? null,
      employees: ap.fullTimeEmployees ?? null,
      country: ap.country ?? null,
      currency: quoteData.currency,
      exchange: quoteData.fullExchangeName || quoteData.exchangeName,
      marketState: quoteData.marketState,
      fiftyDayAverage: quoteData.fiftyDayAverage,
      twoHundredDayAverage: quoteData.twoHundredDayAverage,
      fiftyTwoWeekChange: ks.fiftyTwoWeekChange?.raw ?? null,
    })
  } catch (error) {
    console.error('[stock/route] Error:', error.message)
    return NextResponse.json({ error: 'Failed to fetch market data. Please try again.' }, { status: 500 })
  }
}
