/**
 * Data Validation Layer
 * Prevents garbage data from entering DCF calculations
 * Rules: Range validation, outlier detection, consistency checks
 */

import { logValidationIssue } from '@/lib/db/client'

// ============================================================================
// VALIDATION RULES CONFIGURATION
// ============================================================================

const VALIDATION_RULES = {
  // Revenue must be positive and reasonable
  revenue: {
    required: true,
    min: 1000000,        // 1M minimum (stk screeners can have tiny "test" entries)
    max: 500000000000000, // 500T (largest companies)
    maxMultipleOfMarketCap: 10, // Revenue shouldn't exceed 10x market cap
    message: 'Revenue must be positive and within reasonable range'
  },

  // EBITDA range
  ebitda: {
    required: true,
    min: -500000000000,  // Allow negative for startups
    max: 50000000000000, // 50T max
    rangeOfRevenue: { min: -50, max: 80 }, // -50% to 80% of revenue
    message: 'EBITDA must be within reasonable range relative to revenue'
  },

  // Debt must be non-negative
  totalDebt: {
    min: 0,
    max: 50000000000000,
    rangeOfMarketCap: { max: 10 }, // Debt shouldn't exceed 10x market cap
    message: 'Total debt must be non-negative and within reasonable range'
  },

  // Cash must be non-negative
  totalCash: {
    min: 0,
    max: 50000000000000,
    message: 'Cash must be non-negative'
  },

  // Beta validation
  beta: {
    required: true,
    min: 0.1,
    max: 3.5,            // Cap at 3.5 (extremely volatile)
    sectorAdjust: true,   // Different sectors have different beta norms
    message: 'Beta must be between 0.1 and 3.5'
  },

  // P/E ratio
  pe: {
    min: 0.5,
    max: 200,            // Cap at 200 (extreme growth stocks)
    message: 'P/E ratio seems unusual'
  },

  // Margins
  grossMargin: {
    min: -100,
    max: 100,
    message: 'Gross margin must be between -100% and 100%'
  },

  operatingMargin: {
    min: -100,
    max: 100,
    maxOfGross: 1.0,     // Operating margin shouldn't exceed gross margin
    message: 'Operating margin must be valid percentage'
  },

  profitMargin: {
    min: -100,
    max: 100,
    maxOfOperating: 1.0, // Net margin shouldn't exceed operating margin
    message: 'Profit margin must be valid percentage'
  },

  // Shares outstanding
  sharesOutstanding: {
    required: true,
    min: 100000,         // Minimum 100k shares
    max: 10000000000000, // 10T shares (largest companies)
    message: 'Shares outstanding seems invalid'
  },

  // Market Cap
  marketCap: {
    required: true,
    min: 10000000,       // 10M minimum
    max: 500000000000000, // 500T (Apple/Saudi Aramco level)
    message: 'Market cap seems invalid'
  },

  // ROE
  roe: {
    min: -500,
    max: 500,            // Even 500% is extreme but possible
    message: 'ROE seems unusual'
  },

  // ROCE
  roce: {
    min: -200,
    max: 200,
    message: 'ROCE seems unusual'
  },

  // Revenue growth
  revenueGrowth: {
    min: -100,
    max: 2000,           // Cap at 2000% growth
    message: 'Revenue growth rate seems unusual'
  }
}

// ============================================================================
// VALIDATION SEVERITY LEVELS
// ============================================================================

export const Severity = {
  ERROR: 'ERROR',   // Data rejected
  WARN: 'WARN',     // Data accepted but flagged
  INFO: 'INFO',     // Notification only
  PASS: 'PASS'      // All good
}

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

/**
 * Validate stock data before DCF calculation
 * Returns: { isValid, errors, warnings, cleanData }
 */
export async function validateStockData(ticker, data) {
  const issues = []
  const warnings = []
  const errors = []
  const cleanData = { ...data }

  // Check each field
  for (const [field, rules] of Object.entries(VALIDATION_RULES)) {
    const value = data[field]
    const result = validateField(field, value, rules, data)

    if (result.severity === Severity.ERROR) {
      errors.push(result)
      issues.push(result)
    } else if (result.severity === Severity.WARN) {
      warnings.push(result)
      issues.push(result)
    }

    // Apply corrections for fixable issues
    if (result.corrected !== undefined) {
      cleanData[field] = result.corrected
    }
  }

  // Cross-field validations
  const crossFieldResults = validateCrossFields(cleanData)
  for (const result of crossFieldResults) {
    if (result.severity === Severity.ERROR) {
      errors.push(result)
      issues.push(result)
    } else if (result.severity === Severity.WARN) {
      warnings.push(result)
      issues.push(result)
    }
  }

  // Log all issues
  for (const issue of issues) {
    await logValidationIssue(ticker, issue)
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    dataQuality: calculateDataQuality(issues),
    cleanData
  }
}

