'use client'

export default function RiskRatios({ data }) {
  if (!data) return null
  const d = data

  return (
    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Risk Overview Banner */}
      <div className="card card-glow" style={{ padding: '1.5rem 2rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--txt-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'var(--font-dm-mono)', marginBottom: '0.5rem' }}>
              Overall Risk Assessment
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              <ScoreGauge score={d.overallRiskScore} label="Risk Score" inverted />
              <ScoreGauge score={d.overallQualityScore} label="Quality Score" />
            </div>
          </div>
          {d.riskSummary && (
            <div style={{ flex: 1, minWidth: '240px' }}>
              <p style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.875rem', color: 'var(--txt-secondary)', lineHeight: 1.7 }}>{d.riskSummary}</p>
            </div>
          )}
          {d.technicals && (
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <TechBadge label="Trend" value={d.technicals.trend} />
              <TechBadge label="Momentum" value={d.technicals.momentum} />
              <TechBadge label="Technical" value={d.technicals.technicalRating} />
            </div>
          )}
        </div>
      </div>

      {/* Valuation Ratios */}
      {d.valuationRatios?.length > 0 && (
        <div className="card" style={{ padding: '1.25rem 1.5rem', overflowX: 'auto' }}>
          <SectionTitle>Valuation Multiples vs Sector</SectionTitle>
          <table className="data-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th style={{ textAlign: 'right' }}>Value</th>
                <th style={{ textAlign: 'right' }}>Sector Median</th>
                <th style={{ textAlign: 'right' }}>Assessment</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {d.valuationRatios.map((r, i) => (
                <tr key={i}>
                  <td style={{ color: 'var(--txt-secondary)', fontWeight: 500 }}>{r.metric}</td>
                  <td style={{ textAlign: 'right', color: 'var(--txt-primary)', fontFamily: 'var(--font-dm-mono)' }}>{r.value}</td>
                  <td style={{ textAlign: 'right', color: 'var(--txt-muted)', fontFamily: 'var(--font-dm-mono)' }}>{r.sectorMedian}</td>
                  <td style={{ textAlign: 'right' }}>
                    <AssessmentBadge assessment={r.assessment} />
                  </td>
                  <td style={{ color: 'var(--txt-muted)', fontSize: '0.78rem', maxWidth: '200px' }}>{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Quality + Leverage side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
        {/* Quality Ratios */}
        {d.qualityRatios?.length > 0 && (
          <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
            <SectionTitle>Profitability & Quality</SectionTitle>
            <div>
              {d.qualityRatios.map((r, i) => (
                <div key={i} className="metric-row">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--txt-primary)', fontFamily: 'var(--font-dm-mono)' }}>{r.metric}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--txt-muted)', marginTop: '0.1rem' }}>Benchmark: {r.benchmark}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.9rem', color: 'var(--txt-primary)' }}>{r.value}</span>
                    <RatingBadge rating={r.rating} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Leverage Ratios */}
        {d.leverageRatios?.length > 0 && (
          <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
            <SectionTitle>Financial Health & Leverage</SectionTitle>
            <div>
              {d.leverageRatios.map((r, i) => (
                <div key={i} className="metric-row">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--txt-primary)', fontFamily: 'var(--font-dm-mono)' }}>{r.metric}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--txt-muted)', marginTop: '0.1rem' }}>Threshold: {r.threshold}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.9rem', color: 'var(--txt-primary)' }}>{r.value}</span>
                    <RiskBadge risk={r.risk} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Technical Analysis */}
      {d.technicals && (
        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <SectionTitle>Technical Analysis</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.875rem' }}>
            {[
              { label: 'vs 50-Day MA', value: `${parseFloat(d.technicals.priceVs50DMA) >= 0 ? '+' : ''}${parseFloat(d.technicals.priceVs50DMA || 0).toFixed(1)}%`, positive: parseFloat(d.technicals.priceVs50DMA) >= 0 },
              { label: 'vs 200-Day MA', value: `${parseFloat(d.technicals.priceVs200DMA) >= 0 ? '+' : ''}${parseFloat(d.technicals.priceVs200DMA || 0).toFixed(1)}%`, positive: parseFloat(d.technicals.priceVs200DMA) >= 0 },
              { label: '52W Position', value: `${parseFloat(d.technicals.weekPosition52 || 0).toFixed(0)}%`, neutral: true },
              { label: 'Support', value: d.technicals.keyLevels?.support ? `$${parseFloat(d.technicals.keyLevels.support).toFixed(2)}` : '—', neutral: true },
              { label: 'Resistance', value: d.technicals.keyLevels?.resistance ? `$${parseFloat(d.technicals.keyLevels.resistance).toFixed(2)}` : '—', neutral: true },
            ].map(({ label, value, positive, neutral }) => (
              <div key={label} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '6px', padding: '0.875rem', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--txt-muted)', fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>{label}</div>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '1rem', color: neutral ? 'var(--txt-primary)' : positive ? 'var(--gain)' : 'var(--loss)', fontWeight: 500 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk Factors */}
      {d.riskFactors?.length > 0 && (
        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <SectionTitle>Risk Factor Matrix</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
            {d.riskFactors.map((r, i) => (
              <RiskFactor key={i} risk={r} />
            ))}
          </div>
        </div>
      )}

      {/* Peer Benchmarks */}
      {d.peerBenchmarks?.length > 0 && (
        <div className="card" style={{ padding: '1.25rem 1.5rem', overflowX: 'auto' }}>
          <SectionTitle>Peer Comparison</SectionTitle>
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Company</th>
                <th style={{ textAlign: 'right' }}>P/E</th>
                <th style={{ textAlign: 'right' }}>EV/EBITDA</th>
                <th style={{ textAlign: 'right' }}>Net Margin</th>
              </tr>
            </thead>
            <tbody>
              {d.peerBenchmarks.map((p, i) => (
                <tr key={i}>
                  <td style={{ color: 'var(--teal)', fontWeight: 500 }}>{p.ticker}</td>
                  <td style={{ color: 'var(--txt-secondary)' }}>{p.name}</td>
                  <td style={{ textAlign: 'right' }}>{p.pe}</td>
                  <td style={{ textAlign: 'right' }}>{p.evEbitda}</td>
                  <td style={{ textAlign: 'right' }}>{p.margin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ScoreGauge({ score, label, inverted }) {
  const pct = ((parseFloat(score) || 5) / 10) * 100
  const color = inverted
    ? pct > 70 ? '#ef4444' : pct > 40 ? '#f59e0b' : '#22c55e'
    : pct > 70 ? '#22c55e' : pct > 40 ? '#f59e0b' : '#ef4444'

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 0.5rem' }}>
        <svg viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
          <circle cx="40" cy="40" r="34" fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={`${2 * Math.PI * 34}`}
            strokeDashoffset={`${2 * Math.PI * 34 * (1 - pct / 100)}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '1.15rem', color, fontWeight: 500, lineHeight: 1 }}>{isNaN(parseFloat(score)) ? "N/A" : parseFloat(score).toFixed(1)}</span>
          <span style={{ fontSize: '0.6rem', color: 'var(--txt-muted)', lineHeight: 1 }}>/10</span>
        </div>
      </div>
      <div style={{ fontSize: '0.7rem', color: 'var(--txt-muted)', fontFamily: 'var(--font-dm-mono)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
    </div>
  )
}

function AssessmentBadge({ assessment }) {
  const map = {
    CHEAP: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.25)' },
    UNDERVALUED: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.25)' },
    FAIR: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' },
    EXPENSIVE: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)' },
    OVERVALUED: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)' },
  }
  const s = map[assessment?.toUpperCase()] || map.FAIR
  return (
    <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-dm-mono)', color: s.color, background: s.bg, border: `1px solid ${s.border}`, padding: '0.15rem 0.5rem', borderRadius: '3px', letterSpacing: '0.06em' }}>
      {assessment}
    </span>
  )
}

function RatingBadge({ rating }) {
  const colors = { EXCELLENT: '#22c55e', GOOD: '#86efac', AVERAGE: '#f59e0b', POOR: '#ef4444' }
  return (
    <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-dm-mono)', color: colors[rating] || 'var(--txt-muted)' }}>
      {rating}
    </span>
  )
}

function RiskBadge({ risk }) {
  const colors = { LOW: '#22c55e', MEDIUM: '#f59e0b', HIGH: '#ef4444' }
  const bgs = { LOW: 'rgba(34,197,94,0.08)', MEDIUM: 'rgba(245,158,11,0.08)', HIGH: 'rgba(239,68,68,0.08)' }
  return (
    <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-dm-mono)', color: colors[risk] || 'var(--txt-muted)', background: bgs[risk] || 'transparent', padding: '0.1rem 0.45rem', borderRadius: '3px' }}>
      {risk}
    </span>
  )
}

function TechBadge({ label, value }) {
  const isPositive = ['UPTREND', 'BULLISH', 'STRONG'].includes(value?.toUpperCase())
  const isNegative = ['DOWNTREND', 'BEARISH', 'NEGATIVE', 'WEAK'].includes(value?.toUpperCase())
  const color = isPositive ? '#22c55e' : isNegative ? '#ef4444' : '#f59e0b'
  return (
    <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '6px', padding: '0.5rem 0.75rem', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ fontSize: '0.6rem', color: 'var(--txt-muted)', fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.2rem' }}>{label}</div>
      <div style={{ fontSize: '0.78rem', color, fontFamily: 'var(--font-dm-mono)', fontWeight: 500 }}>{value}</div>
    </div>
  )
}

function RiskFactor({ risk }) {
  const severityColors = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#22c55e' }
  const likelihoodColors = { HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#22c55e' }

  return (
    <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '6px', padding: '0.875rem', border: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.4rem', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.82rem', color: 'var(--txt-primary)', fontWeight: 500, flex: 1 }}>{risk.risk}</span>
        <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
          <span style={{ fontSize: '0.62rem', color: severityColors[risk.severity], fontFamily: 'var(--font-dm-mono)' }}>
            ⬆ {risk.severity}
          </span>
          <span style={{ fontSize: '0.62rem', color: likelihoodColors[risk.likelihood], fontFamily: 'var(--font-dm-mono)' }}>
            ◎ {risk.likelihood}
          </span>
        </div>
      </div>
      <p style={{ fontSize: '0.78rem', color: 'var(--txt-secondary)', fontFamily: 'var(--font-dm-mono)', lineHeight: 1.55 }}>{risk.detail}</p>
    </div>
  )
}

function SectionTitle({ children }) {
  return <div style={{ fontSize: '0.68rem', color: 'var(--txt-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'var(--font-dm-mono)', marginBottom: '0.75rem' }}>{children}</div>
}
