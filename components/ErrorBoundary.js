'use client'

import { Component } from 'react'

/**
 * Error Boundary Component
 * Catches JavaScript errors in child components and displays a fallback UI
 * Prevents entire app from crashing due to unexpected data shapes or runtime errors
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    // Log to console in development
    console.error('[ErrorBoundary] Component error:', error)
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack)

    // Could also send to error tracking service here
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'exception', {
        description: `${error.message} | ${errorInfo.componentStack}`,
        fatal: false,
      })
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      return (
        <div
          style={{
            padding: '2rem',
            borderRadius: '8px',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            background: 'rgba(239, 68, 68, 0.05)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>
          <div
            style={{
              fontFamily: 'var(--font-dm-mono)',
              fontSize: '1rem',
              color: '#f87171',
              marginBottom: '0.75rem',
            }}
          >
            Something went wrong displaying this analysis
          </div>
          <p
            style={{
              fontFamily: 'var(--font-dm-mono)',
              fontSize: '0.82rem',
              color: 'var(--txt-muted)',
              marginBottom: '1.5rem',
              lineHeight: 1.6,
            }}
          >
            The data format returned was unexpected. Please try running the analysis again.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '0.625rem 1.25rem',
              fontSize: '0.85rem',
              fontFamily: 'var(--font-dm-mono)',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '6px',
              color: '#f87171',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(239, 68, 68, 0.15)'
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(239, 68, 68, 0.1)'
            }}
          >
            Try Again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Tab Error Boundary
 * Specialized error boundary for analysis tabs with retry functionality
 */
export function TabErrorBoundary({ children, tabName }) {
  return (
    <ErrorBoundary tabName={tabName}>
      {children}
    </ErrorBoundary>
  )
}
