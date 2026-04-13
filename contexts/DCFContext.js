'use client'

import { createContext, useContext, useMemo, useCallback } from 'react'
import {
  calculateValuationSpread,
  getValuationVerdict,
  calculateUpside,
  calculateDCFRating,
  calculateFCF,
  calculatePV,
  calculateTerminalValue,
  calculatePVTerminalValue,
  calculateEnterpriseValue,
  calculateEquityValue,
  calculateIntrinsicValuePerShare,
  calculateMarginOfSafety,
  calculateEBITDA,
  calculateNOPAT,
  normalizeToAbsolute,
} from '@/lib/financial-utils'

const DCFContext = createContext(undefined)

/**
 * DCF Provider
 * Accepts rawApiData (AI response) and stockData (live stock from Yahoo).
 * stockData is the ground truth for currentPrice and sharesOutstanding.
 * The AI DCF model provides assumptions and projections; JS math does all calculations.
 */
export function DCFProvider({ children, rawApiData, stockData }) {
  // ─── Step 1: Build safe base data using AI output + stockData fallbacks ───
  const safeData = useMemo(() => {
    if (!rawApiData) return null

    const d = rawApiData

    // ── Ground-truth values from stockData (never trust AI for these) ────────
    // currentPrice: use live stock price from stockData, fall back to AI output
    const currentPrice = stockData?.price || d?.currentPrice || 0

    // sharesOutstanding: Yahoo provides this reliably; AI often omits it
    const sharesOutstanding =
      stockData?.sharesOutstanding ||
      d?.sharesOutstanding ||
      d?.assumptions?.sharesOutstanding ||
      1000000 // final fallback: 1M shares (better than 1)

    // ── Financial base metrics ────────────────────────────────────────────────
    // Normalize all values to absolute numbers (handles "2.5B", "2500M", etc.)
    const baseRevenue = normalizeToAbsolute(stockData?.revenue || d?.revenue) || 1000000000
    const baseEbitda = normalizeToAbsolute(stockData?.ebitda || d?.ebitda) || baseRevenue * 0.2

    // ── DCF Assumptions from AI (with safe defaults) ─────────────────────────
    const wacc = d?.assumptions?.wacc || 10
    const terminalGrowthRate = d?.assumptions?.terminalGrowthRate || 2.5
    const taxRate = d?.assumptions?.taxRate || 21

    // ── Revenue growth rates: use AI-provided or default ─────────────────────
    const revenueGrowthRates =
      Array.isArray(d?.assumptions?.revenueGrowthRates) && d.assumptions.revenueGrowthRates.length === 5
        ? d.assumptions.revenueGrowthRates
        : [10, 9.5, 9, 8.5, 8]

    const ebitdaMargins =
      Array.isArray(d?.assumptions?.ebitdaMargins) && d.assumptions.ebitdaMargins.length === 5
        ? d.assumptions.ebitdaMargins
        : [20, 21, 22, 23, 24]

    // ── 5-Year Projections ────────────────────────────────────────────────────
    // Prefer AI-provided projections if they look valid (5 years, positive revenue)
    let calculatedProjections
    const aiProjections = d?.projections

    const aiProjectionsValid =
      Array.isArray(aiProjections) &&
      aiProjections.length === 5 &&
      aiProjections.every(p => p?.revenue > 0 && p?.fcf !== undefined)

    if (aiProjectionsValid) {
      // Use AI projections directly (they're already in absolute numbers)
      calculatedProjections = aiProjections.map((p, i) => ({
        year: p.year || i + 1,
        revenue: p.revenue || 0,
        ebitda: p.ebitda || 0,
        ebit: p.ebit || 0,
        nopat: p.nopat || 0,
        capex: p.capex || 0,
        nwcChange: p.nwcChange || 0,
        fcf: p.fcf || 0,
        pvFCF: calculatePV(p.fcf || 0, wacc, p.year || i + 1),
      }))
    } else {
      // Recompute from scratch using assumptions
      calculatedProjections = []
      for (let i = 0; i < 5; i++) {
        const year = i + 1
        const growthRate = revenueGrowthRates[i] || 10
        const ebitdaMargin = ebitdaMargins[i] || 20

        const revenue = baseRevenue * Math.pow(1 + growthRate / 100, year)
        const ebitda = calculateEBITDA(revenue, ebitdaMargin)
        const depreciation = ebitda * 0.12
        const ebit = ebitda - depreciation
        const nopat = calculateNOPAT(ebit, taxRate)
        const capex = -revenue * 0.08
        const prevRevenue = i === 0 ? baseRevenue : calculatedProjections[i - 1].revenue
        const nwcChange = (revenue - prevRevenue) * 0.03
        const fcf = calculateFCF(nopat, depreciation, capex, nwcChange)
        const pvFCF = calculatePV(fcf, wacc, year)

        calculatedProjections.push({ year, revenue, ebitda, ebit, nopat, capex, nwcChange, fcf, pvFCF })
      }
    }

    // ── Valuation math ────────────────────────────────────────────────────────
    const pvFCFs = calculatedProjections.reduce((sum, p) => sum + (p.pvFCF || 0), 0)
    const finalFCF = calculatedProjections[calculatedProjections.length - 1]?.fcf || 0

    const terminalValue = calculateTerminalValue(finalFCF, wacc, terminalGrowthRate)
    const pvTerminalValue = calculatePVTerminalValue(terminalValue, wacc, 5)
    const enterpriseValue = calculateEnterpriseValue(pvFCFs, pvTerminalValue)

    // Normalize cash/debt to absolute numbers
    const totalCash = normalizeToAbsolute(stockData?.totalCash || d?.totalCash || d?.assumptions?.cash)
    const totalDebt = normalizeToAbsolute(stockData?.totalDebt || d?.totalDebt || d?.assumptions?.debt)
    const marketCap = stockData?.marketCap || d?.marketCap || currentPrice * sharesOutstanding

    const equityValue = calculateEquityValue(enterpriseValue, totalCash, totalDebt, marketCap)
    const intrinsicValuePerShare = calculateIntrinsicValuePerShare(equityValue, sharesOutstanding)

    return {
      currentPrice,
      wacc,
      terminalGrowthRate,
      taxRate,
      sharesOutstanding,
      assumptions: d?.assumptions || { wacc, terminalGrowthRate, taxRate, revenueGrowthRates, ebitdaMargins },
      calculatedProjections,
      pvFCFs,
      terminalValue,
      pvTerminalValue,
      enterpriseValue,
      equityValue,
      intrinsicValuePerShare,
      totalCash,
      totalDebt,
      // Pass-through for non-financial fields
      originalData: d,
    }
  }, [rawApiData, stockData])

  // ─── Step 2: Calculate sensitivity table ─────────────────────────────────
  const calculateSensitivity = useCallback((baseIntrinsicValue, currentPrice, waccRange, tgrRange) => {
    if (!baseIntrinsicValue || !currentPrice || baseIntrinsicValue <= 0 || currentPrice <= 0) return null
    if (!waccRange?.length || !tgrRange?.length) return null

    const values = tgrRange.map(tgr =>
      waccRange.map(w => {
        const waccAdj = (10 - w) * 0.05
        const tgrAdj = (tgr - 2.5) * 0.03
        return Math.max(0, baseIntrinsicValue * (1 + waccAdj + tgrAdj))
      })
    )

    return { waccRange, tgrRange, values }
  }, [])

  // ─── Step 3: Derive final DCF data ───────────────────────────────────────
  const dcfData = useMemo(() => {
    if (!safeData) return null

    const {
      calculatedProjections,
      wacc,
      terminalGrowthRate,
      currentPrice,
      intrinsicValuePerShare,
      pvFCFs,
      terminalValue,
      pvTerminalValue,
      enterpriseValue,
      equityValue,
      totalCash,
      totalDebt,
      assumptions,
    } = safeData

    const upside = calculateValuationSpread(currentPrice, intrinsicValuePerShare)
    const verdict = getValuationVerdict(currentPrice, intrinsicValuePerShare)
    const dcfRating = calculateDCFRating(upside)
    const marginOfSafety = calculateMarginOfSafety(intrinsicValuePerShare, currentPrice)

    const sensitivityTable = calculateSensitivity(
      intrinsicValuePerShare,
      currentPrice,
      [8, 9, 10, 11, 12],
      [1.5, 2.0, 2.5, 3.0, 3.5]
    )

    // Merge: spread originalData first so our computed values always override
    return {
      ...safeData.originalData,
      currentPrice,
      assumptions,
      projections: calculatedProjections,
      pvFCFs,
      terminalValue,
      pvTerminalValue,
      enterpriseValue,
      equityValue,
      intrinsicValuePerShare,
      totalCash,
      totalDebt,
      upside,
      spreadPercentage: upside,
      verdict,
      dcfRating,
      marginOfSafety,
      sensitivityTable,
    }
  }, [safeData, calculateSensitivity])

  const value = {
    data: dcfData,
    baseData: safeData,
    derivedData: dcfData,
    calculateSensitivity,
    isValid: !!dcfData?.projections?.length,
  }

  return <DCFContext.Provider value={value}>{children}</DCFContext.Provider>
}

export function useDCF() {
  const context = useContext(DCFContext)
  if (context === undefined) {
    throw new Error('useDCF must be used within a DCFProvider')
  }
  return context
}

export default DCFContext
