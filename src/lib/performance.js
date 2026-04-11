/**
 * Performance utilities
 * Collection of helpers for optimizing application performance
 */

import { getOrSet, CACHE_TTL } from './cache.js'
import { dedupe } from './dedupe.js'

// Re-export for convenience
export { getOrSet, CACHE_TTL, dedupe }

/**
 * Memoize a function with TTL
 * @template T
 * @param {(...args: any[]) => Promise<T>} fn - Function to memoize
 * @param {number} ttl - Time to live in milliseconds
 * @param {(...args: any[]) => string} makeKey - Key generator function
 * @returns {(...args: any[]) => Promise<T>}
 *
 * @example
 * const memoizedFetch = memoize(
 *   fetchStockData,
 *   30000,
 *   (ticker) => `stock:${ticker}`
 * )
 */
export function memoize(fn, ttl = CACHE_TTL.medium, makeKey = JSON.stringify) {
  return async (...args) => {
    const key = makeKey(...args)
    return getOrSet(key, () => fn(...args), ttl)
  }
}

/**
 * Create a cached and deduplicated version of a function
 * Combines caching and deduplication for optimal performance
 *
 * @template T
 * @param {(...args: any[]) => Promise<T>} fn - Function to optimize
 * @param {Object} options - Options
 * @param {number} options.ttl - Cache TTL in milliseconds
 * @param {(...args: any[]) => string} options.makeKey - Key generator
 * @param {string} options.prefix - Key prefix for deduplication
 * @returns {(...args: any[]) => Promise<T>}
 *
 * @example
 * const optimizedFetch = optimize(
 *   fetchStockData,
 *   { ttl: 30000, prefix: 'stock' }
 * )
 */
export function optimize(
  fn,
  { ttl = CACHE_TTL.medium, makeKey = JSON.stringify, prefix = '' }
) {
  return async (...args) => {
    const key = `${prefix}:${makeKey(...args)}`
    // First check cache, then dedupe
    const cached = await getOrSet(key, () => dedupe(key, () => fn(...args)), ttl)
    return cached
  }
}

/**
 * Debounce a function
 * @template T
 * @param {(...args: any[]) => T} fn - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {(...args: any[]) => void}
 */
export function debounce(fn, wait = 300) {
  let timeout
  return (...args) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => fn(...args), wait)
  }
}

/**
 * Throttle a function
 * @template T
 * @param {(...args: any[]) => T} fn - Function to throttle
 * @param {number} limit - Milliseconds between calls
 * @returns {(...args: any[]) => T | undefined}
 */
export function throttle(fn, limit = 100) {
  let inThrottle
  return (...args) => {
    if (!inThrottle) {
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
      return fn(...args)
    }
  }
}

/**
 * Measure execution time of a function
 * @template T
 * @param {string} label - Label for the timing
 * @param {() => Promise<T>} fn - Function to measure
 * @returns {Promise<T>}
 */
export async function measureTime(label, fn) {
  const start = performance.now()
  try {
    return await fn()
  } finally {
    const duration = performance.now() - start
    console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`)
  }
}

/**
 * Prefetch API data (for client-side use)
 * @param {string} url - URL to prefetch
 */
export function prefetch(url) {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    requestIdleCallback(() => {
      fetch(url, { method: 'HEAD' }).catch(() => {
        // Ignore errors
      })
    })
  }
}

/**
 * Create a lazy executor that processes items in batches
 * @template T
 * @param {T[]} items - Items to process
 * @param {(item: T) => Promise<any>} processor - Processor function
 * @param {number} concurrency - Max concurrent operations
 * @returns {Promise<any[]>}
 */
export async function batchProcess(items, processor, concurrency = 3) {
  const results = []
  const executing = new Set()

  for (const item of items) {
    const promise = processor(item).then((result) => {
      executing.delete(promise)
      return result
    })

    results.push(promise)
    executing.add(promise)

    if (executing.size >= concurrency) {
      await Promise.race(executing)
    }
  }

  return Promise.all(results)
}
