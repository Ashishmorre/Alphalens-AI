'use client'
import { formatNumber, formatPrice } from '@/lib/client-utils'
import { calculateUpside, getValuationVerdict, calculateDCFRating } from '@/lib/financial-utils'
import { useDCF } from '@/contexts/DCFContext'
import ErrorBoundary from '@/components/ErrorBoundary'
import SensitivityTable from './SensitivityTable'

export default function DCFValuation({ currency }) {
  const { data: d } = useDCF()
  if (!d) return null

  // Use the strictly derived verdict from our corrected math engine
  const verdict = getValuationVerdict(d.currentPrice, d.intrinsicValuePerShare)

  // Always recalculate upside from raw prices — never trust API-derived values
  let upside = 0
  const currentPrice = d.currentPrice
  const intrinsicValue = d.intrinsicValuePerShare
  if (intrinsicValue && currentPrice && currentPrice > 0) {
    upside = calculateUpside(intrinsicValue, currentPrice)
  }

  // Derive rating from calculated upside — never use API rating directly
  const dcfRating = calculateDCFRating(upside)

  const isUndervalued = verdict.label === 'UNDERVALUED'
  const isOvervalued  = verdict.label === 'OVERVALUED'
  const ratingColor   = isUndervalued ? '#00d4aa' : isOvervalued ? '#ef4444' : '#f59e0b'
  const upsideSign    = upside >= 0 ? '+' : ''

  // Badge style
  const badgeBg    = isUndervalued ? '#00d4aa' : isOvervalued ? '#ef4444' : '#f59e0b'
  const badgeColor = isUndervalued ? '#040c0a' : '#fff'

  // Projection rows config
  const projRowsConfig = [
    { key: 'revenue',   label: 'Revenue',         fmt: v => formatNumber(v, 2, currency) },
    { key: 'ebitda',    label: 'EBITDA',           fmt: v => formatNumber(v, 2, currency) },
    { key: 'ebit',      label: 'EBIT',             fmt: v => formatNumber(v, 2, currency) },
    { key: 'nopat',     label: 'NOPAT',            fmt: v => formatNumber(v, 2, currency) },
    { key: 'capex',     label: 'CapEx',            fmt: v => v != null && !Number.isNaN(v) ? `(${formatNumber(Math.abs(v), 2, currency)})` : '—' },
    { key: 'nwcChange', label: 'NWC Change',       fmt: v => formatNumber(v, 2, currency) },
    { key: 'fcf',       label: 'Free Cash Flow',   fmt: v => formatNumber(v, 2, currency), highlight: true },
  ]

  const hasSeparator = (key) => key === 'revenue' // divider above growth rows — handled via borderTop

  return (
    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── DCF Verdict Hero ─────────────────────────────────────────────── */}
      <div style={{
        background: 'radial-gradient(circle at 0% 50%, rgba(0,212,170,0.14) 0%, rgba(0,0,0,0) 60%), rgba(255,255,255,0.018)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '18px',
        padding: '2rem 2.5rem',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '2rem',
      }}>
        {/* Left — big price */}
        <div style={{ zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: 'var(--font-dm-mono)', fontSize: '0.75rem',
              color: 'rgba(255,255,255,0.45)', letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>
              Intrinsic Value per Share
            </span>
            <span style={{
              background: badgeBg, color: badgeColor,
              fontFamily: 'var(--font-dm-mono)', fontSize: '0.65rem',
              fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
              padding: '0.25rem 0.75rem', borderRadius: '999px',
            }}>
              {verdict.label || dcfRating || '—'}
            </span>
          </div>
          <div style={{
            fontFamily: 'var(--font-playfair)',
            fontSize: 'clamp(3rem, 8vw, 5.25rem)',
            color: '#e8f2fc', lineHeight: 1,
            letterSpacing: '-0.03em', marginBottom: '0.75rem',
            textShadow: isUndervalued ? '0 0 40px rgba(0,212,170,0.22)' : 'none',
          }}>
            {formatPrice(d.intrinsicValuePerShare, currency)}
          </div>
          <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '1rem', color: ratingColor, fontWeight: 500 }}>
            vs current {formatPrice(d.currentPrice, currency)}
            {' · '}
            {upsideSign}{upside.toFixed(1)}% {upside >= 0 ? 'upside' : 'downside'}
          </div>
        </div>

        {/* Right — key assumptions chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', zIndex: 1, justifyContent: 'flex-end' }}>
          {[
            { label: 'WACC',             value: d.assumptions?.wacc != null ? `${d.assumptions.wacc.toFixed(1)}%` : '—',                accent: false },
            { label: 'Terminal Growth',  value: d.assumptions?.terminalGrowthRate != null ? `${d.assumptions.terminalGrowthRate.toFixed(1)}%` : '—', accent: false },
            { label: 'Margin of Safety', value: d.marginOfSafety != null ? `${d.marginOfSafety.toFixed(1)}%` : '—',                    accent: true  },
            { label: 'Rating',           value: dcfRating || '—',                                                                        accent: false },
          ].map(({ label, value, accent }) => (
            <div key={label} style={{
              padding: '0.75rem 1.25rem',
              borderRadius: '12px',
              display: 'flex', flexDirection: 'column',
              minWidth: '130px',
              background: accent ? 'rgba(0,212,170,0.09)' : 'rgba(255,255,255,0.04)',
              border: accent ? '1px solid rgba(0,212,170,0.22)' : '1px solid rgba(255,255,255,0.08)',
            }}>
              <span style={{
                fontFamily: 'var(--font-dm-mono)', fontSize: '0.62rem',
                textTransform: 'uppercase', letterSpacing: '0.12em',
                color: accent ? 'rgba(0,212,170,0.7)' : 'rgba(255,255,255,0.35)',
                marginBottom: '0.4rem',
              }}>{label}</span>
              <span style={{
                fontFamily: 'var(--font-dm-mono)', fontSize: '1.1rem',
                color: accent ? '#00d4aa' : '#e8f2fc',
              }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── EV Bridge Strip ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.625rem', overflowX: 'auto', paddingBottom: '4px', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
        {[
          { label: 'PV of FCFs',        value: formatNumber(d.pvFCFs, 2, currency) },
          { label: 'Terminal Value',     value: formatNumber(d.terminalValue, 2, currency) },
          { label: 'PV of TV',          value: formatNumber(d.pvTerminalValue, 2, currency) },
          { label: 'Enterprise Value',  value: formatNumber(d.enterpriseValue, 2, currency) },
          { label: 'Equity Value',      value: formatNumber(d.equityValue, 2, currency) },
          { label: 'Tax Rate',          value: d.assumptions?.taxRate != null ? `${d.assumptions.taxRate.toFixed(1)}%` : '—' },
        ].map(({ label, value }) => (
          <div key={label} style={{
            flexShrink: 0, minWidth: '150px',
            padding: '0.75rem 1rem',
            background: 'rgba(255,255,255,0.015)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '10px',
            transition: 'border-color 0.18s, background 0.18s',
            cursor: 'default',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(0,212,170,0.18)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.015)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
          >
            <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>{label}</div>
            <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.88rem', color: '#e8f2fc', fontWeight: 500 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── FCF Projections Table ────────────────────────────────────────── */}
      {d.projections?.length > 0 && (
        <div style={{
          background: 'rgba(255,255,255,0.018)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '14px',
          overflow: 'hidden',
        }}>
          {/* Table header bar */}
          <div style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', gap: '0.625rem',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" strokeWidth="1.8" strokeLinecap="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
            <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.75rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>
              Five-Year Free Cash Flow Projections
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            {/* Column headers */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '180px repeat(5, 1fr)',
              padding: '0.75rem 1.5rem',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              background: 'rgba(255,255,255,0.04)',
              fontFamily: 'var(--font-dm-mono)', fontSize: '0.65rem',
              color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.12em',
              minWidth: '700px',
            }}>
              <div></div>
              {d.projections.map(p => <div key={p.year} style={{ textAlign: 'right' }}>Year {p.year}</div>)}
            </div>

            {/* Data rows */}
            {projRowsConfig.map(({ key, label, fmt, highlight }, i) => (
              <div
                key={key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '180px repeat(5, 1fr)',
                  padding: '0.875rem 1.5rem',
                  borderBottom: i < projRowsConfig.length - 1 ? '1px solid rgba(255,255,255,0.025)' : 'none',
                  background: highlight
                    ? 'rgba(0,212,170,0.04)'
                    : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                  borderLeft: highlight ? '2px solid #00d4aa' : '2px solid transparent',
                  fontFamily: 'var(--font-dm-mono)', fontSize: '0.82rem',
                  minWidth: '700px',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!highlight) e.currentTarget.style.background = 'rgba(255,255,255,0.025)' }}
                onMouseLeave={e => { e.currentTarget.style.background = highlight ? 'rgba(0,212,170,0.04)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}
              >
                <div style={{ color: highlight ? '#e8f2fc' : 'rgba(255,255,255,0.45)', fontWeight: highlight ? 600 : 400 }}>{label}</div>
                {d.projections.map(p => {
                  const raw = p[key]
                  const formatted = fmt(raw)
                  const isNeg = typeof formatted === 'string' && formatted.startsWith('(')
                  return (
                    <div key={p.year} style={{
                      textAlign: 'right',
                      color: highlight
                        ? (isNeg ? '#ef4444' : '#00d4aa')
                        : (isNeg ? '#ef4444' : '#e8f2fc'),
                      fontWeight: highlight ? 500 : 400,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {formatted}
                    </div>
                  )
                })}
              </div>
            ))}

            {/* Revenue Growth row */}
            {d.assumptions?.revenueGrowthRates && (
              <div style={{
                display: 'grid', gridTemplateColumns: '180px repeat(5, 1fr)',
                padding: '0.875rem 1.5rem',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(0,0,0,0.15)',
                fontFamily: 'var(--font-dm-mono)', fontSize: '0.82rem',
                minWidth: '700px',
              }}>
                <div style={{ color: 'rgba(255,255,255,0.35)' }}>Revenue Growth</div>
                {d.assumptions.revenueGrowthRates.map((g, i) => (
                  <div key={i} style={{ textAlign: 'right', color: 'rgba(255,255,255,0.5)' }}>{g?.toFixed(1)}%</div>
                ))}
              </div>
            )}

            {/* EBITDA Margin row */}
            {d.assumptions?.ebitdaMargins && (
              <div style={{
                display: 'grid', gridTemplateColumns: '180px repeat(5, 1fr)',
                padding: '0.875rem 1.5rem',
                borderTop: '1px solid rgba(255,255,255,0.04)',
                background: 'rgba(0,0,0,0.15)',
                fontFamily: 'var(--font-dm-mono)', fontSize: '0.82rem',
                minWidth: '700px',
              }}>
                <div style={{ color: 'rgba(255,255,255,0.35)' }}>EBITDA Margin</div>
                {d.assumptions.ebitdaMargins.map((m, i) => (
                  <div key={i} style={{ textAlign: 'right', color: 'rgba(255,255,255,0.5)' }}>{m?.toFixed(1)}%</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Sensitivity + Side Panel ────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: '1rem', alignItems: 'start' }}>
        {/* Sensitivity Table */}
        <ErrorBoundary>
          <SensitivityTable data={d.sensitivityTable} currentPrice={d.currentPrice} currency={currency} />
        </ErrorBoundary>

        {/* Right: Analyst Note + Key Risks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Analyst Commentary */}
          {d.analystNote && (
            <div style={{
              background: 'rgba(255,255,255,0.018)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '14px', padding: '1.5rem',
            }}>
              <DCFSectionTitle icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              } color="#00d4aa">Model Analysis</DCFSectionTitle>
              <p style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.75 }}>
                {d.analystNote}
              </p>
            </div>
          )}

          {/* Key Risks */}
          {d.keyRisksToModel?.length > 0 && (
            <div style={{
              background: 'rgba(255,255,255,0.018)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '14px', padding: '1.5rem',
              flex: 1,
            }}>
              <DCFSectionTitle icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              } color="#f59e0b">Scenario Impact Notes</DCFSectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {d.keyRisksToModel.map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-start' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="0" style={{ flexShrink: 0, marginTop: '2px' }}>
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                    <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.65 }}>{r}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .dcf-bottom-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

function DCFSectionTitle({ children, icon, color = '#00d4aa' }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      paddingBottom: '0.75rem', marginBottom: '1rem',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
    }}>
      {icon && <span style={{ color, display: 'flex', alignItems: 'center', flexShrink: 0 }}>{icon}</span>}
      <span style={{
        fontFamily: 'var(--font-dm-mono)', fontSize: '0.68rem',
        color: 'rgba(255,255,255,0.45)', letterSpacing: '0.14em',
        textTransform: 'uppercase', fontWeight: 500,
      }}>{children}</span>
    </div>
  )
}
