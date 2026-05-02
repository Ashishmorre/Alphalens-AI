'use client'
import { useState, useEffect } from 'react'

const SCROLL_TICKERS = [
  { symbol: 'MSFT',       price: '420.55', change: '+1.2%',  up: true  },
  { symbol: 'TSLA',       price: '175.22', change: '-2.4%',  up: false },
  { symbol: 'GOOGL',      price: '144.10', change: '+0.8%',  up: true  },
  { symbol: 'META',       price: '485.58', change: '+1.5%',  up: true  },
  { symbol: 'AMZN',       price: '178.15', change: '-0.3%',  up: false },
  { symbol: 'BRK.B',      price: '405.12', change: '+0.1%',  up: true  },
  { symbol: 'JPM',        price: '190.45', change: '+0.5%',  up: true  },
  { symbol: 'AAPL',       price: '173.50', change: '-1.1%',  up: false },
  { symbol: 'NVDA',       price: '880.08', change: '+3.2%',  up: true  },
  { symbol: 'RELIANCE.NS',price: '2847.50',change: '+0.7%',  up: true  },
  { symbol: 'TCS.NS',     price: '3624.10',change: '-0.4%',  up: false },
  { symbol: 'SBIN.NS',    price: '812.35', change: '+1.1%',  up: true  },
]

const POPULAR_TICKERS = [
  'AAPL', 'NVDA', 'RELIANCE.NS', 'TCS.NS', 'MSFT',
  'HDFCBANK.NS', 'INFY.NS', 'TSLA', 'SBIN.NS', 'GOOGL',
]

const FEATURES = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
      </svg>
    ),
    title: 'Investment Thesis',
    desc: 'AI-generated bull, bear & base cases with price targets, moat analysis, and position sizing guidance.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
      </svg>
    ),
    title: 'DCF Valuation',
    desc: '5-year free cash flow model with WACC, terminal value, intrinsic value per share & sensitivity tables.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    title: 'Risk & Ratios',
    desc: 'Complete ratio suite with sector benchmarks, risk matrix, leverage health & technical signals.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
        <path d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/>
      </svg>
    ),
    title: 'News Sentiment',
    desc: 'Sentiment scoring, analyst consensus, macro exposure, catalysts & 30-60 day tactical notes.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 3H2v6M16 3h6v6M2 21h6M16 21h6v-6M12 8v8M8 12h8"/>
      </svg>
    ),
    title: 'Compare Stocks',
    desc: 'Head-to-head comparison of any two tickers with dimension scores and investor-type recommendations.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
      </svg>
    ),
    title: 'PDF Export',
    desc: 'Download a styled research report PDF of any analysis tab to share or store for your portfolio.',
  },
]

