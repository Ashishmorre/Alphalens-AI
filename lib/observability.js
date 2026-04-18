/**
 * Observability utilities
 * Request logging, metrics collection, and performance monitoring
 */

import crypto from 'crypto'

/**
 * Generate unique request ID (duplicated here to avoid circular import)
 * @returns {string}
 */
function generateRequestId() {
  const randomBytes = crypto.randomBytes(6).toString('base64url')
  return `${Date.now().toString(36)}-${randomBytes}`
}

/**
 * Log levels
 */
export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
}

const CURRENT_LEVEL = process.env.LOG_LEVEL
  ? LogLevel[process.env.LOG_LEVEL.toUpperCase()]
  : LogLevel.INFO

/**
 * Structured logger
 * @param {string} level - Log level
 * @param {string} component - Component name
 * @param {string} message - Log message
 * @param {Object} meta - Additional metadata
 */
export function log(level, component, message, meta = {}) {
  if (LogLevel[level] < CURRENT_LEVEL) return

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    component,
    message,
    ...meta,
  }

  // In production, you might send to a logging service
  if (process.env.NODE_ENV === 'production') {
    console.log(JSON.stringify(entry))
  } else {
    const color = {
      DEBUG: '\x1b[36m',
      INFO: '\x1b[32m',
      WARN: '\x1b[33m',
      ERROR: '\x1b[31m',
    }[level] || '\x1b[0m'

    // Filter out sensitive fields before logging
    const sanitizedMeta = { ...meta }
    const sensitiveFields = ['apiKey', 'token', 'secret', 'password', 'auth', 'key', 'signature', 'hash']
    sensitiveFields.forEach(field => {
      if (field in sanitizedMeta) {
        sanitizedMeta[field] = '[REDACTED]'
      }
    })

    console.log(
      `${color}[${entry.timestamp}] [${level}] [${component}]\x1b[0m ${message}`,
      Object.keys(sanitizedMeta).length ? sanitizedMeta : ''
    )
  }
}

/**
 * Request logger middleware
 * Logs incoming requests and their duration
 * @param {Request} request - Incoming request
 * @param {Object} context - Request context
 * @returns {{ requestId: string, startTime: number, log: Function }}
 */
export function createRequestLogger(request, context = {}) {
  const requestId = generateRequestId()
  const url = new URL(request.url)
  const startTime = performance.now()

  const entry = {
    requestId,
    method: request.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    ua: request.headers.get('user-agent')?.slice(0, 100),
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
    ...context,
  }

  log('INFO', 'Request', `${request.method} ${url.pathname}`, entry)

  return {
    requestId,
    startTime,
    log: (level, message, meta = {}) => {
      log(level, 'Request', message, { requestId, ...meta })
    },
    finish: (response, error = null) => {
      const duration = Math.round(performance.now() - startTime)
      const status = response?.status || (error ? 500 : 200)

      log(
        duration > 5000 ? 'WARN' : 'INFO',
        'Response',
        `${request.method} ${url.pathname} ${status} in ${duration}ms`,
        {
          requestId,
          status,
          duration,
          ...(error && { error: error.message }),
        }
      )

      return { requestId, duration, status }
    },
  }
}

/**
 * Metrics collector
 * Simple in-memory metrics (consider using Prometheus for production)
 */
class MetricsCollector {
  constructor() {
    this.counters = new Map()
    this.timers = new Map()
    this.gauges = new Map()
    this.histograms = new Map()
  }

  /**
   * Increment a counter
   * @param {string} name - Metric name
   * @param {number} value - Amount to increment
   * @param {Object} labels - Labels for the metric
   */
  counter(name, value = 1, labels = {}) {
    const key = `${name}:${JSON.stringify(labels)}`
    const current = this.counters.get(key) || 0
    this.counters.set(key, current + value)
  }

  /**
   * Record a timer value
   * @param {string} name - Metric name
   * @param {number} value - Timer value in ms
   * @param {Object} labels - Labels for the metric
   */
  timing(name, value, labels = {}) {
    const key = `${name}:${JSON.stringify(labels)}`
    const existing = this.timers.get(key) || []
    existing.push(value)
    // Keep last 100 values
    if (existing.length > 100) existing.shift()
    this.timers.set(key, existing)
  }

  /**
   * Set a gauge value
   * @param {string} name - Metric name
   * @param {number} value - Gauge value
   * @param {Object} labels - Labels for the metric
   */
  gauge(name, value, labels = {}) {
    const key = `${name}:${JSON.stringify(labels)}`
    this.gauges.set(key, value)
  }

