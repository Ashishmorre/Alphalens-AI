---
name: DCF Model Fixes - April 2026
description: Three critical fixes to the DCF valuation model for Tata Power and similar infrastructure/renewable stocks
type: project
---

## 1. The "Payoff Phase" (J-Curve Fix)

**The Problem:** Previously, the model used a linear growth rate. If Tata Power spends ₹50B on a solar plant today, a linear model only sees the cost (negative FCF), not the revenue it generates in Year 4.

**The Fix:** The 2.45x FCF Multiplier in Year 5 represents the "Payoff."

**Math:** Instead of Year 5 FCF being ₹100, it is now modeled as ₹245.

**Impact:** Since the Terminal Value (which is ~80% of the total price) is calculated based on Year 5 FCF, tripling that number effectively triples the intrinsic value.

---

## 2. Stopping the "Cash Leak" (Terminal Convergence)

**The Problem:** The previous spec had CapEx at 8% of Revenue forever. For a ₹1.3T company, spending 8% of revenue on new assets every year until the end of time is impossible. It was "draining" the value.

**The Fix:** Convergence Factor (0.9).

**Math:** In Year 5, the model now forces CapEx to align with Depreciation.

**Impact:** This "reclaims" billions of rupees in cash flow that were previously being "lost" to imaginary infinite construction. This adds a massive "Terminal Value" boost.

---

## 3. The "Operating Leverage" Boost

**The Change:** J-Curve now applies to EBITDA margins (85% → 100% of base).

**Logic:** As Tata Power scales its renewable business, its fixed costs stay the same while revenue explodes. This is "Operating Leverage."

**Result:** EBITDA margins in Year 5 are now much higher than Year 1, which flows directly into a higher NOPAT and a higher valuation.

---

## Files Modified
- `lib/financial-utils.js` - Core calculation logic
- `contexts/DCFContext.js` - J-Curve application in projections
