import { NextResponse } from 'next/server'
import { fetchStockData } from '@/lib/yahoo-finance'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const ticker = searchParams.get('ticker') || 'RELIANCE.NS'

  try {
    const rawData = await fetchStockData(ticker)

    // Extract key fields for debugging
    const fd = rawData.summary?.financialData || {}
    const ks = rawData.summary?.defaultKeyStatistics || {}
    const bs = rawData.summary?.balanceSheetHistory?.balanceSheetStatements?.[0] || {}
    const is = rawData.summary?.incomeStatementHistory?.incomeStatementHistory?.[0] || {}

    return NextResponse.json({
      success: true,
      ticker,
      roe_debug: {
        // Direct ROE sources
        'fd.returnOnEquity': fd.returnOnEquity,
        'ks.returnOnEquity': ks.returnOnEquity,

        // Formula components
        'fd.netIncome': fd.netIncome,
        'is.netIncome': is.netIncome,
        'bs.stockholdersEquity': bs.stockholdersEquity,
        'bs.totalStockholderEquity': bs.totalStockholderEquity,

        // Balance sheet structure
        balance_sheet_statement_count: rawData.summary?.balanceSheetHistory?.balanceSheetStatements?.length,
        balance_sheet_keys: Object.keys(bs),

        // Income statement structure
        income_statement_count: rawData.summary?.incomeStatementHistory?.incomeStatementHistory?.length,
        income_statement_keys: Object.keys(is),
      },

      // Raw data - full structure
      raw: {
        balance_sheet_full: rawData.summary?.balanceSheetHistory,
        income_statement_full: rawData.summary?.incomeStatementHistory,
      },
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
