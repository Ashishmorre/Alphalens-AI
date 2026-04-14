# Data Sources Architecture
## Alphalens AI - Multi-Source Data Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         DATA SOURCES ARCHITECTURE v16.0                         │
│                    (Yahoo + Screener + TradingView + Database)                    │
└─────────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────┐
│                              │   TICKER    │  ← User Input (e.g., TATAPOWER.NS)
│                              └──────┬──────┘
│                                     │
├─────────────────────────────────────┼─────────────────────────────────────────────┤
│                                     ▼
│  ┌─────────────────────────────────────────────────────────────────────────────┐
│  │                         SOURCE RESOLUTION LAYER                             │
│  ├─────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│  │   DETECT .NS   │   DETECT .BO    │   NO SUFFIX     │   OTHER EXCHANGES     │
│  │   → India      │   → India       │   → US/Global   │   → Map to exchange   │
│  │   → Use all 3  │   → Use all 3   │   → Yahoo only  │   → Yahoo + TV        │
│  └─────────────────┴─────────────────┴─────────────────┴───────────────────────┘
│                                     │
│                                     ▼
├─────────────────────────────────────────────────────────────────────────────────┤
│                              PARALLEL FETCH LAYER                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────┐ │
│  │    📊 YAHOO FINANCE    │  │     🔍 SCREENER.IN     │  │   📈 TRADINGVIEW   │ │
│  │    ─────────────────   │  │    ─────────────────   │  │   ──────────────   │ │
│  │  Priority: PRIMARY     │  │  Priority: SECONDARY   │  │  Priority: TERTIARY│ │
│  │  Coverage: Global      │  │  Coverage: India Only  │  │  Coverage: Global  │ │
│  │  Speed: ~500ms         │  │  Speed: ~1500ms        │  │  Speed: ~4000ms    │ │
│  │  Method: API           │  │  Method: HTML Scrape   │  │  Method: Browser   │ │
│  │  Reliability: ★★★★★    │  │  Reliability: ★★★☆☆    │  │  Reliability: ★★★★☆│ │
│  └───────────┬────────────┘  └───────────┬────────────┘  └─────────┬──────────┘ │
│              │                           │                         │            │
│              ▼                           ▼                         ▼            │
│  ┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────┐ │
│  │ 50+ Data Fields:       │  │ 15+ Data Fields:       │  │ 30+ Data Fields:   │ │
│  │ • Current Price        │  │ • Stock P/E            │  │ • RSI (14)         │ │
│  │ • Market Cap           │  │ • Industry P/E         │  │ • Analyst Consensus│ │
│  │ • Revenue              │  │ • ROCE                 │  │ • EV/EBITDA        │ │
│  │ • EBITDA               │  │ • ROE                  │  │ • Current Ratio    │ │
│  │ • FCF                  │  │ • Debt/Equity          │  │ • 52W High/Low     │ │
│  │ • Total Debt           │  │ • P/B Ratio            │  │ • Volume           │ │
│  │ • Total Cash           │  │ • Dividend Yield       │  │ • Book Value/Share │ │
│  │ • Beta                 │  │ • Sales Growth         │  │ • Interest Coverage│ │
│  │ • P/E, Forward P/E     │  │ • Profit Growth        │  │ • Quick Ratio      │ │
│  │ • ROE, ROCE            │  │ • OPM                  │  │ • EPS              │ │
│  │ • All Margins          │  │ • PEERS Table          │  │ • Beta             │ │
│  └────────────────────────┘  └────────────────────────┘  └────────────────────┘ │
│              │                           │                         │            │
│              └───────────┬───────────────┴─────────────┬───────────┘            │
│                          │                             │                        │
│                          ▼                             ▼                        │
│              ┌─────────────────────┐      ┌──────────────────────┐              │
│              │   PEER DATA         │      │   TECHNICAL DATA     │              │
│              │   (Screener only)   │      │   (TradingView only) │              │
│              └──────────┬──────────┘      └──────────┬───────────┘              │
│                         │                             │                          │
└─────────────────────────┼─────────────────────────────┼──────────────────────────┘
                          │                             │
                          ▼                             ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            DATA MERGE LAYER                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                         MERGE STRATEGY                                      ││
