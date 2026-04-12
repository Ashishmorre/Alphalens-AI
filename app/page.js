'use client'
import { useState, useCallback, useRef, useMemo } from 'react'
import Header from '../components/Header'
import SearchBar from '../components/SearchBar'
import StockOverview from '../components/StockOverview'
import InvestmentThesis from '../components/tabs/InvestmentThesis'
import DCFValuation from '../components/tabs/DCFValuation'
import RiskRatios from '../components/tabs/RiskRatios'
import NewsSentiment from '../components/tabs/NewsSentiment'
import CompareStocks from '../components/CompareStocks'
import ExportPDF from '../components/ExportPDF'
import { AnalysisLoader, RunAnalysisButton } from '../components/LoadingCard'
import ErrorBoundary from '../components/ErrorBoundary'
import { apiFetch, apiPost, getErrorMessage } from '@/lib/api-client'
import { normalizeAIResponse } from '@/lib/ai-normalizer'
import { DCFProvider } from '@/contexts/DCFContext'

const ANALYSIS_TABS = [
  { id: 'thesis', label: 'Investment Thesis' },
  { id: 'dcf', label: 'DCF Valuation' },
  { id: 'risk', label: 'Risk & Ratios' },
  { id: 'news', label: 'News Sentiment' },
]

const NAV_TABS = ['Research', 'Compare']

