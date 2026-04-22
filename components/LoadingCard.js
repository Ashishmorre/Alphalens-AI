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