│  ├─────────────────────────────────────────────────────────────────────────────┤│
│  │  Rule 1: Yahoo always wins for primary fields (Price, Revenue, EBITDA)      ││
│  │  Rule 2: Screener fills gaps (P/E, ROE, Debt/Equity) for Indian stocks      ││
│  │  Rule 3: TradingView fills gaps (RSI, Consensus, Technicals)                  ││
│  │  Rule 4: Conflicts: Log warning, use Yahoo value                            ││
│  │  Rule 5: All sources tracked in _dataSources array                          ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                 │
│  Original: Yahoo              After Screener           After TradingView       │
│  ┌──────────────┐             ┌──────────────┐         ┌──────────────┐        │
│  │ pe: null     │    →        │ pe: 22.5     │    →    │ pe: 22.5     │        │
│  │ roe: null    │    →        │ roe: 0.18    │    →    │ roe: 0.18    │        │
│  │ rsi: null    │    →        │ rsi: null    │    →    │ rsi: 62      │        │
│  │ peers: []    │    →        │ peers: [...] │    →    │ peers: [...] │        │
│  │ consensus: - │    →        │ consensus: - │    →    │ consensus:Buy│        │
│  └──────────────┘             └──────────────┘         └──────────────┘        │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         DATA VALIDATION LAYER                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │  CHECKS PERFORMED:                                                          ││
│  │  ✓ Revenue > 1M and < 500T (ERROR if fail)                                ││
│  │  ✓ P/E between 0.5 and 200 (WARN if outside)                              ││
│  │  ✓ Beta between 0.1 and 3.5 (ERROR if fail)                               ││
│  │  ✓ EBITDA margin -50% to 80% (WARN if outside)                            ││
│  │  ✓ Debt/MarketCap < 10x (WARN if higher)                                  ││
│  │  ✓ Margins are consistent (Operating < Gross)                             ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                     │                                         │
│                          ┌──────────┴──────────┐                               │
│                          ▼                     ▼                               │
│                   ┌────────────┐        ┌────────────┐                      │
│                   │ PASS       │        │ FAIL       │                      │
│                   │ Quality>50 │        │ Quality<50 │                      │
│                   └─────┬──────┘        └─────┬──────┘                      │
│                         │                      │                              │
│                         ▼                      ▼                              │
│               ┌────────────────┐    ┌──────────────────┐                    │
│               │ Continue to    │    │ Log validation   │                    │
│               │ DCF            │    │ errors & return │                    │
│               └────────────────┘    └──────────────────┘                    │
└─────────────────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            DATABASE LAYER                                       │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │  STOCK SNAPSHOT (Saves merged data)                                          ││
│  ├─────────────────────────────────────────────────────────────────────────────┤│
│  │  ticker │ price │ pe │ roe │ beta │ rsi14 │ consensus │ peers │ sources  ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │  VALIDATION_LOG (Tracks data quality issues)                                ││
│  ├─────────────────────────────────────────────────────────────────────────────┤│
│  │  timestamp │ ticker │ field │ expected │ actual │ source │ severity       ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘

LEGEND:
  ─── Active path
  ··· Fallback/conditional
  [■] Process/Transform
  (?) Decision point
  📊 Primary Source
  🔍 Secondary Source
  📈 Tertiary Source
```

## Source Priority Decision Tree

```
                    START
                      │
                      ▼
              ┌───────────────┐
              │ Get Ticker    │
              │ e.g., TATAPOWER.NS
              └───────┬───────┘
                      │
                      ▼
            ┌─────────────────┐
            │ Decode Exchange │
            └────────┬────────┘
                     │
          ┌──────────┼──────────┐
          │          │          │
          ▼          ▼          ▼
    ┌────────┐ ┌────────┐ ┌────────┐
    │.NS/.BO │ │ NO     │ │ OTHER  │
    │India   │ │SUFFIX  │ │.L,.T,.HK│
    └────┬───┘ └───┬────┘ └───┬────┘
         │         │          │
         ▼         ▼          ▼
    ┌────────┐ ┌────────┐ ┌────────┐
    │Enable  │ │Enable  │ │Enable  │
    │ALL 3   │ │Yahoo   │ │Yahoo   │
    │Sources │ │Only    │ │+ TV    │
    └────┬───┘ └───┬────┘ └───┬────┘
         │         │          │
         └────┬────┴────┬─────┘
              │         │
              ▼         ▼
    ┌───────────────────────────────┐
    │ Fetch All Sources in Parallel │
    └───────────────┬───────────────┘
                    │
                    ▼
    ┌───────────────────────────────┐
    │ Wait for Results (Promise.all) │
    │ Yahoo (required)              │
    │ Screener (optional)           │
    │ TradingView (optional)        │
    └───────────────┬───────────────┘
                    │
                    ▼
    ┌───────────────────────────────┐
    │ Merge Strategy:               │
    │ ├─ Yahoo: Base data           │
    │ ├─ Screener: Fill gaps        │
    │ └─ TradingView: Technicals    │
    └───────────────┬───────────────┘
                    │
                    ▼
    ┌───────────────────────────────┐
    │ Validate Merged Data          │
    └───────────────┬───────────────┘
                    │
           ┌────────┴────────┐
           │                 │
           ▼                 ▼
    ┌──────────┐      ┌──────────┐
    │ VALID    │      │ INVALID  │
    │ Data >50 │      │ Errors>0 │
    └────┬─────┘      └────┬─────┘
         │                 │
         ▼                 ▼
    ┌──────────┐      ┌──────────┐
    │ Continue │      │ Return   │
    │ to DCF   │      │ Error    │
    └──────────┘      └──────────┘
