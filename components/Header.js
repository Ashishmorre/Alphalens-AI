'use client'
import { useState, useEffect } from 'react'

const DEMO_TICKERS = [
  { t: 'AAPL', p: '213.18', c: '+1.24%' },
  { t: 'NVDA', p: '891.03', c: '+2.87%' },
  { t: 'MSFT', p: '415.32', c: '-0.41%' },
  { t: 'TSLA', p: '248.71', c: '+3.12%' },
  { t: 'GOOGL', p: '175.84', c: '+0.93%' },
  { t: 'META', p: '525.62', c: '+1.65%' },
  { t: 'AMZN', p: '198.45', c: '-0.28%' },
  { t: 'BRK.B', p: '411.20', c: '+0.55%' },
  { t: 'JPM', p: '224.37', c: '+0.78%' },
  { t: 'V', p: '284.15', c: '+0.42%' },
]

export default function Header() {
  const [time, setTime] = useState('')

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }) + ' EST')
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const items = [...DEMO_TICKERS, ...DEMO_TICKERS]

  return (
    <header className="no-print" style={{ borderBottom: '1px solid rgba(0,212,170,0.12)', background: 'rgba(7,9,13,0.95)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 50 }}>
      {/* Ticker tape */}
      <div className="ticker-tape" style={{ background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid rgba(0,212,170,0.06)', height: '28px', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
        <div className="ticker-inner" style={{ display: 'flex', gap: '2.5rem', paddingRight: '2.5rem', fontSize: '0.72rem', fontFamily: 'var(--font-dm-mono)', whiteSpace: 'nowrap' }}>
          {items.map((item, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--txt-secondary)' }}>
              <span style={{ color: 'var(--teal)', fontWeight: 500 }}>{item.t}</span>
              <span style={{ color: 'var(--txt-primary)' }}>${item.p}</span>
              <span style={{ color: item.c.startsWith('+') ? 'var(--gain)' : 'var(--loss)' }}>{item.c}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Main nav */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '60px' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '32px', height: '32px', background: 'var(--teal)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 14L7 8L10 11L14 4" stroke="#07090d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="14" cy="4" r="1.8" fill="#07090d"/>
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--txt-primary)', letterSpacing: '-0.01em', lineHeight: 1 }}>
              AlphaLens<span style={{ color: 'var(--teal)' }}>AI</span>
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--txt-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: 1.2 }}>
              Institutional Research
            </div>
          </div>
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--txt-muted)', fontFamily: 'var(--font-dm-mono)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--gain)', boxShadow: '0 0 6px var(--gain)', animation: 'pulse-teal 2s ease-in-out infinite' }} />
            MARKETS OPEN
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--txt-secondary)', fontFamily: 'var(--font-dm-mono)' }}>
            {time}
          </div>
          <div style={{ padding: '0.25rem 0.75rem', background: 'rgba(0,212,170,0.07)', border: '1px solid rgba(0,212,170,0.18)', borderRadius: '4px', fontSize: '0.7rem', color: 'var(--teal)', letterSpacing: '0.08em', fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase' }}>
            v1.0 Beta
          </div>
        </div>
      </div>
    </header>
  )
}
