/**
 * Performance hooks for React components
 * Client-side caching, prefetching, and optimized data fetching
 */

'use client'

import { useCallback, useRef, useEffect, useState } from 'react'

/**
 * Cache duration constants (in milliseconds)
 */
export const CACHE_DURATION = {
  STOCK_DATA: 30000, // 30 seconds
  ANALYSIS: 300000, // 5 minutes
  COMPARE: 120000, // 2 minutes
  SHORT: 10000, // 10 seconds
  MEDIUM: 60000, // 1 minute
  LONG: 300000, // 5 minutes
}

/**
 * Client-side cache for API responses
 * Use sessionStorage for persistence across page reloads
 */
class ClientCache {
  constructor() {
    this.memory = new Map()
    this.enabled = typeof window !== 'undefined'
  }

  get(key) {
    // Try memory first
    const memEntry = this.memory.get(key)
    if (memEntry && Date.now() - memEntry.time < memEntry.ttl) {
      return memEntry.data
    }
    if (memEntry) this.memory.delete(key)

    // Try sessionStorage
    if (this.enabled) {
      try {
        const stored = sessionStorage.getItem(`cache:${key}`)
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Date.now() - parsed.time < parsed.ttl) {
            // Restore to memory
            this.memory.set(key, parsed)
            return parsed.data
          }
          sessionStorage.removeItem(`cache:${key}`)
        }
      } catch {
        // Ignore storage errors
      }
    }

    return undefined
  }

  set(key, data, ttl = CACHE_DURATION.MEDIUM) {
    const entry = { data, time: Date.now(), ttl }
    this.memory.set(key, entry)

    if (this.enabled) {
      try {
        sessionStorage.setItem(`cache:${key}`, JSON.stringify(entry))
      } catch {
        // Storage full or unavailable
      }
    }
  }

  clear() {
    this.memory.clear()
    if (this.enabled) {
      try {
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const key = sessionStorage.key(i)
          if (key?.startsWith('cache:')) {
            sessionStorage.removeItem(key)
          }
        }
      } catch {
        // Ignore errors
      }
    }
  }

  cleanup() {
    const now = Date.now()
    for (const [key, entry] of this.memory) {
      if (now - entry.time > entry.ttl) {
        this.memory.delete(key)
      }
    }
  }
}

// Singleton cache instance
const clientCache = typeof window !== 'undefined' ? new ClientCache() : null

/**
 * Hook for cached API calls with automatic deduplication
 *
 * @template T
 * @param {Object} options - Options object
 * @param {string} options.key - Cache key
 * @param {() => Promise<T>} options.fetcher - Async function to fetch data
 * @param {number} options.ttl - Time to live in milliseconds
 * @param {boolean} options.prefetch - Whether to prefetch on mount
 * @returns {{ data: T | null, loading: boolean, error: Error | null, refetch: () => Promise<void> }}
 */
export function useCachedFetch({ key, fetcher, ttl = CACHE_DURATION.MEDIUM, prefetch = false }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const fetchRef = useRef(null)

  const execute = useCallback(async () => {
    // Check cache first
    const cached = clientCache?.get(key)
    if (cached) {
      setData(cached)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await fetcher()
      clientCache?.set(key, result, ttl)
      setData(result)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [key, fetcher, ttl])

  useEffect(() => {
    if (prefetch) {
      execute()
    }
  }, [prefetch, execute])

  const refetch = useCallback(async () => {
    clientCache?.set(key, null, 0) // Invalidate cache
    await execute()
  }, [execute, key])

  return { data, loading, error, refetch }
}

/**
 * Hook for prefetching data when component becomes visible
 * or on user hover intent
 *
 * @param {string} url - URL to prefetch
 * @param {Object} options - Options
 * @param {boolean} options.immediate - Prefetch immediately
 * @param {number} options.delay - Delay in ms before prefetching
 */
export function usePrefetch(url, { immediate = false, delay = 100 } = {}) {
  const prefetchTriggered = useRef(false)

  useEffect(() => {
    if (!immediate || prefetchTriggered.current) return

    const timer = setTimeout(() => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => prefetchUrl(url))
      } else {
        prefetchUrl(url)
      }
    }, delay)

    prefetchTriggered.current = true
    return () => clearTimeout(timer)
  }, [url, immediate, delay])

  const onMouseEnter = useCallback(() => {
    if (!prefetchTriggered.current) {
      prefetchUrl(url)
      prefetchTriggered.current = true
    }
  }, [url])

  return { onMouseEnter }
}

/**
 * Prefetch a URL using HEAD request (lightweight)
 * @param {string} url
 */
export function prefetchUrl(url) {
  if (typeof window === 'undefined') return

  // Don't prefetch if on slow connection
  const connection = navigator.connection
  if (connection?.saveData || connection?.effectiveType === 'slow-2g') {
    return
  }

  // Use link prefetch for GET requests
  const link = document.createElement('link')
  link.rel = 'prefetch'
  link.href = url
  link.as = 'fetch'
  document.head.appendChild(link)

  // Clean up after short delay
  setTimeout(() => link.remove(), 100)
}

/**
 * Batch multiple prefetch requests
 * @param {string[]} urls - URLs to prefetch
 * @param {Object} options - Options
 * @param {number} options.delay - Delay between requests
 */
export function prefetchBatch(urls, { delay = 50 } = {}) {
  urls.forEach((url, i) => {
    setTimeout(() => prefetchUrl(url), i * delay)
  })
}

/**
 * Hook for debounced value (useful for search inputs)
 * @template T
 * @param {T} value - Value to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {T}
 */
export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

/**
 * Hook for measuring component render time (dev only)
 * @param {string} name - Component name
 */
export function useRenderTime(name) {
  if (process.env.NODE_ENV !== 'development') return

  useEffect(() => {
    const start = performance.now()
    return () => {
      const duration = performance.now() - start
      console.log(`[Render] ${name}: ${duration.toFixed(2)}ms`)
    }
  })
}

/**
 * Clear all client-side caches
 */
export function clearClientCache() {
  clientCache?.clear()
}

/**
 * Get cache stats for debugging
 * @returns {{ memory: number, keys: string[] }}
 */
export function getCacheStats() {
  if (!clientCache) return { memory: 0, keys: [] }
  return {
    memory: clientCache.memory.size,
    keys: Array.from(clientCache.memory.keys()),
  }
}
