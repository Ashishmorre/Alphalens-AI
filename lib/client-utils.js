/**
 * Client-side utilities
 * Helper functions for React components
 */

/**
 * Format number with currency (K/M/B/T)
 * @param {number|null} n
 * @param {number} decimals
 * @returns {string}
 */
export function formatNumber(n, decimals = 2, currency = null) {
  if (n == null || isNaN(n)) return '—'
  const symbol = currency ? getCurrencySymbol(currency) : '$'
  if (Math.abs(n) >= 1e12) return symbol + (n / 1e12).toFixed(decimals) + 'T'
  if (Math.abs(n) >= 1e9) return symbol + (n / 1e9).toFixed(decimals) + 'B'
  if (Math.abs(n) >= 1e6) return symbol + (n / 1e6).toFixed(decimals) + 'M'
  if (Math.abs(n) >= 1e3) return symbol + (n / 1e3).toFixed(decimals) + 'K'
  return symbol + n.toFixed(decimals)
}

/**
 * Format plain number (K/M/B/T) without currency
 * @param {number|null} n
 * @param {number} decimals
 * @returns {string}
 */
export function formatPlain(n, decimals = 2) {
  if (n == null || isNaN(n)) return '—'
  if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(decimals) + 'T'
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(decimals) + 'B'
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(decimals) + 'M'
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(decimals) + 'K'
  return n.toFixed(decimals)
}

/**
 * Format percentage
 * @param {number|null} n
 * @param {number} decimals
 * @returns {string}
 */
export function formatPct(n, decimals = 1) {
  if (n == null || isNaN(n)) return '—'
  return (n * 100).toFixed(decimals) + '%'
}

/**
 * Get currency symbol
 * @param {string} currency
 * @returns {string}
 */
export function getCurrencySymbol(currency) {
  const map = {
    INR: '₹',
    GBP: '£',
    EUR: '€',
    JPY: '¥',
    CNY: '¥',
    CAD: 'C$',
    AUD: 'A$',
    HKD: 'HK$',
    SGD: 'S$',
    CHF: 'Fr',
  }
  return map[currency] || '$'
}

/**
 * Format price with currency
 * @param {number|null} value
 * @param {string} currency
 * @returns {string}
 */
export function formatPrice(value, currency) {
  if (value == null || isNaN(value)) return "—"
  const symbol = currency === "INR" ? "₹" : "$"
  return `${symbol}${Number(value).toLocaleString()}`
}

/**
 * Format volume (K/M/B)
 * @param {number|null} n
 * @returns {string}
 */
export function formatVolume(n) {
  if (n == null || isNaN(n)) return '—'
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'
  return n.toString()
}

/**
 * Format multiple (e.g., P/E ratio)
 * @param {number|null} n
 * @param {string} suffix
 * @returns {string}
 */
export function formatMultiple(n, suffix = 'x') {
  if (n == null || isNaN(n)) return '—'
  return n.toFixed(1) + suffix
}

// ─── Color helpers ────────────────────────────────────────────────────────────

/**
 * Get color class based on change value
 * @param {number|null} n
 * @returns {string}
 */
export function changeColor(n) {
  if (n == null) return 'text-txt-secondary'
  return n >= 0 ? 'text-gain' : 'text-loss'
}

/**
 * Get plus/minus sign based on value
 * @param {number|null} n
 * @returns {string}
 */
export function changeSign(n) {
  if (n == null) return ''
  return n >= 0 ? '+' : ''
}

/**
 * Get verdict badge class
 * @param {string} v
 * @returns {string}
 */
export function verdictClass(v) {
  if (!v) return ''
  const u = v.toUpperCase()
  if (u === 'BUY' || u === 'STRONG BUY') return 'badge-buy'
  if (u === 'SELL' || u === 'STRONG SELL') return 'badge-sell'
  return 'badge-hold'
}

/**
 * Get sentiment color
 * @param {number} score
 * @returns {string}
 */
export function sentimentColor(score) {
  if (score >= 70) return '#22c55e'
  if (score >= 50) return '#00d4aa'
  if (score >= 35) return '#f59e0b'
  return '#ef4444'
}

/**
 * Get assessment class
 * @param {string} a
 * @returns {string}
 */
export function assessmentClass(a) {
  if (!a) return 'text-txt-secondary'
  const u = a.toUpperCase()
  if (u === 'CHEAP' || u === 'UNDERVALUED' || u === 'EXCELLENT' || u === 'GOOD')
    return 'text-gain'
  if (u === 'EXPENSIVE' || u === 'OVERVALUED' || u === 'POOR') return 'text-loss'
  return 'text-warn'
}

/**
 * Get risk color
 * @param {string} r
 * @returns {string}
 */
export function riskColor(r) {
  if (!r) return 'text-txt-secondary'
  const u = r.toUpperCase()
  if (u === 'LOW') return 'text-gain'
  if (u === 'HIGH') return 'text-loss'
  return 'text-warn'
}

/**
 * Get impact color
 * @param {string} i
 * @returns {string}
 */
export function impactColor(i) {
  if (!i) return 'text-txt-secondary'
  const u = i.toUpperCase()
  if (u === 'POSITIVE') return 'text-gain'
  if (u === 'NEGATIVE') return 'text-loss'
  return 'text-warn'
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

/**
 * Join class names
 * @param {...any} classes
 * @returns {string}
 */
export function clsx(...classes) {
  return classes.filter(Boolean).join(' ')
}

/**
 * Truncate string
 * @param {string} str
 * @param {number} len
 * @returns {string}
 */
export function truncate(str, len = 120) {
  if (!str) return ''
  return str.length > len ? str.slice(0, len) + '…' : str
}

/**
 * Get exchange region code
 * @param {string} exchange
 * @returns {string}
 */
export function getExchangeFlag(exchange) {
  if (!exchange) return ''
  const e = exchange.toUpperCase()
  if (e.includes('NSE') || e.includes('BSE')) return 'IN'
  if (e.includes('LSE') || e.includes('LONDON')) return 'UK'
  if (e.includes('TSX')) return 'CA'
  if (e.includes('ASX')) return 'AU'
  if (e.includes('HKEX') || e.includes('HONG')) return 'HK'
  if (e.includes('TSE') || e.includes('TOKYO')) return 'JP'
  return 'US'
}