export default function Home() {
  // ─── State ─────────────────────────────────────────────────────────────────
  const [navTab, setNavTab] = useState('Research')
  const [stockLoading, setStockLoading] = useState(false)
  const [stockData, setStockData] = useState(null)
  const [stockError, setStockError] = useState('')

  const [activeAnalysisTab, setActiveAnalysisTab] = useState('thesis')
  const [analysisCache, setAnalysisCache] = useState({})
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState('')

  const resultsRef = useRef(null)

  // ─── Fetch stock data ───────────────────────────────────────────────────────
  const handleSearch = useCallback(async (ticker) => {
    setStockLoading(true)
    setStockError('')
    setStockData(null)
    setAnalysisCache({})
    setAnalysisError('')

    try {
      const data = await apiFetch(`/api/stock?ticker=${encodeURIComponent(ticker)}`)
      setStockData(data)

      // Smooth scroll to results
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (err) {
      setStockError(getErrorMessage(err))
    } finally {
      setStockLoading(false)
    }
  }, [])

  // ─── Run AI analysis ────────────────────────────────────────────────────────
  const handleRunAnalysis = useCallback(async (type) => {
    if (!stockData) return
    const cacheKey = `${stockData.ticker}_${type}`
    if (analysisCache[cacheKey]) return

    setAnalysisLoading(true)
    setAnalysisError('')

    try {
      const data = await apiPost('/api/analyze', {
        ticker: stockData.ticker,
        analysisType: type,
        stockData,
      })
    // Normalize AI response to handle inconsistent formats
    const normalizedData = normalizeAIResponse(data, type)
      setAnalysisCache(prev => ({ ...prev, [cacheKey]: normalizedData }))
    } catch (err) {
      setAnalysisError(getErrorMessage(err))
    } finally {
      setAnalysisLoading(false)
    }
  }, [stockData, analysisCache])

  const handleTabChange = (tabId) => {
    setActiveAnalysisTab(tabId)
    setAnalysisError('')
  }

  const currentCacheKey = stockData ? `${stockData.ticker}_${activeAnalysisTab}` : null
  const currentAnalysis = currentCacheKey ? analysisCache[currentCacheKey] : null

  return (
    <div style={{ minHeight: '100vh' }}>
      <Header />

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 1rem 4rem' }}>
        <SearchBar onSearch={handleSearch} loading={stockLoading} />

        {stockLoading && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--txt-secondary)', fontFamily: 'var(--font-dm-mono)', fontSize: '0.875rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                <style>{`@keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }`}</style>
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              Fetching live market data…
            </div>
          </div>
        )}

        {stockError && !stockLoading && (
          <div className="card animate-fade-in" style={{ padding: '1.25rem 1.5rem', borderColor: 'rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.05)', maxWidth: '600px', margin: '1rem auto' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <span style={{ color: '#ef4444', fontSize: '1.1rem' }}>⚠</span>
              <div>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.875rem', color: '#f87171', fontWeight: 500, marginBottom: '0.25rem' }}>Could not fetch stock data</div>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.8rem', color: 'var(--txt-muted)' }}>{stockError}</div>
              </div>
            </div>
          </div>
        )}

        {stockData && !stockLoading && (
          <div ref={resultsRef} className="animate-slide-up">
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(0,212,170,0.1)', marginBottom: '1.5rem' }}>
              {NAV_TABS.map(tab => (
                <button
                  key={tab}
                  className={`tab-btn ${navTab === tab ? 'active' : ''}`}
                  onClick={() => setNavTab(tab)}
                  style={{ fontSize: '0.8rem' }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {navTab === 'Research' && (
              <>
                <StockOverview data={stockData} />

                <div style={{ marginBottom: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(0,212,170,0.1)', flex: 1 }}>
                    {ANALYSIS_TABS.map(tab => (
                      <button
                        key={tab.id}
                        className={`tab-btn ${activeAnalysisTab === tab.id ? 'active' : ''}`}
                        onClick={() => handleTabChange(tab.id)}
                        style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        <span className="tab-label">{tab.label}</span>
                        {analysisCache[`${stockData.ticker}_${tab.id}`] && (
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--teal)', display: 'inline-block', marginLeft: '2px' }} />
                        )}
                      </button>
                    ))}
                  </div>

                  <ExportPDF
                    stockData={stockData}
                    analysisData={currentAnalysis}
                    activeTab={activeAnalysisTab}
                  />
                </div>

                <div className="card" style={{ minHeight: '300px', padding: analysisLoading || !currentAnalysis ? '0' : '1.5rem' }}>
                  {analysisLoading ? (
                    <AnalysisLoader type={activeAnalysisTab} />
                  ) : currentAnalysis ? (
                    <>
                      {activeAnalysisTab === 'thesis' && (
                        <ErrorBoundary>
                          <InvestmentThesis data={currentAnalysis} ticker={stockData.ticker} currency={stockData.currency} />
                        </ErrorBoundary>
                      )}
                      {activeAnalysisTab === 'dcf' && (
                        <ErrorBoundary>
                          <DCFProvider rawApiData={currentAnalysis}>
                <DCFValuation currency={stockData.currency} />
              </DCFProvider>
                        </ErrorBoundary>
                      )}
                      {activeAnalysisTab === 'risk' && (
                        <ErrorBoundary>
                          <RiskRatios data={currentAnalysis} />
                        </ErrorBoundary>
                      )}
                      {activeAnalysisTab === 'news' && (
                        <ErrorBoundary>
                          <NewsSentiment data={currentAnalysis} currency={stockData.currency} />
                        </ErrorBoundary>
                      )}
                    </>
                  ) : (
                    <RunAnalysisButton
                      type={activeAnalysisTab}
                      onClick={() => handleRunAnalysis(activeAnalysisTab)}
                      loading={analysisLoading}
                    />
                  )}
                </div>

                {analysisError && !analysisLoading && (
                  <div className="card animate-fade-in" style={{ marginTop: '0.875rem', padding: '1rem 1.25rem', borderColor: 'rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.04)' }}>
                    <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
                      <span style={{ color: '#ef4444' }}>⚠</span>
                      <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.82rem', color: '#f87171' }}>{analysisError}</span>
                      <button
                        className="btn btn-ghost"
                        onClick={() => handleRunAnalysis(activeAnalysisTab)}
                        style={{ marginLeft: 'auto', fontSize: '0.78rem' }}
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {navTab === 'Compare' && <CompareStocks />}
          </div>
        )}

        {!stockData && !stockLoading && !stockError && (
          <FeatureCards />
        )}
      </main>

      <footer className="no-print" style={{ borderTop: '1px solid rgba(0,212,170,0.07)', padding: '1.5rem', textAlign: 'center' }}>
        <p style={{ fontSize: '0.72rem', color: 'var(--txt-muted)', fontFamily: 'var(--font-dm-mono)', lineHeight: 1.6 }}>
          AlphaLens AI · Powered by Claude &amp; Yahoo Finance · For informational purposes only — not investment advice.
          <br />
          Built by <span style={{ color: 'var(--teal)' }}>Ashish</span> · EY GDS · CFA Candidate · BCom BMCC Pune
        </p>
      </footer>

      <style>{`
        @media (max-width: 640px) {
          .tab-label { display: none; }
          .tab-btn { padding: 0.625rem 0.75rem; }
        }
      `}</style>
    </div>
  )
}

function FeatureCards() {
  const features = [
    {
      icon: '◆',
      title: 'Investment Thesis',
      desc: 'AI-generated bull, bear & base cases with price targets, moat analysis, and position sizing guidance.',
    },
    {
      icon: '◆',
      title: 'DCF Valuation',
      desc: '5-year free cash flow model with WACC, terminal value, intrinsic value per share & sensitivity tables.',
    },
    {
      icon: '◆',
      title: 'Risk & Ratios',
      desc: 'Complete ratio suite with sector benchmarks, risk matrix, leverage health & technical signals.',
    },
    {
      icon: '◆',
      title: 'News Sentiment',
      desc: 'Sentiment scoring, analyst consensus, macro exposure, catalysts & 30-60 day tactical notes.',
    },
    {
      icon: '◆',
      title: 'Compare Stocks',
      desc: 'Head-to-head comparison of any two tickers with dimension scores and investor-type recommendations.',
    },
    {
      icon: '◆',
      title: 'PDF Export',
      desc: 'Download a styled research report PDF of any analysis tab to share or store for your portfolio.',
    },
  ]

  return (
    <div style={{ paddingTop: '1rem', paddingBottom: '2rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--txt-muted)', fontFamily: 'var(--font-dm-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
          What AlphaLens AI Can Do
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.875rem' }}>
        {features.map((f, i) => (
          <div
            key={i}
            className="card animate-slide-up"
            style={{ padding: '1.25rem', animationDelay: `${i * 0.08}s` }}
          >
            <div style={{ fontSize: '1.5rem', marginBottom: '0.625rem' }}>{f.icon}</div>
            <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '0.95rem', color: 'var(--txt-primary)', marginBottom: '0.375rem', fontWeight: 500 }}>{f.title}</div>
            <p style={{ fontSize: '0.78rem', color: 'var(--txt-secondary)', fontFamily: 'var(--font-dm-mono)', lineHeight: 1.6 }}>{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
