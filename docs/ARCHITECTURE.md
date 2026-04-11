# AlphaLens AI - Architecture Overview

## Project Structure

```
/mnt/c/Users/aman2/OneDrive/Desktop/AI/DCF/Alphalens-AI-main/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   ├── analyze/       # AI analysis endpoint
│   │   ├── compare/       # Stock comparison endpoint
│   │   └── stock/         # Stock data endpoint
│   ├── globals.css        # Global styles
│   ├── layout.js          # Root layout
│   └── page.js            # Home page
├── components/            # React components
│   ├── tabs/             # Analysis tab components
│   ├── CompareStocks.js
│   ├── ExportPDF.js
│   ├── Header.js
│   ├── LoadingCard.js
│   ├── SearchBar.js
│   └── StockOverview.js
├── src/lib/              # Shared utilities (validated by @/lib/*)
│   ├── api-utils.js      # API response helpers
│   ├── cache.js          # Server-side caching
│   ├── client-utils.js   # Client-side helpers
│   ├── dedupe.js         # Request deduplication
│   ├── json-parser.js    # Safe JSON parsing
│   ├── performance.js    # Performance utilities
│   ├── rate-limit.js     # Rate limiting
│   ├── security.js       # Security utilities
│   ├── usePerformance.js # React performance hooks
│   ├── validation.js     # Input validation
│   └── yahoo-finance.js  # Yahoo Finance integration
├── next.config.js         # Next.js configuration
├── jsconfig.json          # Module path aliases
└── package.json
```

## Key Architectural Decisions

### 1. Shared Utilities (src/lib/)
- Single source of truth for all utilities
- Imported via `@/lib/*` alias
- Server-side utilities: caching, rate-limiting, security
- Client-side utilities: formatting, React hooks

### 2. API Route Structure
- All routes use standardized response format: `{ success, data, error }`
- Security headers applied to all responses
- Rate limiting per endpoint with different presets
- Input sanitization and validation

### 3. Performance Optimizations
- Server-side in-memory caching (30s TTL for stock data)
- Request deduplication for concurrent identical requests
- Next.js fetch caching with `no-store` for real-time data
- Client-side sessionStorage cache for analysis results

### 4. Security Hardening
- CORS headers with configurable origins
- Input sanitization (remove control characters, scripts)
- Security headers (X-Frame-Options, CSP, etc.)
- Suspected scanner user-agent blocking

### 5. Error Handling
- Centralized error logging with structured format
- Safe error messages to client
- JSON parsing with balanced brace counting
- AI provider fallback (Cerebras → Groq)

## Environment Variables

```bash
# Required for AI analysis
CEREBRAS_API_KEY=your_cerebras_api_key
GROQ_API_KEY=your_groq_api_key

# Optional - for CORS origin whitelist
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

## API Endpoints

| Endpoint | Method | Rate Limit | Description |
|----------|--------|------------|-------------|
| /api/stock | GET | 20/min | Fetch stock data |
| /api/analyze | POST | 5/min | AI analysis |
| /api/compare | POST | 3/min | Compare two stocks |

## Build & Deploy

```bash
# Development
npm run dev

# Production build
npm run build

# Start production server
npm start
```
