'use client'
import { getCurrencySymbol } from '@/lib/client-utils'

// ── Colour maps ───────────────────────────────────────────────────────────────
const ASSESSMENT_MAP = {
  CHEAP:       { color: '#00d4aa', bg: 'rgba(0,212,170,0.10)',  border: 'rgba(0,212,170,0.30)'  },
  UNDERVALUED: { color: '#00d4aa', bg: 'rgba(0,212,170,0.10)',  border: 'rgba(0,212,170,0.30)'  },
  FAIR:        { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.30)' },
  EXPENSIVE:   { color: '#ef4444', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.30)'  },
  OVERVALUED:  { color: '#ef4444', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.30)'  },
}
const RATING_COLOR  = { EXCELLENT: '#00d4aa', GOOD: '#86efac', AVERAGE: '#f59e0b', POOR: '#ef4444' }
const RISK_COLOR    = { LOW: '#00d4aa', MEDIUM: '#f59e0b', HIGH: '#ef4444' }
const SEV_BG        = { LOW: 'rgba(0,212,170,0.08)', MEDIUM: 'rgba(245,158,11,0.08)', HIGH: 'rgba(239,68,68,0.08)' }

// ── Main Component ────────────────────────────────────────────────────────────
export default function RiskRatios({ data, currency }) {
  if (!data) return null
  const d = data
  const currencySymbol = getCurrencySymbol(currency)

  // Score chips in the header
  const scoreChips = [
    { label: 'Quality Score',  value: d.overallQualityScore ?? d.scores?.quality,  inverted: false },
    { label: 'Leverage Score', value: d.overallRiskScore    ?? d.scores?.leverage,  inverted: true  },
    { label: 'Momentum',       value: d.scores?.momentum,                            inverted: false },
  ].filter(s => s.value != null)

  return (
    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Risk Banner ─────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0,212,170,0.06) 0%, rgba(0,212,170,0.02) 100%)',
        border: '1px solid rgba(0,212,170,0.14)',
        borderRadius: 14, padding: '1.5rem 1.75rem',
        display: 'flex', gap: '1.75rem', alignItems: 'flex-start', flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          {/* Ticker label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, letterSpacing: '0.14em', color: '#00d4aa', fontWeight: 600, fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase' }}>
              Risk &amp; Ratios Analysis
            </span>
            {d.technicals?.trend && <TechPill value={d.technicals.trend} />}
            {d.technicals?.momentum && <TechPill value={d.technicals.momentum} />}
            {d.technicals?.technicalRating && <TechPill value={d.technicals.technicalRating} />}
          </div>
          {d.riskSummary && (
            <p style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, margin: 0 }}>
              {d.riskSummary}
            </p>
          )}
        </div>

        {/* Score chips */}
        {scoreChips.length > 0 && (
          <div style={{ display: 'flex', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
            {scoreChips.map(({ label, value, inverted }) => {
              const pct = ((parseFloat(value) || 5) / 10) * 100
              const color = inverted
                ? pct > 70 ? '#ef4444' : pct > 40 ? '#f59e0b' : '#00d4aa'
                : pct > 70 ? '#00d4aa' : pct > 40 ? '#f59e0b' : '#ef4444'
              return (
                <div key={label} style={{
                  textAlign: 'center', background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 10, padding: '14px 18px', minWidth: 90,
                }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {isNaN(parseFloat(value)) ? '—' : parseFloat(value).toFixed(1)}
                  </div>
                  <div style={{ fontSize: 9, color: '#00d4aa', opacity: 0.7, marginBottom: 6, fontFamily: 'var(--font-dm-mono)' }}>/10</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'var(--font-dm-mono)' }}>{label}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Valuation Ratios Table ─────────────────────────────────── */}
      {d.valuationRatios?.length > 0 && (
        <>
          <SectionTitle>Valuation Multiples vs Sector</SectionTitle>
          <div style={{
            background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12, overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Metric', 'Value', 'Sector Median', 'Assessment', 'Note'].map(h => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 10, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 600, fontFamily: 'var(--font-dm-mono)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.valuationRatios.map((r, i) => {
                  const s = ASSESSMENT_MAP[r.assessment?.toUpperCase()] || ASSESSMENT_MAP.FAIR
                  return (
                    <tr key={i} style={{ borderBottom: i < d.valuationRatios.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 500, fontFamily: 'var(--font-dm-mono)' }}>{r.metric}</td>
                      <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 700, color: '#e8f2fc', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-dm-mono)' }}>{r.value}</td>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: 'rgba(255,255,255,0.35)', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-dm-mono)' }}>{r.sectorMedian}</td>
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 4, fontSize: 10, fontWeight: 700, padding: '3px 8px', letterSpacing: '0.06em', fontFamily: 'var(--font-dm-mono)' }}>{r.assessment}</span>
                      </td>
                      <td style={{ padding: '13px 16px', fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-dm-mono)' }}>{r.note}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Quality + Leverage ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
        {d.qualityRatios?.length > 0 && (
          <div>
            <SectionTitle>Profitability &amp; Quality</SectionTitle>
            <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
              {d.qualityRatios.map((r, i) => {
                const color = RATING_COLOR[r.rating?.toUpperCase()] || '#f59e0b'
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '13px 18px',
                    borderBottom: i < d.qualityRatios.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  }}>
                    <div>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 500, fontFamily: 'var(--font-dm-mono)' }}>{r.metric}</div>
                      {r.benchmark && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 2, fontFamily: 'var(--font-dm-mono)' }}>Benchmark: {r.benchmark}</div>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#e8f2fc', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-dm-mono)' }}>{r.value}</span>
                      <span style={{ background: `${color}18`, color, border: `1px solid ${color}33`, borderRadius: 4, fontSize: 9, fontWeight: 700, padding: '2px 7px', letterSpacing: '0.06em', fontFamily: 'var(--font-dm-mono)' }}>{r.rating}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {d.leverageRatios?.length > 0 && (
          <div>
            <SectionTitle>Financial Health &amp; Leverage</SectionTitle>
            <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
              {d.leverageRatios.map((r, i) => {
                const color = RISK_COLOR[r.risk?.toUpperCase()] || '#f59e0b'
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '13px 18px',
                    borderBottom: i < d.leverageRatios.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  }}>
                    <div>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 500, fontFamily: 'var(--font-dm-mono)' }}>{r.metric}</div>
                      {r.threshold && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 2, fontFamily: 'var(--font-dm-mono)' }}>Threshold: {r.threshold}</div>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#e8f2fc', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-dm-mono)' }}>{r.value}</span>
                      <span style={{ background: `${color}18`, color, border: `1px solid ${color}33`, borderRadius: 4, fontSize: 9, fontWeight: 700, padding: '2px 7px', letterSpacing: '0.06em', fontFamily: 'var(--font-dm-mono)' }}>{r.risk}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Technical Analysis ─────────────────────────────────────── */}
      {d.technicals && (
        <>
          <SectionTitle>Technical Analysis</SectionTitle>
          <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '1.375rem 1.5rem' }}>
            {/* 6-up metrics grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'vs 50-Day MA',  value: `${parseFloat(d.technicals.priceVs50DMA) >= 0 ? '+' : ''}${parseFloat(d.technicals.priceVs50DMA || 0).toFixed(1)}%`, positive: parseFloat(d.technicals.priceVs50DMA) >= 0 },
                { label: 'vs 200-Day MA', value: `${parseFloat(d.technicals.priceVs200DMA) >= 0 ? '+' : ''}${parseFloat(d.technicals.priceVs200DMA || 0).toFixed(1)}%`, positive: parseFloat(d.technicals.priceVs200DMA) >= 0 },
                { label: 'RSI (14)',       value: d.technicals.rsi || '—', neutral: true },
                { label: 'Trend',         value: d.technicals.trend || '—', positive: ['UPTREND','BULLISH','STRONG'].includes((d.technicals.trend||'').toUpperCase()) },
                { label: 'MACD Signal',   value: d.technicals.macdSignal || '—', positive: ['BULLISH','BUY'].includes((d.technicals.macdSignal||'').toUpperCase()) },
                { label: 'Momentum',      value: d.technicals.momentum || '—', positive: ['STRONG','BULLISH','UPTREND'].includes((d.technicals.momentum||'').toUpperCase()) },
              ].map(({ label, value, positive, neutral }) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 9, padding: '14px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-dm-mono)', fontVariantNumeric: 'tabular-nums', color: neutral ? '#e8f2fc' : positive ? '#00d4aa' : '#ef4444' }}>{value}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginTop: 5, letterSpacing: '0.06em', fontFamily: 'var(--font-dm-mono)' }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Key levels */}
            {d.technicals.keyLevels && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                {[
                  { label: 'Support',    value: d.technicals.keyLevels.support    ? `${currencySymbol}${parseFloat(d.technicals.keyLevels.support).toFixed(2)}`    : '—', color: '#00d4aa' },
                  { label: 'Resistance', value: d.technicals.keyLevels.resistance ? `${currencySymbol}${parseFloat(d.technicals.keyLevels.resistance).toFixed(2)}` : '—', color: '#ef4444' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: `${color}0a`, border: `1px solid ${color}22`, borderRadius: 8, padding: '10px 18px', display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'var(--font-dm-mono)' }}>{label}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-dm-mono)' }}>{value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 52W bar */}
            <Week52Bar pct={parseFloat(d.technicals.weekPosition52 || d.technicals.week52Pct || 0)} />
          </div>
        </>
      )}

      {/* ── Risk Factor Matrix ─────────────────────────────────────── */}
      {d.riskFactors?.length > 0 && (
        <>
          <SectionTitle>Risk Factor Matrix</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            {d.riskFactors.map((r, i) => {
              const sevColor = RISK_COLOR[r.severity?.toUpperCase()] || '#f59e0b'
              const likColor = RISK_COLOR[r.likelihood?.toUpperCase()] || '#f59e0b'
              return (
                <div key={i} style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)', fontFamily: 'var(--font-dm-mono)' }}>{r.risk}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span style={{ background: SEV_BG[r.severity?.toUpperCase()], color: sevColor, border: `1px solid ${sevColor}33`, borderRadius: 4, fontSize: 9, fontWeight: 700, padding: '2px 7px', letterSpacing: '0.06em', fontFamily: 'var(--font-dm-mono)' }}>SEV: {r.severity}</span>
                      <span style={{ background: SEV_BG[r.likelihood?.toUpperCase()], color: likColor, border: `1px solid ${likColor}33`, borderRadius: 4, fontSize: 9, fontWeight: 700, padding: '2px 7px', letterSpacing: '0.06em', fontFamily: 'var(--font-dm-mono)' }}>LIK: {r.likelihood}</span>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', lineHeight: 1.65, margin: 0, fontFamily: 'var(--font-dm-mono)' }}>{r.detail}</p>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── Peer Comparison ────────────────────────────────────────── */}
      {d.peerBenchmarks?.length > 0 && (
        <>
          <SectionTitle>Peer Comparison</SectionTitle>
          <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Ticker', 'Company', 'P/E', 'EV/EBITDA', 'Net Margin'].map(h => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 10, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 600, fontFamily: 'var(--font-dm-mono)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.peerBenchmarks.map((p, i) => {
                  // Highlight the row where ticker matches (first row, or explicit flag)
                  const isSubject = i === 0 || p.isSubject
                  return (
                    <tr key={i} style={{ borderBottom: i < d.peerBenchmarks.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', background: isSubject ? 'rgba(0,212,170,0.04)' : 'transparent' }}>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: isSubject ? '#00d4aa' : '#e8f2fc', fontFamily: 'var(--font-dm-mono)' }}>{p.ticker}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-dm-mono)' }}>{p.name}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontVariantNumeric: 'tabular-nums', color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-dm-mono)' }}>{p.pe}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontVariantNumeric: 'tabular-nums', color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-dm-mono)' }}>{p.evEbitda}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontVariantNumeric: 'tabular-nums', color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-dm-mono)' }}>{p.margin}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, fontFamily: 'var(--font-dm-mono)', marginBottom: 10 }}>
      {children}
    </div>
  )
}

function TechPill({ value }) {
  const isPos = ['UPTREND','BULLISH','STRONG','POSITIVE'].includes(value?.toUpperCase())
  const isNeg = ['DOWNTREND','BEARISH','WEAK','NEGATIVE'].includes(value?.toUpperCase())
  const color = isPos ? '#00d4aa' : isNeg ? '#ef4444' : '#f59e0b'
  return (
    <span style={{ background: `${color}14`, color, border: `1px solid ${color}30`, borderRadius: 4, fontSize: 9, fontWeight: 700, padding: '2px 8px', letterSpacing: '0.08em', fontFamily: 'var(--font-dm-mono)' }}>
      {value}
    </span>
  )
}

function Week52Bar({ pct }) {
  const pos   = Math.max(0, Math.min(100, pct))
  const label = pos <= 25 ? 'Near 52W Low — trading close to yearly floor'
    : pos <= 50 ? 'Below Mid-Range — lower half of yearly range'
    : pos <= 75 ? 'Above Mid-Range — upper half of yearly range'
    : 'Near 52W High — approaching yearly peak'
  const color = pos <= 25 ? '#ef4444' : pos <= 50 ? '#f59e0b' : pos <= 75 ? '#60a5fa' : '#00d4aa'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'var(--font-dm-mono)' }}>52-Week Range Position</span>
        <span style={{ fontSize: 14, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-dm-mono)' }}>{pos.toFixed(0)}%</span>
      </div>
      <div style={{ position: 'relative', height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, marginBottom: 8 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pos}%`, background: `linear-gradient(90deg, rgba(10,30,22,1), ${color})`, borderRadius: 3, transition: 'width 0.6s ease' }} />
        <div style={{ position: 'absolute', top: -3, width: 12, height: 12, background: color, borderRadius: '50%', border: '2px solid #040c0a', left: `calc(${pos}% - 6px)`, boxShadow: `0 0 8px ${color}88` }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: '#ef4444', fontFamily: 'var(--font-dm-mono)' }}>52W Low</span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', maxWidth: 400, textAlign: 'center', fontFamily: 'var(--font-dm-mono)' }}>{label}</span>
        <span style={{ fontSize: 10, color: '#00d4aa', fontFamily: 'var(--font-dm-mono)' }}>52W High</span>
      </div>
    </div>
  )
}
