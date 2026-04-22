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
  calculateDynamicWACC,
  calculateDynamicCapEx,
  calculateGrowthJCurve,
  calculateTerminalCapEx,
  calculateQualityPremium,
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

    // ── DCF Assumptions (Dynamic Assumption Engine) ─────────────────────────
    // Calculate dynamic WACC based on stock risk profile (not hardcoded 10%)
    const dynamicWACC = calculateDynamicWACC({
      beta: stockData?.beta || d?.beta || 1.0,
      pe: stockData?.pe || d?.pe,
      sector: stockData?.sector || d?.sector,
      baseRate: 4.5 // Risk-free rate
    })

    // Terminal Growth Rate: Market-aligned (not hardcoded 2.5%)
    // Higher P/E + High ROCE + sector tailwinds = higher TGR
    const basePE = stockData?.pe || d?.pe || 15
    const stockROCE = stockData?.roce || d?.roce || 0
    let dynamicTGR = 2.5

    // Dynamic TGR: If PE > 25 OR ROCE > 50%, use 5.8% - 6.2% (growth premium)
    if (basePE > 30 || stockROCE > 50) {
      dynamicTGR = 6.0
    } else if (basePE > 25 || stockROCE > 35) {
      dynamicTGR = 5.8
    } else if (basePE > 20) {
      dynamicTGR = 4.5
    } else if (basePE > 15) {
      dynamicTGR = 3.5
    } else if (basePE > 10) {
      dynamicTGR = 3.0
    } else {
      dynamicTGR = 2.5
    }

    // Sector premium for utilities and renewables
    const sector = (stockData?.sector || d?.sector || '').toLowerCase()
    if (sector.includes('utility') || sector.includes('renewable')) {
      dynamicTGR = Math.min(6.0, dynamicTGR + 0.4) // Infrastructure tailwind (slightly reduced)
    }

    const wacc = d?.assumptions?.wacc || dynamicWACC
    const terminalGrowthRate = d?.assumptions?.terminalGrowthRate || dynamicTGR
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
    // ALWAYS build from scratch using Yahoo ground-truth baseRevenue (absolute numbers).
    // AI projections are intentionally IGNORED: the AI prompt outputs currencies in MILLIONS
    // but sharesOutstanding from Yahoo is ABSOLUTE — division causes near-zero intrinsic value.
    // Building from baseRevenue guarantees units are consistent throughout the entire pipeline.
    let calculatedProjections = []

    const revenueGrowth0 = revenueGrowthRates[0] || 10
    const capexRate = calculateDynamicCapEx({
      revenueGrowth: revenueGrowth0,
      sector: stockData?.sector || d?.sector,
      capexIntensity: stockData?.capexToRevenue || d?.capexToRevenue
    })

    const baseFCF = baseEbitda * 0.6
    const { fcfMultipliers, revenueGrowthMultipliers, ebitdaMarginMultipliers } = calculateGrowthJCurve({
      baseFCF,
      growthRate: terminalGrowthRate,
      efficiencyMultiplier: 1.5
    })

    for (let i = 0; i < 5; i++) {
      const year = i + 1
      const baseGrowthRate   = revenueGrowthRates[i] || 10
      const baseEbitdaMargin = ebitdaMargins[i] || 20

      const jCurveGrowthRate   = baseGrowthRate   * revenueGrowthMultipliers[i]
      const jCurveEbitdaMargin = baseEbitdaMargin * ebitdaMarginMultipliers[i]

      const revenue      = baseRevenue * Math.pow(1 + jCurveGrowthRate / 100, year)
      const ebitda       = calculateEBITDA(revenue, jCurveEbitdaMargin)
      const depreciation = ebitda * 0.12
      const ebit         = ebitda - depreciation
      const nopat        = calculateNOPAT(ebit, taxRate)

      const capexAdjustment = i < 2 ? 1.3 : (i === 2 ? 1.0 : 0.8)
      let capex = -(revenue * capexRate * capexAdjustment)

      const prevRevenue = i === 0 ? baseRevenue : calculatedProjections[i - 1].revenue
      const nwcChange   = (revenue - prevRevenue) * 0.03

      if (i === 4) {
        const convergedCapEx = calculateTerminalCapEx(depreciation, Math.abs(capex), 0.9)
        capex = -convergedCapEx
      }

      const baseFcfYear = calculateFCF(nopat, depreciation, capex, nwcChange)
      const fcf   = baseFcfYear * fcfMultipliers[i]
      const pvFCF = calculatePV(fcf, wacc, year)

      calculatedProjections.push({ year, revenue, ebitda, ebit, nopat, capex, nwcChange, fcf, pvFCF })
    }

    // ── Valuation math ────────────────────────────────────────────────────────
    // STRICT ANCHOR LOGIC: Always derive from calculated base, never trust AI-derived values
    const pvFCFs = calculatedProjections.reduce((sum, p) => sum + (p.pvFCF || 0), 0)
    const finalFCF = calculatedProjections[calculatedProjections.length - 1]?.fcf || 0

    // ANCHOR 1: Calculate Enterprise Value from scratch using PV of FCFs + PV of Terminal Value
    // Exit Multiple Anchor: Use max of Gordon Growth or 16x-22x EBITDA (quality-based)
    const finalEBITDA = calculatedProjections[calculatedProjections.length - 1]?.ebitda || 0
    const qualityScore = (stockData?.roe || d?.roe || 0) + (stockData?.roce || d?.roce || 0)
    const terminalValue = calculateTerminalValue(finalFCF, wacc, terminalGrowthRate, finalEBITDA, qualityScore)
    const pvTerminalValue = calculatePVTerminalValue(terminalValue, wacc, 5)
    const enterpriseValue = calculateEnterpriseValue(pvFCFs, pvTerminalValue)

    // ANCHOR 2: Normalize cash/debt to absolute numbers (handles "2.5B", "2500M", etc.)
    const totalCash = normalizeToAbsolute(stockData?.totalCash || d?.totalCash || d?.assumptions?.cash)
    const totalDebt = normalizeToAbsolute(stockData?.totalDebt || d?.totalDebt || d?.assumptions?.debt)
    const marketCap = stockData?.marketCap || d?.marketCap || currentPrice * sharesOutstanding

    // ANCHOR 3: ALWAYS re-derive equityValue from enterpriseValue anchor
    // NEVER use d.equityValue from AI (it may be incorrect)
    // Include SOTP buffer for utilities (infrastructure value not in cash flows)
    // 'sector' already defined at line 78 (lowercased for TGR calculation)
    const equityValue = calculateEquityValue(enterpriseValue, totalCash, totalDebt, marketCap, sector)

    // Quality Premium: High ROE/ROCE companies get scarcity premium (Oswal Pumps effect)
    const rawIntrinsicValue = calculateIntrinsicValuePerShare(equityValue, sharesOutstanding)
    const stockROE = stockData?.roe || d?.roe
    // stockROCE already defined at line 70 (used for TGR calculation)
    const intrinsicValuePerShare = calculateQualityPremium({
      intrinsicValue: rawIntrinsicValue,
      roe: stockROE,
      roce: stockROCE,
    })

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
    // STRICT ANCHOR: Explicitly exclude raw AI-derived values that should be recalculated
    // This prevents accidentally using d.equityValue, d.enterpriseValue from AI if present
    const { enterpriseValue: _rawEV, equityValue: _rawEqV, intrinsicValuePerShare: _rawIV, ...safeOriginalData } = safeData.originalData || {}

    return {
      ...safeOriginalData,
      currentPrice,
      assumptions,
      projections: calculatedProjections,
      pvFCFs,
      terminalValue,
      pvTerminalValue,
      enterpriseValue,        // ANCHOR: Our calculated value (not AI's)
      equityValue,              // ANCHOR: Our calculated value (not AI's)
      intrinsicValuePerShare,   // ANCHOR: Our calculated value (not AI's)
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
