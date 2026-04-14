# DCF Valuation Guide - Alphalens AI
## Elite-Tier DCF Model v15.0

---

## Executive Summary

Our DCF model follows **elite-tier valuation practices** with **18 refinements** across **25+ steps**:

### Core Refinements (v12.0)
1. **Dynamic Capital Structure WACC** — Sector-based 90/10 (Tech) to 50/50 (Utilities)
2. **Linked Depreciation** — PP&E/CapEx based, not fixed % of revenue
3. **Historical NWC Rate** — Company-specific, not fixed 3%

### Advanced Features (v13.0)
4. **Multiple Scenario Modeling** — Bear/Base/Bull with economic correlation
5. **Reverse DCF** — "What growth is the market pricing in?"
6. **Sector-Specific Growth Ceilings** — 32 sectors with realistic limits
7. **Scenario Correlation** — Growth ↔ Margins ↔ Beta move together logically
8. **Stability Guards** — Bounds, convergence checks, TGR < WACC validation

### Elite Tier (v14.0) 🔥
9. **Enhanced WACC** — Size Premium + Country Risk + Smart Beta
10. **Elite Reinvestment** — Reinvestment = (Growth/ROIC) × NOPAT
11. **CAP (Moat-Based)** — 5-15 year projection horizons based on competitive advantage
12. **10-Year Projections** — Reduces TV dominance from 80%+ to ~70%
13. **Smart Beta** — Unlever → Fade → Relever

### Final Polish (v15.0) ⭐
14. **Dilution Modeling** — ESOPs + Equity Issuance − Buybacks over projection
15. **Cyclicality Layer** — Mean reversion for cyclical sectors (metals, banks, real estate)
16. **Probability Weighting** — Full mathematical weighting of Bear/Base/Bull scenarios
17. **Monte Carlo Simulation** — 1,000 simulations with distribution of outcomes
18. **Capital Allocation Framework** — FCF → Reinvestment + Dividends + Buybacks

---

## Step-by-Step DCF Process

### STEP 1: Data Normalization & Inputs

| Input Category | Fields | Source |
|---------------|--------|--------|
| **Income Statement** | Revenue, EBITDA, EBIT, Interest Expense | Yahoo Finance / AI |
| **Balance Sheet** | Cash, Debt, PP&E, Current Assets/Liabilities | Yahoo Finance |
| **Market Data** | Market Cap, Beta, Price, Shares Outstanding | Yahoo Finance |
| **AI Assumptions** | Growth rates, Margins (validated, not trusted blindly) | AI Model |

**Normalization Function:**
```javascript
function normalizeToAbsolute(value)
// Handles: "2.5B" → 2500000000, "2500M" → 2500000000, "2.5T" → 2500000000000
```

---

### STEP 2: Calculate WACC (Weighted Average Cost of Capital)

#### Old Method (Market-Cap Based) ❌
```
E = Market Cap          (fluctuates daily!)
D = Total Debt          (stable)
V = E + D

WACC = (E/V) × Ke + (D/V) × Kd × (1 - T)
```

#### New Method (Target Capital Structure) ✅
```
Target Structure: 70% Equity / 30% Debt (industry standard)

WACC = 0.70 × Ke + 0.30 × Kd × (1 - T)

Where:
  Ke = Cost of Equity = Rf + β × (Rm - Rf)
     = 7.0% + β × 5.5%

  Kd = Cost of Debt = Interest Expense / Total Debt
     = ~6.0% for Indian corporates

  T = Tax Rate = 21%
```

**WACC Calculation Table:**

| Component | Formula | Example Value |
|-----------|---------|---------------|
| Risk-Free Rate (Rf) | India 10Y Bond | 7.0% |
| Market Risk Premium | (Rm - Rf) | 5.5% |
| Beta (β) | Stock volatility vs market | 1.1 |
| **Cost of Equity (Ke)** | 7.0% + 1.1 × 5.5% | **13.05%** |
| Cost of Debt (Kd) | Interest/Debt | **6.0%** |
| Tax Rate (T) | Corporate tax | 21% |
| **WACC** | 0.70×13.05% + 0.30×6.0%×(1-0.21) | **10.48%** |