/**
 * Validate a single field
 */
function validateField(field, value, rules, allData) {
  // Required check
  if (rules.required && (value === null || value === undefined || value === '')) {
    return {
      field,
      value,
      severity: Severity.ERROR,
      rule: 'required',
      message: `${field} is required but missing`,
    }
  }

  // Skip further checks if value is missing and not required
  if (value === null || value === undefined) {
    return { field, value, severity: Severity.PASS }
  }

  const numValue = Number(value)
  if (isNaN(numValue)) {
    return {
      field,
      value,
      severity: Severity.ERROR,
      rule: 'numeric',
      message: `${field} must be a number, got: ${value}`,
    }
  }

  // Min/max range check
  if (rules.min !== undefined && numValue < rules.min) {
    return {
      field,
      value: numValue,
      severity: Severity.ERROR,
      rule: 'min',
      threshold: rules.min,
      actual: numValue,
      message: `${field} (${numValue}) below minimum (${rules.min})`,
      corrected: numValue < 0 && rules.min >= 0 ? 0 : rules.min
    }
  }

  if (rules.max !== undefined && numValue > rules.max) {
    // Cap outliers at WARN level to allow them through
    return {
      field,
      value: numValue,
      severity: Severity.WARN,
      rule: 'max',
      threshold: rules.max,
      actual: numValue,
      message: `${field} (${numValue}) exceeds maximum (${rules.max}) - potential outlier`,
      corrected: rules.max
    }
  }

  // Revenue range relative to market cap
  if (field === 'revenue' && rules.maxMultipleOfMarketCap) {
    const marketCap = allData.marketCap
    if (marketCap && marketCap > 0) {
      const ratio = numValue / marketCap
      if (ratio > rules.maxMultipleOfMarketCap) {
        return {
          field,
          value: numValue,
          severity: Severity.ERROR,
          rule: 'maxMultipleOfMarketCap',
          threshold: rules.maxMultipleOfMarketCap,
          actual: ratio,
          message: `Revenue is ${ratio.toFixed(1)}x market cap - likely data error`,
        }
      }
    }
  }

  // EBITDA range relative to revenue
  if (field === 'ebitda' && rules.rangeOfRevenue && allData.revenue) {
    const margin = (numValue / allData.revenue) * 100
    if (margin < rules.rangeOfRevenue.min || margin > rules.rangeOfRevenue.max) {
      return {
        field,
        value: numValue,
        severity: Severity.WARN,
        rule: 'rangeOfRevenue',
        threshold: `${rules.rangeOfRevenue.min}% to ${rules.rangeOfRevenue.max}%`,
        actual: `${margin.toFixed(1)}%`,
        message: `EBITDA margin (${margin.toFixed(1)}%) outside normal range`,
      }
    }
  }

  // Beta sector adjustment warning
  if (field === 'beta' && rules.sectorAdjust) {
    const sector = (allData.sector || '').toLowerCase()
    const expectedRange = getExpectedBetaRange(sector)
    if (numValue < expectedRange.min || numValue > expectedRange.max) {
      return {
        field,
        value: numValue,
        severity: Severity.WARN,
        rule: 'sectorBetaRange',
        threshold: `${expectedRange.min}-${expectedRange.max}`,
        actual: numValue,
        message: `Beta ${numValue} outside typical range for ${sector || 'this sector'}`,
      }
    }
  }

  return { field, value: numValue, severity: Severity.PASS }
}

/**
 * Cross-field validation
 */