  /**
   * Record a histogram value
   * @param {string} name - Metric name
   * @param {number} value - Value to record
   * @param {Object} labels - Labels for the metric
   */
  histogram(name, value, labels = {}) {
    const key = `${name}:${JSON.stringify(labels)}`
    const buckets = this.histograms.get(key) || {
      count: 0,
      sum: 0,
      min: Infinity,
      max: -Infinity,
    }

    buckets.count++
    buckets.sum += value
    buckets.min = Math.min(buckets.min, value)
    buckets.max = Math.max(buckets.max, value)

    this.histograms.set(key, buckets)
  }

  /**
   * Get all metrics as a summary
   * @returns {Object}
   */
  summarize() {
    // Use Object.create(null) to prevent prototype pollution
    const summary = Object.create(null)

    // Counters
    for (const [key, value] of this.counters) {
      const [name, labelsStr] = key.split(':')
      summary[`counter_${name}`] = {
        value,
        labels: JSON.parse(labelsStr),
      }
    }

    // Timers with aggregates
    for (const [key, values] of this.timers) {
      const [name, labelsStr] = key.split(':')
      const sorted = [...values].sort((a, b) => a - b)
      summary[`timer_${name}`] = {
        count: values.length,
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        labels: JSON.parse(labelsStr),
      }
    }

    // Gauges
    for (const [key, value] of this.gauges) {
      const [name, labelsStr] = key.split(':')
      summary[`gauge_${name}`] = { value, labels: JSON.parse(labelsStr) }
    }

    // Histograms
    for (const [key, buckets] of this.histograms) {
      const [name, labelsStr] = key.split(':')
      summary[`histogram_${name}`] = {
        ...buckets,
        avg: buckets.sum / buckets.count,
        labels: JSON.parse(labelsStr),
      }
    }

    return summary
  }

  /**
   * Export metrics in Prometheus format
   * @returns {string}
   */
  toPrometheus() {
    const lines = []

    // Counters
    for (const [key, value] of this.counters) {
      const [name, labelsStr] = key.split(':')
      const labels = JSON.parse(labelsStr)
      const labelStr = Object.entries(labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',')
      lines.push(`api_${name}_total{${labelStr}} ${value}`)
    }

    // Gauges
    for (const [key, value] of this.gauges) {
      const [name, labelsStr] = key.split(':')
      const labels = JSON.parse(labelsStr)
      const labelStr = Object.entries(labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',')
      lines.push(`api_${name}{${labelStr}} ${value}`)
    }

    return lines.join('\n')
  }
}

// Singleton metrics instance
export const metrics = new MetricsCollector()

/**
 * Time a function execution
 * @template T
 * @param {string} name - Metric name
 * @param {() => T} fn - Function to time
 * @param {Object} labels - Labels
 * @returns {Promise<T>}
 */
export async function withTiming(name, fn, labels = {}) {
  const start = performance.now()
  try {
    return await fn()
  } finally {
    const duration = performance.now() - start
    metrics.timing(name, duration, labels)
    metrics.histogram(`${name}_hist`, duration, labels)
  }
}

/**
 * Health check status
 * @returns {{ status: 'healthy' | 'degraded' | 'unhealthy', checks: Object }}
 */
export async function healthCheck() {
  const checks = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    versions: process.versions,
  }

  // Check if critical services are available
  let degraded = false

  // AI providers check - currently only NVIDIA NIM is supported
  const hasAI = Boolean(process.env.NVIDIA_API_KEY)
  if (!hasAI) {
    degraded = true
    checks.ai = 'unavailable'
  } else {
    checks.ai = 'available'
  }

  return {
    status: degraded ? 'degraded' : 'healthy',
    checks,
  }
}

/**
 * Middleware to track API metrics
 * @param {Function} handler - API route handler
 * @param {string} routeName - Name of the route
 * @returns {Function}
 */
export function withMetrics(handler, routeName) {
  return async function (request, context) {
    const logger = createRequestLogger(request, { route: routeName })

    try {
      const response = await handler(request, {
        ...context,
        logger,
        requestId: logger.requestId,
      })

      logger.finish(response)

      // Track metrics
      metrics.counter('requests_total', 1, {
        route: routeName,
        method: request.method,
        status: response.status,
      })

      return response
    } catch (error) {
      logger.finish(null, error)

      // Track error metrics
      metrics.counter('errors_total', 1, {
        route: routeName,
        error: error.name || 'UnknownError',
      })

      throw error
    }
  }
}