**Why Target Structure?**
- Market cap fluctuates daily → WACC volatility
- Target structure (70/30) is stable and industry-standard
- Reflects long-term financing intentions, not short-term sentiment

---

### STEP 3: Terminal Growth Rate (TGR)

**Conservative Limits for India:**
```javascript
TGR = min(4%, GDP Growth, Inflation + Real Growth)
    = min(4%, 6%, 5% + 1.5%)
    = 3.5% - 4.0%
```

| Market Type | TGR Range | Rationale |
|-------------|-----------|-----------|
| Developed (US/UK) | 2.0% - 2.5% | Mature economies, slow growth |
| Emerging (India) | 3.0% - 4.0% | Higher GDP growth, but capped |
| **Our Default** | **3.5%** | Conservative India baseline |

**Critical Constraint:** TGR must be < WACC
```
If TGR ≥ WACC → Gordon Growth Model explodes (infinite value)
```

---

### STEP 4: Excess Cash Separation

**Operating Cash vs Excess Cash**

| Type | Definition | Usage |
|------|------------|-------|
| **Operating Cash** | 2% of revenue | Day-to-day working capital needs |
| **Excess Cash** | Total Cash - Operating Cash | Available for shareholders |
| **Valuation Cash** | Excess Cash ONLY | Added to equity value |

```javascript
Operating Cash = Revenue × 2%
Excess Cash    = max(Total Cash - Operating Cash, 0)
```

**Example:**
- Total Cash: ₹500 Cr
- Revenue: ₹2,000 Cr
- Operating Cash: ₹2,000 Cr × 2% = ₹40 Cr
- **Excess Cash: ₹460 Cr** (used in valuation)

---

### STEP 5: Calculate Historical NWC Rate (Company-Specific)

#### Old Method (Fixed 3%) ❌
```
ΔNWC = ΔRevenue × 3%
```

#### New Method (Historical/Calculated) ✅

**Method 1: Historical Rate (Most Accurate)**
```
NWC % = Historical Average (company-specific)
ΔNWC  = ΔRevenue × Historical NWC%
```

**Method 2: Balance Sheet Calculation**
```
Operating CA  = Current Assets - Cash
Operating CL  = Current Liabilities - Short-term Debt
NWC           = Operating CA - Operating CL
NWC %         = NWC / Revenue
```

**Method 3: Sector Defaults (Last Resort)**

| Sector | Typical NWC % | Reason |
|--------|---------------|--------|
| Software/Tech | 8% - 12% | High receivables, low inventory |
| Manufacturing | 15% - 25% | High inventory + receivables |
| Retail | -5% - 5% | Often negative (customer cash first) |
| Utilities | 2% - 5% | Prepaid by customers |
| Infrastructure | -5% - 0% | Customer advances |

**Example Comparison:**

| Company Type | Old ΔNWC | New ΔNWC | Difference |
|-------------|----------|----------|------------|
| Software (10% rev growth) | ₹30 Cr | ₹100 Cr | **-₹70 Cr** |
| Retail (10% rev growth) | ₹30 Cr | -₹50 Cr | **+₹80 Cr** |
| Utility (10% rev growth) | ₹30 Cr | ₹30 Cr | ₹0 Cr |

---

### STEP 6: 5-Year Financial Projections

#### Growth Rate Schedule (with Terminal Fade)

| Year | Growth Rate | Method |
|------|-------------|--------|
| Year 1 | 15.0% | Starting growth (AI or default) |
| Year 2 | 14.0% | Linear decline |
| Year 3 | 13.0% | Linear decline |
| Year 4 | 11.0% | Terminal fade begins |
| Year 5 | 9.0% | Converging to TGR |
| Terminal | 3.5% | TGR (Govt bond territory) |

