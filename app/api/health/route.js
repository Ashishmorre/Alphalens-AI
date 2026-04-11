import { NextResponse } from 'next/server'
import { healthCheck, metrics } from '@/lib/observability'
import { stats as cacheStats } from '@/lib/cache'
import { SECURITY_HEADERS } from '@/lib/security'

/**
 * GET /api/health
 * Health check endpoint for monitoring
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const includeMetrics = searchParams.get('metrics') === 'true'
  const includeCache = searchParams.get('cache') === 'true'

  // Run health check
  const health = await healthCheck()

  const response = {
    status: health.status,
    checks: health.checks,
  }

  // Optionally include cache stats
  if (includeCache) {
    response.cache = cacheStats()
  }

  // Optionally include metrics
  if (includeMetrics) {
    response.metrics = metrics.summarize()
  }

  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503

  return NextResponse.json(response, {
    status: statusCode,
    headers: SECURITY_HEADERS,
  })
}

/**
 * GET /api/health/metrics
 * Prometheus-compatible metrics endpoint
 */
export async function POST(request) {
  // This endpoint is for future use (e.g., pushing metrics)
  return NextResponse.json(
    { success: true, message: 'Not implemented' },
    { status: 200, headers: SECURITY_HEADERS }
  )
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
