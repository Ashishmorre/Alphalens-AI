# Video Script: Data Sources Architecture
## Alphalens AI - Multi-Source Data Pipeline

---

## Video Outline (3-4 minutes)

### Scene 1: Introduction (0:00-0:30)
**Visual:** 
- Title card: "How Alphalens Gets Its Data"
- Split screen showing 3 data sources
- Stock ticker: TATAPOWER.NS

**VOICEOVER:**
> "When you analyze Tata Power on Alphalens, where does all that financial data come from? Today, I'll show you our multi-source architecture that fetches, merges, and validates data from three different providers to give you the most accurate picture possible."

---

### Scene 2: The Three Sources (0:30-1:15)
**Visual:**
- Three animated boxes appear sequentially

```
┌─────────────────┐
│ 📊 YAHOO        │  ← SLIDE IN FROM LEFT
│   FINANCE       │
│   ─────────     │
│   Primary       │
│   Global        │
│   500ms         │
└─────────────────┘

        ┌─────────────────┐
        │ 🔍 SCREENER.IN  │  ← SLIDE IN FROM TOP
        │   ─────────     │
        │   Secondary     │
        │   India Only    │
        │   Peer Data     │
        └─────────────────┘

               ┌─────────────────┐
               │ 📈 TRADINGVIEW  │  ← SLIDE IN FROM RIGHT
               │   ─────────     │
               │   Tertiary      │
               │   Technicals    │
               │   Analyst views │
               └─────────────────┘
```

**VOICEOVER:**
> "We don't rely on just one source. We pull from three: Yahoo Finance as our primary global source, Screener.in for Indian-specific peer comparisons, and TradingView for technical indicators and analyst consensus."

---

### Scene 3: What Each Source Provides (1:15-2:00)
**Visual:** 
- Table comparison with highlights
- Screen recordings of actual API calls

**YAHOO FINANCE (Screen recording):**
```
query2.finance.yahoo.com/v10/quoteSummary/TATAPOWER.NS

Response:
├── price: ₹399.35
├── marketCap: ₹1,15,000 Cr
├── revenue: ₹40,000 Cr  ← INCOME STATEMENT
├── ebitda: ₹12,000 Cr
├── totalDebt: ₹15,000 Cr  ← BALANCE SHEET
├── totalCash: ₹8,000 Cr
├── pe: 22.5  ← VALUATION
├── roe: 18.5%
└── beta: 0.85  ← RISK METRICS
```

**SCREENER.IN (Screen recording):**
```
screener.in/company/TATAPOWER/consolidated/

Extracted:
├── Stock P/E: 22.5  ← VERIFICATION
├── Industry P/E: 18.5  ← COMPARISON
├── ROCE: 16.2%  ← EFFICIENCY
├── PEERS TABLE  ← ⭐ UNIQUE
│   ├── Adani Power: PE 15.2
│   ├── NTPC: PE 12.8
│   └── Torrent Power: PE 19.4
└── Sales Growth: 15.2%
```

**TRADINGVIEW (Screen recording):**
```
tradingview.com/symbols/NSE-TATAPOWER/technicals/

Data:
├── RSI (14): 62  ← UNIQUE
├── Analyst Consensus: BUY  ← ⭐ UNIQUE
├── 52W High: ₹450
├── EV/EBITDA: 7.8  ← UNIQUE
├── Current Ratio: 1.2  ← LIQUIDITY
└── Interest Coverage: 4.5
```

**VOICEOVER:**
> "Yahoo gives us the fundamentals: price, revenue, EBITDA, debt, and cash. Screener adds Indian context: peer comparisons, industry P/E ratios, and ROCE. TradingView contributes what others don't: RSI for technical analysis, analyst consensus ratings, and additional valuation multiples like EV to EBITDA."

---

### Scene 4: The Merge Process (2:00-2:30)
**Visual:**
- Animation showing data flowing and merging

```
YAHOO DATA                    MERGED RESULT
┌─────────────────┐           ┌─────────────────┐
│ price: 399      │──────────▶│ price: 399      │
│ pe: null        │           │ pe: 22.5        │◄── SCReener
│ roe: null       │           │ roe: 18.5%      │◄── fills gaps
│ rsi: null       │    +      │ rsi: 62         │◄── TradingView
│ peers: []       │           │ peers: [...]    │◄── adds peers
│ consensus: -    │           │ consensus: BUY  │◄── adds consensus
└─────────────────┘           └─────────────────┘
        │                            │
        ▼                            ▼
[INCOMPLETE]              [COMPLETE & VERIFIED]
Quality: 60%              Quality: 95%
```

**VOICEOVER:**
> "Here's where it gets interesting. Yahoo is our primary source, but when it has gaps—like a missing P/E ratio—we fill them from Screener. When we need technical indicators like RSI, TradingView provides them. The result is a complete, multi-verified dataset."

---

### Scene 5: Fallback Chain (2:30-2:50)
**Visual:**
- Flowchart showing P/E retrieval attempt

```
USER: Get P/E for Tata Power
       │
       ▼
┌────────────────┐
│ YAHOO          │ ◄── PRIMARY
│ Status: SUCCESS│
│ pe: 22.5       │
└────┬───────────┘
     │
     ▼
[RETURN 22.5 from Yahoo]

           ┌────────────────────────────┐
           │ IF Yahoo FAILS:            │
           │ ┌──────────────────────┐   │
           │ │ SCREENER             │   │
           │ │ PE: 22.3             │   │ ◄── FALLBACK 1
           │ └──────────────────────┘   │
           └────────────────────────────┘
                    │
           ┌────────┴────────┐
           │ IF Screener FAILS│
           │ ┌───────────────┐│
           │ │ TRADINGVIEW   ││ ◄── FALLBACK 2
           │ │ PE: 22.8      ││
           │ └───────────────┘│
           └───────────────────┘
                    │
           ┌────────┴────────┐
           │ IF All FAIL:      │
           │ Use Sector Avg:   │ ◄── LAST RESORT
           │ PE: 18.5          │
           │ ⚠️ Flag: Estimated│
           └───────────────────┘
```