**Terminal Fade Logic:**
```javascript
// Years 4-5: Smooth exponential fade to TGR
// Prevents unrealistic "cliff" in Year 5
fadeProgress = (year - 3) / 2  // Year 4=0.5, Year 5=1.0
growthRate   = year5Growth × (TGR/year5Growth)^fadeProgress
```

#### EBITDA Margin Convergence

| Year | EBITDA Margin | Convergence |
|------|---------------|-------------|
| Year 1 | 20.0% | Base margin |
| Year 2 | 21.0% | +25% toward target |
| Year 3 | 22.0% | +50% toward target |
| Year 4 | 23.0% | +75% toward target |
| Year 5 | 24.0% | Terminal margin |

#### Depreciation Calculation (Linked Method)

**Old Method:** Depreciation = Revenue × 5% ❌

**New Method:** Linked to PP&E/CapEx ✅

```javascript
// Method 1: If gross PP&E available
Depreciation = Gross PP&E / Asset Life

// If accumulated depreciation exists, adjust for asset age
Asset Age = Accumulated Depreciation / (Gross PP&E / Asset Life)
Adjustment = max(0.6, min(1.2, 1 - (Asset Age - 5) × 0.02))
Final Depreciation = Base Depreciation × Adjustment

// Method 2: If historical CapEx available
Depreciation = Historical CapEx × 0.85

// Method 3: Fallback using net PP&E
Depreciation = Net PP&E / Asset Life × 0.8
```

**Depreciation Comparison by Sector:**

| Sector | Gross PP&E | Old Dep | New Dep | Impact on FCF |
|--------|------------|---------|---------|---------------|
| Utility | ₹50,000 Cr | ₹500 Cr | ₹5,000 Cr | **-₹4,500 Cr** |
| Software | ₹1,000 Cr | ₹500 Cr | ₹100 Cr | **+₹400 Cr** |

#### Complete Projection Table (Example)

**Assumptions:**
- Base Revenue: ₹10,000 Cr
- Base EBITDA Margin: 20%
- Tax Rate: 25%
- CapEx Rate: 8%
- NWC Rate: 10% (from historical)
- Asset Life: 10 years
- Gross PP&E: ₹5,000 Cr

| Line Item | Year 1 | Year 2 | Year 3 | Year 4 | Year 5 |
|-----------|--------|--------|--------|--------|--------|
| **Revenue Growth** | 15.0% | 14.0% | 13.0% | 11.0% | 9.0% |
| Revenue (₹ Cr) | 11,500 | 13,110 | 14,814 | 16,444 | 17,924 |
| **EBITDA Margin** | 20.5% | 21.0% | 21.7% | 22.8% | 24.0% |
| EBITDA (₹ Cr) | 2,358 | 2,753 | 3,215 | 3,749 | 4,302 |
| Depreciation (₹ Cr) | 595 | 625 | 655 | 685 | 715 |
| EBIT (₹ Cr) | 1,763 | 2,128 | 2,560 | 3,064 | 3,587 |
| NOPAT (₹ Cr) | 1,322 | 1,596 | 1,920 | 2,298 | 2,690 |
| CapEx (₹ Cr) | -1,104 | -1,260 | -1,422 | -1,549 | -715* |
| ΔNWC (₹ Cr) | -150 | -161 | -170 | -163 | -148 |
| **FCF (₹ Cr)** | **663** | **900** | **1,083** | **1,291** | **2,542** |

*Year 5 CapEx converged to Depreciation (stable state)

---

### STEP 7: Calculate Present Value of FCFs

**Mid-Year Discounting (Professional Standard)**

```javascript
// Cash flows occur throughout the year
// Discount Factor = 1 / (1 + WACC)^(t - 0.5)

PV Factor Year 1 = 1 / (1.1048)^0.5 = 0.951
PV Factor Year 2 = 1 / (1.1048)^1.5 = 0.861
PV Factor Year 3 = 1 / (1.1048)^2.5 = 0.780
PV Factor Year 4 = 1 / (1.1048)^3.5 = 0.706
PV Factor Year 5 = 1 / (1.1048)^4.5 = 0.639
```

