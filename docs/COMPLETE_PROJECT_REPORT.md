# ALPHALENS AI - Complete Project Report
## Production-Grade DCF Valuation System for Indian Equities

**Version:** 16.0  
**Last Updated:** 2026-04-14  
**Architecture:** Multi-source data pipeline with AI-assisted qualitative analysis

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Architecture Overview](#architecture-overview)
5. [Data Sources](#data-sources)
6. [DCF Model Mathematics](#dcf-model-mathematics)
7. [Database Schema](#database-schema)
8. [API Endpoints](#api-endpoints)
9. [Configuration](#configuration)
10. [Key Components](#key-components)
11. [Data Flow](#data-flow)
12. [Security & Rate Limiting](#security--rate-limiting)
13. [Future Roadmap](#future-roadmap)

---

## Executive Summary

Alphalens AI is a sophisticated DCF (Discounted Cash Flow) valuation platform specifically designed for Indian stock market analysis. Unlike traditional DCF calculators that rely on static assumptions, Alphalens uses:

- **Multi-source data aggregation** (Yahoo Finance + Screener.in + TradingView)
- **Production-grade validation layer** (rejects garbage data)
- **Macro-aware calculations** (RBI rates, inflation, GDP)
- **Historical trend analysis** (5-10 year CAGR calculations)
- **Pure JavaScript projections** (no AI hallucinations for math)
- **AI-assisted qualitative analysis** (thesis, risks, catalysts only)

The system evolved through 16 major versions, with v16.0 representing a complete architectural overhaul from AI-dependent to validation-first methodology.

---

## Technology Stack

### Core Framework
| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Framework | Next.js | 14.x | React framework with API routes |
| Language | JavaScript/TypeScript | ES2022 | Primary language |
| Runtime | Node.js | 18.x | Server runtime |
| Styling | Tailwind CSS | 3.x | Utility-first CSS |
| UI Components | shadcn/ui | - | Pre-built accessible components |

### State Management
| Component | Technology | Purpose |
|-----------|------------|---------|
| Global State | React Context | DCF calculations, theme |
| Server State | SWR/React Query | API caching |
| Local State | React useState | Component level |

### Database & Storage
| Component | Technology | Purpose |
|-----------|------------|---------|
| ORM | Prisma | Database access |
| Database | SQLite | Local development |
| Cache | In-memory + Redis | Rate limiting, session |

### External Services
| Service | Purpose | Fallback |
|---------|---------|----------|
| Yahoo Finance | Primary financial data | TradingView |
| Screener.in | Peer comparisons, Indian ratios | N/A |
| TradingView | Technical analysis, consensus | Calculated |
| Browserless.io | Cloud browser for scraping | Headless local |
| OpenRouter | AI analysis (qualitative only) | None |

### Testing
| Tool | Purpose |
|------|---------|
| Jest | Unit testing |
| Playwright | E2E testing |
| React Testing Library | Component testing |

---

## Project Structure

```
/mnt/c/Users/aman2/OneDrive/Desktop/AI/DCF/Alphalens-AI-main/
│
├── 📁 app/                          # Next.js App Router
│   ├── api/                         # API Routes
│   │   ├── analyze/                 # Investment thesis, risk analysis
│   │   │   └── route.js            # AI-powered qualitative analysis
│   │   ├── chat/                    # Chat interface routes
│   │   ├── stock/                   # Stock data endpoint
│   │   │   └── route.js            # Yahoo + Screener + TradingView merge
│   │   ├── tradingview/            # TradingView scraping endpoint
│   │   ├── valuation/              # NEW: Production DCF orchestrator
│   │   ├── watchlist/              # User watchlist management
│   │   └── valuation-history/      # Historical valuations
│   ├── page.tsx                    # Main dashboard
│   ├── layout.tsx                  # Root layout with providers
│   └── globals.css                 # Global styles
│
├── 📁 components/                   # React Components
│   ├── ui/                         # shadcn/ui components
│   │   ├── card.tsx
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   ├── StockData.tsx               # Stock data display
│   ├── WatchlistManager.tsx       # Watchlist UI
│   ├── ChatInterface.tsx          # Chat UI
│   ├── SensitivityAnalysis.tsx    # DCF sensitivity tables
│   ├── ValuationHistory.tsx       # Historical valuations
│   └── ThesisDisplay.tsx          # Investment thesis
│
├── 📁 contexts/                     # React Contexts
│   ├── ChatContext.js             # Chat state management
│   ├── WatchlistContext.tsx       # Watchlist state
│   ├── StockContext.tsx           # Stock data state
│   ├── ThemeContext.tsx           # Dark/light mode
│   └── DCFContext.js              # DCF calculation state
│
├── 📁 lib/                        # Utility Libraries
│   ├── ai-normalizer.js          # AI response normalizer
│   ├── api-client.js             # API HTTP client
│   ├── api-utils.js              # API utilities
│   ├── cache.js                  # Caching layer
│   ├── client-utils.js           # Browser utilities
│   ├── dcf-clean.js              # DCF calculations (1700+ lines)
│   ├── dedupe.js                 # Request deduplication
│   ├── financial-utils.js        # Financial math utilities
│   ├── json-parser.js            # Safe JSON parsing
│   ├── nse-xbrl-parser.js        # NSE XBRL parsing
│   ├── observability.js          # Logging/monitoring
│   ├── performance.js            # Performance utils
│   ├── rate-limit.js             # Rate limiting
│   ├── rate-limit-redis.js       # Redis rate limiting
│   ├── screener-scraper.js       # Screener.in scraper
│   ├── tradingview-scraper.js    # TradingView scraper
│   ├── validation.js             # Request validation
│   ├── security.js               # Security headers
│   ├── usePerformance.js         # Performance hooks
│   ├── yahoo-finance.js          # Yahoo Finance integration
│   │
│   ├── 📁 db/                      # Database Layer
│   │   ├── client.js              # Prisma client + CRUD
│   │   └── prisma/
│   │       └── schema.prisma      # Database schema
│   │
│   ├── 📁 macro/                   # Macro Data
│   │   └── rbi-service.js         # RBI rates, inflation
│   │
│   ├── 📁 validation/              # Validation
│   │   └── data-validator.js      # Data quality checks
│   │
│   ├── 📁 projections/           # Projection Engine
│   │   └── projection-engine.js    # Pure JS projections
│   │
│   ├── 📁 historical/            # Historical Data
│   │   └── trends-service.js       # 5-10 year trends
│   │
│   └── ai-gateway/               # AI Gateway
│       └── gateway.js
│
├── 📁 docs/                        # Documentation
│   ├── DATA_SOURCES_ARCHITECTURE.md
│   ├── VIDEO_SCRIPT_DATA_SOURCES.md
│   └── COMPLETE_PROJECT_REPORT.md  # This file
│
├── 📁 __tests__/                   # Test Files
│   ├── financial-utils.test.js    # 44 tests passing
│   └── data-sources-integration.test.js
│
├── 📁 contexts/                    # React Contexts (duplicate link)
│   └── (see above)
│
├── 📁 .next/                       # Next.js build output
├── 📁 node_modules/                # Dependencies
├── 📁 prisma/                      # Prisma migrations
│
├── .env.local                     # Environment variables
├── .env.example                   # Example env
├── next.config.js                 # Next.js config
├── package.json                   # Dependencies
├── jest.config.js                 # Jest config
├── tailwind.config.ts             # Tailwind config
├── tsconfig.json                  # TypeScript config
└── DCF_VALUATION_GUIDE.md         # User-facing DCF guide
```

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   React     │  │  Tailwind   │  │   shadcn    │  │   Context API       │ │
│  │ Components  │  │   Styles    │  │   UI Kit    │  │   (State)           │ │
│  └──────┬──────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────┬───────────────────────────────────────────────────────────────────┘
          │ HTTP / API Calls
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API LAYER                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ /api/stock    │  │ /api/analyze  │  │ /api/valuation│  │ /api/chat     │ │
│  │ (Data Fetch)  │  │ (AI Thesis)   │  │ (DCF Engine)  │  │ (Chat)        │ │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘ │
└──────────┼─────────────────┼─────────────────┼─────────────────┼────────────┘
           │                 │                 │                 │
           ▼                 ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   Yahoo     │  │  Screener   │  │ TradingView │  │  Database       │  │
│  │  Finance    │  │    .in      │  │             │  │  (SQLite)       │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘  │
└─────────┼─────────────────┼─────────────────┼──────────────────┼────────────┘
          │                 │                 │                  │
          └─────────────────┴─────────────────┴──────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     PROCESSING LAYER                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ Validation  │  │    Macro    │  │  Historical │  │  Projection     │  │
│  │   Layer     │  │  (RBI)      │  │   Trends    │  │   Engine        │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘  │
└─────────┼─────────────────┼─────────────────┼──────────────────┼────────────┘
          │                 │                 │                  │
          └─────────────────┴─────────────────┴──────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      DCF ENGINE                                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │    WACC     │  │  Projections│  │   Terminal  │  │   Valuation     │  │
│  │ Calculation │  │   (5-Year)  │  │    Value    │  │    Output       │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Sources

### Primary: Yahoo Finance

**Endpoint:** `query1.finance.yahoo.com/v10/finance/quoteSummary/`

**Modules Requested:**
- `financialData` - Revenue, EBITDA, margins, ratios
- `defaultKeyStatistics` - Market cap, shares, beta, P/E, P/B
- `assetProfile` - Sector, industry, description
- `summaryDetail` - 52W high/low, dividends
- `incomeStatementHistory` - Historical income
- `cashflowStatementHistory` - CapEx, OCF (for manual FCF)

**Key Fields (50+):**
| Field | Source Path | Fallback |
|-------|-------------|----------|
| price | quote.regularMarketPrice | None |
| marketCap | sd.marketCap.raw / fd.marketCap.raw | - |
| revenue | fd.totalRevenue.raw | - |
| ebitda | fd.ebitda.raw | - |
| pe | fd.trailingPE.raw / ks.trailingPE.raw | forwardPE |
| roe | fd.returnOnEquity.raw / ks.returnOnEquity.raw | - |
| beta | ks.beta.raw | - |
| fcf | fd.freeCashflow.raw | **Calculated** |

### Secondary: Screener.in

**Endpoint:** `screener.in/company/{TICKER}/consolidated/`

**Method:** Cheerio HTML scraping

**Data Extracted:**
- Top ratios: Stock P/E, Industry P/E, ROCE, ROE, Debt/Equity, P/B
- Growth metrics: Sales growth, Profit growth, OPM
- Peer comparison table

**Unique Fields:**
- `industryPE` - Sector P/E for comparison
- `screenerPeers` - Array of 5 peer companies
- `roce` - Return on capital employed

### Tertiary: TradingView

**Endpoint:** `tradingview.com/symbols/{EXCHANGE}-{SYMBOL}/`

**Method:** Browserless.io (Playwright cloud browser)

**Data Extracted:**
- Technical indicators: RSI(14), 52W high/low
- Valuation: EV/EBITDA, EV/Revenue
- Financial health: Current ratio, Quick ratio, Interest coverage
- Analyst data: Consensus rating (Buy/Hold/Sell)

**Unique Fields:**
- `rsi14` - Relative Strength Index
- `analystConsensus` - "Strong Buy" to "Strong Sell"
- `evToEbitda` - Enterprise value multiple

---

## DCF Model Mathematics

### 1. Free Cash Flow (FCF)

**Formula:**
```
FCF = NOPAT + Depreciation - CapEx - ΔNWC

Where:
NOPAT = EBIT × (1 - Tax Rate)
Depreciation = Revenue × Depreciation Rate (by sector)
CapEx = Revenue × CapEx % (by growth phase)
ΔNWC = Revenue Change × NWC Rate (3%)
```

**Manual Calculation (when Yahoo missing):**
```javascript
const FCF = OperatingCashFlow - |CapitalExpenditures|
```

### 2. Weighted Average Cost of Capital (WACC)

**Formula:**
```
WACC = (E/V × Ke) + (D/V × Kd × (1 - T))

Where:
E/V = Equity / Total Value (Target: 70%)
D/V = Debt / Total Value (Target: 30%)
Ke = Cost of Equity = Rf + β × (Rm - Rf)
Kd = Cost of Debt = Interest Expense / Total Debt
T = Tax Rate (25% for India)

Cost of Equity (CAPM):
Ke = Risk Free Rate + Beta × Market Risk Premium
Risk Free Rate = India 10Y G-Sec (~6.8%)
Market Risk Premium = 5.5% (historical India)
```

**Dynamic Inputs (from RBI):**
- Risk-free rate from 10Y G-Sec yield
- Inflation from CPI
- GDP growth for TGR

### 3. Terminal Value (Gordon Growth Model)

**Formula:**
```
TV = FCF₅ × (1 + g) / (WACC - g)

Where:
FCF₅ = Year 5 Free Cash Flow
g = Terminal Growth Rate (typically 3.5% for India, max 4.5%)

Terminal Growth Formula:
g = min(4.5%, GDP Growth × 0.5 + Inflation × 0.5)
```

### 4. Present Value Calculations

**PV of Each Year's FCF:**
```
PV(FCF₁) = FCF₁ / (1 + WACC)¹
PV(FCF₂) = FCF₂ / (1 + WACC)²
...
PV(FCF₅) = FCF₅ / (1 + WACC)⁵

Sum of PV(FCF₁₋₅) = Total PV of explicit period
```

**PV of Terminal Value:**
```
PV(TV) = TV / (1 + WACC)⁵
```

### 5. Enterprise & Equity Value

**Enterprise Value:**
```
EV = PV(FCF₁₋₅) + PV(TV)
```

**Equity Value:**
```
Equity Value = EV + Cash - Debt (+ SOTP buffer for utilities)
```

**Intrinsic Value per Share:**
```
IV = Equity Value / Shares Outstanding
```

### 6. Upside & Verdict

**Upside:**
```
Upside % = ((IV - Current Price) / Current Price) × 100
```

**Verdict:**
- UNDERVALUED: Upside > 10%
- NEUTRAL: -10% ≤ Upside ≤ 10%
- OVERVALUED: Upside < -10%

---

## Database Schema

### Prisma Models

```prisma
// Core stock information
model Stock {
  id           String    @id @default(cuid())
  ticker       String    @unique
  name         String
  sector       String?
  industry     String?
  exchange     String?
  country      String    @default("IN")
  currency     String    @default("INR")
  isActive     Boolean   @default(true)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  
  historicalData HistoricalData[]
  valuations     Valuation[]
  snapshots      StockSnapshot[]
}

// Daily snapshots for trend analysis
model StockSnapshot {
  id                String   @id @default(cuid())
  stockId           String
  ticker            String
  date              DateTime
  
  price             Float?
  marketCap         Float?
  sharesOutstanding Float?
  revenue           Float?
  ebitda            Float?
  pe                Float?
  roe               Float?
  beta              Float?
  
  stock Stock @relation(fields: [stockId], references: [id])
  @@index([ticker, date])
}

// Historical annual data
model HistoricalData {
  id            String   @id @default(cuid())
  stockId       String
  ticker        String
  fiscalYear    Int
  period        String   // ANNUAL, Q1, Q2, Q3, Q4
  
  revenue       Float?
  ebitda        Float?
  netIncome     Float?
  freeCashFlow  Float?
  totalDebt     Float?
  totalEquity   Float?
  
  stock Stock @relation(fields: [stockId], references: [id])
  @@unique([ticker, fiscalYear, period])
}

// DCF Valuation runs
model Valuation {
  id                String   @id @default(cuid())
  stockId           String
  ticker            String
  date              DateTime @default(now())
  
  wacc              Float
  terminalGrowthRate Float
  intrinsicValue    Float
  currentPrice      Float
  upside            Float
  verdict           String
  
  pvFCFs            Float
  terminalValue     Float
  enterpriseValue   Float
  equityValue       Float
  
  dataQuality       Float?   // 0-100 score
  aiAssisted        Boolean  @default(false)
  
  stock       Stock        @relation(fields: [stockId], references: [id])
  projections Projection[]
}

// Year-by-year projections
model Projection {
  id          String   @id @default(cuid())
  valuationId String
  year        Int
  
  revenue     Float?
  ebitda      Float?
  fcf         Float?
  pvFCF       Float?
  
  valuation Valuation @relation(fields: [valuationId], references: [id])
}

// RBI macro data
model MacroData {
  id            String   @id @default(cuid())
  date          DateTime
  repoRate      Float?
  gSec10Year    Float?   // Risk-free rate
  inflationCPI  Float?
  gdpGrowth     Float?
}
```

---

## API Endpoints

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/stock` | GET | Fetch merged stock data | No |
| `/api/analyze` | POST | AI-powered analysis | No |
| `/api/valuation` | POST | Complete DCF valuation | No |
| `/api/valuation` | GET | Quick valuation | No |
| `/api/chat` | POST | Chat messages | No |
| `/api/tradingview` | GET | TradingView data | No |
| `/api/watchlist` | GET/POST | User watchlists | Session |
| `/api/valuation-history` | GET | Past valuations | Session |

### `/api/stock` Response Format

```json
{
  "ticker": "TATAPOWER.NS",
  "price": 399.35,
  "marketCap": 1150000000000,
  "revenue": 40000000000,
  "ebitda": 12000000000,
  "pe": 22.5,
  "roe": 0.18,
  "_dataSources": ["yahoo", "screener", "tradingview"],
  "_dataQuality": 92
}
```

### `/api/valuation` Response Format

```json
{
  "status": "SUCCESS",
  "ticker": "TATAPOWER.NS",
  "currentPrice": 399.35,
  "intrinsicValue": 450.20,
  "upside": 12.7,
  "verdict": "UNDERVALUED",
  "projections": [/* 5 years */],
  "assumptions": {
    "wacc": 9.5,
    "terminalGrowthRate": 4.0
  },
  "recommendation": {
    "action": "BUY",
    "confidence": "HIGH"
  }
}
```

---

## Configuration

### Environment Variables (`.env.local`)

```bash
# Required
DATABASE_URL="file:./prisma/alphalens.db"

# Optional - AI Features
OPENROUTER_API_KEY=sk-or-v1-xxx       # For thesis/risk analysis
BROWSERLESS_TOKEN=xxx                  # For TradingView scraping

# Optional - External APIs
NVIDIA_API_KEY=xxx                     # Alternative AI provider

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# Rate Limiting
RATE_LIMIT_RPM=60
RATE_LIMIT_WINDOW_MS=60000

# DCF Defaults
DCF_DEFAULT_MOAT=MODERATE
DCF_PROJECTION_YEARS=5
DCF_BASE_RISK_FREE_RATE=6.8
DCF_MARKET_RISK_PREMIUM=5.5
```

---

## Key Components

### 1. DCF Orchestrator (`lib/dcf-orchestrator.js`)

Main entry point. Coordinates 8 stages:
1. Data Fetch (Yahoo + Screener + TV)
2. Validation
3. Historical Analysis
4. Macro Data (RBI)
5. Projections
6. DCF Calculation
7. AI Assist (lightweight)
8. Persistence

### 2. Projection Engine (`lib/projections/projection-engine.js`)

Pure JavaScript - NO AI.
- 5-year revenue projections with fade
- EBITDA margin convergence
- Dynamic CapEx based on growth phase
- J-curve modeling

### 3. DCF Clean (`lib/dcf-clean.js`)

40+ exported functions:
- `calculateEliteWACC()` - Full WACC with size/country premiums
- `calculateTerminalValue()` - Gordon Growth Model
- `calculateEnterpriseValue()` - EV calculation
- `SECTOR_CAPITAL_STRUCTURES` - Target debt/equity by sector
- `SIZE_PREMIUM_TABLE` - Damodaran size premiums

### 4. Validation Layer (`lib/validation/data-validator.js`)

Data quality checks:
- Range validation (revenue > 1M, P/E < 200)
- Cross-field consistency (operating < gross margin)
- Sector-based sanity checks
- Quality score 0-100

---

## Data Flow

### Complete Request Flow

```
USER REQUEST: Analyze TATAPOWER.NS
│
├─▶ [1] PARALLEL FETCH
│   ├─▶ Yahoo Finance API ─────────▶ Raw financial data
│   ├─▶ Screener.in scraper ─────▶ Peers, industry ratios
│   └─▶ TradingView scraper ─────▶ RSI, consensus
│
├─▶ [2] MERGE LAYER
│   └─▶ Combine data, Yahoo wins conflicts, track sources
│
├─▶ [3] VALIDATION
│   └─▶ Check ranges, flag outliers, score quality
│
├─▶ [4] HISTORICAL ANALYSIS
│   └─▶ Fetch 5-year data, calculate CAGRs
│
├─▶ [5] MACRO DATA
│   └─▶ Fetch RBI rates, inflation, GDP
│
├─▶ [6] PROJECTIONS (JS only)
│   └─▶ Calculate 5-year FCFs with fade rates
│
├─▶ [7] DCF CALCULATION
│   ├─▶ WACC calculation
│   ├─▶ PV of FCFs (years 1-5)
│   ├─▶ Terminal Value
│   └─▶ Intrinsic Value per share
│
├─▶ [8] AI ASSIST (optional)
│   └─▶ Qualitative thesis, risks, catalysts
│
└─▶ [9] PERSISTENCE
    └─▶ Save to database, update history

RESPONSE: Complete valuation with all components
```

---

## Security & Rate Limiting

### Rate Limits (per IP)

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/stock` | 60 | 60 seconds |
| `/api/analyze` | 20 | 60 seconds |
| `/api/valuation` | 30 | 60 seconds |

### Security Headers

- Content Security Policy
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Strict-Transport-Security

---

## Future Roadmap

### Near-term (Q2 2026)
- [ ] Real-time price updates via WebSocket
- [ ] Excel/CSV export
- [ ] Stock screener with filters

### Medium-term (Q3 2026)
- [ ] Portfolio tracking
- [ ] Historical valuation charts
- [ ] Alert system for price targets

### Long-term (Q4 2026)
- [ ] Machine learning for moat detection
- [ ] Automated report generation
- [ ] Mobile app

---

## Performance Metrics

- **API Response Time:** ~500ms (Yahoo), ~2000ms (Screener), ~4000ms (TradingView)
- **DCF Calculation:** ~50ms (pure JS)
- **Database Queries:** ~10-50ms
- **Test Coverage:** 44 tests passing

---

## Files Summary

| File | Lines | Purpose |
|------|-------|---------|
| `lib/dcf-clean.js` | 1,700+ | Core DCF math |
| `lib/projections/projection-engine.js` | 320+ | 5-year projections |
| `lib/yahoo-finance.js` | 350+ | Yahoo integration |
| `lib/db/client.js` | 600+ | Database operations |
| `app/api/analyze/route.js` | 500+ | AI analysis endpoint |
| `lib/validation/data-validator.js` | 400+ | Data validation |

---

**Total Codebase:** ~15,000 lines of production code

**Key Philosophy:** AI assists, JavaScript calculates, data validates.

---

*End of Report*