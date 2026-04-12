'use client'
import { verdictClass, formatPrice, impactColor } from '@/lib/client-utils'
import { validatePeers, validateAnalysisQuality, getSuggestedPeers } from '@/lib/sector-validator'
import { MIN_CONFIDENCE_THRESHOLD } from '@/lib/ai-normalizer'

export default function InvestmentThesis({ data, ticker, currency }) {
  if (!data) {
    return <InsufficientDataState reason="No analysis data available" />
  }

  const d = data

  // ─────────────────────────────────────────────────────────────────────────
  // VALIDATION: Check if analysis meets minimum quality standards
  // ─────────────────────────────────────────────────────────────────────────
  const validation = validateAnalysisQuality(d)

  // If data came from API normalization with `isValid` flag, use that too
  const isDataValid = d.isValid !== undefined ? d.isValid : validation.isValid
  const errors = d.validationErrors || validation.errors

  // Return insufficient data state if validation fails
  if (!isDataValid || errors.length > 0) {
    return <InsufficientDataState
      reason="Analysis quality below acceptable threshold"
      errors={errors}
      ticker={ticker}
    />
  }

  // Validate and filter peers by sector
  const peerValidation = ticker ? validatePeers(ticker, d.comparisonPeers || []) : null
  const validPeers = peerValidation?.validPeers?.map(p => p.ticker) || []

  const moatStars = Math.round(d.moatRating || 0)

  return (
    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Verdict banner */}
      <div className="card card-glow" style={{ padding: '1.5rem 2rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--txt-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'var(--font-dm-mono)', marginBottom: '0.5rem' }}>
              AI Investment Verdict
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <span className={verdictClass(d.verdict)} style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '1.5rem', fontWeight: 700, padding: '0.3rem 1rem', borderRadius: '6px', letterSpacing: '0.1em' }}>
                {d.verdict}
              </span>
              <div>
                <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '1.1rem', color: 'var(--txt-primary)', marginBottom: '0.15rem' }}>
                  Target: {formatPrice(d.targetPrice, currency)}
                  <span style={{ fontSize: '0.85rem', color: d.upsideDownside >= 0 ? 'var(--gain)' : 'var(--loss)', marginLeft: '0.5rem' }}>
                    ({d.upsideDownside >= 0 ? '+' : ''}{d.upsideDownside?.toFixed(1)}%)
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--txt-muted)', fontFamily: 'var(--font-dm-mono)' }}>
                  {d.timeHorizon} · Confidence: {d.confidence}%
                </div>
              </div>
            </div>
          </div>

          {/* Confidence meter */}
          <div style={{ minWidth: '180px' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--txt-muted)', fontFamily: 'var(--font-dm-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              Analyst Confidence
            </div>
            <div className="progress-bar" style={{ height: '8px', marginBottom: '0.3rem' }}>
              <div className="progress-fill" style={{ width: `${d.confidence}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--txt-muted)', fontFamily: 'var(--font-dm-mono)' }}>
              <span>Low</span>
              <span style={{ color: 'var(--teal)' }}>{d.confidence}%</span>
              <span>High</span>
            </div>
          </div>
        </div>

        {/* Summary */}
        {d.thesisSummary && (
          <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(0,212,170,0.08)' }}>
            <p style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.875rem', color: 'var(--txt-secondary)', lineHeight: 1.7 }}>
              {d.thesisSummary}
            </p>
          </div>
        )}
      </div>

      {/* Bull / Bear / Base cases */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.875rem' }}>
        {/* Bull Case */}
        {d.bullCase && (
          <CaseCard
            label="Bull Case"
            title={d.bullCase.title}
            points={d.bullCase.points}
            target={d.bullCase.targetPrice}
            probability={d.bullCase.probability}
            color="#22c55e"
            bg="rgba(34,197,94,0.05)"
            border="rgba(34,197,94,0.18)"
            icon="↑"
            currency={currency}
          />
        )}
        {/* Bear Case */}
        {d.bearCase && (
          <CaseCard
            label="Bear Case"
            title={d.bearCase.title}
            points={d.bearCase.points}
            target={d.bearCase.targetPrice}
            probability={d.bearCase.probability}
            color="#ef4444"
            bg="rgba(239,68,68,0.05)"
            border="rgba(239,68,68,0.18)"
            icon="↓"
            currency={currency}
          />
        )}
        {/* Base Case */}
        {d.baseCase && (
          <CaseCard
            label="Base Case"
            title={d.baseCase.title}
            points={[]}
            target={d.baseCase.targetPrice}
            probability={d.baseCase.probability}
            color="#f59e0b"
            bg="rgba(245,158,11,0.05)"
            border="rgba(245,158,11,0.18)"
            icon="→"
            currency={currency}
          />
        )}
      </div>

      {/* Key Drivers */}
      {d.keyDrivers?.length > 0 && (
        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <SectionTitle>Key Investment Drivers</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {d.keyDrivers.map((driver, i) => (
              <div key={i} className="metric-row">
                <div style={{ flex: 1 }}>
                  <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.85rem', color: 'var(--txt-primary)', fontWeight: 500 }}>{driver.driver}</span>
                  <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem', color: 'var(--txt-secondary)' }}>{driver.detail}</span>
                </div>
                <ImpactBadge impact={driver.impact} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom row: Moat + Catalysts + Risks */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.875rem' }}>
        {/* Economic Moat */}
        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <SectionTitle>Economic Moat</SectionTitle>
          <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem' }}>
            {[1,2,3,4,5].map(s => (
              <div key={s} style={{ width: '28px', height: '6px', borderRadius: '3px', background: s <= moatStars ? 'var(--teal)' : 'rgba(0,212,170,0.12)' }} />
            ))}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--teal)', fontFamily: 'var(--font-dm-mono)', marginBottom: '0.4rem' }}>{d.moatType}</div>
          {d.growthQuality && <p style={{ fontSize: '0.8rem', color: 'var(--txt-secondary)', lineHeight: 1.6, fontFamily: 'var(--font-dm-mono)' }}>{d.growthQuality}</p>}
        </div>

        {/* Catalysts */}
        {d.catalysts?.length > 0 && (
          <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
            <SectionTitle>Near-Term Catalysts</SectionTitle>
            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {d.catalysts.map((c, i) => (
                <li key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--gain)', marginTop: '0.1rem', flexShrink: 0 }}>◆</span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--txt-secondary)', fontFamily: 'var(--font-dm-mono)', lineHeight: 1.5 }}>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Risks */}
        {d.risks?.length > 0 && (
          <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
            <SectionTitle>Key Risks</SectionTitle>
            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {d.risks.map((r, i) => (
                <li key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--loss)', marginTop: '0.1rem', flexShrink: 0 }}>◆</span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--txt-secondary)', fontFamily: 'var(--font-dm-mono)', lineHeight: 1.5 }}>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Position sizing */}
      {(isDataValid && (d.positionSizing || validPeers.length > 0)) && (
        <div className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'flex-start' }}>
          {d.positionSizing && d.positionSizing !== 'None' && (
            <div>
              <SectionTitle>Recommended Positioning</SectionTitle>
              <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '1rem', color: 'var(--teal)', fontWeight: 500 }}>{d.positionSizing}</span>
            </div>
          )}
          {validPeers.length > 0 ? (
            <div>
              <SectionTitle>Peer Group (Sector-Validated)</SectionTitle>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {validPeers.map((p, i) => (
                  <span key={i} style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.8rem', color: 'var(--txt-secondary)', background: 'rgba(0,212,170,0.05)', border: '1px solid rgba(0,212,170,0.12)', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
                    {p}
                  </span>
                ))}
              </div>
            </div>
          ) : ticker && (
            <div>
              <SectionTitle>Peer Group</SectionTitle>
              <div style={{ fontSize: '0.8rem', color: 'var(--txt-muted)', fontFamily: 'var(--font-dm-mono)' }}>
                No validated peers available for {ticker.toUpperCase()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Insufficient Data State Component
 * Shows when analysis quality is below threshold
 */
function InsufficientDataState({ reason, errors = [], ticker }) {
  const suggestedPeers = ticker ? getSuggestedPeers(ticker, 5) : []

  return (
    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="card" style={{
        padding: '2rem',
        border: '2px solid rgba(239,68,68,0.3)',
        background: 'rgba(239,68,68,0.05)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1rem'
        }}>
          <span style={{
            fontSize: '1.5rem',
            color: '#ef4444'
          }}>⚠</span>
          <span style={{
            fontFamily: 'var(--font-dm-mono)',
            fontSize: '1.25rem',
            fontWeight: 600,
            color: '#ef4444'
          }}>
            INSUFFICIENT DATA FOR ANALYSIS
          </span>
        </div>

        <p style={{
          fontFamily: 'var(--font-dm-mono)',
          fontSize: '0.9rem',
          color: 'var(--txt-secondary)',
          marginBottom: '1.5rem',
          lineHeight: 1.6
        }}>
          {reason}
        </p>

        {errors.length > 0 && (
          <div style={{
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '6px',
            padding: '1rem',
            marginBottom: '1.5rem'
          }}>
            <div style={{
              fontSize: '0.7rem',
              color: 'var(--txt-muted)',
              fontFamily: 'var(--font-dm-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '0.75rem'
            }}>
              Validation Errors
            </div>
            <ul style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}>
              {errors.map((error, i) => (
                <li key={i} style={{
                  fontFamily: 'var(--font-dm-mono)',
                  fontSize: '0.82rem',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem'
                }}>
                  <span>•</span>
                  {error}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div style={{
          display: 'flex',
          gap: '2rem',
          flexWrap: 'wrap'
        }}>
          <div>
            <div style={{
              fontSize: '0.7rem',
              color: 'var(--txt-muted)',
              fontFamily: 'var(--font-dm-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '0.5rem'
            }}>
              Minimum Requirements
            </div>
            <ul style={{
              fontFamily: 'var(--font-dm-mono)',
              fontSize: '0.8rem',
              color: 'var(--txt-secondary)',
              paddingLeft: '1rem',
              lineHeight: 1.8
            }}>
              <li>Confidence ≥ {MIN_CONFIDENCE_THRESHOLD}%</li>
              <li>At least 2 valid investment drivers</li>
              <li>Target price must be present</li>
              <li>Peers must be in same sector</li>
            </ul>
          </div>

          {suggestedPeers.length > 0 && (
            <div>
              <div style={{
                fontSize: '0.7rem',
                color: 'var(--txt-muted)',
                fontFamily: 'var(--font-dm-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: '0.5rem'
              }}>
                Sector-Validated Peers
              </div>
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                flexWrap: 'wrap'
              }}>
                {suggestedPeers.map((p, i) => (
                  <span key={i} style={{
                    fontFamily: 'var(--font-dm-mono)',
                    fontSize: '0.8rem',
                    color: 'var(--txt-secondary)',
                    background: 'rgba(0,212,170,0.05)',
                    border: '1px solid rgba(0,212,170,0.12)',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '4px'
                  }}>
                    {p.ticker}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CaseCard({ label, title, points, target, probability, color, bg, border, icon, currency }) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: '8px', padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
        <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '1rem', color, fontWeight: 700 }}>{icon}</span>
        <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-dm-mono)', color, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</span>
        {probability && (
          <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color, fontFamily: 'var(--font-dm-mono)' }}>{probability}% prob.</span>
        )}
      </div>
      {title ? (
        <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '0.95rem', color: 'var(--txt-primary)', marginBottom: '0.75rem', lineHeight: 1.3 }}>{title}</div>
      ) : (
        <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '0.95rem', color: 'var(--txt-muted)', marginBottom: '0.75rem', lineHeight: 1.3 }}>No scenario details available</div>
      )}
      {target ? (
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '1.1rem', color, fontWeight: 600, marginBottom: '0.625rem' }}>
          Target: {formatPrice(target, currency)}
        </div>
      ) : (
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '1.1rem', color: 'var(--txt-muted)', fontWeight: 600, marginBottom: '0.625rem' }}>
          Target: —
        </div>
      )}
      {points?.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {points.map((p, i) => (
            <li key={i} style={{ fontSize: '0.8rem', color: 'var(--txt-secondary)', fontFamily: 'var(--font-dm-mono)', lineHeight: 1.5, paddingLeft: '0.75rem', borderLeft: `2px solid ${color}40` }}>
              {p}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: '0.68rem', color: 'var(--txt-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'var(--font-dm-mono)', marginBottom: '0.75rem' }}>
      {children}
    </div>
  )
}

function ImpactBadge({ impact }) {
  const map = {
    POSITIVE: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.25)' },
    NEGATIVE: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)' },
    NEUTRAL: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' },
  }
  const s = map[impact?.toUpperCase()] || map.NEUTRAL
  return (
    <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-dm-mono)', color: s.color, background: s.bg, border: `1px solid ${s.border}`, padding: '0.15rem 0.5rem', borderRadius: '3px', letterSpacing: '0.08em', flexShrink: 0 }}>
      {impact}
    </span>
  )
}