**PV of FCFs Table:**

| Year | FCF (₹ Cr) | PV Factor | PV of FCF (₹ Cr) |
|------|------------|-----------|------------------|
| 1 | 663 | 0.951 | 630 |
| 2 | 900 | 0.861 | 775 |
| 3 | 1,083 | 0.780 | 845 |
| 4 | 1,291 | 0.706 | 911 |
| 5 | 2,542 | 0.639 | 1,624 |
| **Total PV of FCFs** | | | **₹4,785 Cr** |

**Why Mid-Year Discounting?**
- Cash flows occur evenly throughout the year, not at year-end
- Adds ~3-5% to valuation vs end-of-year discounting
- Industry standard for investment banking

---

### STEP 8: Calculate Terminal Value (Gordon Growth Model)

```
TV = FCF₅ × (1 + g) / (WACC - g)

Where:
  FCF₅ = Year 5 FCF = ₹2,542 Cr
  g = Terminal Growth Rate = 3.5%
  WACC = 10.48%

TV = ₹2,542 Cr × (1.035) / (0.1048 - 0.035)
   = ₹2,631 Cr / 0.0698
   = ₹37,693 Cr
```

**PV of Terminal Value:**
```
PV(TV) = ₹37,693 Cr / (1.1048)^5
       = ₹37,693 Cr × 0.606
       = ₹22,842 Cr
```

**Important: Gordon Growth ONLY**
- We removed Exit Multiple method (no MAX function)
- Exit multiples can inflate TV unrealistically
- Gordon Growth is more theoretically sound

---

### STEP 9: Enterprise Value Calculation

```
Enterprise Value = PV of FCFs + PV of Terminal Value
                 = ₹4,785 Cr + ₹22,842 Cr
                 = ₹27,627 Cr
```

**Value Composition:**

| Component | Value (₹ Cr) | % of EV |
|-----------|--------------|---------|
| PV of Years 1-5 FCFs | ₹4,785 | 17.3% |
| PV of Terminal Value | ₹22,842 | 82.7% |
| **Enterprise Value** | **₹27,627** | **100%** |

**Sanity Check:** Terminal Value % of EV
- Acceptable range: 60-80%
- Warning if > 85% (too much value in distant future)
- Critical if > 90% (projections may be too conservative)

---

### STEP 10: Equity Value Bridge

```
Equity Value = Enterprise Value + Excess Cash - Total Debt

Example:
  Enterprise Value:  ₹27,627 Cr
  + Excess Cash:     ₹460 Cr
  - Total Debt:      ₹5,000 Cr
  = Equity Value:    ₹23,087 Cr
```

**What We REMOVED:**
- ❌ No SOTP (Sum-of-the-Parts) buffer
- ❌ No Quality Premium (ROE-based adjustments)
- ❌ No Bull/Floor price anchors
- ❌ No MAX(TV methods)

**Why Clean Bridge?**
- SOTP buffers were inflating value unrealistically
- Quality premiums double-counted good ROE
- Clean math = more reliable valuation

---

### STEP 11: Intrinsic Value Per Share

```
Intrinsic Value Per Share = Equity Value / Shares Outstanding

Example:
  Equity Value:        ₹23,087 Cr
  Shares Outstanding:  100 Cr
  Intrinsic Value:   ₹230.87 per share
```

---

### STEP 12: ROIC Validation

**Return on Invested Capital Check**

```javascript
ROIC = NOPAT / Invested Capital

Invested Capital = Total Debt + Book Equity - Excess Cash
```

**Value Creation Test:**

| Scenario | Condition | Meaning |
|----------|-----------|---------|
| **Value Creating** | ROIC > WACC | Growth adds value ✓ |
| **Value Destroying** | ROIC < WACC | Growth destroys value ✗ |
| **Neutral** | ROIC = WACC | Growth doesn't affect value |

