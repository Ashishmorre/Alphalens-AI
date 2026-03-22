'use client'
import { useState } from 'react'
import { formatPrice, formatNumber, formatPct, formatMultiple, changeColor, changeSign } from '../lib/utils'
import { AnalysisLoader } from './LoadingCard'

export default function CompareStocks() {
  const [ticker1, setTicker1] = useState('')
  const [ticker2, setTicker2] = useState('')
  const [stock1, setStock1] = useState(null)
  const [stock2, setStock2] = useState(null)
  const [comparison, setComparison] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState('input') // input | result

  const handleCompare = async () => {
    if (!ticker1.trim() || !ticker2.trim()) return
    setLoading(true)
    setError('')
    setComparison(null)

    try {
      // Fetch both stocks in parallel
      const [r1, r2] = await Promise.all([
        fetch(`/api/stock?ticker=${ticker1.trim().toUpperCase()}`).then(r => r.json()),
        fetch(`/api/stock?ticker=${ticker2.trim().toUpperCase()}`).then(r => r.json()),
      ])

      if (r1.error) throw new Error(`${ticker1}: ${r1.error}`)
      if (r2.error) throw new Error(`${ticker2}: ${r2.error}`)

      setStock1(r1)
      setStock2(r2)

      // Run AI comparison
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock1: r1, stock2: r2 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Comparison failed')

      setComparison(data.data)
      setStep('result')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Input form */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--txt-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'var(--font-dm-mono)', marginBottom: '1rem' }}>
          Compare Two Stocks Head-to-Head
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.875rem', alignItems: 'flex-end' }}>
          <TickerInput value={ticker1} onChange={setTicker1} placeholder="Ticker 1 — e.g. AAPL" label="Stock A" />
          <div style={{ color: 'var(--txt-muted)', fontFamily: 'var(--font-dm-mono)', fontSize: '1.2rem', paddingBottom: '0.6rem' }}>vs</div>
          <TickerInput value={ticker2} onChange={setTicker2} placeholder="Ticker 2 — e.g. MSFT" label="Stock B" />
          <button
            className="btn btn-primary"
            onClick={handleCompare}
            disabled={loading || !ticker1.trim() || !ticker2.trim()}
            style={{ minWidth: '160px', height: '42px' }}
          >
            {loading ? 'Comparing…' : '⚡ Compare Now'}
          </button>
        </div>
        {error && (
          <div style={{ marginTop: '0.75rem', padding: '0.625rem 0.875rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '5px', fontSize: '0.8rem', color: '#f87171', fontFamily: 'var(--font-dm-mono)' }}>
            ⚠ {error}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="card">
          <AnalysisLoader type="compare" />
        </div>
      )}

      {/* Results */}
      {!loading && comparison && stock1 && stock2 && (
        <CompareResults stock1={stock1} stock2={stock2} comparison={comparison} />
      )}
    </div>
  )
}

function TickerInput({ value, onChange, placeholder, label }) {
  return (
    <div style={{ flex: 1, minWidth: '160px' }}>
      <label style={{ fontSize: '0.68rem', color: 'var(--txt-muted)', fontFamily: 'var(--font-dm-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value.toUpperCase())}
        placeholder={placeholder}
        maxLength={10}
        style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,212,170,0.15)', borderRadius: '6px', padding: '0.6rem 0.875rem', color: 'var(--txt-primary)', fontFamily: 'var(--font-dm-mono)', fontSize: '0.9rem', outline: 'none' }}
        onFocus={e => e.target.style.borderColor = 'rgba(0,212,170,0.35)'}
        onBlur={e => e.target.style.borderColor = 'rgba(0,212,170,0.15)'}
      />
    </div>
  )
}

function CompareResults({ stock1, stock2, comparison }) {
  const c = comparison
  const winnerIs1 = c.winner === stock1.ticker
  const winnerIs2 = c.winner === stock2.ticker
  const isTie = c.winner === 'TIE'

  return (
    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Winner banner */}
      <div className="card card-glow" style={{ padding: '1.5rem 2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--txt-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'var(--font-dm-mono)', marginBottom: '0.5rem' }}>
          Overall Winner
        </div>
        <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '2rem', color: isTie ? '#f59e0b' : 'var(--teal)', marginBottom: '0.5rem' }}>
          {isTie ? '🤝 It\'s a Tie' : `🏆 ${c.winner}`}
        </div>
        <p style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.85rem', color: 'var(--txt-secondary)', maxWidth: '520px', margin: '0 auto', lineHeight: 1.6 }}>
          {c.winnerRationale}
        </p>
      </div>

      {/* Side-by-side price cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
        <StockCard stock={stock1} isWinner={winnerIs1} />
        <StockCard stock={stock2} isWinner={winnerIs2} />
      </div>

      {/* Dimension scores */}
      {c.comparisonDimensions?.length > 0 && (
        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <SectionTitle>Comparison Dimensions</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {c.comparisonDimensions.map((dim, i) => (
              <DimensionBar key={i} dim={dim} ticker1={stock1.ticker} ticker2={stock2.ticker} />
            ))}
          </div>
        </div>
      )}

      {/* Head to head metrics table */}
      {c.headToHead?.length > 0 && (
        <div className="card" style={{ padding: '1.25rem 1.5rem', overflowX: 'auto' }}>
          <SectionTitle>Head-to-Head Metrics</SectionTitle>
          <table className="data-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th style={{ textAlign: 'right', color: 'var(--teal)' }}>{stock1.ticker}</th>
                <th style={{ textAlign: 'right', color: '#00a882' }}>{stock2.ticker}</th>
                <th style={{ textAlign: 'right' }}>Advantage</th>
              </tr>
            </thead>
            <tbody>
              {c.headToHead.map((row, i) => (
                <tr key={i}>
                  <td style={{ color: 'var(--txt-secondary)' }}>{row.metric}</td>
                  <td style={{ textAlign: 'right', color: row.advantage === stock1.ticker ? 'var(--gain)' : 'var(--txt-primary)' }}>{row.stock1Value}</td>
                  <td style={{ textAlign: 'right', color: row.advantage === stock2.ticker ? 'var(--gain)' : 'var(--txt-primary)' }}>{row.stock2Value}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.75rem', color: row.advantage === 'TIE' ? '#f59e0b' : 'var(--gain)', fontFamily: 'var(--font-dm-mono)' }}>
                      {row.advantage}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Strengths and weaknesses */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
        <StrengthWeakness ticker={stock1.ticker} strengths={c.stock1Strengths} weaknesses={c.stock1Weaknesses} />
        <StrengthWeakness ticker={stock2.ticker} strengths={c.stock2Strengths} weaknesses={c.stock2Weaknesses} />
      </div>

      {/* Recommendations */}
      {c.recommendation && (
        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <SectionTitle>Who Should Buy Which?</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.875rem' }}>
            {[
              { label: '📈 Growth Investors', ticker: c.recommendation.forGrowthInvestors, rationale: c.recommendation.growthRationale },
              { label: '💰 Value Investors', ticker: c.recommendation.forValueInvestors, rationale: c.recommendation.valueRationale },
              { label: '🏦 Income Investors', ticker: c.recommendation.forIncomeInvestors, rationale: c.recommendation.incomeRationale },
            ].map(({ label, ticker, rationale }) => (
              <div key={label} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '6px', padding: '0.875rem', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--txt-muted)', fontFamily: 'var(--font-dm-mono)', marginBottom: '0.35rem' }}>{label}</div>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '1rem', color: 'var(--teal)', fontWeight: 600, marginBottom: '0.35rem' }}>{ticker}</div>
                <p style={{ fontSize: '0.78rem', color: 'var(--txt-secondary)', fontFamily: 'var(--font-dm-mono)', lineHeight: 1.55 }}>{rationale}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Portfolio context */}
      {c.portfolioContext && (
        <div className="card" style={{ padding: '1.25rem 1.5rem', borderLeft: '3px solid var(--teal)' }}>
          <SectionTitle>Portfolio Context</SectionTitle>
          <p style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.875rem', color: 'var(--txt-secondary)', lineHeight: 1.7 }}>{c.portfolioContext}</p>
        </div>
      )}
    </div>
  )
}

function StockCard({ stock, isWinner }) {
  const isPositive = stock.changePercent >= 0
  return (
    <div className="card" style={{ padding: '1.25rem', position: 'relative', borderColor: isWinner ? 'rgba(0,212,170,0.3)' : undefined, boxShadow: isWinner ? '0 0 20px rgba(0,212,170,0.08)' : undefined }}>
      {isWinner && (
        <div style={{ position: 'absolute', top: '0.625rem', right: '0.625rem', fontSize: '0.65rem', color: 'var(--teal)', fontFamily: 'var(--font-dm-mono)', background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.25)', padding: '0.15rem 0.5rem', borderRadius: '3px' }}>
          WINNER
        </div>
      )}
      <div style={{ fontSize: '0.75rem', color: 'var(--teal)', fontFamily: 'var(--font-dm-mono)', marginBottom: '0.25rem' }}>{stock.ticker}</div>
      <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '0.95rem', color: 'var(--txt-primary)', marginBottom: '0.5rem', lineHeight: 1.2 }}>{stock.name}</div>
      <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '1.35rem', color: 'var(--txt-primary)' }}>{formatPrice(stock.price)}</div>
      <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.8rem', color: isPositive ? 'var(--gain)' : 'var(--loss)', marginTop: '0.15rem' }}>
        {changeSign(stock.changePercent)}{stock.changePercent?.toFixed(2)}%
      </div>
      <div style={{ marginTop: '0.75rem', fontSize: '0.72rem', color: 'var(--txt-muted)', fontFamily: 'var(--font-dm-mono)' }}>
        {stock.sector} · {formatNumber(stock.marketCap)} Mktcap
      </div>
    </div>
  )
}

function DimensionBar({ dim, ticker1, ticker2 }) {
  const total = (dim.stock1Score || 0) + (dim.stock2Score || 0)
  const pct1 = total > 0 ? (dim.stock1Score / total) * 100 : 50
  const pct2 = 100 - pct1

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.82rem', color: 'var(--txt-primary)' }}>{dim.dimension}</span>
          {dim.winner !== 'TIE' && (
            <span style={{ fontSize: '0.65rem', color: 'var(--teal)', fontFamily: 'var(--font-dm-mono)' }}>→ {dim.winner}</span>
          )}
        </div>
        <span style={{ fontSize: '0.72rem', color: 'var(--txt-muted)', fontFamily: 'var(--font-dm-mono)', maxWidth: '280px', textAlign: 'right' }}>{dim.detail}</span>
      </div>
      <div style={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', gap: '1px' }}>
        <div style={{ width: `${pct1}%`, background: 'var(--teal)', borderRadius: '3px 0 0 3px', transition: 'width 0.8s ease' }} />
        <div style={{ width: `${pct2}%`, background: '#00a882', borderRadius: '0 3px 3px 0', transition: 'width 0.8s ease', opacity: 0.7 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem' }}>
        <span style={{ fontSize: '0.65rem', color: 'var(--txt-muted)', fontFamily: 'var(--font-dm-mono)' }}>{ticker1}: {dim.stock1Score}/10</span>
        <span style={{ fontSize: '0.65rem', color: 'var(--txt-muted)', fontFamily: 'var(--font-dm-mono)' }}>{ticker2}: {dim.stock2Score}/10</span>
      </div>
    </div>
  )
}

function StrengthWeakness({ ticker, strengths, weaknesses }) {
  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.85rem', color: 'var(--teal)', fontWeight: 500, marginBottom: '0.75rem' }}>{ticker}</div>
      {strengths?.length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--txt-muted)', fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>Strengths</div>
          {strengths.map((s, i) => (
            <div key={i} style={{ fontSize: '0.78rem', color: 'var(--txt-secondary)', fontFamily: 'var(--font-dm-mono)', display: 'flex', gap: '0.4rem', marginBottom: '0.3rem', lineHeight: 1.5 }}>
              <span style={{ color: 'var(--gain)', flexShrink: 0 }}>+</span>{s}
            </div>
          ))}
        </div>
      )}
      {weaknesses?.length > 0 && (
        <div>
          <div style={{ fontSize: '0.65rem', color: 'var(--txt-muted)', fontFamily: 'var(--font-dm-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>Weaknesses</div>
          {weaknesses.map((w, i) => (
            <div key={i} style={{ fontSize: '0.78rem', color: 'var(--txt-secondary)', fontFamily: 'var(--font-dm-mono)', display: 'flex', gap: '0.4rem', marginBottom: '0.3rem', lineHeight: 1.5 }}>
              <span style={{ color: 'var(--loss)', flexShrink: 0 }}>−</span>{w}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SectionTitle({ children }) {
  return <div style={{ fontSize: '0.68rem', color: 'var(--txt-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'var(--font-dm-mono)', marginBottom: '0.75rem' }}>{children}</div>
}
