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

    // Validate required data
    if (!projectedCashFlows.length) {
      return safeData.originalData
    }

    // Ensure all projections have correctly calculated FCF based on the formula:
    // FCF = NOPAT + D&A - CapEx - Change in NWC
    const projections = projectedCashFlows.map((p) => {
      const depreciation = (p.ebitda || 0) - (p.ebit || 0)
      const calculatedFCF = calculateFCF(p.nopat || 0, depreciation, p.capex || 0, p.nwcChange || 0)

      return {
        ...p,
        fcf: calculatedFCF, // Override any API-provided FCF with calculated value
        pvFCF: calculatePV(calculatedFCF, wacc, p.year || 1),
      }
    })

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
    }
  }, [safeData])

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