**Example:**
- Year 5 NOPAT: ₹2,690 Cr
- Total Debt: ₹5,000 Cr
- Book Equity: ₹15,000 Cr
- Excess Cash: ₹460 Cr
- Invested Capital: ₹19,540 Cr
- **ROIC: 13.8%**
- **WACC: 10.5%**
- **Result: Value Creating** ✅

---

### STEP 13: Reinvestment Rate

```javascript
Reinvestment Rate = Growth Rate / ROIC

Example:
  Growth Rate = 9%
  ROIC = 13.8%
  Reinvestment Rate = 9% / 13.8% = 65%
```

**Interpretation:**
- 65% of NOPAT must be reinvested to support 9% growth
- 35% is free cash flow distributable to shareholders

---

### STEP 14: Sensitivity Analysis

**WACC vs Terminal Growth Grid:**

| TGR → <br> WACC ↓ | 2.5% | 3.0% | **3.5%** | 4.0% | 4.5% |
|-------------------|------|------|----------|------|------|
| **8.5%** | ₹312 | ₹338 | ₹371 | ₹416 | ₹481 |
| **9.5%** | ₹268 | ₹286 | ₹309 | ₹339 | ₹382 |
| **10.5%** | ₹232 | ₹246 | ₹262 | ₹282 | ₹309 |
| **11.5%** | ₹203 | ₹214 | ₹226 | ₹240 | ₹258 |
| **12.5%** | ₹179 | ₹188 | ₹196 | ₹207 | ₹220 |

*(Values: Intrinsic Value per Share in ₹)*

**Base Case Highlighted:** 10.5% WACC, 3.5% TGR = ₹262

---

### STEP 15: Sanity Checks & Quality Score

**9-Point Validation:**

| Check | Condition | Status |
|-------|-----------|--------|
| 1. TGR < WACC | 3.5% < 10.5% | ✅ PASS |
| 2. TGR ≤ 5% | 3.5% ≤ 5% | ✅ PASS |
| 3. WACC 8-14% | 10.5% in range | ✅ PASS |
| 4. TV < 85% of EV | 82.7% < 85% | ✅ PASS |
| 5. ROIC > WACC | 13.8% > 10.5% | ✅ PASS |
| 6. TV < 80% of EV | 82.7% | ⚠️ WARNING |
| 7. Growth < 15% Y5 | 9% < 15% | ✅ PASS |
| 8. Book Equity > 0 | ₹15,000 Cr | ✅ PASS |
| 9. TGR gap > 5% | 9% → 3.5% = 5.5% | ⚠️ WARNING |

**Trust Score: 85/100 (HIGH Quality)**

---

### STEP 16: Final Verdict

| Metric | Value |
|--------|-------|
| Current Market Price | ₹200 |
| Intrinsic Value | ₹263 |
| Upside | +31.5% |
| Verdict | **UNDERVALUED** |
| DCF Rating | BUY |
| Margin of Safety | 24% |

**Margin of Safety:**
```
MOS = (Intrinsic Value - Current Price) / Intrinsic Value × 100
    = (263 - 200) / 263 × 100
    = 24%
```

---

## Complete DCF Output Structure

