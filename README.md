# AlphaLens AI - Institutional-Grade Stock Analysis Platform

Welcome to **AlphaLens AI** — a production-grade, AI-powered stock analysis and DCF valuation platform built for serious investors. This document provides comprehensive technical documentation covering architecture, formulas, workflows, fallback mechanisms, and implementation details.

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Core Features](#2-core-features)
3. [Tech Stack](#3-tech-stack)
4. [Directory Structure](#4-directory-structure)
5. [DCF Valuation Architecture](#5-dcf-valuation-architecture)
6. [Formula Reference & Calculations](#6-formula-reference--calculations)
7. [Data Sources & Fallback Chain](#7-data-sources--fallback-chain)
8. [API Routes & Endpoints](#8-api-routes--endpoints)
9. [Component Architecture](#9-component-architecture)
10. [Rate Limiting & Security](#10-rate-limiting--security)
11. [Environment Setup](#11-environment-setup)
12. [Development & Production](#12-development--production)

---

## 1. Project Overview

AlphaLens AI provides institutional-grade financial analysis including:
- **Investment Thesis Generation** — Bull, Base, and Bear case analysis with AI
- **Discounted Cash Flow (DCF) Valuation** — Real-time calculation engine
- **Risk Analysis** — Comprehensive ratio analysis with sector benchmarking
- **News Sentiment Analysis** — Market sentiment scoring
- **Stock Comparison** — Multi-stock side-by-side analysis
- **PDF Export** — Styled research report generation

**Built By:** Ashish & Aman Agrahari

---

## 2. Core Features

### 2.1 DCF Valuation Engine (v16.0)
- **Dynamic Capital Structure WACC** — Sector-based 70/30 to 50/50 equity/debt
- **Linked Depreciation** — PP&E/CapEx based calculations (not fixed % of revenue)
- **Historical NWC Rate** — Company-specific working capital rates
- **Terminal Year CapEx Convergence** — Prevents valuation decay via depreciation ≈ CapEx alignment
- **Quality Premium** — High ROE/ROCE scarcity premium (Oswal Pumps Effect)
- **Reverse DCF** — "What growth is the market pricing in?"
- **Monte Carlo Simulation Ready** — Probability-weighted scenarios
- **Multiple Scenario Modeling** — Bear/Base/Bull with economic correlation

### 2.2 Data Sources Fallback
```
Flow: Yahoo Finance → NSE XBRL → Screener.in → TradingView → Database Historical
```

### 2.3 Rate Limiting
- Stock data: 100 requests/minute per IP
- AI analysis: 20 requests/minute per IP
- Valuation: 30 requests/minute per IP

---

## 3. Tech Stack

| Category | Technology | Purpose |
|----------|------------|---------|
| **Framework** | Next.js 16.2.3 | React framework with App Router |
| **Language** | JavaScript (ES2023) | Core development |
| **Styling** | TailwindCSS 3.4.1 | Utility-first CSS |
| **Database** | Prisma + PostgreSQL | Data persistence |
| **AI/LLM** | OpenAI (NVIDIA/cloud) + Groq fallback | Analysis generation |
| **Caching** | Redis (Upstash) | Rate limiting |
| **Data** | Yahoo Finance API | Real-time market data |
| **PDF** | html2canvas + jspdf | Report export |
| **Charts** | Recharts | Data visualization |

---

## 4. Directory Structure

```
alphalens-ai/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── analyze/route.js      # AI analysis endpoint
│   │   ├── compare/route.js    # Stock comparison
│   │   ├── health/route.js       # Health check
│   │   ├── stock/route.js        # Stock data fetcher (Yahoo + XBRL)
│   │   ├── tradingview/route.js  # TradingView scraper
│   │   └── valuation/route.js    # DCF valuation endpoint
│   ├── globals.css               # Global styles (CRT theme)
│   ├── layout.js                 # Root layout with fonts
│   ├── page.js                   # Main page component
│   └── global-error.js           # Error boundary
│
├── components/                   # React Components
│   ├── CompareStocks.js          # Comparison view
│   ├── ErrorBoundary.js          # Error handling
│   ├── ExportPDF.js              # PDF generation
│   ├── Header.js                 # Navigation header
│   ├── LoadingCard.js            # Loading states
│   ├── ScrollableTabBar.js       # Tab navigation
│   ├── SearchBar.js              # Stock search
│   ├── StockOverview.js          # Stock summary card
│   └── tabs/                     # Analysis tab components
│       ├── DCFValuation.js       # DCF calculator UI
│       ├── InvestmentThesis.js   # AI thesis display
│       ├── NewsSentiment.js      # Sentiment UI
│       ├── RiskRatios.js         # Risk analysis UI
│       └── SensitivityTable.js   # WACC/TGR grid
│
├── contexts/                     # React Contexts
│   ├── CurrencyContext.js        # Currency formatting
│   └── DCFContext.js             # DCF calculation state
│
├── lib/                          # Core Logic
│   ├── ai-gateway/               # AI provider management
│   │   ├── ai-gateway.js         # Provider routing
│   │   ├── models.js             # Model configurations
│   │   └── queue.js              # Request queue
│   ├── db/                       # Database
│   │   ├── client.js             # Prisma client
│   │   └── prisma/
│   │       └── schema.prisma     # Database schema
│   ├── historical/               # Historical data
│   │   └── trends-service.js     # Trend analysis
│   ├── macro/                    # Macroeconomic data
│   │   └── rbi-service.js        # RBI rates for India
│   └── projections/              # Projection engine
│       └── projection-engine.js  # Financial projections
│
├── lib/                          # Core Utilities (root)
│   ├── ai-normalizer.js          # AI response normalization
│   ├── api-client.js             # Frontend API client
│   ├── api-utils.js              # Backend API utilities
│   ├── cache.js                  # Caching layer
│   ├── client-utils.js           # Client-side utilities
│   ├── dcf-clean.js              # Core DCF calculations (50+ functions)
│   ├── dcf-orchestrator.js       # Production DCF workflow
│   ├── dedupe.js                 # Data deduplication
│   ├── dedupe.js                 # Data deduplication
│   ├── financial-utils.js        # Financial calculations (800+ lines)
│   ├── json-parser.js            # Safe JSON parsing
│   ├── nse-xbrl-parser.js        # NSE XBRL parsing
│   ├── rate-limit.js             # Rate limiting
│   ├── rate-limit-redis.js       # Redis rate limiting
│   ├── screener-scraper.js       # Screener.in scraper
│   ├── sector-validator.js       # Sector validation
│   ├── security.js               # Security headers
│   ├── tradingview-scraper.js    # TradingView scraper
│   ├── validation.js             # Input validation
│   └── yahoo-finance.js          # Yahoo Finance integration
│
├── __tests__/                    # Jest test suite
├── DCF_VALUATION_GUIDE.md        # Detailed DCF documentation
└── package.json                  # Dependencies
```

---

## 5. DCF Valuation Architecture

### 5.1 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                       CLIENT REQUEST                             │
│                    (User searches ticker)                        │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STAGE 1: DATA FETCH                         │
│  ┌──────────────┐  ┌─────────────┐  ┌────────────────────────┐ │
│  │ Yahoo Finance│→│ NSE XBRL    │→│ Screener.in            │ │
│  │ Primary      │  │ Indian Eq   │  │ Peers & Ratios         │ │
│  └──────────────┘  └─────────────┘  └────────────────────────┘ │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STAGE 2: VALIDATION LAYER                     │
│         • Data completeness check                               │
│         • Range validation (e.g., WACC 7-12%)                   │
│         • Data quality scoring (0-100)                        │
│         • Missing field detection                               │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STAGE 3: MACRO DATA                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ RBI Service (India)                                     │   │
│  │ • Risk-free rate (India 10Y Bond)                       │   │
│  │ • Market risk premium                                   │   │
│  │ • Sector risk adjustments                             │   │
│  └────────────────────────────────────────────────────────┘    │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STAGE 4: PROJECTION ENGINE                    │
│              lib/projections/projection-engine.js                │
│                                                                  │
│  • Year 1-5 forward projections (Revenue, EBITDA, EBIT)         │
│  • Fade rates by moat type (WIDE: 2%/yr, NONE: 8%/yr)          │
│  • Dynamic capEx strategies (High Growth vs Mature)           │
│  • J-Curve modeling for FCF ramp                              │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STAGE 5: DCF CALCULATION                      │
│                     lib/dcf-clean.js                             │
│                                                                  │
│  • WACC from CAPM (not hardcoded)                              │
│  • Terminal Value (Gordon Growth)                               │
│  • Mid-year discounting                                         │
│  • PV of FCFs + PV of Terminal Value                            │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STAGE 6: VALUATION OUTPUT                     │
│                                                                  │
│  Enterprise Value = PV(FCFs) + PV(Terminal Value)              │
│  Equity Value = EV + Cash - Debt                               │
│  Intrinsic Value = Equity Value / Shares Outstanding         │
│  Upside = ((IV - Current Price) / Current Price) × 100         │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STAGE 7: AI ASSIST (Optional)               │
│  • Qualitative insights only (NO calculations)               │
│  • Investment thesis generation                               │
│  • Risk factor analysis                                        │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STAGE 8: DATABASE PERSISTENCE               │
│  • Save valuation snapshot                                     │
│  • Track historical valuations                                 │
│  • CAGR calculations for trend analysis                       │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **No AI for Calculations** | Pure JavaScript math ensures reproducibility and eliminates hallucination risk |
| **Target Capital Structure** | 70/30 equity/debt (industry standard) vs market-cap weights that fluctuate daily |
| **Gordon Growth Only** | Removed exit multiples that inflate Terminal Value unrealistically |
| **Terminal CapEx Convergence** | Year 5 CapEx ≈ Depreciation prevents valuation decay |
| **Quality Premium** | High ROE/ROCE == scarcity premium (e.g., Oswal Pumps effect) |

---

## 6. Formula Reference & Calculations

### 6.1 WACC (Weighted Average Cost of Capital)

```
Formula: WACC = (E/V × Ke) + (D/V × Kd × (1 - T))

Where:
  E/V = Target equity % (default: 70%, sector-adjustable)
  D/V = Target debt % (default: 30%, sector-adjustable)
  Ke  = Cost of Equity = Rf + β × (Rm - Rf) + Sector Adjustment
  Kd  = Cost of Debt = Interest Expense / Total Debt (or 6% for India corporates)
  T   = Tax Rate (default: 25% for India, 21% for US)

Example Calculation (India Utility):
  Rf = 7.0% (India 10Y bond)
  β = 0.85
  Market Risk Premium = 5.5%
  Ke = 7.0 + (0.85 × 5.5) = 11.675%
  Kd = 6.0%
  T = 25%
  Target Structure (Utility): 55% / 45%
  WACC = (0.55 × 11.675) + (0.45 × 6.0 × 0.75) = 8.44%
```

### 6.2 Cost of Equity (CAPM)

```
Ke = Rf + β × (Market Risk Premium) + Sector Adjustment

Sector Adjustments:
  Technology/SaaS: +0.5% (higher volatility)
  Utilities/Power: -0.5% (regulated returns)
  Financials: +0.3% (regulatory risk)
  Manufacturing: 0% (baseline)
```

### 6.3 Free Cash Flow (FCF)

```
Formula: FCF = NOPAT + D&A - CapEx - ΔNWC

Where:
  NOPAT = EBIT × (1 - Tax Rate)
  D&A   = Depreciation & Amortization
  CapEx = Capital Expenditures (NEGATIVE for cash outflow)
  ΔNWC  = Change in Net Working Capital

Net Working Capital:
  NWC = (Current Assets - Cash) - (Current Liabilities - Short-term Debt)
  ΔNWC = (Current Year Revenue - Previous Year Revenue) × NWC Rate

NWC Rate Sources (Priority):
  1. Historical average (company-specific) ← BEST
  2. Current balance sheet calculation
  3. Sector defaults:
     • Software/SaaS: 8-12%
     • Manufacturing: 15-25%
     • Retail: -5% to 5% (often negative)
     • Utilities: 2-5%
```

### 6.4 Depreciation (Linked Method)

```
Method 1: Gross PP&E (if available)
  Depreciation = Gross PP&E / Asset Life

Method 2: Historical CapEx
  Depreciation = Historical CapEx × 0.85

Method 3: Net PP&E (fallback)
  Depreciation = Net PP&E / Asset Life × 0.8

Method 4: Revenue-based (last resort)
  Depreciation = Revenue × 0.05

Asset Age Adjustment (if accumulated dep available):
  Asset Age = Accumulated Depreciation / (Gross PP&E / Asset Life)
  Adjustment = max(0.6, min(1.2, 1 - (Asset Age - 5) × 0.02))
  Final Depreciation = Base Depreciation × Adjustment
```

### 6.5 Terminal Value (Gordon Growth Model)

```
Formula: TV = FCF₅ × (1 + g) / (WACC - g)

Where:
  FCF₅ = Year 5 Free Cash Flow
  g    = Terminal Growth Rate
  WACC = Weighted Average Cost of Capital

Terminal Growth Rate Factors:
  Base: 3.5% (India emerging market)
  Moat Adjustment:
    • WIDE moat: +1.0%
    • MODERATE moat: +0.5%
    • NARROW moat: +0%
    • NONE moat: -0.5%

Dynamic TGR by P/E and ROCE:
  • PE > 30 OR ROCE > 50%: TGR = 6.0%
  • PE > 25 OR ROCE > 35%: TGR = 5.8%
  • PE > 20: TGR = 4.5%
  • PE > 15: TGR = 3.5%
  • PE > 10: TGR = 3.0%
  • Else: TGR = 2.5%

Critical Constraint: g < WACC (otherwise Gordon Growth explodes)
```

### 6.6 EV to Equity Bridge

```
Enterprise Value (EV) = PV(FCFs) + PV(Terminal Value)
PV Factor = 1 / (1 + WACC)^(t - 0.5)  [Mid-year discounting]

PV of Terminal Value = Terminal Value / (1 + WACC)^5

Equity Value = EV + Cash - Debt

Intrinsic Value Per Share = Equity Value / Shares Outstanding

Quality Premium (High ROE/ROCE):
  Quality Score = ROE + ROCE
  If Quality Score > 120: Premium = +25%
  If ROE > 50%: +25%, >30%: +15%, >20%: +10%
  If ROCE > 50%: +20%, >30%: +10%, >20%: +5%
  Max total premium: 50%

Example:
  EV = ₹20,000 Cr
  Cash = ₹500 Cr
  Debt = ₹2,000 Cr
  SOTP Buffer (Utilities only) = 5% of Market Cap
  Equity Value = 20,000 + 500 - 2,000 + Buffer = ₹18,500 Cr
```

### 6.7 Terminal CapEx Convergence

```
Purpose: Prevent "Valuation Decay" in Gordon Growth Model

In terminal year (Year 5), CapEx should approach Depreciation:
  convergedCapEx = baseCapEx × (1 - cf) + Depreciation × cf

Where cf (convergence factor) = 0.9 (90% convergence)

Example:
  Year 5 Depreciation = ₹500 Cr
  Base CapEx = ₹750 Cr
  convergedCapEx = 750 × 0.1 + 500 × 0.9 = ₹525 Cr

Final CapEx = -525 Cr (negative for cash outflow)

This ensures: Terminal Year CapEx ≈ Terminal Year Depreciation
```

### 6.8 Margin of Safety & Upside

```
Margin of Safety (MOS) = ((IV - Current Price) / IV) × 100

Upside (%) = ((IV - Current Price) / Current Price) × 100

DCF Rating:
  • UNDERVALUED if upside > 10%
  • OVERVALUED if upside < -10%
  • NEUTRAL if -10% to +10%

Verdict Colors:
  • UNDERVALUED: Green (#22c55e)
  • NEUTRAL: Yellow (#f59e0b)
  • OVERVALUED: Red (#ef4444)
```

### 6.9 Growth J-Curve Multipliers

```
Purpose: Model FCF ramp where heavy early CapEx pays off later

Revenue Growth Multipliers:
  Year 1: 0.5 (conservative start)
  Year 2: 0.7 (building)
  Year 3: 1.0 (operational)
  Year 4: 1.2 (scale benefits)
  Year 5: 1.3 (full efficiency)

EBITDA Margin Multipliers:
  Year 1: 0.85 (85% of target)
  Year 2: 0.90
  Year 3: 0.95
  Year 4: 0.98
  Year 5: 1.00 (100% target)

FCF Multipliers:
  Year 1: 1 + (TGR × 0.5 / 100)
  Year 2: 1 + (TGR × 0.7 / 100)
  Year 3: 1 + (TGR × 1.5 / 100)
  Year 4: Year 3 × (1 + TGR × 1.2 / 100)
  Year 5: Year 4 × (1 + TGR × 1.3 / 100)
```

---

## 7. Data Sources & Fallback Chain

### 7.1 Primary Flow

```
┌─────────────────┐
│  Yahoo Finance  │ ← Primary source (global coverage)
│  (yfinance API) │
└────────┬────────┘
         │ No ROE/D/E/Current Ratio/etc
         ▼
┌─────────────────┐
│   NSE XBRL      │ ← Indian equities only (.NS/.BO)
│   (NSE India)   │ ← Financial statements XML
└────────┬────────┘
         │ Still missing peer ratios
         ▼
┌─────────────────┐
│  Screener.in    │ ← India stock screener
│  (Web scraping) │ ← Peer data, ROE, industry P/E
└────────┬────────┘
         │ Still missing after 2+ sources
         ▼
┌─────────────────┐
│   TradingView   │ ← Global financial platform
│   (Web scraping)│ ← Technical data, ratios
└────────┬────────┘
         │ All external sources exhausted
         ▼
┌─────────────────┐
│ Database/Cache  │ ← Historical stored valuations
│ Historical CAGR │ ← 5-10 year trend context
└─────────────────┘
```

### 7.2 Sector-Based Capital Structures

| Sector | Equity % | Debt % | Rationale |
|--------|----------|--------|-----------|
| Tech/Software | 90% | 10% | Asset-light, high cash flow |
| Utilities/Power | 55% | 45% | Stable cash flows support debt |
| Manufacturing | 60% | 40% | Moderate leverage |
| Financials | 85% | 15% | Regulatory constraints |
| Real Estate | 40% | 60% | Heavy leverage structure |
| Consumer/FMCG | 75% | 25% | Brand stability |
| Healthcare | 80% | 20% | R&D heavy, low debt |
| Energy | 55% | 45% | Capital intensive |

---

## 8. API Routes & Endpoints

### 8.1 Stock Data Endpoint

**GET** `/api/stock?ticker={ticker}`

**Response:**
```json
{
  "success": true,
  "data": {
    "ticker": "TATAPOWER.NS",
    "name": "Tata Power Company Limited",
    "price": 399.35,
    "currency": "INR",
    "marketCap": 1276606000000,
    "revenue": 61930000000,
    "ebitda": 14520000000,
    "pe": 28.64,
    "roe": 0.1524,
    "beta": 0.85,
    "sector": "Utilities",
    "debtToEquity": 1.45,
    "_xbrlEnhanced": true,
    "_dataSources": {
      "roe": "screener"
    }
  }
}
```

### 8.2 Valuation Endpoint

**POST** `/api/valuation`

**Request Body:**
```json
{
  "ticker": "TATAPOWER.NS",
  "options": {
    "moat": "MODERATE",
    "taxRate": 25,
    "capitalStructure": { "debt": 45, "equity": 55 },
    "includeAI": true
  }
}
```

**Response:**
```json
{
  "ticker": "TATAPOWER.NS",
  "status": "SUCCESS",
  "currentPrice": 399.35,
  "intrinsicValue": 422.50,
  "upside": 5.8,
  "verdict": "UNDERVALUED",
  "projections": [
    { "year": 1, "revenue": 71200000000, "ebitda": 15200000000, "fcf": 3500000000 },
    // ... Years 2-5
  ],
  "assumptions": {
    "wacc": 8.44,
    "terminalGrowthRate": 4.0,
    "taxRate": 25
  },
  "workflow": {
    "stages": [
      { "name": "data_fetch", "status": "COMPLETED", "dataPoints": 24 },
      { "name": "validation", "status": "COMPLETED", "quality": 85 },
      { "name": "historical", "status": "COMPLETED", "years": "5-year" },
      { "name": "macro", "status": "COMPLETED", "riskFreeRate": 7.0 },
      { "name": "projections", "status": "COMPLETED", "years": 5 },
      { "name": "valuation", "status": "COMPLETED", "upside": 5.8 },
      { "name": "ai_assist", "status": "COMPLETED" },
      { "name": "persistence", "status": "COMPLETED" }
    ]
  }
}
```

### 8.3 Analyze Endpoint

**POST** `/api/analyze`

**Request Body:**
```json
{
  "ticker": "RELIANCE.NS",
  "analysisType": "thesis|dcf|risk|news",
  "stockData": { /* Yahoo Finance data */ }
}
```

**Analysis Types:**
- `thesis` — Investment thesis with Bull/Base/Bear cases
- `dcf` — DCF model assumptions and projections
- `risk` — Risk ratios and peer benchmarking
- `news` — Sentiment analysis and market narrative

---

## 9. Component Architecture

### 9.1 Context API Structure

```
DCFContext
├── safeData: Processed raw data with fallbacks
├── dcfData: Calculated DCF outputs
├── calculateSensitivity: Function for WACC/TGR grid
└── isValid: Boolean validation

CurrencyContext
├── formatCurrency: Currency formatter
├── convertCurrency: Exchange rate conversion
└── currencySymbol: Current symbol
```

### 9.2 Tab Component Hierarchy

```
page.js (Main Page)
├── Header
├── SearchBar
├── StockOverview (Summary card)
├── Analysis Tabs
│   ├── InvestmentThesis
│   │   ├── Bull/Bear/Base cases
│   │   ├── Catalysts & Risks
│   │   └── Position Sizing
│   ├── DCFValuation (with DCFProvider)
│   │   ├── Assumption Inputs
│   │   ├── Projection Table
│   │   ├── SensitivityTable
│   │   └── Valuation Summary
│   ├── RiskRatios
│   │   ├── Technical Analysis
│   │   ├── Quality Ratios
│   │   └── Peer Benchmarks
│   └── NewsSentiment
│       ├── Sentiment Score
│       ├── Analyst Consensus
│       └── Macro Exposure
├── CompareStocks (modal)
└── ExportPDF
```

### 9.3 CSS Theme System

```css
:root {
  /* Primary Colors */
  --teal: #00d4aa;
  --bg-primary: #07090d;
  --bg-secondary: #0c1118;
  --bg-card: #0f1520;
  
  /* Text Colors */
  --txt-primary: #e8f2fc;
  --txt-secondary: #7a9ab8;
  --txt-muted: #3d5468;
  
  /* Semantic */
  --gain: #22c55e;
  --loss: #ef4444;
  --warn: #f59e0b;
  
  /* Fonts */
  --font-playfair: 'Playfair Display', Georgia, serif;
  --font-dm-mono: 'DM Mono', 'Courier New', monospace;
}
```

---

## 10. Rate Limiting & Security

### 10.1 Rate Limit Configuration

```javascript
// lib/rate-limit.js
const RATE_LIMIT_PRESETS = {
  stockData:      { max: 100, window: 60 },   // 100/minute
  aiAnalysis:     { max: 20, window: 60 },    // 20/minute
  valuation:      { max: 30, window: 60 },     // 30/minute
};
```

### 10.2 Security Headers

```javascript
// lib/security.js
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': 'default-src ...',
};
```

### 10.3 Input Validation

```javascript
// lib/validation.js
const validateTicker = (ticker) => {
  // Pattern: A-Z, 0-9, dots, hyphens
  // Min length: 1, Max: 20
  // Sanitization: Trim, uppercase, remove special chars
};
```

---

## 11. Environment Setup

### 11.1 Required Environment Variables

```bash
# .env.local

# Required: Primary AI Provider
NVIDIA_API_KEY="nvapi-your-key-here"

# Required: Fallback AI Provider
GROQ_API_KEY="gsk-your-key-here"

# Optional: Upstash Redis (for distributed rate limiting)
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."

# Optional: Database
DATABASE_URL="postgresql://..."

# Build Configuration (handled by next.config.mjs)
NODE_ENV="development"
```

### 11.2 Installation

```bash
# Clone repository
git clone <repo-url>
cd alphalens-ai

# Install dependencies
npm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with your API keys

# Generate Prisma client
npm run postinstall

# Run development server
npm run dev

# Build for production
npm run build

# Run production server
npm start
```

---

## 12. Development & Production

### 12.1 Build Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| dev | `next dev` | Development server (Turbopack) |
| build | `prisma generate && next build` | Production build |
| start | `next start` | Production server |
| lint | `next lint` | ESLint check |
| test | `jest` | Run test suite |
| postinstall | `prisma generate` | Generate Prisma client |

### 12.2 Deployment (Vercel)

```json
// vercel.json
{
  "maxDuration": 300
}
```

**Known Constraints:**
- Playwright browser installation requires 45-60 seconds
- Initial requests may timeout; subsequent requests cached
- XBRL Parsing adds 10-15 seconds to first Indian equity request

### 12.3 Development Mode Features

- Hot reload enabled
- TurboPack for faster builds
- Detailed error boundaries
- Redux DevTools support (if configured)
- Source maps enabled

### 12.4 Production Optimization

- Images optimized to WebP
- Static generation for landing
- Dynamic rendering for API routes
- Redis caching for rate limiting
- Prisma connection pooling

---

## 13. Key Files Reference

| File | Lines | Purpose |
|------|-------|---------|
| `lib/financial-utils.js` | 800+ | Financial calculation core |
| `lib/dcf-clean.js` | 450+ | DCF calculation functions |
| `lib/dcf-orchestrator.js` | 475 | Production DCF workflow |
| `lib/projections/projection-engine.js` | 464 | 5-year projection logic |
| `app/api/analyze/route.js` | 671 | AI analysis endpoint |
| `app/api/stock/route.js` | 237 | Data fetching pipeline |
| `contexts/DCFContext.js` | 348 | DCF calculation state |
| `DCF_VALUATION_GUIDE.md` | 751 | Detailed DCF documentation |

---

## 14. Validation Checklist

Before trusting any DCF output, verify:

- [ ] TGR < WACC (critical — Gordon Growth requires this)
- [ ] TGR ≤ 4-5% for India / 2-3% for developed markets
- [ ] WACC in 8-14% range (sector-dependent)
- [ ] Terminal Value < 85% of Enterprise Value
- [ ] ROIC > WACC (value creating)
- [ ] Projections within sector ceilings
- [ ] Sensitivity grid looks reasonable
- [ ] Data Trust Score > 60
- [ ] Reverse DCF converged within bounds
- [ ] Scenarios economically correlated

---

## 15. Troubleshooting

### 15.1 Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Rate limit exceeded" | Too many requests | Wait 60 seconds or check Redis config |
| "NSE XBRL parse failed" | NSE API change | Falls back to Yahoo data automatically |
| "Invalid AI response" | JSON parsing error | Retry or lower temperature setting |
| "Negative equity value" | High debt/low cash | Quality Premium bailout triggers |
| Slow first request | Playwright initialization | Normal; subsequent requests cached |

### 15.2 Debug Endpoints

- `GET /api/health` — Health check
- `GET /api/debug/yahoo?ticker=XXX` — Yahoo raw data
- Check browser console for DCF calculation logs

---

*Last Updated: April 2026*
*Model Version: DCF v16.0*
*Documentation Version: 1.0*

**Maintainers:** Ashish Agrahari, Aman Agrahari
**Email:** [Contact maintainers]
**License:** Private — All rights reserved
