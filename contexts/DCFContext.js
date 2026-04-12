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
  // 1. Sanitize incoming API data (The Single Source of Truth)
  const safeData = useMemo(() => {
    if (!rawApiData) return null

    const d = rawApiData

    return {
      currentPrice: d?.currentPrice || 0,
      wacc: d?.assumptions?.wacc || 10,
      terminalGrowthRate: d?.assumptions?.terminalGrowthRate || 2.5,
      sharesOutstanding: d?.sharesOutstanding || d?.assumptions?.sharesOutstanding || 1,
      currency: d?.ticker?.endsWith('.NS') || d?.ticker?.endsWith('.BO') ? 'INR' : 'USD',
      // Ensure cashflows are an array to prevent .map() crashes
      projectedCashFlows: Array.isArray(d?.projections) ? d.projections : [],
      // Original data for pass-through
      originalData: d,
    }
  }, [rawApiData])

  // 2. Derive the complex math exactly once here, NOT in individual components
  const dcfData = useMemo(() => {
    if (!safeData) return null

    const { projectedCashFlows, wacc, terminalGrowthRate, currentPrice, sharesOutstanding } = safeData

    // If no projections from API, create default projections based on stock data
    const projections = projectedCashFlows.length > 0
      ? projectedCashFlows.map((p) => {
          const depreciation = (p.ebitda || 0) - (p.ebit || 0)
          const calculatedFCF = calculateFCF(p.nopat || 0, depreciation, p.capex || 0, p.nwcChange || 0)

          return {
            ...p,
            fcf: calculatedFCF, // Override any API-provided FCF with calculated value
            pvFCF: calculatePV(calculatedFCF, wacc, p.year || 1),
          }
        })
      : generateDefaultProjections(safeData.originalData, wacc, terminalGrowthRate)

    // Calculate summary values from projections (single source of truth)
    const pvFCFs = projections.reduce((sum, p) => sum + (p.pvFCF || 0), 0)

    // Get final year FCF for terminal value calculation
    const finalProjection = projections[projections.length - 1]
    const finalFCF = finalProjection?.fcf || 0

    const years = projections.length || 5

    const terminalValue = calculateTerminalValue(finalFCF, wacc, terminalGrowthRate)
    const pvTerminalValue = calculatePVTerminalValue(terminalValue, wacc, years)
    const enterpriseValue = calculateEnterpriseValue(pvFCFs, pvTerminalValue)

    // Use actual cash/debt from stock data if available
    const totalCash = safeData.originalData?.totalCash || safeData.originalData?.assumptions?.cash || 0
    const totalDebt = safeData.originalData?.totalDebt || safeData.originalData?.assumptions?.debt || 0

    const equityValue = calculateEquityValue(enterpriseValue, totalCash, totalDebt)

    const intrinsicValuePerShare = calculateIntrinsicValuePerShare(equityValue, sharesOutstanding)

    // Always recalculate upside from raw prices using the fixed formula
    const upside = calculateValuationSpread(currentPrice, intrinsicValuePerShare)

    // Grab the corrected verdict and spread from our utility file
    const verdict = getValuationVerdict(currentPrice, intrinsicValuePerShare)

    // Derive rating from calculated upside
    const dcfRating = calculateDCFRating(upside)

    const marginOfSafety = calculateMarginOfSafety(intrinsicValuePerShare, currentPrice)

    // Generate sensitivity table if not provided by API
    const sensitivityTable = safeData.originalData?.sensitivityTable ||
      calculateSensitivity(intrinsicValuePerShare, currentPrice, [8, 9, 10, 11, 12], [1.5, 2.0, 2.5, 3.0, 3.5])

    return {
      ...safeData.originalData,
      projections,
      pvFCFs,
      terminalValue,
      pvTerminalValue,
      enterpriseValue,
      equityValue,
      intrinsicValuePerShare,
      upside,
      spreadPercentage: upside,
      verdict,
      dcfRating,
      marginOfSafety,
      sensitivityTable,
    }
  }, [safeData, calculateSensitivity])

  // Helper to recalculate sensitivity table
  const calculateSensitivity = useCallback((baseIntrinsicValue, currentPrice, waccRange, tgrRange) => {
    if (!baseIntrinsicValue || !currentPrice || !waccRange || !tgrRange) {
      return null
    }

    const values = []

    for (const tgr of tgrRange) {
      const row = []
      for (const wacc of waccRange) {
        // Calculate adjusted intrinsic value based on WACC and TGR
        const waccAdjustment = (10 - wacc) * 0.05
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
