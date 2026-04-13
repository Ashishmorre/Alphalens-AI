'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'

/**
 * ScrollableTabBar — TradingView-style horizontally scrollable tab navigation.
 *
 * Features:
 * - Smooth horizontal scroll with hidden scrollbar
 * - Left/right fade gradients when content is clipped
 * - Keyboard navigation (Arrow keys, Home, End)
 * - Auto-scrolls active tab into view on change
 * - ResizeObserver for dynamic layout changes
 * - Accessible: role="tablist", aria-selected, focus-visible
 * - Mobile touch optimised, reduced-motion aware
 *
 * @param {string[]}  tabs       - Tab label strings
 * @param {string}    activeTab  - Currently active tab label
 * @param {Function}  onTabChange - Callback(tab:string) when tab changes
 * @param {string}    [className] - Extra CSS class on outer wrapper
 */
export default function ScrollableTabBar({ tabs, activeTab, onTabChange, className = '' }) {
  const scrollRef = useRef(null)
  const [showLeft,  setShowLeft]  = useState(false)
  const [showRight, setShowRight] = useState(false)

  // ─── Fade-visibility check ───────────────────────────────────────────────
  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    const scrollable = scrollWidth > clientWidth
    setShowLeft(scrollable && scrollLeft > 5)
    setShowRight(scrollable && scrollLeft < scrollWidth - clientWidth - 5)
  }, [])

  // ─── Init + scroll + resize listeners ───────────────────────────────────
  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', checkScroll, { passive: true })
    const ro = new ResizeObserver(checkScroll)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', checkScroll)
      ro.disconnect()
    }
  }, [checkScroll, tabs])

  // ─── Auto-scroll active tab into view ───────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const activeEl = el.querySelector('[data-active="true"]')
    if (!activeEl) return
    const pad = 20
    requestAnimationFrame(() => {
      const cRect = el.getBoundingClientRect()
      const tRect = activeEl.getBoundingClientRect()
      if (tRect.left < cRect.left + pad) {
        el.scrollBy({ left: tRect.left - cRect.left - pad, behavior: 'smooth' })
      } else if (tRect.right > cRect.right - pad) {
        el.scrollBy({ left: tRect.right - cRect.right + pad, behavior: 'smooth' })
      }
    })
  }, [activeTab])

  // ─── Keyboard navigation ─────────────────────────────────────────────────
  const handleKeyDown = (e, index) => {
    if (e.key === 'ArrowLeft'  && index > 0)              { e.preventDefault(); onTabChange(tabs[index - 1]) }
    if (e.key === 'ArrowRight' && index < tabs.length - 1){ e.preventDefault(); onTabChange(tabs[index + 1]) }
    if (e.key === 'Home') { e.preventDefault(); onTabChange(tabs[0]) }
    if (e.key === 'End')  { e.preventDefault(); onTabChange(tabs[tabs.length - 1]) }
  }

  return (
    <div className={`stb-wrapper ${className}`}>
      {/* Left fade */}
      <div className={`stb-fade stb-fade-left  ${showLeft  ? 'stb-visible' : ''}`} aria-hidden="true" />

      {/* Scrollable nav */}
      <nav
        ref={scrollRef}
        className="stb-nav"
        role="tablist"
        aria-label="Analysis sections"
      >
        {tabs.map((tab, i) => {
          const isActive = activeTab === tab
          const id = tab.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
          return (
            <button
              key={tab}
              data-tab={tab}
              data-active={isActive}
              role="tab"
              aria-selected={isActive}
              aria-controls={`${id}-panel`}
              id={`${id}-tab`}
              tabIndex={isActive ? 0 : -1}
              className={`stb-tab ${isActive ? 'stb-active' : ''}`}
              onClick={() => onTabChange(tab)}
              onKeyDown={e => handleKeyDown(e, i)}
              type="button"
            >
              {tab}
            </button>
          )
        })}
      </nav>

      {/* Right fade */}
      <div className={`stb-fade stb-fade-right ${showRight ? 'stb-visible' : ''}`} aria-hidden="true" />

      <style jsx>{`
        /* ── Outer wrapper ─────────────────────────────────────────────────── */
        .stb-wrapper {
          position: relative;
          display: flex;
          align-items: stretch;
          width: 100%;
          background: var(--bg-secondary, #1e222d);
          border-bottom: 1px solid var(--border-color, #2a2e39);
        }

        /* ── Scrollable nav ────────────────────────────────────────────────── */
        .stb-nav {
          display: flex;
          overflow-x: auto;
          overflow-y: hidden;
          white-space: nowrap;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          -ms-overflow-style: none;
          flex: 1;
          min-height: 44px;
        }
        .stb-nav::-webkit-scrollbar { display: none; }

        /* ── Tab buttons ───────────────────────────────────────────────────── */
        .stb-tab {
          flex-shrink: 0;
          padding: 0 20px;
          height: 44px;
          font-size: 13px;
          font-weight: 500;
          color: var(--txt-muted, #868993);
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          transition: color 150ms ease, background-color 150ms ease;
          white-space: nowrap;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          letter-spacing: 0.02em;
        }
        .stb-tab:hover {
          color: var(--txt-primary, #d1d4dc);
          background: rgba(255, 255, 255, 0.04);
        }
        .stb-tab.stb-active {
          color: var(--txt-primary, #d1d4dc);
          border-bottom-color: var(--accent, #2962ff);
          font-weight: 600;
        }
        .stb-tab:focus-visible {
          outline: 2px solid var(--accent, #2962ff);
          outline-offset: -2px;
          border-radius: 4px;
        }
        .stb-tab:focus { outline: none; }

        /* ── Edge fade gradients ───────────────────────────────────────────── */
        .stb-fade {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 32px;
          pointer-events: none;
          opacity: 0;
          transition: opacity 200ms ease;
          z-index: 10;
        }
        .stb-fade.stb-visible { opacity: 1; }
        .stb-fade-left {
          left: 0;
          background: linear-gradient(
            to right,
            var(--bg-secondary, #1e222d) 0%,
            var(--bg-secondary, #1e222d) 40%,
            transparent 100%
          );
        }
        .stb-fade-right {
          right: 0;
          background: linear-gradient(
            to left,
            var(--bg-secondary, #1e222d) 0%,
            var(--bg-secondary, #1e222d) 40%,
            transparent 100%
          );
        }

        /* ── Responsive ────────────────────────────────────────────────────── */
        @media (max-width: 1024px) {
          .stb-tab { padding: 0 16px; }
          .stb-fade { width: 24px; }
        }
        @media (max-width: 768px) {
          .stb-tab { padding: 0 14px; height: 40px; font-size: 12px; }
          .stb-fade { width: 20px; }
        }
        @media (max-width: 480px) {
          .stb-tab { padding: 0 12px; height: 40px; font-size: 12px; }
          .stb-fade { width: 16px; }
        }
        @media (pointer: coarse) { .stb-tab { min-height: 44px; } }
        @media (prefers-reduced-motion: reduce) {
          .stb-tab, .stb-fade { transition: none; }
        }
      `}</style>
    </div>
  )
}
