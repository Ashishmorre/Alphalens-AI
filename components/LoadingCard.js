'use client'

export function SkeletonLine({ width = '100%', height = '14px', style = {} }) {
  return (
    <div className="shimmer" style={{ width, height, borderRadius: '4px', ...style }} />
  )
}

export function SkeletonCard({ lines = 4 }) {
  return (
    <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} width={i === 0 ? '40%' : i % 2 === 0 ? '75%' : '60%'} />
      ))}
    </div>
  )
}

export function AnalysisLoader({ type }) {
  const messages = {
    thesis: ['Evaluating competitive moat…', 'Modelling bull & bear scenarios…', 'Synthesising investment thesis…'],
    dcf: ['Projecting 5-year cash flows…', 'Computing WACC…', 'Building sensitivity table…'],
    risk: ['Screening valuation multiples…', 'Benchmarking vs peers…', 'Assessing risk factors…'],
    news: ['Parsing market narrative…', 'Scoring sentiment signals…', 'Aggregating analyst views…'],
    compare: ['Analysing both companies…', 'Running head-to-head comparison…', 'Scoring investment dimensions…'],
  }

  const steps = messages[type] || ['Running AI analysis…', 'Processing data…', 'Generating insights…']

  return (
    <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
      {/* Animated orb */}
      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.75rem', position: 'relative' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '50%', border: '2px solid rgba(0,212,170,0.2)', position: 'absolute', animation: 'spin 3s linear infinite' }} />
        <div style={{ width: '44px', height: '44px', borderRadius: '50%', border: '2px solid transparent', borderTopColor: 'var(--teal)', position: 'absolute', animation: 'spin 1.2s linear infinite' }} />
        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(0,212,170,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.5">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>

      <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '1.15rem', color: 'var(--txt-primary)', marginBottom: '0.5rem' }}>
        Running AI Analysis
      </div>
      <div style={{ fontSize: '0.8rem', color: 'var(--teal)', fontFamily: 'var(--font-dm-mono)', marginBottom: '2rem' }}>
        <StepCycle steps={steps} />
      </div>

      {/* Progress bars skeleton */}
      <div style={{ maxWidth: '400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {steps.map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: i === 0 ? 'var(--teal)' : 'rgba(0,212,170,0.2)', flexShrink: 0 }} />
            <div style={{ flex: 1, height: '3px', background: 'rgba(0,212,170,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
              <div className="shimmer" style={{ height: '100%', borderRadius: '2px', animationDelay: `${i * 0.3}s` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StepCycle({ steps }) {
  const [idx, setIdx] = require('react').useState(0)
  require('react').useEffect(() => {
    const id = setInterval(() => setIdx(i => (i + 1) % steps.length), 1800)
    return () => clearInterval(id)
  }, [steps.length])
  return <span className="cursor">{steps[idx]}</span>
}

export function RunAnalysisButton({ type, onClick, loading }) {
  const icons = {
    thesis: '●',
    dcf: '●',
    risk: '●',
    news: '●',
  }
  const labels = {
    thesis: 'Generate Investment Thesis',
    dcf: 'Build DCF Model',
    risk: 'Analyse Risk & Ratios',
    news: 'Score News Sentiment',
  }

  return (
    <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>{icons[type]}</div>
      <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '1.3rem', color: 'var(--txt-primary)', marginBottom: '0.5rem' }}>
        {labels[type]}
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--txt-secondary)', fontFamily: 'var(--font-dm-mono)', marginBottom: '2rem', maxWidth: '380px', margin: '0 auto 2rem', lineHeight: 1.6 }}>
        Click to run a comprehensive AI analysis powered by Claude. Takes 5-15 seconds.
      </p>
      <button className="btn btn-primary" onClick={onClick} disabled={loading} style={{ fontSize: '0.9rem', padding: '0.75rem 2rem' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M5 3l14 9-14 9V3z"/>
        </svg>
        Run Analysis
      </button>
    </div>
  )
}