export default function LandingHero({ onSearch, loading }) {
  const [query, setQuery] = useState('')
  const items = [...SCROLL_TICKERS, ...SCROLL_TICKERS, ...SCROLL_TICKERS]

  const submit = (ticker) => {
    const val = (ticker || query).trim().toUpperCase()
    if (val && onSearch) onSearch(val)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter') submit()
  }

  return (
    <>
      {/* ── Ticker Tape ─────────────────────────────────────────────────────── */}
      <div className="lh-tape">
        <div className="lh-tape-track">
          {items.map((t, i) => (
            <div key={i} className="lh-tape-item">
              <span className="lh-tape-sym">{t.symbol}</span>
              <span className="lh-tape-price">{t.price}</span>
              <span className={t.up ? 'lh-tape-up' : 'lh-tape-dn'}>{t.change}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="lh-hero">
        {/* Ambient glow orbs */}
        <div className="lh-orb lh-orb1" />
        <div className="lh-orb lh-orb2" />
        {/* Dot grid overlay */}
        <div className="lh-dotgrid" />

        <div className="lh-hero-inner">
          {/* Badge */}
          <div className="lh-badge">
            <span className="lh-badge-dot" />
            Powered by NVIDIA NIM · Real-Time Market Data
          </div>

          {/* Headline */}
          <h1 className="lh-headline">
            Institutional-Grade Analysis,{' '}
            <em className="lh-headline-em">Democratised.</em>
          </h1>

          {/* Sub */}
          <p className="lh-sub">
            <span>DCF models</span>
            <span className="lh-dot-sep">·</span>
            <span>Investment thesis</span>
            <span className="lh-dot-sep">·</span>
            <span>Risk analysis</span>
            <span className="lh-dot-sep">·</span>
            <span>Sentiment scoring</span>
          </p>

          {/* Search */}
          <div className="lh-search-wrap">
            <div className="lh-search-box">
              <svg className="lh-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                className="lh-search-input"
                type="text"
                placeholder="Enter ticker — AAPL, NVDA, RELIANCE.NS…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKey}
                disabled={loading}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                className="lh-search-btn"
                onClick={() => submit()}
                disabled={loading || !query.trim()}
              >
                {loading ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'lh-spin 0.8s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                ) : (
                  <>
                    Analyse
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Popular tickers */}
          <div className="lh-popular">
            <span className="lh-popular-label">Popular</span>
            {POPULAR_TICKERS.map(t => (
              <button key={t} className="lh-chip" onClick={() => submit(t)} disabled={loading}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature Cards ───────────────────────────────────────────────────── */}
      <section className="lh-features">
        <div className="lh-features-header">
          <span className="lh-features-label">What AlphaLens AI Can Do</span>
          <div className="lh-features-line" />
        </div>
        <div className="lh-grid">
          {FEATURES.map((f, i) => (
            <div key={i} className="lh-card" style={{ animationDelay: `${i * 0.07}s` }}>
              <div className="lh-card-icon">{f.icon}</div>
              <h3 className="lh-card-title">{f.title}</h3>
              <p className="lh-card-desc">{f.desc}</p>
              <div className="lh-card-cta">
                Explore
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="lh-footer no-print">
        <div className="lh-footer-inner">
          <div className="lh-footer-brand">
            <span className="lh-footer-logo">AlphaLens<span>AI</span></span>
            <span className="lh-footer-copy">© {new Date().getFullYear()} · For informational purposes only — not investment advice.</span>
          </div>
          <div className="lh-footer-links">
            <a href="#">Terms</a>
            <a href="#">Privacy</a>
            <a href="#">Disclaimers</a>
          </div>
        </div>
      </footer>

      <style>{`
        /* ── Ticker Tape ─────────────────────────────────────────────── */
        .lh-tape {
          overflow: hidden;
          white-space: nowrap;
          background: rgba(0,0,0,0.45);
          border-bottom: 1px solid rgba(0,212,170,0.07);
          height: 30px;
          display: flex;
          align-items: center;
        }
        .lh-tape-track {
          display: inline-flex;
          align-items: center;
          animation: lh-ticker 55s linear infinite;
        }
        .lh-tape-track:hover { animation-play-state: paused; }
        @keyframes lh-ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        .lh-tape-item {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0 1.5rem;
          font-family: var(--font-dm-mono);
          font-size: 0.7rem;
          letter-spacing: 0.06em;
          border-right: 1px solid rgba(255,255,255,0.04);
        }
        .lh-tape-sym   { color: rgba(255,255,255,0.45); }
        .lh-tape-price { color: rgba(255,255,255,0.85); }
        .lh-tape-up    { color: #00d4aa; }
        .lh-tape-dn    { color: #ef4444; }

        /* ── Hero ───────────────────────────────────────────────────── */
        .lh-hero {
          position: relative;
          overflow: hidden;
          padding: 7rem 1.5rem 5rem;
          display: flex;
          justify-content: center;
        }
        .lh-orb {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          filter: blur(80px);
        }
        .lh-orb1 {
          width: 700px; height: 700px;
          background: radial-gradient(circle, rgba(0,212,170,0.13) 0%, transparent 70%);
          top: -300px; left: 50%;
          transform: translateX(-50%);
        }
        .lh-orb2 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(0,120,255,0.07) 0%, transparent 70%);
          bottom: -100px; right: 10%;
        }
        .lh-dotgrid {
          position: absolute; inset: 0; pointer-events: none; z-index: 0;
          background-image:
            radial-gradient(circle, rgba(0,212,170,0.12) 1px, transparent 1px);
          background-size: 36px 36px;
          mask-image: radial-gradient(ellipse 80% 60% at 50% 50%, black 0%, transparent 100%);
          -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 50%, black 0%, transparent 100%);
        }
        .lh-hero-inner {
          position: relative;
          z-index: 1;
          max-width: 760px;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        /* Badge */
        .lh-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.3rem 0.875rem;
          border: 1px solid rgba(0,212,170,0.22);
          border-radius: 999px;
          background: rgba(0,212,170,0.06);
          font-family: var(--font-dm-mono);
          font-size: 0.7rem;
          color: rgba(0,212,170,0.85);
          letter-spacing: 0.05em;
          margin-bottom: 2rem;
        }
        .lh-badge-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #00d4aa;
          box-shadow: 0 0 6px rgba(0,212,170,0.8);
          animation: lh-pulse 2s ease-in-out infinite;
        }
        @keyframes lh-pulse {
          0%,100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.5; transform: scale(0.85); }
        }
        /* Headline */
        .lh-headline {
          font-family: var(--font-playfair);
          font-size: clamp(2.4rem, 7vw, 5.5rem);
          font-weight: 700;
          line-height: 1.08;
          color: #e8f2fc;
          letter-spacing: -0.02em;
          margin-bottom: 1.5rem;
        }
        .lh-headline-em {
          font-style: italic;
          background: linear-gradient(135deg, #00d4aa 0%, #009e7f 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        /* Sub */
        .lh-sub {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 0.25rem 0.75rem;
          font-family: var(--font-dm-mono);
          font-size: 0.9rem;
          color: rgba(255,255,255,0.35);
          margin-bottom: 2.75rem;
          letter-spacing: 0.02em;
        }
        .lh-dot-sep { color: #00d4aa; }

        /* ── Search ─────────────────────────────────────────────────── */
        .lh-search-wrap { width: 100%; max-width: 620px; margin-bottom: 1.5rem; }
        .lh-search-box {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(10,12,16,0.95);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 14px;
          padding: 0.4rem 0.4rem 0.4rem 1.2rem;
          transition: border-color 0.25s, box-shadow 0.25s;
        }
        .lh-search-box:focus-within {
          border-color: rgba(0,212,170,0.5);
          box-shadow: 0 0 0 1px rgba(0,212,170,0.18), 0 0 28px rgba(0,212,170,0.08);
        }
        .lh-search-icon { color: rgba(255,255,255,0.25); flex-shrink: 0; }
        .lh-search-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          font-family: var(--font-dm-mono);
          font-size: 0.875rem;
          color: #e8f2fc;
          padding: 0.625rem 0;
          min-width: 0;
        }
        .lh-search-input::placeholder { color: rgba(255,255,255,0.18); }
        .lh-search-btn {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.625rem 1.25rem;
          background: linear-gradient(135deg, #00d4aa 0%, #009e7f 100%);
          border: none;
          border-radius: 10px;
          font-family: var(--font-dm-mono);
          font-size: 0.82rem;
          font-weight: 500;
          color: #040c0a;
          cursor: pointer;
          letter-spacing: 0.04em;
          transition: opacity 0.2s, transform 0.15s;
          flex-shrink: 0;
          position: relative;
          overflow: hidden;
        }
        .lh-search-btn::after {
          content: '';
          position: absolute; top: 0; left: -100%; width: 50%; height: 100%;
          background: linear-gradient(to right, transparent, rgba(255,255,255,0.22), transparent);
          transform: skewX(-22deg);
          animation: lh-shimmer 3.5s infinite;
        }
        @keyframes lh-shimmer {
          0%   { left: -100%; }
          20%  { left: 180%; }
          100% { left: 180%; }
        }
        .lh-search-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .lh-search-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        @keyframes lh-spin {
          to { transform: rotate(360deg); }
        }

        /* ── Popular ────────────────────────────────────────────────── */
        .lh-popular {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          align-items: center;
          gap: 0.5rem;
          max-width: 620px;
        }
        .lh-popular-label {
          font-family: var(--font-dm-mono);
          font-size: 0.65rem;
          color: rgba(255,255,255,0.25);
          letter-spacing: 0.15em;
          text-transform: uppercase;
          margin-right: 0.25rem;
        }
        .lh-chip {
          padding: 0.3rem 0.75rem;
          border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.09);
          background: rgba(255,255,255,0.04);
          font-family: var(--font-dm-mono);
          font-size: 0.72rem;
          color: rgba(255,255,255,0.5);
          cursor: pointer;
          transition: all 0.18s;
        }
        .lh-chip:hover:not(:disabled) {
          background: rgba(0,212,170,0.1);
          border-color: rgba(0,212,170,0.3);
          color: #00d4aa;
        }
        .lh-chip:disabled { opacity: 0.4; cursor: not-allowed; }

        /* ── Features ───────────────────────────────────────────────── */
        .lh-features {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 1.5rem 5rem;
        }
        .lh-features-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .lh-features-label {
          font-family: var(--font-dm-mono);
          font-size: 0.68rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.3);
          white-space: nowrap;
        }
        .lh-features-line { flex: 1; height: 1px; background: rgba(255,255,255,0.04); }
        .lh-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 1rem;
        }
        .lh-card {
          background: rgba(255,255,255,0.015);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          padding: 2rem;
          cursor: default;
          transition: all 0.28s cubic-bezier(0.4,0,0.2,1);
          animation: lh-fadein 0.5s both;
          backdrop-filter: blur(8px);
        }
        .lh-card:hover {
          background: rgba(0,212,170,0.04);
          border-color: rgba(0,212,170,0.28);
          transform: translateY(-3px);
          box-shadow: 0 16px 40px -8px rgba(0,212,170,0.1), 0 4px 16px rgba(0,0,0,0.4);
        }
        @keyframes lh-fadein {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .lh-card-icon {
          width: 44px; height: 44px;
          border-radius: 10px;
          background: rgba(0,212,170,0.09);
          border: 1px solid rgba(0,212,170,0.15);
          display: flex; align-items: center; justify-content: center;
          color: #00d4aa;
          margin-bottom: 1.25rem;
          transition: transform 0.25s;
        }
        .lh-card:hover .lh-card-icon { transform: scale(1.1) rotate(-3deg); }
        .lh-card-title {
          font-family: var(--font-playfair);
          font-size: 1.1rem;
          font-weight: 600;
          color: #e8f2fc;
          margin-bottom: 0.625rem;
        }
        .lh-card-desc {
          font-family: var(--font-dm-mono);
          font-size: 0.8rem;
          color: rgba(255,255,255,0.4);
          line-height: 1.7;
        }
        .lh-card-cta {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          margin-top: 1.25rem;
          font-family: var(--font-dm-mono);
          font-size: 0.72rem;
          color: #00d4aa;
          letter-spacing: 0.05em;
          opacity: 0;
          transform: translateX(-6px);
          transition: all 0.25s;
        }
        .lh-card:hover .lh-card-cta { opacity: 1; transform: translateX(0); }

        /* ── Footer ─────────────────────────────────────────────────── */
        .lh-footer {
          border-top: 1px solid rgba(255,255,255,0.05);
          background: rgba(5,6,8,0.95);
          padding: 2rem 1.5rem;
        }
        .lh-footer-inner {
          max-width: 1280px;
          margin: 0 auto;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }
        .lh-footer-brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        .lh-footer-logo {
          font-family: var(--font-playfair);
          font-size: 1rem;
          color: rgba(255,255,255,0.5);
        }
        .lh-footer-logo span { color: #00d4aa; }
        .lh-footer-copy {
          font-family: var(--font-dm-mono);
          font-size: 0.68rem;
          color: rgba(255,255,255,0.2);
        }
        .lh-footer-links {
          display: flex;
          gap: 1.5rem;
        }
        .lh-footer-links a {
          font-family: var(--font-dm-mono);
          font-size: 0.72rem;
          color: rgba(255,255,255,0.25);
          text-decoration: none;
          transition: color 0.18s;
        }
        .lh-footer-links a:hover { color: rgba(255,255,255,0.65); }

        @media (max-width: 600px) {
          .lh-hero { padding: 4rem 1rem 3rem; }
          .lh-search-btn span { display: none; }
        }
      `}</style>
    </>
  )
}
