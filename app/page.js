'use client'
import { useState, useCallback, useRef } from 'react'
import Header from '../components/Header'
import SearchBar from '../components/SearchBar'
import LandingHero from '../components/LandingHero'
import StockOverview from '../components/StockOverview'
import InvestmentThesis from '../components/tabs/InvestmentThesis'
import DCFValuation from '../components/tabs/DCFValuation'
import RiskRatios from '../components/tabs/RiskRatios'
import NewsSentiment from '../components/tabs/NewsSentiment'
import CompareStocks from '../components/CompareStocks'
import ExportPDF from '../components/ExportPDF'
import { SkeletonStockOverview, TabSkeleton } from '../components/LoadingCard'
import ErrorBoundary from '../components/ErrorBoundary'
import { apiFetch, apiPost, getErrorMessage } from '@/lib/api-client'
import { normalizeAIResponse } from '@/lib/ai-normalizer'
import { DCFProvider } from '@/contexts/DCFContext'

const ANALYSIS_TABS = [
  { id: 'thesis', label: 'Investment Thesis' },
  { id: 'dcf',    label: 'DCF Valuation' },
  { id: 'risk',   label: 'Risk & Ratios' },
  { id: 'news',   label: 'News Sentiment' },
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

  // Per-tab loading & error state — replaces global analysisLoading/analysisError
  // { thesis: true/false, dcf: true/false, risk: true/false, news: true/false }
  const [tabLoading, setTabLoading] = useState({})
  const [tabErrors, setTabErrors]   = useState({})

  const resultsRef = useRef(null)

  // ─── Core fetch: scoped to a specific analysis type ────────────────────────
  // Takes ticker & data explicitly so it can run right after setStockData
  // without relying on the stockData closure (which would be stale).
  const doFetch = useCallback(async (type, ticker, data) => {
    const cacheKey = `${ticker}_${type}`

    setTabLoading(prev => ({ ...prev, [type]: true }))
    setTabErrors(prev => ({ ...prev, [type]: null }))

    try {
      const result = await apiPost('/api/analyze', {
        ticker,
        analysisType: type,
        stockData: data,
      })
      const normalizedData = normalizeAIResponse(result, type)
      setAnalysisCache(prev => ({ ...prev, [cacheKey]: normalizedData }))
    } catch (err) {
      setTabErrors(prev => ({ ...prev, [type]: getErrorMessage(err) }))
    } finally {
      setTabLoading(prev => ({ ...prev, [type]: false }))
    }
  }, [])

  // ─── On search: fetch stock data, then fire ALL 4 analyses in background ───
  const handleSearch = useCallback(async (ticker) => {
    setStockLoading(true)
    setStockError('')
    setStockData(null)
    setAnalysisCache({})
    setTabErrors({})

    // Pre-mark all 4 tabs as loading so the UI shows skeletons immediately
    setTabLoading({ thesis: true, dcf: true, risk: true, news: true })

    try {
      const data = await apiFetch(`/api/stock?ticker=${encodeURIComponent(ticker)}`)
      setStockData(data)

      // Smooth scroll to results
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)

      // Fire all 4 analyses in parallel — do NOT await, runs in background
      // Promise.allSettled ensures one failure never blocks the others
      Promise.allSettled(
        ANALYSIS_TABS.map(({ id }) => doFetch(id, data.ticker, data))
      )
    } catch (err) {
      setStockError(getErrorMessage(err))
      // Reset loading state if stock fetch itself failed
      setTabLoading({})
    } finally {
      setStockLoading(false)
    }
  }, [doFetch])

  // ─── Retry a single tab ────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    if (!stockData) return
    // Remove the cache entry so fresh data comes in
    const cacheKey = `${stockData.ticker}_${activeAnalysisTab}`
    setAnalysisCache(prev => {
      const next = { ...prev }
      delete next[cacheKey]
      return next
    })
    doFetch(activeAnalysisTab, stockData.ticker, stockData)
  }, [stockData, activeAnalysisTab, doFetch])

  const handleTabChange = (tabId) => {
    setActiveAnalysisTab(tabId)
  }

  const currentCacheKey  = stockData ? `${stockData.ticker}_${activeAnalysisTab}` : null
  const currentAnalysis  = currentCacheKey ? analysisCache[currentCacheKey] : null
  const isTabLoading     = !!tabLoading[activeAnalysisTab]
  const tabError         = tabErrors[activeAnalysisTab] || null

  // Whether to show the landing hero (no result yet, not loading)
  const showLanding = !stockData && !stockLoading && !stockError

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header only shown when results are active */}
      {!showLanding && <Header />}

      {/* Full-screen landing: search + features + footer */}
      {showLanding && (
        <LandingHero onSearch={handleSearch} loading={stockLoading} />
      )}

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: showLanding ? 0 : '0 1rem 4rem' }}>
        {/* Compact search bar only shown once results load */}
        {!showLanding && <SearchBar onSearch={handleSearch} loading={stockLoading} />}

        {stockLoading && (
          <>
            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--txt-secondary)', fontFamily: 'var(--font-dm-mono)', fontSize: '0.8125rem' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Synchronizing with market servers…
              </div>
            </div>
            <SkeletonStockOverview />
          </>
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

                {/* Tab bar — teal dot when a tab's analysis is ready */}
                <div style={{ marginBottom: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(0,212,170,0.1)', flex: 1 }}>
                    {ANALYSIS_TABS.map(tab => {
                      const isReady   = !!analysisCache[`${stockData.ticker}_${tab.id}`]
                      const isLoading = !!tabLoading[tab.id]
                      const hasError  = !!tabErrors[tab.id]
                      return (
                        <button
                          key={tab.id}
                          className={`tab-btn ${activeAnalysisTab === tab.id ? 'active' : ''}`}
                          onClick={() => handleTabChange(tab.id)}
                          style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                        >
                          <span className="tab-label">{tab.label}</span>
                          {/* Status dot: teal solid = ready | amber pulse = loading | red = error */}
                          {isReady && (
                            <span title="Analysis ready" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--teal)', display: 'inline-block', marginLeft: '3px', boxShadow: '0 0 4px rgba(0,212,170,0.6)', flexShrink: 0 }} />
                          )}
                          {isLoading && !isReady && (
                            <span title="Loading…" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(245,158,11,0.9)', display: 'inline-block', marginLeft: '3px', animation: 'pulse 1s ease-in-out infinite', flexShrink: 0 }} />
                          )}
                          {hasError && !isLoading && !isReady && (
                            <span title="Failed — click Retry" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', display: 'inline-block', marginLeft: '3px', flexShrink: 0 }} />
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {/* Progress summary line */}
                  {(() => {
                    const readyCount   = ANALYSIS_TABS.filter(t => !!analysisCache[`${stockData.ticker}_${t.id}`]).length
                    const loadingCount = ANALYSIS_TABS.filter(t => !!tabLoading[t.id] && !analysisCache[`${stockData.ticker}_${t.id}`]).length
                    const errorCount   = ANALYSIS_TABS.filter(t => !!tabErrors[t.id] && !tabLoading[t.id] && !analysisCache[`${stockData.ticker}_${t.id}`]).length
                    if (readyCount === 0 && loadingCount === 0) return null
                    return (
                      <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-dm-mono)', color: 'var(--txt-muted)', display: 'flex', gap: '0.75rem', alignItems: 'center', paddingRight: '0.5rem', whiteSpace: 'nowrap' }}>
                        {loadingCount > 0 && <span style={{ color: 'rgba(245,158,11,0.85)' }}>⟳ {loadingCount} running</span>}
                        {readyCount > 0 && <span style={{ color: 'var(--teal)' }}>✓ {readyCount}/{ANALYSIS_TABS.length} ready</span>}
                        {errorCount > 0 && <span style={{ color: '#ef4444' }}>✗ {errorCount} failed</span>}
                      </div>
                    )
                  })()}

                  <ExportPDF
                    stockData={stockData}
                    analysisData={currentAnalysis}
                    activeTab={activeAnalysisTab}
                  />
                </div>

                {/* Content panel */}
                <div className="card" style={{ minHeight: '300px', padding: '1.5rem' }}>
                  {isTabLoading ? (
                    <TabSkeleton type={activeAnalysisTab} />
                  ) : currentAnalysis ? (
                    <>
                      {activeAnalysisTab === 'thesis' && (
                        <ErrorBoundary>
                          <InvestmentThesis data={currentAnalysis} ticker={stockData.ticker} currency={stockData.currency} />
                        </ErrorBoundary>
                      )}
                      {activeAnalysisTab === 'dcf' && (
                        <ErrorBoundary>
                          <DCFProvider rawApiData={currentAnalysis} stockData={stockData}>
                            <DCFValuation currency={stockData.currency} />
                          </DCFProvider>
                        </ErrorBoundary>
                      )}
                      {activeAnalysisTab === 'risk' && (
                        <ErrorBoundary>
                          <RiskRatios data={currentAnalysis} currency={stockData.currency} />
                        </ErrorBoundary>
                      )}
                      {activeAnalysisTab === 'news' && (
                        <ErrorBoundary>
                          <NewsSentiment data={currentAnalysis} currency={stockData.currency} />
                        </ErrorBoundary>
                      )}
                    </>
                  ) : (
                    /* Brief "preparing" state — shown only if fetch hasn't started yet */
                    <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem', position: 'relative' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '50%', border: '2px solid transparent', borderTopColor: 'var(--teal)', position: 'absolute', animation: 'spin 1.2s linear infinite' }} />
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(0,212,170,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.5">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                          </svg>
                        </div>
                      </div>
                      <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '1.1rem', color: 'var(--txt-primary)', marginBottom: '0.35rem' }}>
                        Preparing Analysis
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--txt-muted)', fontFamily: 'var(--font-dm-mono)' }}>
                        All four analyses are running in the background…
                      </div>
                    </div>
                  )}
                </div>

                {/* Per-tab error banner with retry */}
                {tabError && !isTabLoading && (
                  <div className="card animate-fade-in" style={{ marginTop: '0.875rem', padding: '1rem 1.25rem', borderColor: 'rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.04)' }}>
                    <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
                      <span style={{ color: '#ef4444' }}>⚠</span>
                      <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '0.82rem', color: '#f87171' }}>{tabError}</span>
                      <button
                        className="btn btn-ghost"
                        onClick={handleRetry}
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

      </main>

      {/* Compact footer when results are shown */}
      {!showLanding && (
        <footer className="no-print" style={{ borderTop: '1px solid rgba(0,212,170,0.07)', padding: '1.25rem', textAlign: 'center' }}>
          <p style={{ fontSize: '0.68rem', color: 'var(--txt-muted)', fontFamily: 'var(--font-dm-mono)', lineHeight: 1.6 }}>
            AlphaLens AI · Powered by NVIDIA NIM & Yahoo Finance · Not investment advice.
            {' '}Built by <span style={{ color: 'var(--teal)' }}>Ashish & Aman Agrahari</span>
          </p>
        </footer>
      )}

      <style>{`
        @media (max-width: 640px) {
          .tab-label { display: none; }
          .tab-btn { padding: 0.625rem 0.75rem; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}