```

## Fallback Chain Diagram

```
DATA FIELD: P/E Ratio
══════════════════════════════════════════════════════════════════

    REQUEST: Get P/E for TATAPOWER.NS
                    │
                    ▼
    ┌─────────────────────────────────────────┐
    │ STEP 1: Yahoo Finance API             │ ← PRIMARY
    │ URL: query2.finance.yahoo.com/...       │
    │ Status: SUCCESS │ FAIL │ TIMEOUT      │
    └────────────┬────────────┬───────────────┘
                 │            │
            [SUCCESS]     [FAIL]
                 │            │
                 ▼            ▼
    ┌─────────────────┐  ┌───────────────────────────────────┐
    │ Return Yahoo P/E │  │ STEP 2: Screener.in               │ ← FALLBACK 1
    │ e.g., 22.5       │  │ URL: screener.in/company/TATAPOWER  │
    └─────────────────┘  │ Status: SUCCESS │ FAIL │ BLOCKED │
                         └───────┬──────────┬──────────────────┘
                                 │          │
                            [SUCCESS]    [FAIL]
                                 │          │
                                 ▼          ▼
    ┌─────────────────────────┐ ┌──────────────────────────────────────────┐
    │ Return Screener P/E    │ │ STEP 3: TradingView                        │ ← FALLBACK 2
    │ e.g., 22.3             │ │ URL: tradingview.com/symbols/NSE-TATAPOWER │
    └─────────────────────────┘ │ Status: SUCCESS │ FAIL │ NOT FOUND        │
                                └───────┬──────────┬─────────────────────────┘
                                        │          │
                                   [SUCCESS]    [FAIL]
                                        │          │
                                        ▼          ▼
    ┌─────────────────────────┐ ┌─────────────────────────────┐
    │ Return TradingView P/E │ │ STEP 4: Default/Estimate      │ ← LAST RESORT
    │ e.g., 22.8             │ │ Based on sector average       │
    └─────────────────────────┘ │ e.g., Utilities avg: 18.5   │
                                └─────────────┬───────────────┘
                                              │
                                              ▼
                                ┌─────────────────────────────┐
                                │ Return Estimated P/E         │
                                │ FLAG: dataEstimated = true   │
                                │ Quality score reduced        │
                                └─────────────────────────────┘

══════════════════════════════════════════════════════════════════
DATA FIELD: RSI (14)
══════════════════════════════════════════════════════════════════

    REQUEST: Get RSI for TATAPOWER.NS
                    │
                    ▼
    ┌─────────────────────────────────────────┐
    │ STEP 1: Yahoo Finance                   │ ← PRIMARY
    │ Status: NOT AVAILABLE (Yahoo has RSI)  │
    └────────────┬────────────────────────────┘
                 │
                 ▼
    ┌─────────────────────────────────────────┐
    │ STEP 2: TradingView (ONLY SOURCE)       │ ← PRIMARY FOR RSI
    │ URL: tradingview.com/technicals/        │
    │ Status: SUCCESS │ FAIL │ TIMEOUT       │
    └────────────┬────────────┬───────────────┘
                 │            │
            [SUCCESS]      [FAIL]
                 │            │
                 ▼            ▼
    ┌─────────────────┐  ┌───────────────────────────────────┐
    │ Return RSI       │  │ STEP 3: Calculate from Price     │ ← FALLBACK
    │ e.g., 62.4       │  │ Simple momentum calculation      │
    └─────────────────┘  │ Based on 14-day price change     │
                         │ Estimated RSI: ~55 (neutral)     │
                         └───────────────────────────────────┘

