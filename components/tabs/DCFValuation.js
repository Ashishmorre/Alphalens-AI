'use client'
import { formatNumber, formatPrice } from '../../lib/utils'

export default function DCFValuation({ data }) {
  if (!data) return null
  const d = data

  const isUndervalued = d.upside > 10
  const isOvervalued = d.upside < -10
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
              {formatPrice(d.intrinsicValuePerShare)}
            </div>
            <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.9rem', color: 'var(--txt-secondary)' }}>
                Current: {formatPrice(d.currentPrice)}
              </span>
              <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '1rem', fontWeight: 600, color: ratingColor }}>
                {d.upside >= 0 ? '+' : ''}{d.upside?.toFixed(1)}% {d.upside >= 0 ? 'upside' : 'downside'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <SummaryMetric label="WACC" value={`${d.assumptions?.wacc?.toFixed(1)}%`} />
            <SummaryMetric label="Terminal Growth" value={`${d.assumptions?.terminalGrowthRate?.toFixed(1)}%`} />
            <SummaryMetric label="Tax Rate" value={`${d.assumptions?.taxRate?.toFixed(1)}%`} />
            <SummaryMetric label="Rating" value={d.dcfRating} color={ratingColor} />
          </div>
        </div>

        {/* Bridge: EV breakdown */}
        <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(0,212,170,0.08)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
          {[
            { label: 'PV of FCFs', value: formatNumber(d.pvFCFs) },
            { label: 'Terminal Value (TV)', value: formatNumber(d.terminalValue) },
            { label: 'PV of TV', value: formatNumber(d.pvTerminalValue) },
            { label: 'Enterprise Value', value: formatNumber(d.enterpriseValue) },
            { label: 'Equity Value', value: formatNumber(d.equityValue) },
            { label: 'Margin of Safety', value: `${d.marginOfSafety?.toFixed(1)}%`, color: d.marginOfSafety > 0 ? 'var(--gain)' : 'var(--loss)' },
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
                  { key: 'revenue', label: 'Revenue', fmt: formatNumber },
                  { key: 'ebitda', label: 'EBITDA', fmt: formatNumber },
                  { key: 'ebit', label: 'EBIT', fmt: formatNumber },
                  { key: 'nopat', label: 'NOPAT', fmt: formatNumber },
                  { key: 'capex', label: 'CapEx', fmt: (v) => `(${formatNumber(Math.abs(v))})` },
                  { key: 'nwcChange', label: 'NWC Change', fmt: formatNumber },
                  { key: 'fcf', label: 'Free Cash Flow', fmt: formatNumber, highlight: true },
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

      {/* Sensitivity Table */}
      {d.sensitivityTable && (
        <div className="card" style={{ padding: '1.25rem 1.5rem', overflowX: 'auto' }}>
          <SectionTitle>Sensitivity Analysis — Intrinsic Value per Share</SectionTitle>
          <div style={{ fontSize: '0.75rem', color: 'var(--txt-muted)', fontFamily: 'var(--font-dm-mono)', marginBottom: '1rem' }}>
            WACC (columns) × Terminal Growth Rate (rows)
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: '380px' }}>
              <thead>
                <tr>
                  <th>TGR \ WACC</th>
                  {d.sensitivityTable.waccRange?.map((w, i) => (
                    <th key={i} style={{ textAlign: 'right' }}>{w?.toFixed(1)}%</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.sensitivityTable.tgrRange?.map((tgr, ri) => (
                  <tr key={ri}>
                    <td style={{ color: 'var(--txt-secondary)' }}>{tgr?.toFixed(1)}%</td>
                    {d.sensitivityTable.values?.[ri]?.map((val, ci) => {
                      const cellClass = getSensitivityClass(val, d.currentPrice)
                      return (
                        <td key={ci} className={cellClass} style={{ textAlign: 'right', fontWeight: 500 }}>
                          {formatPrice(val)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <LegendItem color="rgba(34,197,94,0.18)" text="Significantly undervalued" textColor="#4ade80" />
            <LegendItem color="rgba(34,197,94,0.09)" text="Undervalued" textColor="#86efac" />
            <LegendItem color="rgba(0,212,170,0.06)" text="Near fair value" textColor="var(--teal)" />
            <LegendItem color="rgba(239,68,68,0.09)" text="Overvalued" textColor="#fca5a5" />
            <LegendItem color="rgba(239,68,68,0.18)" text="Significantly overvalued" textColor="#f87171" />
          </div>
        </div>
      )}

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

function getSensitivityClass(val, currentPrice) {
  if (!val || !currentPrice) return ''
  const diff = (val - currentPrice) / currentPrice
  if (diff > 0.2) return 'cell-high'
  if (diff > 0.05) return 'cell-med-high'
  if (diff > -0.05) return 'cell-neutral'
  if (diff > -0.2) return 'cell-med-low'
  return 'cell-low'
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
