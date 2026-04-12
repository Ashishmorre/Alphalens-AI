# AlphaLens AI — Institutional-Grade Stock Analysis Platform

> AI-powered equity research platform with DCF valuation, investment thesis generation, risk analysis, and sentiment scoring. Built with Next.js 14, Claude AI, and Yahoo Finance.

![AlphaLens AI](https://img.shields.io/badge/Built%20with-Claude%20AI-00d4aa?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square)
![Deploy on Vercel](https://img.shields.io/badge/Deploy-Vercel-black?style=flat-square)

---

## Features

- **Live Market Data** — Real-time price, stats & financials via Yahoo Finance (no API key needed)
- **Investment Thesis** — AI-generated bull/bear/base cases, price targets, moat analysis
- **DCF Valuation** — 5-year FCF model, WACC, sensitivity table, intrinsic value
- **Risk & Ratios** — Valuation multiples, quality ratios, leverage, technical signals, peer benchmarks
- **News Sentiment** — Sentiment score, analyst consensus, macro exposure, catalysts, trading notes
- **Compare Stocks** — Head-to-head analysis of any two tickers with dimension scoring
- **Export to PDF** — Styled research report download
- **Zero API key exposure** — Anthropic key lives only in `.env.local` on the server

---

## Project Structure

```
alphalens-ai/
├── app/
│   ├── api/
│   │   ├── stock/route.js          ← Yahoo Finance proxy (GET)
│   │   ├── analyze/route.js        ← AI analysis (POST) — key stays server-side
│   │   └── compare/route.js        ← AI comparison (POST)
│   ├── globals.css                 ← Bloomberg dark theme
│   ├── layout.js                   ← Root layout + Google Fonts
│   └── page.js                     ← Main page with all state logic
├── components/
│   ├── tabs/
│   │   ├── InvestmentThesis.js
│   │   ├── DCFValuation.js
│   │   ├── RiskRatios.js
│   │   └── NewsSentiment.js
│   ├── Header.js                   ← Ticker tape + nav
│   ├── SearchBar.js
│   ├── StockOverview.js
│   ├── CompareStocks.js
│   ├── ExportPDF.js
│   └── LoadingCard.js
├── lib/
│   └── utils.js                    ← Formatting helpers
├── .env.example                    ← Copy → .env.local
├── .gitignore                      ← .env.local excluded
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
└── package.json
```

---

## Local Setup

### Prerequisites
- Node.js 18+ (check: `node --version`)
- An Anthropic API key — get one at [console.anthropic.com](https://console.anthropic.com)

### Step 1 — Clone and install
```bash
cd alphalens-ai
npm install
```

### Step 2 — Set up environment
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

### Step 3 — Run locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

---

## Deploy to Vercel (Free — Get a Public URL)

### Step 1 — Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit: AlphaLens AI"
```

Create a new repo on GitHub (github.com/new), then:
```bash
git remote add origin https://github.com/YOUR_USERNAME/alphalens-ai.git
git branch -M main
git push -u origin main
```

> **Important:** `.env.local` is in `.gitignore` — your API key will NOT be pushed to GitHub.

### Step 2 — Deploy on Vercel
1. Go to [vercel.com](https://vercel.com) → Sign in with GitHub
2. Click **"Add New Project"** → Import your `alphalens-ai` repo
3. Keep all defaults (Vercel auto-detects Next.js)
4. **Add Environment Variable:**
   - Key: `ANTHROPIC_API_KEY`
   - Value: `sk-ant-api03-your-key-here`
5. Click **Deploy**

You'll get a URL like: `https://alphalens-ai.vercel.app` ✨

### Step 3 — Share on LinkedIn
```
🚀 Built AlphaLens AI — an institutional-grade stock analysis platform powered by Claude AI.

Features: DCF valuation models, investment thesis generation, risk analysis, sentiment scoring & peer comparison.

Live: https://alphalens-ai.vercel.app
GitHub: https://github.com/YOUR_USERNAME/alphalens-ai

#FinTech #AI #Finance #EquityResearch #CFA #NextJS
```

---

## Security Architecture

```
Browser → Next.js Server → Anthropic API
                ↑
         ANTHROPIC_API_KEY
         (env var, never sent to browser)
```

- The API key is accessed only in `app/api/*/route.js` (server-side)
- Yahoo Finance calls are also proxied through `/api/stock` to avoid CORS
- Users never see or need any API key

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| AI | Anthropic Claude (claude-opus-4-5) |
| Market Data | yahoo-finance2 (free, no key) |
| Styling | Tailwind CSS + custom CSS variables |
| Fonts | Playfair Display + DM Mono (Google Fonts) |
| Charts | Recharts |
| PDF | jsPDF |
| Deployment | Vercel (free tier) |

---

## Customisation Tips

- **Change AI model**: Edit `model` in `app/api/analyze/route.js` (use `claude-haiku-4-5-20251001` for faster/cheaper)
- **Add new analysis types**: Add a prompt builder function in `analyze/route.js` and a tab in `page.js`
- **Branding**: Update `Header.js` and CSS variables in `globals.css`
- **Rate limiting**: Add `upstash/ratelimit` or middleware to limit requests per IP for production

---

## Disclaimer

AlphaLens AI is for informational and educational purposes only. It does not constitute financial advice. Always conduct your own research before making investment decisions.

---

*Built by Ashish & Aman · CFA Candidate · BCom Hons*
