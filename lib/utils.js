// ─── Number formatting ────────────────────────────────────────────────────────

export function formatNumber(n, decimals = 2) {
  if (n == null || isNaN(n)) return '—'
  if (Math.abs(n) >= 1e12) return '$' + (n / 1e12).toFixed(decimals) + 'T'
  if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(decimals) + 'B'
  if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(decimals) + 'M'
  if (Math.abs(n) >= 1e3) return '$' + (n / 1e3).toFixed(decimals) + 'K'
  return '$' + n.toFixed(decimals)
}

export function formatPlain(n, decimals = 2) {
  if (n == null || isNaN(n)) return '—'
  if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(decimals) + 'T'
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(decimals) + 'B'
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(decimals) + 'M'
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(decimals) + 'K'
  return n.toFixed(decimals)
}

export function formatPct(n, decimals = 1) {
  if (n == null || isNaN(n)) return '—'
  return (n * 100).toFixed(decimals) + '%'
}

export function formatPrice(n) {
  if (n == null || isNaN(n)) return '—'
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatVolume(n) {
  if (n == null || isNaN(n)) return '—'
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'
  return n.toString()
}

export function formatMultiple(n, suffix = 'x') {
  if (n == null || isNaN(n)) return '—'
  return n.toFixed(1) + suffix
}

// ─── Color helpers ────────────────────────────────────────────────────────────

export function changeColor(n) {
  if (n == null) return 'text-txt-secondary'
  return n >= 0 ? 'text-gain' : 'text-loss'
}

export function changeSign(n) {
  if (n == null) return ''
  return n >= 0 ? '+' : ''
}

export function verdictClass(v) {
  if (!v) return ''
  const u = v.toUpperCase()
  if (u === 'BUY' || u === 'STRONG BUY') return 'badge-buy'
  if (u === 'SELL' || u === 'STRONG SELL') return 'badge-sell'
  return 'badge-hold'
}

export function sentimentColor(score) {
  if (score >= 70) return '#22c55e'
  if (score >= 50) return '#00d4aa'
  if (score >= 35) return '#f59e0b'
  return '#ef4444'
}

export function assessmentClass(a) {
  if (!a) return 'text-txt-secondary'
  const u = a.toUpperCase()
  if (u === 'CHEAP' || u === 'UNDERVALUED' || u === 'EXCELLENT' || u === 'GOOD') return 'text-gain'
  if (u === 'EXPENSIVE' || u === 'OVERVALUED' || u === 'POOR') return 'text-loss'
  return 'text-warn'
}

export function riskColor(r) {
  if (!r) return 'text-txt-secondary'
  const u = r.toUpperCase()
  if (u === 'LOW') return 'text-gain'
  if (u === 'HIGH') return 'text-loss'
  return 'text-warn'
}

export function impactColor(i) {
  if (!i) return 'text-txt-secondary'
  if (i.toUpperCase() === 'POSITIVE') return 'text-gain'
  if (i.toUpperCase() === 'NEGATIVE') return 'text-loss'
  return 'text-warn'
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

export function clsx(...classes) {
  return classes.filter(Boolean).join(' ')
}

export function truncate(str, len = 120) {
  if (!str) return ''
  return str.length > len ? str.slice(0, len) + '…' : str
}

export function getExchangeFlag(exchange) {
  if (!exchange) return ''
  const e = exchange.toUpperCase()
  if (e.includes('NSE') || e.includes('BSE')) return '🇮🇳'
  if (e.includes('LSE') || e.includes('LONDON')) return '🇬🇧'
  if (e.includes('TSX')) return '🇨🇦'
  if (e.includes('ASX')) return '🇦🇺'
  if (e.includes('HKEX') || e.includes('HONG')) return '🇭🇰'
  if (e.includes('TSE') || e.includes('TOKYO')) return '🇯🇵'
  return '🇺🇸'
}
