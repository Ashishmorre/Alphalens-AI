'use client'

import { createContext, useContext, useMemo } from 'react'

const CurrencyContext = createContext(undefined)

const CURRENCY_SYMBOLS = {
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
  USD: '$',
}

const CURRENCY_LOCALES = {
  INR: 'en-IN',
  GBP: 'en-GB',
  EUR: 'de-DE',
  JPY: 'ja-JP',
  CNY: 'zh-CN',
  CAD: 'en-CA',
  AUD: 'en-AU',
  HKD: 'zh-HK',
  SGD: 'en-SG',
  CHF: 'de-CH',
  USD: 'en-US',
}

export function CurrencyProvider({ children, ticker, currency: explicitCurrency }) {
  const currency = useMemo(() => {
    if (explicitCurrency) return explicitCurrency
    if (ticker?.endsWith('.NS')) return 'INR'
    if (ticker?.endsWith('.BO')) return 'INR'
    if (ticker?.endsWith('.JK')) return 'IDR'
    if (ticker?.endsWith('.AX')) return 'AUD'
    if (ticker?.endsWith('.L')) return 'GBP'
    if (ticker?.endsWith('.PA')) return 'EUR'
    if (ticker?.endsWith('.HK')) return 'HKD'
    if (ticker?.endsWith('.TO')) return 'CAD'
    if (ticker?.endsWith('.MI')) return 'EUR'
    if (ticker?.endsWith('.DE')) return 'EUR'
    return 'USD'
  }, [ticker, explicitCurrency])

  const symbol = CURRENCY_SYMBOLS[currency] || '$'
  const locale = CURRENCY_LOCALES[currency] || 'en-US'

  const normalizeToAbsolute = (value, scale = 1) => {
    if (typeof value === 'string') {
      const clean = value.replace(/[^-0-9.]/g, '')
      const parsed = parseFloat(clean)
      if (isNaN(parsed)) return 0
      return parsed * scale
    }
    if (typeof value === 'number') {
      if (isNaN(value)) return 0
      return value * scale
    }
    return 0
  }

  const formatNumber = (value, options = {}) => {
    const { maximumFractionDigits = 2, minimumFractionDigits = 0 } = options
    const absValue = normalizeToAbsolute(value, 1)

    // Determine appropriate suffix
    let displayValue = absValue
    let displaySuffix = ''

    if (absValue >= 1e12) {
      displayValue = absValue / 1e12
      displaySuffix = 'T'
    } else if (absValue >= 1e9) {
      displayValue = absValue / 1e9
      displaySuffix = 'B'
    } else if (absValue >= 1e6) {
      displayValue = absValue / 1e6
      displaySuffix = 'M'
    } else if (absValue >= 1e3) {
      displayValue = absValue / 1e3
      displaySuffix = 'K'
    }

    const formatted = displayValue.toLocaleString(locale, {
      maximumFractionDigits,
      minimumFractionDigits,
    })

    return `${symbol}${formatted}${displaySuffix}`
  }

  const formatPrice = (value, fractionDigits = 2) => {
    const absValue = normalizeToAbsolute(value, 1)
    const formatted = absValue.toLocaleString(locale, {
      maximumFractionDigits: fractionDigits,
      minimumFractionDigits: fractionDigits,
    })
    return `${symbol}${formatted}`
  }

  const formatPercentage = (value, fractionDigits = 1) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value
    if (isNaN(numValue)) return '—%'
    const prefix = numValue > 0 ? '+' : ''
    const formatted = numValue.toLocaleString(locale, {
      maximumFractionDigits: fractionDigits,
      minimumFractionDigits: fractionDigits,
    })
    return `${prefix}${formatted}%`
  }

  const value = {
    currency,
    symbol,
    locale,
    normalizeToAbsolute,
    formatNumber,
    formatPrice,
    formatPercentage,
  }

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export function useCurrency() {
  const context = useContext(CurrencyContext)
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider')
  }
  return context
}

export default CurrencyContext
