'use client'
import { sentimentColor, formatPrice } from '../../lib/utils'

export default function NewsSentiment({ data }) {
  if (!data) return null
  const d = data
  const score = d.sentimentScore || 50
  const color = sentimentColor(score)

  return (
    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Sentiment Banner */}
      <div className="card card-glow" style={{ padding: '1.5rem 2rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Score gauge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <SentimentGauge score={score} color={color} />
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--txt-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'var(--font-dm-mono)', marginBottom: '0.4rem' }}>
                Market Sentiment
              </div>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '1.3rem', color, fontWeight: 600, marginBottom: '0.25rem' }}>
                {d.sentimentLabel}
              </div>
              {d.sentimentRationale && (
                <p style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.8rem', color: 'var(--txt-secondary)', lineHeight: 1.6, maxWidth: '360px' }}>
                  {d.sentimentRationale}
                </p>
              )}
            </div>
          </div>

          {/* Analyst consensus */}
          {d.analystConsensus && (
            <div style={{ minWidth: '200px' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--txt-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'var(--font-dm-mono)', marginBottom: '0.75rem' }}>
                Analyst Consensus
              </div>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '1.1rem', color: 'var(--teal)', fontWeight: 600, marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                {d.analystConsensus.rating}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--txt-secondary)', fontFamily: 'var(--font-dm-mono)', marginBottom: '0.75rem' }}>
                Target: <span style={{ color: 'var(--txt-primary)' }}>{formatPrice(d.analystConsensus.meanTarget)}</span>
                {d.analystConsensus.upside != null && (
                  <span style={{ color: d.analystConsensus.upside >= 0 ? 'var(--gain)' : 'var(--loss)', marginLeft: '0.4rem' }}>
                    ({d.analystConsensus.upside >= 0 ? '+' : ''}{d.analystConsensus.upside?.toFixed(1)}%)
                  </span>
                )}
              </div>
              {/* Buy/Hold/Sell bars */}
              {(d.analystConsensus.buyCount != null) && (
                <AnalystBar
                  buy={d.analystConsensus.buyCount}
                  hold={d.analystConsensus.holdCount}
                  sell={d.analystConsensus.sellCount}
                />
              )}
              {d.analystConsensus.noteOnConsensus && (
                <p style={{ fontSize: '0.75rem', color: 'var(--txt-muted)', fontFamily: 'var(--font-dm-mono)', marginTop: '0.5rem', lineHeight: 1.5 }}>
                  {d.analystConsensus.noteOnConsensus}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Key Themes */}
      {d.keyThemes?.length > 0 && (
        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <SectionTitle>Key Market Themes</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {d.keyThemes.map((theme, i) => (
              <ThemeCard key={i} theme={theme} />
            ))}
          </div>
        </div>
      )}

      {/* Bull + Bear catalysts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        {d.bullCatalysts?.length > 0 && (
          <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
            <SectionTitle style={{ color: 'var(--gain)' }}>🚀 Bull Catalysts</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {d.bullCatalysts.map((c, i) => (
                <CatalystCard key={i} catalyst={c} positive />
              ))}
            </div>
          </div>
        )}
        {d.bearCatalysts?.length > 0 && (
          <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
            <SectionTitle>⚠️ Bear Catalysts</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {d.bearCatalysts.map((c, i) => (
                <CatalystCard key={i} catalyst={c} positive={false} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Macro Exposure */}
      {d.macroExposure?.length > 0 && (
        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <SectionTitle>Macro Factor Exposure</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
            {d.macroExposure.map((m, i) => (
              <div key={i} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '6px', padding: '0.875rem', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.82rem', color: 'var(--txt-primary)', fontWeight: 500 }}>{m.factor}</span>
                  <ExposureBadge exposure={m.exposure} />
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--txt-secondary)', fontFamily: 'var(--font-dm-mono)', lineHeight: 1.55 }}>{m.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Institutional Activity + Events */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
        {d.institutionalActivity && (
          <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
            <SectionTitle>Institutional Activity</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[
                { label: 'Short Interest Trend', value: d.institutionalActivity.shortInterestTrend },
                { label: 'Short Squeeze Risk', value: d.institutionalActivity.shortSqueezeRisk },
              ].map(({ label, value }) => (
                <div key={label} className="metric-row">
                  <span style={{ fontSize: '0.82rem', color: 'var(--txt-secondary)', fontFamily: 'var(--font-dm-mono)' }}>{label}</span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--txt-primary)', fontFamily: 'var(--font-dm-mono)' }}>{value}</span>
                </div>
              ))}
              {d.institutionalActivity.institutionalOwnershipNote && (
                <p style={{ fontSize: '0.78rem', color: 'var(--txt-muted)', fontFamily: 'var(--font-dm-mono)', marginTop: '0.5rem', lineHeight: 1.55 }}>
                  {d.institutionalActivity.institutionalOwnershipNote}
                </p>
              )}
            </div>
          </div>
        )}

        {d.upcomingEvents?.length > 0 && (
          <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
            <SectionTitle>Upcoming Events</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {d.upcomingEvents.map((ev, i) => (
                <div key={i} style={{ paddingLeft: '0.75rem', borderLeft: '2px solid rgba(0,212,170,0.25)' }}>
                  <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.82rem', color: 'var(--txt-primary)', fontWeight: 500 }}>{ev.event}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--teal)', fontFamily: 'var(--font-dm-mono)', marginTop: '0.15rem' }}>{ev.expectedDate}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--txt-muted)', marginTop: '0.2rem', lineHeight: 1.5 }}>{ev.marketImplications}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Trading Note */}
      {d.tradingNote && (
        <div className="card" style={{ padding: '1.25rem 1.5rem', borderLeft: '3px solid var(--teal)' }}>
          <SectionTitle>30-60 Day Trading Note</SectionTitle>
          <p style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.875rem', color: 'var(--txt-secondary)', lineHeight: 1.7 }}>{d.tradingNote}</p>
        </div>
      )}
    </div>
  )
}

function SentimentGauge({ score, color }) {
  const angle = (score / 100) * 180 - 90
  return (
    <div style={{ position: 'relative', width: '100px', height: '56px', flexShrink: 0 }}>
      <svg viewBox="0 0 100 56" style={{ width: '100px', height: '56px' }}>
        {/* Background arc */}
        <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" strokeLinecap="round" />
        {/* Score arc */}
        <path
          d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * 125.7} 125.7`}
          opacity="0.85"
        />
        {/* Needle */}
        <line
          x1="50" y1="50"
          x2={50 + 30 * Math.cos((angle - 90) * Math.PI / 180)}
          y2={50 + 30 * Math.sin((angle - 90) * Math.PI / 180)}
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="50" cy="50" r="4" fill={color} />
        <text x="50" y="30" textAnchor="middle" fill={color} fontSize="13" fontFamily="DM Mono, monospace" fontWeight="600">{score}</text>
      </svg>
      <div style={{ textAlign: 'center', fontSize: '0.6rem', color: 'var(--txt-muted)', fontFamily: 'var(--font-dm-mono)', marginTop: '-4px' }}>/ 100</div>
    </div>
  )
}

function AnalystBar({ buy, hold, sell }) {
  const total = (buy || 0) + (hold || 0) + (sell || 0)
  if (total === 0) return null
  return (
    <div>
      <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', gap: '1px' }}>
        <div style={{ width: `${(buy / total) * 100}%`, background: 'var(--gain)' }} />
        <div style={{ width: `${(hold / total) * 100}%`, background: 'var(--warn)' }} />
        <div style={{ width: `${(sell / total) * 100}%`, background: 'var(--loss)' }} />
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.3rem', fontSize: '0.68rem', fontFamily: 'var(--font-dm-mono)' }}>
        <span style={{ color: 'var(--gain)' }}>Buy: {buy}</span>
        <span style={{ color: 'var(--warn)' }}>Hold: {hold}</span>
        <span style={{ color: 'var(--loss)' }}>Sell: {sell}</span>
      </div>
    </div>
  )
}

function ThemeCard({ theme }) {
  const sentimentColors = { POSITIVE: '#22c55e', NEGATIVE: '#ef4444', NEUTRAL: '#f59e0b' }
  const color = sentimentColors[theme.sentiment?.toUpperCase()] || '#f59e0b'
  return (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
      <div style={{ width: '3px', background: color, borderRadius: '2px', alignSelf: 'stretch', flexShrink: 0, minHeight: '40px' }} />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.85rem', color: 'var(--txt-primary)', fontWeight: 500 }}>{theme.theme}</span>
          <span style={{ fontSize: '0.65rem', color, fontFamily: 'var(--font-dm-mono)' }}>{theme.sentiment}</span>
          {theme.timeframe && (
            <span style={{ fontSize: '0.65rem', color: 'var(--txt-muted)', fontFamily: 'var(--font-dm-mono)', background: 'rgba(255,255,255,0.04)', padding: '0.1rem 0.4rem', borderRadius: '3px' }}>
              {theme.timeframe}
            </span>
          )}
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--txt-secondary)', fontFamily: 'var(--font-dm-mono)', lineHeight: 1.55 }}>{theme.detail}</p>
      </div>
    </div>
  )
}

function CatalystCard({ catalyst, positive }) {
  const probColors = { HIGH: positive ? '#22c55e' : '#ef4444', MEDIUM: '#f59e0b', LOW: 'var(--txt-muted)' }
  const probColor = probColors[catalyst.probability?.toUpperCase()] || 'var(--txt-muted)'
  return (
    <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '5px', padding: '0.75rem', border: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.3rem' }}>
        <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.82rem', color: 'var(--txt-primary)', fontWeight: 500, flex: 1 }}>{catalyst.catalyst}</span>
        <span style={{ fontSize: '0.62rem', color: probColor, fontFamily: 'var(--font-dm-mono)', flexShrink: 0 }}>{catalyst.probability}</span>
      </div>
      {catalyst.potentialImpact && (
        <p style={{ fontSize: '0.75rem', color: 'var(--txt-muted)', fontFamily: 'var(--font-dm-mono)', lineHeight: 1.5 }}>{catalyst.potentialImpact}</p>
      )}
    </div>
  )
}

function ExposureBadge({ exposure }) {
  const map = {
    POSITIVE: { color: '#22c55e', text: '↑ POS' },
    NEGATIVE: { color: '#ef4444', text: '↓ NEG' },
    NEUTRAL: { color: '#f59e0b', text: '→ NEU' },
  }
  const s = map[exposure?.toUpperCase()] || map.NEUTRAL
  return <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-dm-mono)', color: s.color, fontWeight: 500 }}>{s.text}</span>
}

function SectionTitle({ children }) {
  return <div style={{ fontSize: '0.68rem', color: 'var(--txt-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'var(--font-dm-mono)', marginBottom: '0.75rem' }}>{children}</div>
}
