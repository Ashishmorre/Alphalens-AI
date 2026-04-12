'use client'

import { createContext, useContext, useMemo, useCallback } from 'react'
import {
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

export function DCFProvider({ children, initialData }) {
  // Derive all computed values from raw data
  const dcfData = useMemo(() => {
    if (!initialData) return null

    const d = initialData

    // Validate required data
    if (!d.projections || !Array.isArray(d.projections)) {
      return d
    }

    // Ensure all projections have correctly calculated FCF based on the formula:
    // FCF = NOPAT + D&A - CapEx - Change in NWC
    const projections = d.projections.map((p) => {
      const depreciation = (p.ebitda || 0) - (p.ebit || 0)
      const calculatedFCF = calculateFCF(p.nopat || 0, depreciation, p.capex || 0, p.nwcChange || 0)

      return {
        ...p,
        fcf: calculatedFCF, // Override any API-provided FCF with calculated value
        pvFCF: calculatePV(calculatedFCF, d.assumptions?.wacc || 10, p.year || 1),
      }
    })

    // Calculate summary values from projections (single source of truth)
    const pvFCFs = projections.reduce((sum, p) => sum + (p.pvFCF || 0), 0)

    // Get final year FCF for terminal value calculation
    const finalProjection = projections[projections.length - 1]
    const finalFCF = finalProjection?.fcf || 0

    const wacc = d.assumptions?.wacc || 10
    const terminalGrowthRate = d.assumptions?.terminalGrowthRate || 2.5
    const years = projections.length || 5

    const terminalValue = calculateTerminalValue(finalFCF, wacc, terminalGrowthRate)
    const pvTerminalValue = calculatePVTerminalValue(terminalValue, wacc, years)
    const enterpriseValue = calculateEnterpriseValue(pvFCFs, pvTerminalValue)

    // Use actual cash/debt from stock data if available
    const totalCash = d.totalCash || d.assumptions?.cash || 0
    const totalDebt = d.totalDebt || d.assumptions?.debt || 0

    const equityValue = calculateEquityValue(enterpriseValue, totalCash, totalDebt)

    const sharesOutstanding = d.sharesOutstanding || d.assumptions?.sharesOutstanding || 1
    const intrinsicValuePerShare = calculateIntrinsicValuePerShare(equityValue, sharesOutstanding)

    const currentPrice = d.currentPrice || 0

    // Always recalculate upside from raw prices
    const upside = calculateUpside(intrinsicValuePerShare, currentPrice)

    // Derive rating from calculated upside
    const dcfRating = calculateDCFRating(upside)

    const marginOfSafety = calculateMarginOfSafety(intrinsicValuePerShare, currentPrice)

    return {
      ...d,
      projections,
      pvFCFs,
      terminalValue,
      pvTerminalValue,
      enterpriseValue,
      equityValue,
      intrinsicValuePerShare,
      upside,
      dcfRating,
      marginOfSafety,
    }
  }, [initialData])

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
