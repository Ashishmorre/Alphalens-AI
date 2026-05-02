'use client'
import { formatNumber, formatPrice, formatVolume, formatMultiple, formatPct, changeSign, truncate, getExchangeFlag } from '@/lib/client-utils'

export default function StockOverview({ data }) {
  if (!data) return null

  const isPositive = data.change >= 0
  const changeColor = isPositive ? '#00d4aa' : '#ef4444'
  const pricePctOf52W = data.weekHigh52 && data.weekLow52
    ? Math.min(100, Math.max(0, ((data.price - data.weekLow52) / (data.weekHigh52 - data.weekLow52)) * 100))
    : null

  const primaryStats = [
    { label: 'Market Cap',   value: formatNumber(data.marketCap, 2, data.currency),      dkey: null },
    { label: 'P/E (TTM)',    value: formatMultiple(data.pe),                              dkey: 'pe' },
    { label: 'Forward P/E', value: formatMultiple(data.forwardPE),                       dkey: null },
    { label: 'EV/EBITDA',   value: formatMultiple(data.evToEbitda),                      dkey: 'evToEbitda' },
    { label: 'EPS (TTM)',   value: formatPrice(data.eps, data.currency),                 dkey: null },
    { label: 'Beta',        value: data.beta?.toFixed(2) || '—',                         dkey: null },
    { label: 'Volume',      value: formatVolume(data.volume),                            dkey: null },
    { label: 'Avg Volume',  value: formatVolume(data.avgVolume),                         dkey: null },
  ]

  const secondaryStats = [
    { label: 'Revenue',                              value: formatNumber(data.revenue, 2, data.currency),           dkey: 'netIncome' },
    { label: 'EBITDA',                               value: formatNumber(data.ebitda, 2, data.currency),            dkey: 'ebitda' },
    { label: `FCF (FY${data._fcfPeriod || 'TTM'})`, value: formatNumber(data.freeCashFlow, 2, data.currency),      dkey: 'fcf' },
    { label: 'Gross Margin',                         value: formatPct(data.grossMargin),                            dkey: null },
    { label: 'Net Margin',                           value: formatPct(data.profitMargin),                           dkey: null },
    { label: 'ROE',                                  value: data.roe != null ? formatPct(data.roe) : '—',           dkey: 'roe' },
    { label: 'D/E Ratio',                            value: formatMultiple(data.debtToEquity),                      dkey: null },
    { label: 'Analyst Target',                       value: formatPrice(data.targetMeanPrice, data.currency),       dkey: null },
  ]

  return (
    <div className="animate-slide-up" style={{ marginBottom: '1.5rem' }}>
      {/* ── Main Hero Card ──────────────────────────────────────────── */}
      <div style={{
        background: 'rgba(255,255,255,0.018)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '18px',
        padding: '2rem',
        marginBottom: '0.875rem',
        position: 'relative',
        overflow: 'hidden',
        backdropFilter: 'blur(12px)',
      }}>
        {/* Ambient corner glow */}
        <div style={{
          position: 'absolute', top: 0, right: 0,
          width: '280px', height: '280px',
          background: 'radial-gradient(circle, rgba(0,212,170,0.07) 0%, transparent 70%)',
          borderRadius: '50%', pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>

          {/* ── Left: Identity + Price ──────────────────────────────── */}
          <div style={{ flex: '1 1 280px' }}>
            {/* Ticker badge + sector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.875rem', flexWrap: 'wrap' }}>
              <span style={{
                fontFamily: 'var(--font-dm-mono)', fontSize: '0.75rem',
                color: 'var(--teal)', background: 'rgba(0,212,170,0.09)',
                border: '1px solid rgba(0,212,170,0.22)',
                padding: '0.25rem 0.75rem', borderRadius: '5px',
                letterSpacing: '0.08em', fontWeight: 600,
              }}>
                {getExchangeFlag(data.exchange)} {data.ticker}
              </span>
              {data.marketState === 'CLOSED' && (
                <span style={{
                  fontSize: '0.65rem', color: 'var(--warn)',
                  background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                  padding: '0.15rem 0.5rem', borderRadius: '3px',
                  fontFamily: 'var(--font-dm-mono)',
                }}>CLOSED</span>
              )}
              {data.sector && (
                <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-dm-mono)' }}>
                  {data.sector}{data.industry ? ` · ${data.industry}` : ''}
                </span>
              )}
            </div>

            {/* Company name */}
            <h2 style={{
              fontFamily: 'var(--font-playfair)',
              fontSize: 'clamp(1.4rem, 3vw, 2.4rem)',
              fontWeight: 700, color: '#e8f2fc',
              lineHeight: 1.1, marginBottom: '1.25rem',
              letterSpacing: '-0.01em',
            }}>
              {data.name}
            </h2>

            {/* Price + change */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
              <span style={{
                fontFamily: 'var(--font-dm-mono)',
                fontSize: 'clamp(2.2rem, 5vw, 3.5rem)',
                fontWeight: 400, color: '#e8f2fc',
                letterSpacing: '-0.03em', lineHeight: 1,
                textShadow: isPositive ? '0 0 24px rgba(0,212,170,0.25)' : '0 0 24px rgba(239,68,68,0.15)',
              }}>
                {formatPrice(data.price, data.currency)}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '1.1rem', color: changeColor }}>
                  {isPositive ? '▲' : '▼'}
                </span>
                <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '1rem', color: changeColor, fontWeight: 500 }}>
                  {changeSign(data.change)}{formatPrice(Math.abs(data.change), data.currency)}
                  {' · '}
                  {changeSign(data.changePercent)}{data.changePercent?.toFixed(2)}%
                </span>
              </div>
            </div>

            {/* 52W Range bar */}
            {pricePctOf52W !== null && (
              <div style={{ marginTop: '1.75rem', maxWidth: '360px' }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontFamily: 'var(--font-dm-mono)', fontSize: '0.65rem',
                  color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em',
                  textTransform: 'uppercase', marginBottom: '0.5rem',
                }}>
                  <span>52W L: {formatPrice(data.weekLow52, data.currency)}</span>
                  <span>52W H: {formatPrice(data.weekHigh52, data.currency)}</span>
                </div>
                {/* Gradient track */}
                <div style={{
                  height: '4px', width: '100%', borderRadius: '999px',
                  background: 'linear-gradient(to right, rgba(239,68,68,0.25), rgba(255,255,255,0.08) 50%, rgba(0,212,170,0.25))',
                  position: 'relative',
                }}>
                  {/* Fill */}
                  <div style={{
                    position: 'absolute', top: 0, left: 0,
                    width: `${pricePctOf52W}%`, height: '100%',
                    background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.15))',
                    borderRadius: '999px',
                  }} />
                  {/* White dot cursor */}
                  <div style={{
                    position: 'absolute', top: '50%',
                    left: `${pricePctOf52W}%`,
                    transform: 'translate(-50%, -50%)',
                    width: '10px', height: '10px',
                    background: '#fff',
                    borderRadius: '50%',
                    border: '1.5px solid var(--teal)',
                    boxShadow: '0 0 8px rgba(255,255,255,0.6)',
                  }} />
                </div>
                <div style={{
                  textAlign: 'center', fontSize: '0.62rem',
                  color: 'rgba(255,255,255,0.25)', marginTop: '0.35rem',
                  fontFamily: 'var(--font-dm-mono)',
                }}>
                  {pricePctOf52W.toFixed(0)}% of 52-week range
                </div>
              </div>
            )}
          </div>

          {/* ── Right: Stats Grid ───────────────────────────────────── */}
          <div style={{
            width: 'min(100%, 360px)',
            borderLeft: '1px solid rgba(255,255,255,0.05)',
            paddingLeft: '2rem',
            flex: '0 0 auto',
          }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: '1px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px', overflow: 'hidden',
            }}>
              {primaryStats.map(({ label, value, dkey }, i) => {
                const isDerived = dkey && data._derived?.[dkey]
                return (
                  <div
                    key={label}
                    style={{
                      background: 'rgba(5,6,8,0.82)',
                      padding: '0.875rem 1rem',
                      transition: 'background 0.2s',
                      gridColumn: i === primaryStats.length - 1 && primaryStats.length % 2 !== 0 ? 'span 2' : undefined,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(5,6,8,0.82)'}
                  >
                    <div style={{
                      fontFamily: 'var(--font-dm-mono)', fontSize: '0.62rem',
                      color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase',
                      letterSpacing: '0.1em', marginBottom: '0.35rem',
                      display: 'flex', alignItems: 'center', gap: '0.3rem',
                    }}>
                      {label}
                      {isDerived && <span title={`Estimated: ${isDerived}`} style={{ color: 'rgba(0,212,170,0.55)', fontSize: '0.58rem' }}>~</span>}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-dm-mono)', fontSize: '0.9rem',
                      color: '#e8f2fc', fontWeight: 500,
                    }}>{value}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Description */}
        {data.description && (
          <div style={{
            marginTop: '1.5rem', paddingTop: '1.25rem',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            position: 'relative',
          }}>
            <p style={{
              fontFamily: 'var(--font-dm-mono)', fontSize: '0.8rem',
              color: 'rgba(255,255,255,0.4)', lineHeight: 1.7,
              maxWidth: '800px',
            }}>
              {truncate(data.description, 300)}
            </p>
          </div>
        )}
      </div>

      {/* ── Secondary Metrics Strip (scrollable) ────────────────────── */}
      <div style={{
        display: 'flex', gap: '0.625rem', overflowX: 'auto',
        paddingBottom: '4px',
        msOverflowStyle: 'none', scrollbarWidth: 'none',
      }}>
        {secondaryStats.map(({ label, value, dkey }) => {
          const isDerived = dkey && data._derived?.[dkey]
          return (
            <div
              key={label}
              style={{
                flexShrink: 0, minWidth: '150px',
                padding: '0.75rem 1rem',
                background: 'rgba(255,255,255,0.015)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '10px',
                transition: 'background 0.18s, border-color 0.18s',
                cursor: 'default',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                e.currentTarget.style.borderColor = 'rgba(0,212,170,0.18)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.015)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
              }}
            >
              <div style={{
                fontFamily: 'var(--font-dm-mono)', fontSize: '0.62rem',
                color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase',
                letterSpacing: '0.1em', marginBottom: '0.4rem',
                display: 'flex', alignItems: 'center', gap: '0.3rem',
              }}>
                {label}
                {isDerived && <span title={`Estimated: ${isDerived}`} style={{ color: 'rgba(0,212,170,0.55)', fontSize: '0.58rem' }}>~</span>}
              </div>
              <div style={{
                fontFamily: 'var(--font-dm-mono)', fontSize: '0.88rem',
                color: '#e8f2fc', fontWeight: 500,
              }}>{value}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
