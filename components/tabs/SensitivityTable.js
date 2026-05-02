'use client'

import { formatPrice } from '@/lib/client-utils'
import { getSensitivityClass } from '@/lib/financial-utils'

function fixSensitivity(data) {
  if (!data) return null
  if (!Array.isArray(data.values)) return null
  return data
}

function normalizeSensitivity(data) {
  if (!data) return null
  const safe = {
    waccRange: data.waccRange || [],
    tgrRange:  data.tgrRange  || [],
    values:    data.values    || [],
  }
  // FIX MATRIX SHAPE
  if (safe.tgrRange.length !== safe.values.length) {
    safe.values = safe.tgrRange.map(() => safe.waccRange.map(() => null))
  }
  return safe
}

// Map cellClass → heatmap colours matching sample
function getHeatmapBg(cellClass) {
  switch (cellClass) {
    case 'significantly-undervalued': return 'rgba(0,212,170,0.22)'
    case 'undervalued':               return 'rgba(0,212,170,0.09)'
    case 'near-fair':                 return 'rgba(255,255,255,0.03)'
    case 'overvalued':                return 'rgba(239,68,68,0.09)'
    case 'significantly-overvalued':  return 'rgba(239,68,68,0.18)'
    default:                          return 'transparent'
  }
}

function getHeatmapText(cellClass) {
  switch (cellClass) {
    case 'significantly-undervalued': return '#00d4aa'
    case 'undervalued':               return '#e8f2fc'
    case 'near-fair':                 return 'rgba(255,255,255,0.75)'
    case 'overvalued':                return '#fca5a5'
    case 'significantly-overvalued':  return '#f87171'
    default:                          return 'rgba(255,255,255,0.7)'
  }
}

const LEGEND = [
  { bg: 'rgba(0,212,170,0.22)', border: '1px solid rgba(0,212,170,0.6)', text: 'Significantly undervalued (>+25%)',  color: '#00d4aa' },
  { bg: 'rgba(0,212,170,0.09)', border: '1px solid rgba(0,212,170,0.2)', text: 'Undervalued (+10% to +25%)',          color: 'rgba(255,255,255,0.75)' },
  { bg: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.15)', text: 'Near fair value (±10%)',          color: 'rgba(255,255,255,0.5)' },
  { bg: 'rgba(239,68,68,0.09)', border: '1px solid rgba(239,68,68,0.25)', text: 'Overvalued (−10% to −25%)',           color: '#fca5a5' },
  { bg: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.4)',  text: 'Significantly overvalued (<−25%)',    color: '#f87171' },
]

