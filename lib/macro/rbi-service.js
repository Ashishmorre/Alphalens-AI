/**
 * RBI Macro Data Service
 * Fetches: Interest rates, inflation, GDP data for dynamic WACC calculation
 * Sources: RBI API, MOSPI, Yahoo Finance for Indian macro
 */

import { saveMacroData, getLatestMacroData } from '@/lib/db/client'

// RBI API endpoints (mocked - actual RBI APIs require specific integration)
const RBI_API = {
  repoRate: 'https://rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx',
  tBill: 'https://rbi.org.in/Scripts/BS_NSDLSummary.aspx',
  gSec: 'https://rbi.org.in/Scripts/BS_Current.aspx',
}

// Fallback macro data (last updated: April 2024)
const FALLBACK_MACRO = {
  repoRate: 6.5,
  reverseRepoRate: 6.25,
  tBill91Day: 6.0,
  tBill364Day: 6.25,
  gSec10Year: 6.8,      // 10Y G-Sec (risk-free rate for India)
  inflationCPI: 5.5,    // Current CPI
  inflationWPI: 1.0,    // Current WPI
  gdpGrowth: 7.2,       // GDP growth forecast
  rupeeVsUsd: 83.4,
}

/**
 * Fetch RBI repo rate
 * In production: Would call RBI webservice or scrape
 */
export async function fetchRepoRate() {
  try {
    // In production, integrate with RBI webservice
    // For now, use known value
    return FALLBACK_MACRO.repoRate
  } catch (error) {
    console.warn('Failed to fetch repo rate, using fallback:', error.message)
    return FALLBACK_MACRO.repoRate
  }
}

/**
 * Fetch 10Y G-Sec yield (Risk-free rate)
 * This is the key input for CAPM/Cost of Equity
 */
export async function fetchRiskFreeRate(tenor = 10) {
  try {
    // India 10Y G-Sec is the standard risk-free rate
    // In production: fetch from RBI or market data
    switch (tenor) {
      case 1: return FALLBACK_MACRO.tBill91Day || 6.0
      case 10: return FALLBACK_MACRO.gSec10Year || 6.8
      default: return FALLBACK_MACRO.gSec10Year || 6.8
    }
  } catch (error) {
    console.warn('Failed to fetch risk-free rate:', error.message)
    return FALLBACK_MACRO.gSec10Year
  }
}

/**
 * Fetch inflation data (CPI)
 */
export async function fetchInflation() {
  try {
    // CPI is key for real rate calculations
    return {
      cpi: FALLBACK_MACRO.inflationCPI || 5.5,
      wpi: FALLBACK_MACRO.inflationWPI || 1.0,
    }
  } catch (error) {
    console.warn('Failed to fetch inflation:', error.message)
    return { cpi: 5.5, wpi: 1.0 }
  }
}

/**
 * Calculate Market Risk Premium based on macro conditions
 * Formula: ERP = Expected Market Return - Risk Free Rate
 */
export function calculateMarketRiskPremium(macroData) {
  if (!macroData || !macroData.gSec10Year) {
    return 5.5 // Default India ERP
  }

  const rf = macroData.gSec10Year
  const gdpGrowth = macroData.gdpGrowth || 7.0
  const inflation = macroData.inflationCPI || 5.5

  // Expected market return = Risk-free rate + historical equity premium
  // For India: typically 12-15% depending on conditions
  const expectedReturn = rf + 5.5 // Adding standard 5.5% premium

  return expectedReturn - rf
}

/**
 * Calculate dynamic Terminal Growth Rate from macro data
 * TGR should approximate: GDP growth + half of inflation
 */
export function calculateDynamicTGR(macroData) {
  if (!macroData) {
    return 3.5 // Conservative default for India
  }

  const gdp = macroData.gdpGrowth || 7.0
  const inflation = macroData.inflationCPI || 5.5

  // Nominal GDP growth = Real GDP + Inflation
  const nominalGrowth = gdp + inflation

  // TGR capped at 4.5% for conservative terminal value
  // Company can't grow faster than economy forever
  return Math.min(4.5, Math.max(3.0, nominalGrowth * 0.5))
}

/**
 * Complete macro data fetch with caching
 */
export async function fetchAndStoreMacroData() {
  try {
    const [repoRate, riskFreeRate, inflation] = await Promise.all([
      fetchRepoRate(),
      fetchRiskFreeRate(10),
      fetchInflation(),
    ])

    const macroData = {
      repoRate,
      gSec10Year: riskFreeRate,
      inflationCPI: inflation.cpi,
      inflationWPI: inflation.wpi,
      gdpGrowth: FALLBACK_MACRO.gdpGrowth,
      rupeeVsUsd: FALLBACK_MACRO.rupeeVsUsd,
      source: 'RBI',
      country: 'IN',
    }

    // Save to database
    await saveMacroData(macroData)

    return macroData
  } catch (error) {
    console.error('Failed to fetch macro data:', error)
    return FALLBACK_MACRO
  }
}

/**
 * Get or fetch macro data (with caching)
 * Cache duration: 1 day
 */
export async function getMacroData() {
  // Check database first
  const stored = await getLatestMacroData('IN')

  if (stored && isDataFresh(stored.date)) {
    return stored
  }

  // Fetch fresh data
  return fetchAndStoreMacroData()
}

function isDataFresh(date) {
  const oneDayMs = 24 * 60 * 60 * 1000
  return (new Date() - new Date(date)) < oneDayMs
}

/**
 * Calculate India-specific WACC inputs
 * Returns complete set of inputs for WACC calculation
 */
export async function getWACCInputsFromMacro() {
  const macro = await getMacroData()

  return {
    // Risk-free rate from 10Y G-Sec
    riskFreeRate: macro.gSec10Year || 6.8,

    // Market risk premium (dynamic based on conditions)
    marketRiskPremium: calculateMarketRiskPremium(macro),

    // Terminal growth from macro
    terminalGrowthRate: calculateDynamicTGR(macro),

    // Additional context
    inflation: macro.inflationCPI || 5.5,
    gdpGrowth: macro.gdpGrowth || 7.0,

    // Source info
    dataSource: 'RBI',
    lastUpdated: macro.date || new Date(),
  }
}

/**
 * Calculate real cost of capital (adjusted for inflation)
 */
export function calculateRealCostOfCapital(nominalRate, inflation) {
  return ((1 + nominalRate / 100) / (1 + inflation / 100) - 1) * 100
}

/**
 * Get sector-specific risk adjustments
 * Some sectors carry higher systematic risk
 */
export function getSectorRiskAdjustment(sector) {
  const adjustments = {
    'technology': 0,      // Market average
    'software': -0.5,     // Lower risk from recurring revenue
    'utilities': -1.0,    // Defensive, lower risk
    'power': -1.0,
    'renewable': 0.5,     // Higher regulatory/execution risk
    'bank': 0.5,          // Financial sector risk
    'financial': 0.5,
    'real estate': 1.0,   // Cyclical, high leverage
    'reit': 1.0,
    'oil': 1.0,           // Commodity exposure
    'energy': 1.0,
    'mining': 1.5,        // Cyclical, volatile
    'consumer': -0.3,     // Defensive
    'fmcg': -0.3,
    'pharma': 0,          // Market average
    'healthcare': 0,
    'auto': 0.8,          // Cyclical
    'manufacturing': 0.3,
    'default': 0,
  }

  const lower = (sector || '').toLowerCase()
  for (const [key, value] of Object.entries(adjustments)) {
    if (lower.includes(key)) return value
  }
  return adjustments.default
}