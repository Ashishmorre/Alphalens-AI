import {
  calculateUpside,
  calculateDCFRating,
  calculateFCF,
  calculateEBITDA,
  calculateNOPAT,
  calculatePV,
  calculateTerminalValue,
  calculateEnterpriseValue,
  calculateEquityValue,
  calculateIntrinsicValuePerShare,
  calculateMarginOfSafety,
  getRatingColor,
  getSensitivityClass,
  formatMagnitude,
} from '@/lib/financial-utils'

describe('Financial Utilities', () => {
  describe('calculateUpside', () => {
    it('should calculate correct upside when intrinsic > current', () => {
      // Example: IV = 125.50, CP = 100.00
      // Expected: ((125.50 - 100) / 100) * 100 = 25.5%
      const result = calculateUpside(125.5, 100)
      expect(result).toBeCloseTo(25.5, 1)
    })

    it('should calculate correct downside when intrinsic < current', () => {
      // Example: IV = 125.50, CP = 399.35
      // Expected: ((125.50 - 399.35) / 399.35) * 100 = -68.5%
      const result = calculateUpside(125.5, 399.35)
      expect(result).toBeCloseTo(-68.57, 2)
    })

    it('should return 0 when current price is 0', () => {
      const result = calculateUpside(100, 0)
      expect(result).toBe(0)
    })

    it('should return 0 when inputs are null/undefined', () => {
      expect(calculateUpside(null, 100)).toBe(0)
      expect(calculateUpside(100, null)).toBe(0)
      expect(calculateUpside(undefined, 100)).toBe(0)
    })

    it('should return 0% when intrinsic equals current price', () => {
      const result = calculateUpside(100, 100)
      expect(result).toBe(0)
    })
  })

  describe('calculateDCFRating', () => {
    it('should return UNDERVALUED when upside > 10%', () => {
      expect(calculateDCFRating(15)).toBe('UNDERVALUED')
      expect(calculateDCFRating(10.1)).toBe('UNDERVALUED')
    })

    it('should return OVERVALUED when upside < -10%', () => {
      expect(calculateDCFRating(-15)).toBe('OVERVALUED')
      expect(calculateDCFRating(-10.1)).toBe('OVERVALUED')
    })

    it('should return NEUTRAL when upside is between -10% and 10%', () => {
      expect(calculateDCFRating(0)).toBe('NEUTRAL')
      expect(calculateDCFRating(5)).toBe('NEUTRAL')
      expect(calculateDCFRating(-5)).toBe('NEUTRAL')
      expect(calculateDCFRating(10)).toBe('NEUTRAL')
      expect(calculateDCFRating(-10)).toBe('NEUTRAL')
    })
  })

  describe('calculateFCF', () => {
    it('should calculate FCF correctly: NOPAT + D&A - CapEx - NWC Change', () => {
      // Example: NOPAT = 100, D&A = 20, CapEx = -30, NWC Change = 5
      // Expected: 100 + 20 - 30 - 5 = 85
      const result = calculateFCF(100, 20, -30, 5)
      expect(result).toBe(85)
    })

    it('should handle positive CapEx values by taking absolute value', () => {
      // Example with positive CapEx: 100 + 20 - 30 - 5 = 85
      const result = calculateFCF(100, 20, 30, 5)
      expect(result).toBe(85)
    })

    it('should handle missing/undefined values', () => {
      expect(calculateFCF(100, undefined, undefined, undefined)).toBe(100)
      expect(calculateFCF(undefined, 20, 30, 5)).toBe(-15)
    })

    it('should match real-world example from TATAPOWER', () => {
      // TATAPOWER example values in absolute
      const nopat = 8000000000 // 8B
      const dna = 2000000000 // 2B D&A
      const capex = -3000000000 // 3B CapEx
      const nwcChange = 500000000 // 500M NWC change
      const result = calculateFCF(nopat, dna, capex, nwcChange)
      expect(result).toBe(6500000000) // 6.5B FCF
    })
  })

  describe('calculateEBITDA', () => {
    it('should calculate EBITDA: Revenue * (Margin / 100)', () => {
      // Revenue = 1000, Margin = 20%
      // Expected: 1000 * 0.20 = 200
      const result = calculateEBITDA(1000, 20)
      expect(result).toBe(200)
    })

    it('should return 0 for invalid inputs', () => {
      expect(calculateEBITDA(null, 20)).toBe(0)
      expect(calculateEBITDA(1000, null)).toBe(0)
    })
  })

  describe('calculateNOPAT', () => {
    it('should calculate NOPAT: EBIT * (1 - Tax Rate / 100)', () => {
      // EBIT = 1000, Tax Rate = 21%
      // Expected: 1000 * (1 - 0.21) = 790
      const result = calculateNOPAT(1000, 21)
      expect(result).toBe(790)
    })

    it('should use default tax rate of 21% if not provided', () => {
      const result = calculateNOPAT(1000)
      expect(result).toBe(790)
    })

    it('should return 0 for invalid EBIT', () => {
      expect(calculateNOPAT(null, 21)).toBe(0)
    })
  })

  describe('calculatePV', () => {
    it('should calculate present value correctly', () => {
      // FCF = 100, WACC = 10%, Year = 1
      // Expected: 100 / (1.1)^1 = 90.91
      const result = calculatePV(100, 10, 1)
      expect(result).toBeCloseTo(90.91, 1)
    })

    it('should discount later years more heavily', () => {
      const year1 = calculatePV(100, 10, 1)
      const year5 = calculatePV(100, 10, 5)
      expect(year5).toBeLessThan(year1)
    })
  })

  describe('calculateTerminalValue', () => {
    it('should calculate terminal value using Gordon Growth Model', () => {
      // Final FCF = 100, WACC = 10%, TGR = 2.5%
      // Expected: (100 * 1.025) / (0.10 - 0.025) = 1366.67
      const result = calculateTerminalValue(100, 10, 2.5)
      expect(result).toBeCloseTo(1366.67, 1)
    })

    it('should return 0 if discount rate <= growth rate', () => {
      expect(calculateTerminalValue(100, 5, 5)).toBe(0)
      expect(calculateTerminalValue(100, 5, 6)).toBe(0)
    })
  })

  describe('calculateEnterpriseValue', () => {
    it('should sum PV of FCFs and PV of Terminal Value', () => {
      const result = calculateEnterpriseValue(500, 366.67)
      expect(result).toBeCloseTo(866.67, 2)
    })

    it('should handle missing values', () => {
      expect(calculateEnterpriseValue(null, 100)).toBe(100)
      expect(calculateEnterpriseValue(100, null)).toBe(100)
    })
  })

  describe('calculateEquityValue', () => {
    it('should calculate: EV + Cash - Debt', () => {
      const result = calculateEquityValue(1000, 200, 300)
      expect(result).toBe(900)
    })

    it('should handle missing values', () => {
      expect(calculateEquityValue(1000, null, 300)).toBe(700)
    })
  })

  describe('calculateIntrinsicValuePerShare', () => {
    it('should calculate: Equity Value / Shares Outstanding', () => {
      const result = calculateIntrinsicValuePerShare(1000000000, 1000000)
      expect(result).toBe(1000)
    })

    it('should return 0 if shares outstanding is 0', () => {
      expect(calculateIntrinsicValuePerShare(1000, 0)).toBe(0)
    })

    it('should return 0 if shares outstanding is missing', () => {
      expect(calculateIntrinsicValuePerShare(1000, null)).toBe(0)
    })
  })

  describe('calculateMarginOfSafety', () => {
    it('should calculate: ((IV - CP) / IV) * 100', () => {
      // IV = 125, CP = 100
      // Expected: ((125 - 100) / 125) * 100 = 20%
      const result = calculateMarginOfSafety(125, 100)
      expect(result).toBe(20)
    })

    it('should return negative when overvalued', () => {
      // IV = 125, CP = 150
      // Expected: ((125 - 150) / 125) * 100 = -20%
      const result = calculateMarginOfSafety(125, 150)
      expect(result).toBe(-20)
    })

    it('should return 0 if intrinsic value is 0', () => {
      expect(calculateMarginOfSafety(0, 100)).toBe(0)
    })
  })

  describe('getRatingColor', () => {
    it('should return green for UNDERVALUED', () => {
      expect(getRatingColor('UNDERVALUED')).toBe('#22c55e')
    })

    it('should return red for OVERVALUED', () => {
      expect(getRatingColor('OVERVALUED')).toBe('#ef4444')
    })

    it('should return amber for NEUTRAL', () => {
      expect(getRatingColor('NEUTRAL')).toBe('#f59e0b')
    })

    it('should handle lowercase input', () => {
      expect(getRatingColor('undervalued')).toBe('#22c55e')
    })
  })

  describe('getSensitivityClass', () => {
    it('should classify correctly based on value/price ratio', () => {
      expect(getSensitivityClass(125, 100)).toBe('significantly-undervalued') // +25%
      expect(getSensitivityClass(110, 100)).toBe('undervalued') // +10%
      expect(getSensitivityClass(105, 100)).toBe('near-fair') // +5%
      expect(getSensitivityClass(95, 100)).toBe('near-fair') // -5%
      expect(getSensitivityClass(85, 100)).toBe('overvalued') // -15%
      expect(getSensitivityClass(70, 100)).toBe('significantly-overvalued') // -30%
    })

    it('should return empty string for invalid inputs', () => {
      expect(getSensitivityClass(null, 100)).toBe('')
      expect(getSensitivityClass(100, 0)).toBe('')
    })
  })

  describe('formatMagnitude', () => {
    it('should format trillions correctly', () => {
      const result = formatMagnitude(6482400000000, 2, 'USD')
      expect(result).toBe('$6.48T')
    })

    it('should format billions correctly', () => {
      const result = formatMagnitude(648240000000, 2, 'USD')
      expect(result).toBe('$648.24B')
    })

    it('should format millions correctly', () => {
      const result = formatMagnitude(1000000, 2, 'USD')
      expect(result).toBe('$1.00M')
    })

    it('should format thousands correctly', () => {
      const result = formatMagnitude(50000, 2, 'USD')
      expect(result).toBe('$50.00K')
    })

    it('should use INR symbol for Indian equities', () => {
      const result = formatMagnitude(648240000000, 2, 'INR')
      expect(result).toBe('₹648.24B')
    })

    it('should return em-dash for null/undefined/NaN', () => {
      expect(formatMagnitude(null)).toBe('—')
      expect(formatMagnitude(undefined)).toBe('—')
      expect(formatMagnitude(NaN)).toBe('—')
    })

    it('should handle negative values', () => {
      const result = formatMagnitude(-1000000, 2, 'USD')
      expect(result).toBe('$-1.00M')
    })
  })
})
