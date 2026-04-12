'use client'
import { formatNumber, formatPrice } from '@/lib/client-utils'
import { calculateUpside, calculateDCFRating } from '@/lib/financial-utils'
import ErrorBoundary from '@/components/ErrorBoundary'
import SensitivityTable from './SensitivityTable'

export default function DCFValuation({ data, currency }) {
  if (!data) return null
  const d = data

  // Ensure upside is calculated correctly: ((IV - CP) / CP) * 100
  const currentPrice = d.currentPrice
  const intrinsicValue = d.intrinsicValuePerShare

  // Always recalculate upside from raw prices - never trust API-derived values
  let upside = 0
  if (intrinsicValue && currentPrice && currentPrice > 0) {
    upside = calculateUpside(intrinsicValue, currentPrice)
  }

  // Derive rating from calculated upside - never use API rating directly
  const dcfRating = calculateDCFRating(upside)

  // Determine rating based on calculated upside
  const isUndervalued = intrinsicValue > currentPrice
  const isOvervalued = intrinsicValue < currentPrice
  const ratingColor = isUndervalued ? '#22c55e' : isOvervalued ? '#ef4444' : '#f59e0b'

  return (
    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* DCF Summary Banner */}
      <div className="card card-glow" style={{ padding: '1.5rem 2rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--txt-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'var(--font-dm-mono)', marginBottom: '0.5rem' }}>
              DCF Intrinsic Value
            </div>
            <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '2.5rem', color: 'var(--txt-primary)', lineHeight: 1 }}>
              {formatPrice(d.intrinsicValuePerShare, currency)}
            </div>
            <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.9rem', color: 'var(--txt-secondary)' }}>
                Current: {formatPrice(d.currentPrice, currency)}
              </span>
              <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '1rem', fontWeight: 600, color: ratingColor }}>
                {upside >= 0 ? '+' : ''}{upside.toFixed(1)}% {upside >= 0 ? 'upside' : 'downside'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <SummaryMetric label="WACC" value={`${d.assumptions?.wacc?.toFixed(1)}%`} />
            <SummaryMetric label="Terminal Growth" value={`${d.assumptions?.terminalGrowthRate?.toFixed(1)}%`} />
            <SummaryMetric label="Tax Rate" value={`${d.assumptions?.taxRate?.toFixed(1)}%`} />
            <SummaryMetric label="Rating" value={dcfRating} color={ratingColor} />
          </div>
        </div>

        {/* Bridge: EV breakdown */}
        <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(0,212,170,0.08)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
          {[
            { label: 'PV of FCFs', value: formatNumber(d.pvFCFs, 2, currency) },
            { label: 'Terminal Value (TV)', value: formatNumber(d.terminalValue, 2, currency) },
            { label: 'PV of TV', value: formatNumber(d.pvTerminalValue, 2, currency) },
            { label: 'Enterprise Value', value: formatNumber(d.enterpriseValue, 2, currency) },
            { label: 'Equity Value', value: formatNumber(d.equityValue, 2, currency) },
            { label: 'Margin of Safety', value: `${d.marginOfSafety?.toFixed(1)}%`, color: upside > 0 ? 'var(--gain)' : 'var(--loss)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '6px', padding: '0.75rem', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--txt-muted)', fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>{label}</div>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.95rem', color: color || 'var(--txt-primary)', fontWeight: 500 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 5-Year Projections Table */}
      {d.projections?.length > 0 && (
        <div className="card" style={{ padding: '1.25rem 1.5rem', overflowX: 'auto' }}>
          <SectionTitle>5-Year Cash Flow Projections</SectionTitle>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: '600px' }}>
              <thead>
                <tr>
                  <th>Metric</th>
                  {d.projections.map(p => <th key={p.year} style={{ textAlign: 'right' }}>Year {p.year}</th>)}
                </tr>
              </thead>
              <tbody>
                {[
                  { key: 'revenue', label: 'Revenue', fmt: (v) => formatNumber(v, 2, currency) },
                  { key: 'ebitda', label: 'EBITDA', fmt: (v) => formatNumber(v, 2, currency) },
                  { key: 'ebit', label: 'EBIT', fmt: (v) => formatNumber(v, 2, currency) },
                  { key: 'nopat', label: 'NOPAT', fmt: (v) => formatNumber(v, 2, currency) },
                  { key: 'capex', label: 'CapEx', fmt: (v) => `(${formatNumber(Math.abs(v), 2, currency)})` },
                  { key: 'nwcChange', label: 'NWC Change', fmt: (v) => formatNumber(v, 2, currency) },
                  { key: 'fcf', label: 'Free Cash Flow', fmt: (v) => formatNumber(v, 2, currency), highlight: true },
                ].map(({ key, label, fmt, highlight }) => (
                  <tr key={key} style={highlight ? { background: 'rgba(0,212,170,0.04)' } : {}}>
                    <td style={{ color: highlight ? 'var(--teal)' : 'var(--txt-secondary)', fontWeight: highlight ? 500 : 400 }}>{label}</td>
                    {d.projections.map(p => (
                      <td key={p.year} style={{ textAlign: 'right', color: highlight ? 'var(--teal)' : 'var(--txt-primary)', fontWeight: highlight ? 500 : 400 }}>
                        {fmt(p[key])}
                      </td>
                    ))}
                  </tr>
                ))}
                {d.assumptions?.revenueGrowthRates && (
                  <tr style={{ background: 'rgba(0,0,0,0.15)' }}>
                    <td style={{ color: 'var(--txt-muted)' }}>Revenue Growth</td>
                    {d.assumptions.revenueGrowthRates.map((g, i) => (
                      <td key={i} style={{ textAlign: 'right', color: 'var(--txt-secondary)' }}>{g?.toFixed(1)}%</td>
                    ))}
                  </tr>
                )}
                {d.assumptions?.ebitdaMargins && (
                  <tr style={{ background: 'rgba(0,0,0,0.15)' }}>
                    <td style={{ color: 'var(--txt-muted)' }}>EBITDA Margin</td>
                    {d.assumptions.ebitdaMargins.map((m, i) => (
                      <td key={i} style={{ textAlign: 'right', color: 'var(--txt-secondary)' }}>{m?.toFixed(1)}%</td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sensitivity Table with Error Boundary */}
      <ErrorBoundary>
        <SensitivityTable data={d.sensitivityTable} currentPrice={d.currentPrice} currency={currency} />
      </ErrorBoundary>

      {/* Analyst note */}
      {d.analystNote && (
        <div className="card" style={{ padding: '1.25rem 1.5rem', borderLeft: '3px solid var(--teal)' }}>
          <SectionTitle>Analyst Commentary</SectionTitle>
          <p style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.875rem', color: 'var(--txt-secondary)', lineHeight: 1.7 }}>{d.analystNote}</p>
        </div>
      )}

      {/* Risk factors */}
      {d.keyRisksToModel?.length > 0 && (
        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <SectionTitle>Key Risks to DCF Model</SectionTitle>
          <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {d.keyRisksToModel.map((r, i) => (
              <li key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--warn)', flexShrink: 0 }}>⚠</span>
                <span style={{ fontSize: '0.82rem', color: 'var(--txt-secondary)', fontFamily: 'var(--font-dm-mono)', lineHeight: 1.5 }}>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function SummaryMetric({ label, value, color }) {
  return (
    <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '6px', padding: '0.75rem 1rem', border: '1px solid rgba(255,255,255,0.04)', minWidth: '100px', textAlign: 'center' }}>
      <div style={{ fontSize: '0.65rem', color: 'var(--txt-muted)', fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.95rem', color: color || 'var(--txt-primary)', fontWeight: 500 }}>{value}</div>
    </div>
  )
}

function SectionTitle({ children }) {
  return <div style={{ fontSize: '0.68rem', color: 'var(--txt-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'var(--font-dm-mono)', marginBottom: '0.75rem' }}>{children}</div>
}

function LegendItem({ color, text, textColor }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem', fontFamily: 'var(--font-dm-mono)' }}>
      <div style={{ width: '12px', height: '12px', background: color, borderRadius: '2px', flexShrink: 0 }} />
      <span style={{ color: textColor }}>{text}</span>
    </div>
  )
}
