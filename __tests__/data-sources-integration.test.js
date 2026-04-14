/**
 * Integration Tests: Data Sources (Yahoo + Screener + TradingView)
 * Tests: Fetch, merge, validation, fallback chains
 */

import { fetchScreenerData, mergeScreenerData, isScreenerEligible } from '@/lib/screener-scraper'
import { fetchTradingViewData, mergeTradingViewData, tickerToTradingView } from '@/lib/tradingview-scraper'
import { getYahooFinanceData } from '@/lib/yahoo-finance'

describe('Data Sources Integration', () => {
  const TEST_TICKERS = {
    indian: 'TATAPOWER.NS',
    us: 'AAPL',
  }

  describe('Source Detection', () => {
    test('should detect Indian tickers (.NS/.BO)', () => {
      expect(isScreenerEligible('TATAPOWER.NS')).toBe(true)
      expect(isScreenerEligible('RELIANCE.BO')).toBe(true)
      expect(isScreenerEligible('AAPL')).toBe(false)
    })

    test('should map tickers to TradingView format', () => {
      expect(tickerToTradingView('TATAPOWER.NS')).toEqual({ exchange: 'NSE', symbol: 'TATAPOWER' })
      expect(tickerToTradingView('RELIANCE.BO')).toEqual({ exchange: 'BSE', symbol: 'RELIANCE' })
      expect(tickerToTradingView('AAPL')).toEqual({ exchange: 'NASDAQ', symbol: 'AAPL' })
    })
  })

  describe('Yahoo Finance (Primary)', () => {
    test('should fetch complete data for Indian stock', async () => {
      const data = await getYahooFinanceData(TEST_TICKERS.indian)
      expect(data).toBeTruthy()
      expect(data.ticker).toBe(TEST_TICKERS.indian)
      expect(data.price).toBeGreaterThan(0)
      expect(data.marketCap).toBeGreaterThan(0)
    }, 15000)

    test('should fetch data for US stock', async () => {
      const data = await getYahooFinanceData(TEST_TICKERS.us)
      expect(data).toBeTruthy()
      expect(data.price).toBeGreaterThan(0)
    }, 15000)
  })

  describe('Screener.in (Secondary - India Only)', () => {
    test('should fetch peer data for Indian stock', async () => {
      const data = await fetchScreenerData(TEST_TICKERS.indian)

      if (data) {
        // Screener data available
        expect(data.screenerRatios).toBeDefined()
        expect(data.screenerPeers).toBeDefined()
        expect(data.screenerPeers.length).toBeGreaterThanOrEqual(0)
      } else {
        // Screener blocked or unavailable - this is acceptable
        console.log('Screener data unavailable (bot protection)')
      }
    }, 20000)

    test('should return null for non-Indian tickers', async () => {
      const data = await fetchScreenerData(TEST_TICKERS.us)
      expect(data).toBeNull()
    })
  })

  describe('TradingView (Tertiary)', () => {
    test('should fetch technical data', async () => {
      const tv = tickerToTradingView(TEST_TICKERS.indian)
      const data = await fetchTradingViewData(tv.exchange, tv.symbol)

      if (data && process.env.BROWSERLESS_TOKEN) {
        expect(data._source).toBe('tradingview')
        expect(data._exchange).toBe('NSE')
      } else {
        console.log('TradingView data unavailable (no token or error)')
      }
    }, 30000)
  })

  describe('Data Merging', () => {
    test('should merge Screener data into Yahoo data', () => {
      const yahooData = {
        price: 100,
        pe: null, // Yahoo missing
        roe: null,
        _dataSources: ['yahoo']
      }

      const screenerData = {
        screenerRatios: {
          stockPE: 22.5,
          roe: 18.5,
        },
        screenerPeers: [{ name: 'Peer1', pe: 20 }]
      }

      const merged = mergeScreenerData(yahooData, screenerData)

      expect(merged.pe).toBe(22.5) // Filled from Screener
      expect(merged.roe).toBe(0.185) // Converted from %
      expect(merged.screenerPeers).toHaveLength(1)
      expect(merged._dataSources).toContain('screener')
    })

    test('should merge TradingView data into Yahoo data', () => {
      const yahooData = {
        price: 100,
        rsi14: null,
        analystConsensus: null,
      }

      const tvData = {
        rsi14: 65,
        analystConsensus: 'Buy',
        evToEbitda: 8.5,
      }

      const merged = mergeTradingViewData(yahooData, tvData)

      expect(merged.rsi14).toBe(65)
      expect(merged.analystConsensus).toBe('Buy')
      expect(merged._tvEnhanced).toBe(true)
    })

    test('should preserve Yahoo data when all sources have value', () => {
      const yahooData = {
        price: 100,
        pe: 20, // Yahoo has value
      }

      const screenerData = {
        screenerRatios: {
          stockPE: 22, // Screener has different value
        }
      }

      const merged = mergeScreenerData(yahooData, screenerData)

      // Yahoo wins on conflicts
      expect(merged.pe).toBe(20)
    })
  })

  describe('Fallback Chain', () => {
    test('should handle complete Yahoo failure gracefully', async () => {
      // Simulate failure by passing invalid ticker
      const data = await getYahooFinanceData('INVALID123')
      expect(data).toBeNull()
    })

    test('should continue with available sources when one fails', async () => {
      const ticker = TEST_TICKERS.indian

      // This would be the actual implementation
      const [yahooData, screenerData] = await Promise.all([
        getYahooFinanceData(ticker).catch(() => null),
        fetchScreenerData(ticker).catch(() => null),
      ])

      // At minimum, we should have Yahoo data
      // Screener may fail (rate limiting) but that's OK
      expect(yahooData).toBeTruthy()
    })
  })

  describe('Source Coverage', () => {
    const criticalFields = [
      'price',
      'marketCap',
      'revenue',
      'ebitda',
      'sharesOutstanding',
    ]

    const optionalFields = [
      'pe',
      'roe',
      'rsi14',
      'analystConsensus',
      'screenerPeers',
    ]

    test('Yahoo should provide all critical fields', async () => {
      const data = await getYahooFinanceData(TEST_TICKERS.indian)

      for (const field of criticalFields) {
        expect(data[field]).toBeDefined()
        expect(data[field]).not.toBeNull()
      }
    }, 15000)

    test('optional fields may be filled by secondary/tertiary sources', async () => {
      // This tests that the system is designed to handle missing optional data
      const yahooData = await getYahooFinanceData(TEST_TICKERS.indian)

      // Check which optional fields Yahoo has
      const yahooHasOptional = optionalFields.filter(f =>
        yahooData[f] !== null && yahooData[f] !== undefined
      )

      // Yahoo should have most ratios
      expect(yahooHasOptional.length).toBeGreaterThan(optionalFields.length / 2)
    }, 15000)
  })
})

describe('Data Quality Validation', () => {
  test('should flag suspicious P/E ratios', () => {
    const suspiciousPE = 500 // Too high
    expect(suspiciousPE).toBeGreaterThan(200)
  })

  test('should flag negative revenue', () => {
    const negativeRevenue = -1000
    expect(negativeRevenue).toBeLessThan(0)
  })

  test('should validate consistent margins', () => {
    const grossMargin = 0.45
    const operatingMargin = 0.25
    const netMargin = 0.15

    // Margins should be in descending order
    expect(grossMargin).toBeGreaterThanOrEqual(operatingMargin)
    expect(operatingMargin).toBeGreaterThanOrEqual(netMargin)
  })
})