```json
{
  "assumptions": {
    "wacc": 10.48,
    "terminalGrowthRate": 3.5,
    "taxRate": 21,
    "targetCapitalStructure": { "equityPct": 70, "debtPct": 30 },
    "nwcRate": 0.10,
    "nwcSource": "HISTORICAL"
  },
  "projections": [
    { "year": 1, "revenue": 11500, "ebitda": 2358, "fcf": 663, "pv": 630 },
    { "year": 2, "revenue": 13110, "ebitda": 2753, "fcf": 900, "pv": 775 },
    { "year": 3, "revenue": 14814, "ebitda": 3215, "fcf": 1083, "pv": 845 },
    { "year": 4, "revenue": 16444, "ebitda": 3749, "fcf": 1291, "pv": 911 },
    { "year": 5, "revenue": 17924, "ebitda": 4302, "fcf": 2542, "pv": 1624 }
  ],
  "valuation": {
    "pvFCFs": 4785,
    "terminalValue": 37693,
    "pvTerminalValue": 22842,
    "enterpriseValue": 27627,
    "equityValue": 23087,
    "intrinsicValuePerShare": 263
  },
  "metrics": {
    "roic": 13.8,
    "roicAssessment": "VALUE_CREATING",
    "reinvestmentRate": 0.65,
    "terminalValuePct": 82.7,
    "trustScore": 85,
    "qualityRating": "HIGH"
  },
  "verdict": {
    "currentPrice": 200,
    "intrinsicValue": 263,
    "upside": 31.5,
    "verdict": "UNDERVALUED",
    "marginOfSafety": 24
  }
}
```

---

## Key Improvements Summary

| Aspect | Old Model | New Model | Impact |
|--------|-----------|-----------|--------|
| **WACC** | Market-cap weights (volatile) | 70/30 target (stable) | ±2-3% WACC stability |
| **Depreciation** | 5% of revenue | PP&E/CapEx linked | More accurate by sector |
| **NWC** | Fixed 3% | Historical/company-specific | Retail: +ve cash, Software: -ve cash |
| **TV Method** | MAX(Gordon, Exit Multiple) | Gordon ONLY | Removes inflation bias |
| **Discounting** | End-of-year | Mid-year | +3-5% value accuracy |
| **Cash** | Total added | Excess only | More conservative |
| **Quality** | ROE premium | ROIC validation | Better economics test |

---

## Formula Reference Card

```
WACC = E% × Ke + D% × Kd × (1 - T)
     = 0.70 × [Rf + β(Rm-Rf)] + 0.30 × (Int/Debt) × (1-T)

FCF = NOPAT + D&A - CapEx - ΔNWC
    = EBIT×(1-T) + Dep - CapEx - (ΔRev × NWC%)

TV = FCF₅ × (1+g) / (WACC - g)

PV Factor = 1 / (1+WACC)^(t-0.5)

Equity Value = EV + Excess Cash - Debt

IV/S = Equity Value / Shares

ROIC = NOPAT / (Debt + Book Equity - Excess Cash)
```

---

## STEP 16: Multiple Scenario Modeling (v13.0)

### Economic Correlation Logic

Our scenarios **link variables economically** — they don't move independently:

| Scenario | Growth | Margins | Beta | Correlation | Justification |
|----------|--------|---------|------|-------------|---------------|
| **Bear** | -30% | -10% relative, -2% abs | +30%, min 1.0 | Tight | Slowdown → crush margins → higher risk |
| **Base** | Baseline | Baseline | Baseline | — | Normal operations |
| **Bull** | +25% | +5% relative, +2% abs | -15%, min 0.6 | Loose | Scale → operating leverage → lower risk |

### Scenario Mechanics

```javascript
// Bear: Growth slowdown → margin compression → higher risk
bearAdjusted = {
  growth: base × 0.70,       // Revenue drops 30%
  margin: base × 0.90 - 2,   // Margins squeezed
  beta: base × 1.30 (min 1.0) // Business risk rises
  justification: 'Slowdown crushes margins, risk rises'
}

// Bull: Growth acceleration → operating leverage → lower risk
bullAdjusted = {
  growth: base × 1.25,       // Revenue up 25%
  margin: base × 1.05 + 2,   // Operating leverage kicks in
  beta: base × 0.85 (min 0.6) // Scale = stability
  justification: 'Operating leverage drives margins, risk falls'
}
```

### Sector-Specific Growth Ceilings

Prevents unrealistic projections by sector:

| Sector | Year 1 Max | Year 5 Max | Rationale |
|--------|------------|------------|-----------|
| **SaaS** | 30% | 15% | Hyper-growth early stage |
| **Software** | 28% | 12% | Recurring revenue |
| **E-commerce** | 25% | 12% | Market share gains |
| **Tech** | 25% | 12% | Maturation risk |
| **Biotech** | 30% | 15% | Binary outcomes |
| **Pharma** | 18% | 8% | Patent cliff |
| **Consumer/FMCG** | 12% | 6% | GDP-linked |
| **Banks** | 12% | 6% | Credit cycle |
| **Utilities** | 8% | 5% | Regulated |
| **REITs** | 8% | 3% | Distribution focused |

### Scenario Output Structure

```json
{
  "scenarios": {
    "bear": { "intrinsicValue": 180, "verdict": "OVERVALUED" },
    "base": { "intrinsicValue": 263, "verdict": "UNDERVALUED" },
    "bull": { "intrinsicValue": 340, "verdict": "UNDERVALUED" }
  },
  "summary": {
    "bearIV": 180,
    "baseIV": 263,
    "bullIV": 340,
    "weightedIV": 244,      // 30/50/20 probability
    "upsideToBear": "-18%",
    "upsideToBase": "+31%",
    "upsideToBull": "+70%"
  }
}
```

---

## STEP 17: Reverse DCF (v13.0)

### "What Growth Is The Market Pricing In?"

Instead of calculating value, **solve for growth** implied by current price.

### Stability Guards

| Guard | Condition | Action |
|-------|-----------|--------|
| **TGR < WACC** | TGR ≥ WACC - 1% | Return error (Gordon undefined) |
| **Growth Ceiling** | Implied > sector max | Clamp to sector ceiling |
| **Convergence** | diff/EV > 0.5% | Require better precision |
| **Bounds** | Growth outside [0%, 25%] | Return error with classification |

### Binary Search Algorithm

```javascript
// Iterate 25 times to find growth that produces target EV
let low = -10, high = 50, bestGrowth = 20;
for (let i = 0; i < 25; i++) {
  const mid = (low + high) / 2;
  const projections = calculateProjections({
    year1Growth: mid
  });
  const ev = calculateEV(projections);
  if (ev > targetEV) high = mid; else low = mid;
}
```

### Output Structure

```json
{
  "currentPrice": 200,
  "targetEquityValue": 20000,
  "targetEnterpriseValue": 18500,
  "wacc": 10.48,
  "tgr": 3.5,
  "impliedAssumptions": {
    "year1Growth": 18.5,
    "year5Growth": 9.0,
    "ebitdaMargin": 20.0
  },
  "comparison": {
    "baseCaseGrowth": 15,
    "impliedGrowth": 18.5,
    "growthGap": 3.5
  },
  "interpretation": {
    "verdict": "AGGRESSIVE",
    "conclusion": "Market pricing in 18.5% vs base 15% - expects higher growth"
  }
}
```

### Verdict Classification

| Verdict | Implied Growth | Interpretation |
|---------|---------------|----------------|
| **OVEROPTIMISTIC** | > 20% | Likely overvalued |
| **AGGRESSIVE** | 12-20% | Stretched but possible |
| **REASONABLE** | 6-12% | Fairly priced |
| **CONSERVATIVE** | < 6% | Potentially cheap |

---

## Model Validation Checklist

Before trusting any DCF output:

- [ ] TGR < WACC (critical)
- [ ] TGR ≤ 4-5% for India
- [ ] WACC in 8-14% range
- [ ] TV < 85% of EV
- [ ] ROIC > WACC (value creating)
- [ ] Projections within sector ceilings
- [ ] Sensitivity grid looks reasonable
- [ ] Trust Score > 60
- [ ] Reverse DCF converged within bounds
- [ ] Scenarios economically correlated

---

*Document Version: 15.0*
*Total Refinements: 18*
*Last Updated: April 2026*
*Model: lib/dcf-clean.js*
*Total Exports: 45+ functions and tables*
