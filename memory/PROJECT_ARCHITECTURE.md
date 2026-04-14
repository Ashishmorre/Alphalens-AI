---
name: Alphalens AI - Complete Project Architecture
description: Data sources, formulas, schemas, AI prompts, models, and system architecture
date: 2026-04-14
version: 10.0
---

# Alphalens AI - Complete Technical Documentation

---

## 1. DATA SOURCES

### 1.1 Yahoo Finance (Primary Provider)
**File:** `lib/yahoo-finance.js`

| Category | Metrics |
|----------|---------|
| **Price** | Price, Change, Currency |
| **Valuation** | Market Cap, PE, Forward PE, EV/EBITDA |
| **Financials** | Revenue, EBITDA, Net Income, Debt, Cash, FCF |
| **Returns** | ROE, ROA |
| **Risk** | Beta, Moving Averages |
| **Profile** | Sector, Industry, Shares Outstanding, Employees |

### 1.2 Screener.in (Indian Peers)
**File:** `lib/screener.js`

| Metrics |
|---------|
| Peer Data (Name, PE, Market Cap) |
| Industry PE/EV ratios |

### 1.3 Derived Calculations
| Metric | Formula |
|--------|---------|
| ROCE | EBIT / (Total Assets - Current Liabilities) × 100 |
| Current Ratio | Current Assets / Current Liabilities |
| Quality Score | ROE + ROCE |

---

## 2. TECHNICAL FORMULAS

### 2.1 Terminal Value (Dual Method)
```
Method A: Gordon Growth = (FCF₅ × (1+g)) / (WACC-g)
Method B: Exit Multiple = EBITDA₅ × Multiple
                          (22x if Quality>100, else 16x)
Final TV = MAX(Gordon, Exit Multiple)
```

### 2.2 Equity Value with SOTP
```
Equity = EV + Cash - Debt + SOTP_Buffer
SOTP_Buffer = MarketCap × 0.18 (for utilities)
Final Value = MAX(Equity, MarketCap × 0.95)
```

### 2.3 Dynamic WACC
```
Base = 4.5% + (Beta × 5.5%)
Adjustments:
- Current Ratio > 3: -1.0%
- Current Ratio > 1.5: -0.5%
- High Beta > 1.3: +0.3%
Range: 7.0% - 12.0%
```

### 2.4 Terminal Growth Rate
```
PEG < 0.5: TGR ≥ 5.0%
Quality > 100: TGR = 6.0%
PE > 30: TGR = 5.5%
PE > 25: TGR = 4.5%
... (cascading scale)
Utilities: +0.5%
```

### 2.5 J-Curve Multipliers
| Year | Revenue Growth | EBITDA Margin | FCF Multiplier |
|------|---------------|---------------|----------------|
| 1 | 0.50x Base | 0.85x Base | 1.0 + TGR×0.5/100 |
| 2 | 0.70x Base | 0.90x Base | 1.0 + TGR×0.7/100 |
| 3 | 1.00x Base | 0.95x Base | 1.0 + TGR×1.5/100 |
| 4 | 1.20x Base | 0.98x Base | Year 3 × (1 + TGR×1.2/100) |
| 5 | 1.30x Base | 1.00x Base | Year 4 × (1 + TGR×1.3/100) |

### 2.6 Quality Premium
```
Quality Score = ROE + ROCE

If Score > 120: 1.25x multiplier (25% premium)
Else:
  ROE > 50%: +25%
  ROE > 30%: +15%
  ROCE > 50%: +20%
  ROCE > 30%: +10%
  (Capped at 50% total)
```

### 2.7 Terminal Convergence
```
Year 5 CapEx = CapEx_Base × 0.1 + Depreciation × 0.9
(90% convergence to maintenance level)
```

---

## 3. AI MODELS & PROMPTS

### 3.1 Primary Model
| Provider | Model | Fallback |
|----------|-------|----------|
| NVIDIA | Llama 3.1 405B | Groq (Mixtral/Meta) |

### 3.2 Prompt Types

#### A. DCF Valuation
- **Role:** Quantitative Financial Modeler
- **File:** `app/api/analyze/route.js` (line 109)
- **Key Rules:**
  1. No-Dash Rule (calculate missing PE/ROE/ROCE)
  2. Currency in Millions
  3. Terminal Convergence
  4. Exit Multiple anchor
  5. PEG-based TGR rules

#### B. Investment Thesis
- **Role:** Tier-1 Institutional Equity Analyst
- **File:** `app/api/analyze/route.js` (line 52)
- **Key Rules:**
  1. Realistic target prices
  2. Confidence 60-95
  3. Verdict matches price ratio
  4. Same-sector peers only

#### C. Risk Analysis
- **Role:** Quantitative Risk Analyst
- **File:** `app/api/analyze/route.js` (line 264)
- **Focus:** Liquidity, Leverage, Valuation risks

#### D. News Sentiment
- **Role:** Senior Market Sentiment Analyst
- **File:** `app/api/analyze/route.js` (line 420)
- **Focus:** Themes, catalysts, macro exposure

### 3.3 Model Config
```
maxTokens: 4096
temperature: 0.1  (Conservative)
```

---

## 4. API ENDPOINTS

| Endpoint | Description |
|----------|-------------|
| /api/stock | Fetch complete stock data |
| /api/analyze | AI analysis (DCF, Thesis, Risk, News) |
| /api/compare | Compare multiple stocks |

---

## 5. TESTING

| Module | Tests | Status |
|--------|-------|--------|
| financial-utils.js | 44 | ✅ Passing |

**Command:** `npm test`

---

## 6. FEATURES SUMMARY

| Feature | Impact |
|---------|--------|
| Exit Multiple (22x/16x) | Prevents undervaluation |
| SOTP Buffer (+18%) | Infrastructure premium |
| Quality Score > 120 → 1.25x | Oswal Pumps effect |
| J-Curve (2.45x in Y5) | CapEx payoff capture |
| Terminal Convergence | Stops cash leak |
| Dynamic WACC (7-12%) | Risk-based discount |
| Bull Market Floor (95%) | Valuation support |

---

## 7. EXAMPLE: OSWAL PUMPS

| Metric | Value |
|--------|-------|
| Price | ₹1,422 |
| Target | ₹1,803 |
| Quality Score | 87% ROE + 30% ROCE = 117 |
| Exit Multiple | 22x (Quality > 100) |
| Premium | 25% (Score near 120 threshold) |

---

*Alphalens AI v10.0 - 2026.04.14*