══════════════════════════════════════════════════════════════════
DATA FIELD: Peer Comparisons
══════════════════════════════════════════════════════════════════

    REQUEST: Get Peers for TATAPOWER.NS
                    │
                    ▼
    ┌─────────────────────────────────────────┐
    │ STEP 1: Screener.in (ONLY SOURCE)       │ ← PRIMARY & ONLY
    │ URL: screener.in peers table            │
    │ Status: SUCCESS │ FAIL │ BLOCKED │ 404 │
    └────────────┬────────────┬───────────────┘
                 │            │
            [SUCCESS]      [FAIL]
                 │            │
                 ▼            ▼
    ┌─────────────────┐  ┌───────────────────────────────────┐
    │ Return Peers     │  │ STEP 2: Yahoo Industry Data       │ ← FALLBACK
    │ (5-10 companies)│  │ Get sector, find similar by market │
    │ With metrics     │  │ cap and sector classification     │
    └─────────────────┘  │ Return generic peer list          │
                         │ Quality: LOW (no direct peers)     │
                         └───────────────────────────────────┘
```

## Source Coverage Matrix

| Data Point | Yahoo | Screener | TradingView | Primary | Fallback Chain |
|------------|-------|----------|-------------|---------|----------------|
| **Price** | ✓ | ✗ | ✓ | Yahoo | Yahoo → TV → Screener |
| **Market Cap** | ✓ | ✓ | ✓ | Yahoo | Yahoo → Screener → TV |
| **Revenue** | ✓ | ✗ | ✗ | Yahoo | Yahoo only |
| **EBITDA** | ✓ | ✗ | ✗ | Yahoo | Yahoo only |
| **P/E** | ✓ | ✓ | ✓ | Yahoo | Yahoo → Screener → TV |
| **ROE** | ✓ | ✓ | ✓ | Yahoo | Yahoo → Screener → TV |
| **Beta** | ✓ | ✗ | ✓ | Yahoo | Yahoo → TV |
| **RSI** | ✗ | ✗ | ✓ | TV | TV → Calculate |
| **Consensus** | ✗ | ✗ | ✓ | TV | TV only |
| **Peers** | ✗ | ✓ | ✗ | Screener | Screener → Yahoo Sector |
| **EV/EBITDA** | ✗ | ✗ | ✓ | TV | TV only |
| **Debt/Equity** | ✓ | ✓ | ✓ | Yahoo | Yahoo → Screener → TV |
| **Sector P/E** | ✗ | ✓ | ✗ | Screener | Screener only |
| **52W High/Low** | ✓ | ✗ | ✓ | Yahoo | Yahoo → TV |

## Error Handling Strategy

```
SOURCE FAILURE HANDLING:
────────────────────────────────────────────────────────────

Yahoo Down → Retry 2x → If still fail → Use TradingView + Screener + Estimates
                                    → Mark dataQuality = "DEGRADED"

Screener Blocked → Try alternative URLs → If fail → Mark "screenerUnavailable"
                 → Use Yahoo + TradingView only

TradingView Timeout → Retry 1x → If fail → Skip technical data
                      → Mark "technicalsSkipped"
                      → DCF continues without RSI/consensus

All Sources Fail → Return ERROR: "DATA_UNAVAILABLE"
                   → Suggest manual data entry
                   → Log incident for monitoring
```

## Data Freshness

| Source | Update Frequency | Latency | Cache TTL |
|--------|------------------|---------|-----------|
| Yahoo Finance | Real-time (15 min delay) | ~500ms | 1 hour |
| Screener.in | Daily (EOD) | ~1500ms | 4 hours |
| TradingView | 15 minutes | ~4000ms | 1 hour |
| Database | Historical only | ~50ms | N/A |

## Integration Code Example

```javascript
// app/api/stock/route.js - Simplified flow

export async function GET(request) {
  const { ticker } = extractParams(request)

  // 1. Fetch all sources in parallel
  const [yahooData, screenerData, tradingViewData] = await Promise.all([
    getYahooFinanceData(ticker),
    isScreenerEligible(ticker) ? fetchScreenerData(ticker) : null,
    tickerToTradingView(ticker) ? fetchTradingViewData(exchange, symbol) : null
  ])

  // 2. Merge with priority
  let mergedData = yahooData
  if (screenerData) mergedData = mergeScreenerData(mergedData, screenerData)
  if (tradingViewData) mergedData = mergeTradingViewData(mergedData, tradingViewData)

  // 3. Validate
  const validation = await validateStockData(ticker, mergedData)

  // 4. Return enriched data
  return Response.json({
    ...validation.cleanData,
    _dataSources: ['yahoo', 'screener', 'tradingview'].filter(s => used(s)),
    _dataQuality: validation.dataQuality
  })
}
```