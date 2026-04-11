'use client'
import { formatNumber, formatPrice, formatVolume, formatMultiple, formatPct, changeColor, changeSign, truncate, getExchangeFlag, getCurrencySymbol } from '../lib/utils'

export default function StockOverview({ data, onCompare }) {
  if (!data) return null
  const isPositive = data.change >= 0
  const changeColor = isPositive ? '#22c55e' : '#ef4444'
  const pricePctOf52W = data.weekHigh52 && data.weekLow52
    ? ((data.price - data.weekLow52) / (data.weekHigh52 - data.weekLow52)) * 100
    : null

  return (
    <div className="animate-slide-up" style={{ marginBottom: '1.5rem' }}>
      {/* Main price card */}
      <div className="card card-glow" style={{ padding: '1.75rem 2rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          {/* Left: Company + price */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.8rem', color: 'var(--teal)', background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)', padding: '0.2rem 0.6rem', borderRadius: '4px', letterSpacing: '0.08em' }}>
                {getExchangeFlag(data.exchange)} {data.ticker}
              </span>
              {data.sector && (
                <span style={{ fontSize: '0.72rem', color: 'var(--txt-muted)', fontFamily: 'var(--font-dm-mono)', letterSpacing: '0.04em' }}>
                  {data.sector} · {data.industry}
                </span>
              )}
              {data.marketState === 'CLOSED' && (
                <span style={{ fontSize: '0.68rem', color: 'var(--warn)', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', padding: '0.15rem 0.5rem', borderRadius: '3px' }}>
                  CLOSED
                </span>
              )}
            </div>

            <h2 style={{ fontFamily: 'var(--font-playfair)', fontSize: 'clamp(1.1rem, 2.5vw, 1.4rem)', fontWeight: 600, color: 'var(--txt-primary)', marginBottom: '0.75rem', lineHeight: 1.2 }}>
              {data.name}
            </h2>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 400, color: 'var(--txt-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {formatPrice(data.price, data.currency)}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '1.1rem', color: changeColor, fontWeight: 500 }}>
                  {changeSign(data.change)}{formatPrice(Math.abs(data.change), data.currency)}
                </span>
                <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.9rem', color: changeColor }}>
                  {changeSign(data.changePercent)}{data.changePercent?.toFixed(2)}%
                </span>
              </div>
            </div>

            {/* 52W Range bar */}
            {pricePctOf52W !== null && (
              <div style={{ marginTop: '1rem', maxWidth: '320px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--txt-muted)', fontFamily: 'var(--font-dm-mono)', marginBottom: '0.3rem' }}>
                  <span>52W Low {formatPrice(data.weekLow52, data.currency)}</span>
                  <span>52W High {formatPrice(data.weekHigh52, data.currency)}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, pricePctOf52W))}%` }} />
                </div>
                <div style={{ textAlign: 'center', fontSize: '0.68rem', color: 'var(--txt-muted)', marginTop: '0.2rem', fontFamily: 'var(--font-dm-mono)' }}>
                  {pricePctOf52W.toFixed(0)}% of 52-week range
                </div>
              </div>
            )}
          </div>

          {/* Right: Key stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', minWidth: '280px', maxWidth: '480px', flex: '1 1 280px' }}>
            {[
              { label: 'Market Cap', value: formatNumber(data.marketCap) },
              { label: 'P/E (TTM)', value: formatMultiple(data.pe) },
              { label: 'Forward P/E', value: formatMultiple(data.forwardPE) },
              { label: 'EV/EBITDA', value: formatMultiple(data.evToEbitda) },
              { label: 'EPS (TTM)', value: formatPrice(data.eps, data.currency) },
              { label: 'Beta', value: data.beta?.toFixed(2) || '—' },
              { label: 'Volume', value: formatVolume(data.volume) },
              { label: 'Avg Volume', value: formatVolume(data.avgVolume) },
            ].map(({ label, value }) => (
              <StatCard key={label} label={label} value={value} />
            ))}
          </div>
        </div>

        {/* Description */}
        {data.description && (
          <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(0,212,170,0.07)' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--txt-secondary)', lineHeight: 1.65, fontFamily: 'var(--font-dm-mono)' }}>
              {truncate(data.description, 280)}
            </p>
          </div>
        )}
      </div>

      {/* Secondary stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.625rem' }}>
        {[
          { label: 'Revenue', value: formatNumber(data.revenue) },
          { label: 'EBITDA', value: formatNumber(data.ebitda) },
          { label: 'Free Cash Flow', value: formatNumber(data.freeCashFlow) },
          { label: 'Gross Margin', value: formatPct(data.grossMargin) },
          { label: 'Net Margin', value: formatPct(data.profitMargin) },
          { label: 'ROE', value: formatPct(data.roe) },
          { label: 'D/E Ratio', value: formatMultiple(data.debtToEquity) },
          { label: 'Analyst Target', value: formatPrice(data.targetMeanPrice, data.currency) },
        ].map(({ label, value }) => (
          <div key={label} className="card" style={{ padding: '0.75rem 1rem' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--txt-muted)', fontFamily: 'var(--font-dm-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.3rem' }}>{label}</div>
            <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.95rem', color: 'var(--txt-primary)', fontWeight: 500 }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.25)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ fontSize: '0.65rem', color: 'var(--txt-muted)', fontFamily: 'var(--font-dm-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.3rem' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.95rem', color: 'var(--txt-primary)', fontWeight: 500 }}>{value}</div>
    </div>
  )
}
