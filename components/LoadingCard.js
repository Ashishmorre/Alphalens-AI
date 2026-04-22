'use client'
import { useState, useEffect } from 'react'

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

export function SkeletonStockOverview() {
  return (
    <div className="skeleton-wrapper" style={{ marginBottom: '1.5rem' }}>
      {/* Main price card skeleton */}
      <div className="card" style={{ padding: '1.75rem 2rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.8rem' }}>
              <SkeletonLine width="80px" height="24px" />
              <SkeletonLine width="150px" height="14px" style={{ marginTop: '5px' }} />
            </div>
            <SkeletonLine width="280px" height="32px" style={{ marginBottom: '1.2rem' }} />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem' }}>
              <SkeletonLine width="180px" height="48px" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <SkeletonLine width="60px" height="18px" />
                <SkeletonLine width="45px" height="14px" />
              </div>
            </div>
            <div style={{ marginTop: '1.5rem', maxWidth: '320px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <SkeletonLine width="80px" height="10px" />
                <SkeletonLine width="80px" height="10px" />
              </div>
              <SkeletonLine width="100%" height="4px" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', minWidth: '280px', maxWidth: '480px', flex: '1 1 280px' }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.15)', borderRadius: '6px' }}>
                <SkeletonLine width="50%" height="10px" style={{ marginBottom: '0.5rem' }} />
                <SkeletonLine width="70%" height="16px" />
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(0,212,170,0.07)' }}>
          <SkeletonLine width="100%" height="14px" style={{ marginBottom: '0.6rem' }} />
          <SkeletonLine width="95%" height="14px" style={{ marginBottom: '0.6rem' }} />
          <SkeletonLine width="60%" height="14px" />
        </div>
      </div>

      {/* Secondary stats row skeleton */}
      <SkeletonStatGrid />
    </div>
  )
}

export function SkeletonStatGrid({ count = 8 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.625rem' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card" style={{ padding: '0.75rem 1rem' }}>
          <SkeletonLine width="40%" height="10px" style={{ marginBottom: '0.5rem' }} />
          <SkeletonLine width="60%" height="16px" />
        </div>
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
      <div style={{ maxWidth: '400px', margin: '0 auto 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {steps.map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: i === 0 ? 'var(--teal)' : 'rgba(0,212,170,0.2)', flexShrink: 0 }} />
            <div style={{ flex: 1, height: '3px', background: 'rgba(0,212,170,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
              <div className="shimmer" style={{ height: '100%', borderRadius: '2px', animationDelay: `${i * 0.3}s` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Structural skeleton lines */}
      <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem', opacity: 0.5 }}>
        <SkeletonLine width="100%" height="16px" />
        <SkeletonLine width="90%" height="16px" />
        <SkeletonLine width="95%" height="16px" />
        <SkeletonLine width="40%" height="16px" />
      </div>
    </div>
  )
}

function StepCycle({ steps }) {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
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
      <div style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: 0.7 }}>{icons[type]}</div>
      <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '1.3rem', color: 'var(--txt-primary)', marginBottom: '0.5rem' }}>
        {labels[type]}
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--txt-secondary)', fontFamily: 'var(--font-dm-mono)', marginBottom: '2rem', maxWidth: '380px', margin: '0 auto 2rem', lineHeight: 1.6 }}>
        Click to run a comprehensive AI analysis. Takes 5–15 seconds.
      </p>
      <button
        className="btn btn-primary"
        onClick={onClick}
        disabled={loading}
        style={{ fontSize: '0.9rem', padding: '0.75rem 2rem', color: '#001a12', fontWeight: 700, letterSpacing: '0.04em' }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="#001a12" stroke="none">
          <path d="M5 3l14 9-14 9V3z"/>
        </svg>
        <span style={{ color: '#001a12', fontWeight: 700 }}>Run Analysis</span>
      </button>
    </div>
  )
}

// ─── Shared skeleton helpers ──────────────────────────────────────────────────

function SkeletonSection({ label, children }) {
  return (
    <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
      <SkeletonLine width="120px" height="10px" style={{ marginBottom: '1rem', opacity: 0.5 }} />
      {children}
    </div>
  )
}

function SkeletonRows({ count = 4, widths }) {
  const defaults = ['100%', '90%', '80%', '60%']
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonLine key={i} width={(widths || defaults)[i % (widths || defaults).length]} height="13px" />
      ))}
    </div>
  )
}