**VOICEOVER:**
> "What happens if a source fails? We have a fallback chain. Try Yahoo first, then Screener, then TradingView. If all fail, we use sector averages—but we flag that the data is estimated and reduce our confidence score."

---

### Scene 6: Validation (2:50-3:15)
**Visual:**
- Quality checks animation
- Before/After validation

```
┌─────────────────────────────────────────────┐
│     VALIDATION LAYER                        │
├─────────────────────────────────────────────┤
│                                             │
│ ✓ Revenue > 0 and < 500T        [PASS]     │
│ ✓ P/E between 0.5 and 200       [PASS]     │
│ ✓ Beta between 0.1 and 3.5      [PASS]     │
│ ⚠ EBITDA margin outside range     [WARN]     │
│ ✓ Debt/MarketCap < 10x            [PASS]    │
│ ✓ Margins consistent              [PASS]    │
│                                             │
├─────────────────────────────────────────────┤
│ DATA QUALITY SCORE: ████████░░ 85%        │
│ STATUS: ✅ USABLE FOR DCF                  │
└─────────────────────────────────────────────┘
```

**VOICEOVER:**
> "Before any calculation, we validate. Is revenue positive? Is P/E reasonable? Are margins consistent? We score data quality from 0 to 100. Below 50, we reject. Above 50, we proceed with confidence."

---

### Scene 7: Real Example (3:15-3:45)
**Visual:**
- Split screen API response vs final display

**VOICEOVER:**
> "Let me show you a real example. For Tata Power, we fetched 50 fields from Yahoo, 10 peer comparisons from Screener, and added RSI plus analyst consensus from TradingView. After merging and validation, our data quality score was 92%—meaning we'd invested 92 out of 100 confidence points."

**On Screen:**
```
FINAL DATA OBJECT:
├── ticker: "TATAPOWER.NS"
├── price: 399.35
├── _dataSources: ["yahoo", "screener", "tradingview"]
├── _dataQuality: 92
├── pe: 22.5
├── roe: 18.5%
├── rsi: 62
├── analystConsensus: "BUY"
├── peers: [5 companies]
└── ... 65 more fields
```

---

### Scene 8: Summary (3:45-4:00)
**Visual:**
- Summary graphic
- Call to action

```
┌─────────────────────────────────────────────┐
│                                             │
│   Three Sources. One Result.                │
│                                             │
│   ✓ Yahoo Finance    → Primary              │
│   ✓ Screener.in      → Peers                │
│   ✓ TradingView      → Technicals           │
│                                             │
│   → Merged                                        │
│   → Validated                                       │
│   → Reliable                                  │
│                                             │
│   That's the Alphalens difference.          │
│                                             │
└─────────────────────────────────────────────┘
```

**VOICEOVER:**
> "Three sources. One merged dataset. Full validation. That's how Alphalens ensures your DCF valuations are built on rock-solid data. Try it yourself at alphalens.ai"

---

## Technical Specifications

### Resolution
- 1080p (1920x1080) or 4K (3840x2160)

### Aspect Ratio
- 16:9 horizontal for main content
- 9:16 vertical for mobile/social cuts

### Color Scheme
```
Primary:   #0A0F1C (Dark navy background)
Secondary: #1A1F2E (Card backgrounds)
Accent:    #00D4AA (Green for Yahoo/checks)
Accent 2:  #FF6B35 (Orange for warnings)
Accent 3:  #6366F1 (Purple for Screener)
Accent 4:  #F59E0B (Amber for TradingView)
Text:      #FFFFFF (White)
Muted:     #94A3B8 (Gray)
```

### Typography
- Headers: Inter Bold, 48px
- Body: Inter Regular, 24px
- Code: JetBrains Mono, 16px
- Captions: Inter Medium, 18px

### Animation Timing
- Slide in: 300ms ease-out
- Fade: 200ms ease-in-out
- Typewriter: 50ms per character
- Data flow: 500ms with stagger

### Music/Sound
- Background: Tech corporate, 120 BPM
- Sound effects:
  - Success: Soft chime
  - Warning: Subtle alert
  - Data fetch: Whoosh
  - Merge: Satisfying click

---

## B-Roll Footage Needed

1. Stock market ticker display (generic)
2. Person using laptop with financial charts
3. Server/database visualization
4. India stock exchange building
5. Financial newspaper/magazine
6. Abstract data visualization

---

## Lower Thirds

**Scene 2:** 
```
┌──────────────────────────────────────┐
│  THREE DATA SOURCES                  │
│  Yahoo + Screener + TradingView     │
└──────────────────────────────────────┘
```

**Scene 4:**
```
┌──────────────────────────────────────┐
│  MERGE PROCESS                        │
│  Strategy: Fill gaps, verify data    │
└──────────────────────────────────────┘
```

**Scene 5:**
```
┌──────────────────────────────────────┐
│  FALLBACK CHAIN                       │
│  Yahoo → Screener → TV → Estimate   │
└──────────────────────────────────────┘
```

---

## Call-to-Action Cards

**End Screen:**
```
┌─────────────────────────────────────────────┐
│                                             │
│   Try Alphalens Now                         │
│   alphalens.ai                              │
│                                             │
│   [Learn More] [Subscribe] [Share]          │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Accessibility Notes

- All text on screen also spoken in VO
- Color contrast minimum 4.5:1
- Captions provided for all audio
- Alt text for all visual elements
- No flashing content >3Hz
