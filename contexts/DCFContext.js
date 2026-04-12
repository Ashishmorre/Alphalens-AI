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
} from '@/lib/financial-utils'

/**
 * Generate default 5-year projections when API doesn't provide any
 * Uses conservative assumptions based on available stock data
 */
function generateDefaultProjections(stockData, wacc, terminalGrowthRate) {
  const baseRevenue = stockData?.revenue || 1000000000
  const taxRate = stockData?.assumptions?.taxRate || 21
  const revenueGrowthRates = stockData?.assumptions?.revenueGrowthRates || [10, 10, 10, 10, 10]
  const ebitdaMargins = stockData?.assumptions?.ebitdaMargins || [20, 20, 20, 20, 20]

  const projections = []

  for (let i = 0; i < 5; i++) {
    const year = i + 1
    const growthRate = revenueGrowthRates[i] || 10
    const ebitdaMargin = ebitdaMargins[i] || 20

    // Calculate values
    const revenue = baseRevenue * Math.pow(1 + growthRate / 100, year)
    const ebitda = calculateEBITDA(revenue, ebitdaMargin)

    // Estimate EBIT (typically 70-80% of EBITDA for mature companies)
    const ebit = ebitda * 0.75

    // Calculate NOPAT
    const nopat = calculateNOPAT(ebit, taxRate)

    // Estimate CapEx (typically 5-10% of revenue)
    const capex = -revenue * 0.08

    // Estimate NWC change (typically 2-4% of revenue change)
    const prevRevenue = i === 0 ? baseRevenue : projections[i - 1].revenue
    const nwcChange = (revenue - prevRevenue) * 0.03

    // Calculate FCF
    const depreciation = ebitda - ebit
    const fcf = calculateFCF(nopat, depreciation, capex, nwcChange)

    // Calculate PV of FCF
    const pvFCF = calculatePV(fcf, wacc, year)

    projections.push({
      year,
      revenue,
      ebitda,
      ebit,
      nopat,
      capex,
      nwcChange,
      fcf,
      pvFCF,
    })
  }

  return projections
}

const DCFContext = createContext(undefined)

/**
 * DCF Provider
 * Solves State Desync by deriving all values from raw API data once.
 * Both Summary Cards and Projections Table read from the same derived state.
 */