// ─── 1. Investment Thesis Skeleton ────────────────────────────────────────────
export function SkeletonThesis() {
  return (
    <div className="skeleton-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Verdict banner */}
      <div className="card" style={{ padding: '1.5rem 2rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <SkeletonLine width="140px" height="10px" />
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <SkeletonLine width="120px" height="36px" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <SkeletonLine width="160px" height="18px" />
                <SkeletonLine width="120px" height="12px" />
              </div>
            </div>
          </div>
          <div style={{ minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <SkeletonLine width="120px" height="10px" />
            <SkeletonLine width="100%" height="8px" />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <SkeletonLine width="30px" height="10px" />
              <SkeletonLine width="30px" height="10px" />
            </div>
          </div>
        </div>
        <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(0,212,170,0.08)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <SkeletonLine width="100%" height="13px" />
          <SkeletonLine width="92%" height="13px" />
          <SkeletonLine width="78%" height="13px" />
        </div>
      </div>

      {/* Bull / Bear / Base cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.875rem' }}>
        {[['rgba(34,197,94,0.08)','rgba(34,197,94,0.2)'], ['rgba(239,68,68,0.08)','rgba(239,68,68,0.2)'], ['rgba(245,158,11,0.08)','rgba(245,158,11,0.2)']].map(([bg, border], i) => (
          <div key={i} style={{ background: bg, border: `1px solid ${border}`, borderRadius: '8px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <SkeletonLine width="20px" height="20px" style={{ borderRadius: '50%' }} />
              <SkeletonLine width="70px" height="10px" />
            </div>
            <SkeletonLine width="80%" height="16px" />
            <SkeletonLine width="60%" height="20px" />
            <SkeletonRows count={3} widths={['90%', '75%', '60%']} />
          </div>
        ))}
      </div>

      {/* Key Drivers */}
      <SkeletonSection>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
            <div style={{ display: 'flex', gap: '0.75rem', flex: 1 }}>
              <SkeletonLine width="100px" height="13px" />
              <SkeletonLine width="140px" height="13px" />
            </div>
            <SkeletonLine width="60px" height="22px" style={{ borderRadius: '3px' }} />
          </div>
        ))}
      </SkeletonSection>

      {/* Moat / Catalysts / Risks */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.875rem' }}>
        {[3, 3, 3].map((n, i) => (
          <SkeletonSection key={i}>
            <SkeletonRows count={n} widths={['80%', '65%', '50%']} />
          </SkeletonSection>
        ))}
      </div>
    </div>
  )
}

// ─── 2. DCF Valuation Skeleton ────────────────────────────────────────────────
export function SkeletonDCF() {
  return (
    <div className="skeleton-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Summary metrics bar */}
      <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '6px', padding: '0.75rem 1rem', minWidth: '100px' }}>
              <SkeletonLine width="50px" height="10px" style={{ marginBottom: '0.5rem' }} />
              <SkeletonLine width="70px" height="18px" />
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.625rem' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '6px', padding: '0.75rem' }}>
              <SkeletonLine width="60%" height="10px" style={{ marginBottom: '0.4rem' }} />
              <SkeletonLine width="75%" height="16px" />
            </div>
          ))}
        </div>
      </div>

      {/* 5-Year projections table */}
      <div className="card" style={{ padding: '1.25rem 1.5rem', overflowX: 'auto' }}>
        <SkeletonLine width="160px" height="10px" style={{ marginBottom: '1rem', opacity: 0.5 }} />
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {Array.from({ length: 6 }).map((_, i) => (
                <td key={i} style={{ padding: '0.5rem 0.75rem' }}>
                  <SkeletonLine width={i === 0 ? '80px' : '50px'} height="10px" />
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 7 }).map((_, row) => (
              <tr key={row} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                {Array.from({ length: 6 }).map((_, col) => (
                  <td key={col} style={{ padding: '0.6rem 0.75rem' }}>
                    <SkeletonLine width={col === 0 ? '90px' : '55px'} height="12px" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sensitivity table */}
      <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
        <SkeletonLine width="140px" height="10px" style={{ marginBottom: '1rem', opacity: 0.5 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.375rem' }}>
          {Array.from({ length: 36 }).map((_, i) => (
            <SkeletonLine key={i} width="100%" height="28px" style={{ borderRadius: '3px' }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── 3. Risk & Ratios Skeleton ────────────────────────────────────────────────
export function SkeletonRisk() {
  return (
    <div className="skeleton-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Ratio grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.875rem' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card" style={{ padding: '1.25rem 1.5rem' }}>
            <SkeletonLine width="100px" height="10px" style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
            <SkeletonLine width="80px" height="28px" style={{ marginBottom: '0.5rem' }} />
            <SkeletonLine width="100%" height="4px" style={{ marginBottom: '0.4rem' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <SkeletonLine width="40px" height="10px" />
              <SkeletonLine width="40px" height="10px" />
            </div>
          </div>
        ))}
      </div>

      {/* Risk matrix */}
      <SkeletonSection>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
            <SkeletonLine width="160px" height="13px" />
            <SkeletonLine width="70px" height="22px" style={{ borderRadius: '3px' }} />
          </div>
        ))}
      </SkeletonSection>

      {/* Two-column: Strengths + Concerns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
        <SkeletonSection><SkeletonRows count={4} /></SkeletonSection>
        <SkeletonSection><SkeletonRows count={4} /></SkeletonSection>
      </div>
    </div>
  )
}

// ─── 4. News Sentiment Skeleton ───────────────────────────────────────────────
export function SkeletonNews() {
  return (
    <div className="skeleton-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Sentiment score banner */}
      <div className="card" style={{ padding: '1.5rem 2rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <SkeletonLine width="120px" height="10px" />
            <SkeletonLine width="80px" height="40px" />
            <SkeletonLine width="100px" height="10px" />
          </div>
          <div style={{ flex: 1, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {['Bullish signals', 'Bearish signals', 'Neutral signals'].map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <SkeletonLine width="80px" height="10px" />
                <SkeletonLine width="100%" height="8px" />
                <SkeletonLine width="25px" height="10px" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* News articles */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <SkeletonLine width="48px" height="48px" style={{ borderRadius: '6px', flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <SkeletonLine width="55px" height="20px" style={{ borderRadius: '3px' }} />
                <SkeletonLine width="80px" height="10px" />
              </div>
              <SkeletonLine width="85%" height="14px" />
              <SkeletonLine width="65%" height="13px" />
            </div>
          </div>
        </div>
      ))}

      {/* Analyst consensus */}
      <SkeletonSection>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
              <SkeletonLine width="50px" height="28px" />
              <SkeletonLine width="70px" height="10px" />
            </div>
          ))}
        </div>
      </SkeletonSection>
    </div>
  )
}

// ─── Tab skeleton router ──────────────────────────────────────────────────────
export function TabSkeleton({ type }) {
  if (type === 'thesis') return <SkeletonThesis />
  if (type === 'dcf')    return <SkeletonDCF />
  if (type === 'risk')   return <SkeletonRisk />
  if (type === 'news')   return <SkeletonNews />
  return <AnalysisLoader type={type} />
}