export default function SensitivityTable({ data, currentPrice, currency }) {
  const sensitivity = fixSensitivity(data)
  if (!sensitivity) {
    return (
      <SensitivityError msg="No sensitivity data available." />
    )
  }
  const normalizedData = normalizeSensitivity(sensitivity)
  if (!normalizedData || !normalizedData.waccRange || !normalizedData.tgrRange || !normalizedData.values) {
    return <SensitivityError msg="Sensitivity matrix calculation failed: invalid WACC or Terminal Growth inputs." />
  }
  if (normalizedData.tgrRange.length !== normalizedData.values.length) {
    return <SensitivityError msg="Sensitivity matrix calculation failed: data structure mismatch." />
  }

  const { waccRange, tgrRange, values } = normalizedData

  // Find the "current" WACC row index (closest to actual WACC if available)
  const midWaccIdx = Math.floor(waccRange.length / 2)

  return (
    <div style={{
      background: 'rgba(255,255,255,0.018)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '14px',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.75rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', marginBottom: '0.25rem' }}>
          Sensitivity Analysis — Intrinsic Value per Share
        </div>
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)' }}>
          WACC (rows) × Terminal Growth Rate (columns)
        </div>
      </div>

      {/* Matrix */}
      <div style={{ overflowX: 'auto', padding: '1.25rem 1.5rem' }}>
        <div style={{
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '10px',
          overflow: 'hidden',
          background: 'rgba(0,0,0,0.35)',
          minWidth: '520px',
        }}>
          {/* Column header row (TGR values) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `140px repeat(${waccRange.length}, 1fr)`,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.04)',
          }}>
            <div style={{ padding: '0.625rem 0.875rem', borderRight: '1px solid rgba(255,255,255,0.07)', fontFamily: 'var(--font-dm-mono)', fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              TGR \ WACC
            </div>
            {waccRange.map((w, i) => (
              <div key={i} style={{
                padding: '0.625rem 0.5rem',
                textAlign: 'center',
                borderRight: i < waccRange.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                fontFamily: 'var(--font-dm-mono)', fontSize: '0.65rem',
                color: 'rgba(255,255,255,0.55)', letterSpacing: '0.08em',
              }}>
                {!isNaN(w) ? w.toFixed(1) : '—'}%
              </div>
            ))}
          </div>

          {/* Data rows */}
          {tgrRange.map((tgr, ri) => {
            const row = values[ri] || []
            // Highlight the middle TGR row as "current-ish"
            const isCurrentRow = ri === Math.floor(tgrRange.length / 2)
            return (
              <div
                key={ri}
                style={{
                  display: 'grid',
                  gridTemplateColumns: `140px repeat(${waccRange.length}, 1fr)`,
                  borderBottom: ri < tgrRange.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  outline: isCurrentRow ? '1px solid rgba(245,158,11,0.35)' : 'none',
                  background: isCurrentRow ? 'rgba(245,158,11,0.04)' : 'transparent',
                }}
              >
                {/* TGR label cell */}
                <div style={{
                  padding: '0.75rem 0.875rem',
                  borderRight: '1px solid rgba(255,255,255,0.07)',
                  fontFamily: 'var(--font-dm-mono)', fontSize: '0.72rem',
                  color: isCurrentRow ? '#f59e0b' : 'rgba(255,255,255,0.4)',
                  background: 'rgba(0,0,0,0.2)',
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                }}>
                  {!isNaN(tgr) ? tgr.toFixed(1) : '—'}%
                  {isCurrentRow && <span style={{ fontSize: '0.55rem', color: '#f59e0b', letterSpacing: '0.1em' }}>BASE</span>}
                </div>

                {/* Value cells */}
                {waccRange.map((wacc, ci) => {
                  const val = row[ci]
                  const cellClass = getSensitivityClass(val, currentPrice)
                  const bg = getHeatmapBg(cellClass)
                  const textColor = getHeatmapText(cellClass)
                  const displayVal = val && !isNaN(val) ? formatPrice(val, currency) : '—'
                  return (
                    <div
                      key={ci}
                      style={{
                        padding: '0.75rem 0.5rem',
                        textAlign: 'center',
                        borderRight: ci < waccRange.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                        background: bg,
                        color: textColor,
                        fontFamily: 'var(--font-dm-mono)', fontSize: '0.72rem',
                        fontVariantNumeric: 'tabular-nums',
                        transition: 'transform 0.15s, box-shadow 0.15s',
                        cursor: 'default',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.zIndex = '5'; e.currentTarget.style.position = 'relative'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.5)' }}
                      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.zIndex = ''; e.currentTarget.style.position = ''; e.currentTarget.style.boxShadow = '' }}
                    >
                      {displayVal}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.875rem', marginTop: '1.25rem' }}>
          {LEGEND.map(({ bg, border, text, color }) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'var(--font-dm-mono)', fontSize: '0.65rem' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: bg, border, flexShrink: 0 }} />
              <span style={{ color: 'rgba(255,255,255,0.35)' }}>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SensitivityError({ msg }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.018)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '14px', padding: '2rem',
      fontFamily: 'var(--font-dm-mono)', fontSize: '0.82rem',
      color: 'var(--warn)', textAlign: 'center',
    }}>
      {msg}
    </div>
  )
}