export function DCFProvider({ children, rawApiData }) {
  // 1. Calculate all DCF projections in JavaScript - hard decouple from AI
  const safeData = useMemo(() => {
    if (!rawApiData) return null

    const d = rawApiData

    // Extract base values with defaults
    const baseRevenue = d?.revenue || 1000000000
    const baseEbitda = d?.ebitda || 200000000
    const growthRate = 1.08 // 8% growth rate
    const wacc = d?.assumptions?.wacc || 10
    const terminalGrowthRate = d?.assumptions?.terminalGrowthRate || 2.5
    const taxRate = d?.assumptions?.taxRate || 21
    const sharesOutstanding = d?.sharesOutstanding || d?.assumptions?.sharesOutstanding || 1

    // Generate calculated projections for years 1-5
    const calculatedProjections = []
    for (let i = 0; i < 5; i++) {
      const year = i + 1

      // Revenue grows at 8% annually
      const revenue = baseRevenue * Math.pow(growthRate, year)

      // EBITDA margin based on base relationship
      const ebitdaMargin = baseEbitda / baseRevenue
      const ebitda = revenue * ebitdaMargin

      // EBIT is EBITDA minus depreciation (estimate 12% of EBITDA)
      const depreciation = ebitda * 0.12
      const ebit = ebitda - depreciation

      // NOPAT
      const nopat = calculateNOPAT(ebit, taxRate)

      // CapEx (estimate 8% of revenue)
      const capex = -revenue * 0.08

      // NWC change (estimate 3% of revenue change)
      const prevRevenue = i === 0 ? baseRevenue : calculatedProjections[i - 1].revenue
      const nwcChange = (revenue - prevRevenue) * 0.03

      // Free Cash Flow
      const fcf = calculateFCF(nopat, depreciation, capex, nwcChange)

      // Discount factor and PV of FCF
      const discountFactor = Math.pow(1 + wacc / 100, year)
      const pvFCF = calculatePV(fcf, wacc, year)

      calculatedProjections.push({
        year,
        revenue,
        ebitda,
        ebit,
        nopat,
        capex,
        nwcChange,
        fcf,
        discountFactor,
        pvFCF,
      })
    }

    // Calculate summary values
    const pvFCFs = calculatedProjections.reduce((sum, p) => sum + (p.pvFCF || 0), 0)
    const finalProjection = calculatedProjections[calculatedProjections.length - 1]
    const finalFCF = finalProjection?.fcf || 0

    // Terminal value calculations
    const terminalValue = calculateTerminalValue(finalFCF, wacc, terminalGrowthRate)
    const pvTerminalValue = calculatePVTerminalValue(terminalValue, wacc, 5)

    // Enterprise and equity value
    const enterpriseValue = calculateEnterpriseValue(pvFCFs, pvTerminalValue)
    const totalCash = d?.totalCash || d?.assumptions?.cash || 0
    const totalDebt = d?.totalDebt || d?.assumptions?.debt || 0
    const equityValue = calculateEquityValue(enterpriseValue, totalCash, totalDebt)
    const intrinsicValuePerShare = calculateIntrinsicValuePerShare(equityValue, sharesOutstanding)

    return {
      currentPrice: d?.currentPrice || 0,
      wacc,
      terminalGrowthRate,
      sharesOutstanding,
      currency: d?.ticker?.endsWith('.NS') || d?.ticker?.endsWith('.BO') ? 'INR' : 'USD',
      // Calculated projections from JavaScript DCF math
      calculatedProjections,
      // Calculated summary values
      pvFCFs,
      terminalValue,
      pvTerminalValue,
      enterpriseValue,
      equityValue,
      intrinsicValuePerShare,
      totalCash,
      totalDebt,
      // Original data for pass-through
      originalData: d,
    }
  }, [rawApiData])

  // Helper to recalculate sensitivity table - must be defined before use
  const calculateSensitivity = useCallback((baseIntrinsicValue, currentPrice, waccRange, tgrRange) => {
    if (!baseIntrinsicValue || !currentPrice || !waccRange || !tgrRange) {
      return null
    }

    const values = []

    for (const tgr of tgrRange) {
      const row = []
      for (const w of waccRange) {
        // Calculate adjusted intrinsic value based on WACC and TGR
        const waccAdjustment = (10 - w) * 0.05
        const tgrAdjustment = (tgr - 2.5) * 0.03
        const adjustedValue = baseIntrinsicValue * (1 + waccAdjustment + tgrAdjustment)
        row.push(Math.max(0, adjustedValue))
      }
      values.push(row)
    }

    return {
      waccRange,
      tgrRange,
      values,
    }
  }, [])

  // 2. Derive additional calculated values from safeData
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
    } = safeData

    // Always recalculate upside from raw prices using the fixed formula
    const upside = calculateValuationSpread(currentPrice, intrinsicValuePerShare)

    // Grab the corrected verdict and spread from our utility file
    const verdict = getValuationVerdict(currentPrice, intrinsicValuePerShare)

    // Derive rating from calculated upside
    const dcfRating = calculateDCFRating(upside)

    const marginOfSafety = calculateMarginOfSafety(intrinsicValuePerShare, currentPrice)

    // Calculate sensitivity table using the callback
    const sensitivityTable = calculateSensitivity(
      intrinsicValuePerShare,
      currentPrice,
      [8, 9, 10, 11, 12],
      [1.5, 2.0, 2.5, 3.0, 3.5]
    )

    return {
      ...safeData.originalData,
      // All DCF values calculated in JavaScript, not from AI
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