function validateCrossFields(data) {
  const results = []

  // Revenue vs EBITDA consistency
  if (data.revenue > 0 && data.ebitda) {
    const ebitdaMargin = (data.ebitda / data.revenue) * 100
    if (ebitdaMargin > 80) {
      results.push({
        field: 'ebitda/revenue',
        severity: Severity.WARN,
        rule: 'marginConsistency',
        message: `EBITDA margin (${ebitdaMargin.toFixed(1)}%) unusually high`,
      })
    }
  }

  // P/E vs ROE consistency
  if (data.pe > 0 && data.roe) {
    // High P/E should generally correlate with high ROE
    if (data.pe > 50 && data.roe < 10) {
      results.push({
        field: 'pe/roe',
        severity: Severity.WARN,
        rule: 'peRoeMismatch',
        message: `High P/E (${data.pe.toFixed(1)}x) with low ROE (${data.roe.toFixed(1)}%) - verify data`,
      })
    }
  }

  // Debt vs Market Cap
  if (data.totalDebt > 0 && data.marketCap > 0) {
    const debtRatio = data.totalDebt / data.marketCap
    if (debtRatio > 5) {
      results.push({
        field: 'debt/marketCap',
        severity: Severity.WARN,
        rule: 'highLeverage',
        message: `Debt is ${debtRatio.toFixed(1)}x market cap - check if distressed`,
      })
    }
  }

  // Beta vs Sector
  if (data.beta > 2 && data.sector) {
    const defensiveSectors = ['utilities', 'power', 'consumer', 'fmcg']
    const isDefensive = defensiveSectors.some(s =>
      data.sector.toLowerCase().includes(s)
    )
    if (isDefensive) {
      results.push({
        field: 'beta/sector',
        severity: Severity.WARN,
        rule: 'betaSectorMismatch',
        message: `High beta (${data.beta}) for defensive sector (${data.sector})`,
      })
    }
  }

  return results
}

/**
 * Get expected beta range by sector
 */
function getExpectedBetaRange(sector) {
  const ranges = {
    'utilities': { min: 0.3, max: 0.8 },
    'power': { min: 0.4, max: 0.9 },
    'consumer': { min: 0.5, max: 0.9 },
    'fmcg': { min: 0.5, max: 0.9 },
    'pharma': { min: 0.6, max: 1.0 },
    'healthcare': { min: 0.6, max: 1.0 },
    'technology': { min: 1.0, max: 1.5 },
    'software': { min: 1.0, max: 1.5 },
    'financial': { min: 0.8, max: 1.3 },
    'bank': { min: 0.8, max: 1.3 },
    'real estate': { min: 0.9, max: 1.4 },
    'energy': { min: 0.8, max: 1.4 },
    'oil': { min: 0.8, max: 1.4 },
    'mining': { min: 1.0, max: 1.6 },
    'default': { min: 0.5, max: 1.8 },
  }

  const lower = (sector || '').toLowerCase()
  for (const [key, range] of Object.entries(ranges)) {
    if (lower.includes(key)) return range
  }
  return ranges.default
}

/**
 * Calculate data quality score (0-100)
 */
function calculateDataQuality(issues) {
  const errors = issues.filter(i => i.severity === Severity.ERROR).length
  const warnings = issues.filter(i => i.severity === Severity.WARN).length

  // Base score
  let score = 100

  // Deduct for errors (heavier penalty)
  score -= errors * 20

  // Deduct for warnings
  score -= warnings * 5

  // Bonus for having key fields
  const keyFields = ['revenue', 'ebitda', 'marketCap', 'sharesOutstanding']
  const present = keyFields.filter(f => issues.every(i => i.field !== f || i.severity === Severity.PASS)).length
  score += present * 5

  return Math.max(0, Math.min(100, score))
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Quick check if data is usable
 */
export function isDataUsable(validationResult) {
  return validationResult.isValid && validationResult.dataQuality >= 50
}

/**
 * Get validation summary for display
 */
export function getValidationSummary(validationResult) {
  return {
    quality: validationResult.dataQuality,
    status: validationResult.isValid ? 'PASS' : 'FAIL',
    errorCount: validationResult.errors.length,
    warningCount: validationResult.warnings.length,
    criticalIssues: validationResult.errors.map(e => e.message),
    suggestions: validationResult.warnings.map(w => w.message),
  }
}

/**
 * Sanitize input before validation
 * Removes suspicious values
 */
export function sanitizeInput(data) {
  const clean = { ...data }

  // Remove obvious test values
  const suspicious = [0, -1, 999999999999, -999999999999]
  for (const [key, value] of Object.entries(clean)) {
    if (suspicious.includes(value)) {
      delete clean[key]
    }
  }

  // Convert strings to numbers where possible
  for (const key of Object.keys(clean)) {
    if (typeof clean[key] === 'string' && !isNaN(clean[key])) {
      clean[key] = Number(clean[key])
    }
  }

  return clean
}