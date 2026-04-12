'use client'

import { formatPrice } from '@/lib/client-utils'
import { getSensitivityClass } from '@/lib/financial-utils'

export default function SensitivityTable({ data, currentPrice, currency }) {
  // Handle missing or invalid data
  if (!data || !data.waccRange || !data.tgrRange || !data.values) {
    return (
      <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
        <SectionTitle>Sensitivity Analysis</SectionTitle>
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          color: 'var(--txt-muted)',
          fontFamily: 'var(--font-dm-mono)',
          fontSize: '0.875rem',
        }}>
          <div style={{ marginBottom: '1rem', color: 'var(--warn)' }}>
            Sensitivity matrix calculation failed due to invalid WACC or Terminal Growth inputs.
          </div>
          <div>
            Please ensure all assumptions (WACC, Terminal Growth Rate) have valid numeric values.
          </div>
        </div>
      </div>
    )
  }

  const { waccRange, tgrRange, values } = data

  // Validate data integrity
  if (tgrRange.length !== values.length) {
    return (
      <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
        <SectionTitle>Sensitivity Analysis</SectionTitle>
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          color: 'var(--txt-muted)',
          fontFamily: 'var(--font-dm-mono)',
          fontSize: '0.875rem',
        }}>
          <div style={{ marginBottom: '1rem', color: 'var(--warn)' }}>
            Sensitivity matrix calculation failed: data structure mismatch.
          </div>
          <div>
            Please ensure all assumptions have valid numeric values and retry.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: '1.25rem 1.5rem', overflowX: 'auto' }}>
      <SectionTitle>Sensitivity Analysis — Intrinsic Value per Share</SectionTitle>
      <div style={{
        fontSize: '0.75rem',
        color: 'var(--txt-muted)',
        fontFamily: 'var(--font-dm-mono)',
        marginBottom: '1rem'
      }}>
        WACC (columns) × Terminal Growth Rate (rows)
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ minWidth: '380px' }}>
          <thead>
            <tr>
              <th>TGR \ WACC</th>
              {waccRange.map((w, i) => (
                <th key={i} style={{ textAlign: 'right' }}>
                  {!isNaN(w) ? w.toFixed(1) : '—'}%
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tgrRange.map((tgr, ri) => {
              const row = values[ri] || []
              return (
                <tr key={ri}>
                  <td style={{ color: 'var(--txt-secondary)' }}>
                    {!isNaN(tgr) ? tgr.toFixed(1) : '—'}%
                  </td>
                  {waccRange.map((wacc, ci) => {
                    const val = row[ci]
                    const cellClass = getSensitivityClass(val, currentPrice)
                    const displayVal = val && !isNaN(val) ? formatPrice(val, currency) : '—'
                    return (
                      <td key={ci} className={cellClass} style={{
                        textAlign: 'right',
                        fontWeight: 500,
                        background: getCellBackground(cellClass),
                        color: getCellTextColor(cellClass, val, currentPrice),
                      }}>
                        {displayVal}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <LegendItem color="rgba(34,197,94,0.18)" text="Significantly undervalued (> +25%)" textColor="#4ade80" />
        <LegendItem color="rgba(34,197,94,0.09)" text="Undervalued (+10% to +25%)" textColor="#86efac" />
        <LegendItem color="rgba(0,212,170,0.06)" text="Near fair value (±10%)" textColor="var(--teal)" />
        <LegendItem color="rgba(239,68,68,0.09)" text="Overvalued (-10% to -25%)" textColor="#fca5a5" />
        <LegendItem color="rgba(239,68,68,0.18)" text="Significantly overvalued (< -25%)" textColor="#f87171" />
      </div>
    </div>
  )
}

function getCellBackground(cellClass) {
  switch (cellClass) {
    case 'significantly-undervalued': return 'rgba(34,197,94,0.18)'
    case 'undervalued': return 'rgba(34,197,94,0.09)'
    case 'near-fair': return 'rgba(0,212,170,0.06)'
    case 'overvalued': return 'rgba(239,68,68,0.09)'
    case 'significantly-overvalued': return 'rgba(239,68,68,0.18)'
    default: return 'transparent'
  }
}

function getCellTextColor(cellClass, value, currentPrice) {
  if (cellClass === 'significantly-undervalued' || cellClass === 'undervalued') return '#4ade80'
  if (cellClass === 'overvalued' || cellClass === 'significantly-overvalued') return '#f87171'
  if (cellClass === 'near-fair') return 'var(--teal)'
  return 'var(--txt-primary)'
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: '0.68rem',
      color: 'var(--txt-muted)',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      fontFamily: 'var(--font-dm-mono)',
      marginBottom: '0.75rem'
    }}>
      {children}
    </div>
  )
}

function LegendItem({ color, text, textColor }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.4rem',
      fontSize: '0.7rem',
      fontFamily: 'var(--font-dm-mono)'
    }}>
      <div style={{
        width: '12px',
        height: '12px',
        background: color,
        borderRadius: '2px',
        flexShrink: 0
      }} />
      <span style={{ color: textColor }}>{text}</span>
    </div>
  )
}
