'use client'
import { useState, useRef, useCallback, useEffect } from 'react'

const POPULAR = ['AAPL', 'NVDA', 'RELIANCE.NS', 'TCS.NS', 'MSFT', 'HDFCBANK.NS', 'INFY.NS', 'TSLA', 'SBIN.NS', 'GOOGL']

// Known Indian tickers that should get .NS suffix auto-appended
const KNOWN_INDIAN_TICKERS = new Set([
  'RELIANCE', 'TCS', 'HDFCBANK', 'HDFC', 'INFY', 'INFOSY', 'SBIN', 'ICICIBANK',
  'HINDUNILVR', 'KOTAKBANK', 'ITC', 'BHARTIARTL', 'AXISBANK', 'LT', 'ASIANPAINT',
  'MARUTI', 'BAJFINANCE', 'BAJAJFINSV', 'WIPRO', 'HCLTECH', 'ULTRACEMCO',
  'TITAN', 'SUNPHARMA', 'TATAMOTORS', 'TATASTEEL', 'NESTLEIND', 'ADANIPORTS',
  'POWERGRID', 'NTPC', 'ONGC', 'JSWSTEEL', 'GRASIM', 'TECHM', 'INDUSINDBK',
  'DIVISLAB', 'DRREDDY', 'CIPLA', 'BRITANNIA', 'EICHERMOT', 'TATAPOWER',
  'ADANIENT', 'VEDL', 'COALINDIA', 'HINDALCO', 'BPCL', 'HEROMOTOCO',
  'BAJAJ-AUTO', 'SIEMENS', 'PIDILITIND', 'HAVELLS', 'DABUR', 'MARICO',
  'NIFTY', 'BANKNIFTY', 'SENSEX'
])

/**
 * Auto-append .NS suffix for known Indian tickers that don't already have a suffix.
 * @param {string} ticker
 * @returns {string}
 */
function normalizeTickerForSearch(ticker) {
  const upper = ticker.toUpperCase().trim()
  // Already has a suffix (.NS, .BO, .L, etc.) — leave it alone
  if (upper.includes('.')) return upper
  // Known Indian ticker — auto-add .NS
  if (KNOWN_INDIAN_TICKERS.has(upper)) return upper + '.NS'
  // Unknown — return as-is (US/global)
  return upper
}

// Debounce hook for input handling
function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export default function SearchBar({ onSearch, loading }) {
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const inputRef = useRef(null)

  // Debounce typing state for visual feedback
  useEffect(() => {
    setIsTyping(true)
    const timer = setTimeout(() => setIsTyping(false), 300)
    return () => clearTimeout(timer)
  }, [input])

  const handleSubmit = useCallback((e) => {
    e?.preventDefault()
    const val = normalizeTickerForSearch(input.trim())
    if (val) onSearch(val)
  }, [input, onSearch])

  const handleInputChange = useCallback((e) => {
    // Prevent input that looks like SQL injection or XSS
    const sanitized = e.target.value.replace(/[<>'"";]/g, '')
    setInput(sanitized)
  }, [])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit()
  }

  const handlePopular = (ticker) => {
    // Tickers in POPULAR already have correct suffix — just use as-is
    setInput(ticker)
    onSearch(ticker)
  }

  return (
    <div className="animate-slide-up" style={{ textAlign: 'center', padding: '3rem 0 2rem' }}>
      {/* Headline */}
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ fontSize: '0.75rem', letterSpacing: '0.2em', color: 'var(--teal)', textTransform: 'uppercase', marginBottom: '0.5rem', fontFamily: 'var(--font-dm-mono)' }}>
          AI-Powered Equity Intelligence
        </div>
        <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: 'clamp(2rem, 5vw, 3.2rem)', fontWeight: 600, color: 'var(--txt-primary)', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
          Institutional-Grade Analysis,
          <br />
          <span style={{ color: 'var(--teal)' }}>Democratised.</span>
        </h1>
      </div>
      <p style={{ color: 'var(--txt-secondary)', fontSize: '0.9rem', marginBottom: '2.5rem', maxWidth: '480px', margin: '0 auto 2.5rem', lineHeight: 1.6 }}>
        DCF models · Investment thesis · Risk analysis · Sentiment scoring
      </p>

      {/* Search input */}
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'stretch', padding: '4px', background: 'var(--bg-card)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: '10px', boxShadow: '0 0 40px rgba(0,212,170,0.06)', transition: 'border-color 0.2s, box-shadow 0.2s' }}
          onFocus={() => {}}
        >
          <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '1rem' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Enter ticker symbol — AAPL, NVDA, TSLA..."
            maxLength={10}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--txt-primary)',
              fontSize: '1rem',
              fontFamily: 'var(--font-dm-mono)',
              letterSpacing: '0.05em',
              padding: '0.75rem 0',
            }}
            disabled={loading}
          />
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={loading || !input.trim()}
            style={{ margin: '4px', minWidth: '120px', fontSize: '0.85rem' }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <SpinnerIcon />
                Fetching...
              </span>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
                Analyse
              </>
            )}
          </button>
        </div>

        {/* Popular tickers */}
        <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--txt-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Popular:</span>
          {POPULAR.map((t) => (
            <button
              key={t}
              onClick={() => handlePopular(t)}
              disabled={loading}
              style={{
                padding: '0.25rem 0.625rem',
                fontSize: '0.72rem',
                fontFamily: 'var(--font-dm-mono)',
                background: 'rgba(0,212,170,0.05)',
                border: '1px solid rgba(0,212,170,0.12)',
                borderRadius: '4px',
                color: 'var(--txt-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                letterSpacing: '0.04em',
              }}
              onMouseEnter={e => { e.target.style.borderColor = 'rgba(0,212,170,0.35)'; e.target.style.color = 'var(--teal)'; e.target.style.background = 'rgba(0,212,170,0.1)' }}
              onMouseLeave={e => { e.target.style.borderColor = 'rgba(0,212,170,0.12)'; e.target.style.color = 'var(--txt-secondary)'; e.target.style.background = 'rgba(0,212,170,0.05)' }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  )
}
