/**
 * Rate Limiter
 * Upstash Redis-based rate limiting for API protection
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { env } from './env';
import { RateLimitError } from './error-handler';

// Redis client singleton
let redis: Redis;

function getRedisClient(): Redis {
  if (!redis) {
    redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

// Rate limiter instances
let standardLimiter: Ratelimit;
let aiAnalysisLimiter: Ratelimit;
let stockDataLimiter: Ratelimit;

/**
 * Rate limiter types
 */
export type LimiterType = 'standard' | 'ai-analysis' | 'stock-data';

/**
 * Initialize rate limiters
 */
function initRateLimiters(): void {
  const redis = getRedisClient();

  // Standard limiter: 5 requests per minute
  // Used for most endpoints
  standardLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '1 m'),
    analytics: true,
    prefix: '@upstash/ratelimit/alphalens/standard',
  });

  // AI Analysis limiter: 3 requests per minute
  // More restrictive due to AI API costs
  aiAnalysisLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, '1 m'),
    analytics: true,
    prefix: '@upstash/ratelimit/alphalens/ai',
  });

  // Stock data limiter: 10 requests per minute
  // More lenient as Yahoo data is cheaper
  stockDataLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    analytics: true,
    prefix: '@upstash/ratelimit/alphalens/stock',
  });
}

/**
 * Get the appropriate rate limiter
 */
function getLimiter(type: LimiterType): Ratelimit {
  if (!standardLimiter) {
    initRateLimiters();
  }

  switch (type) {
    case 'ai-analysis':
      return aiAnalysisLimiter;
    case 'stock-data':
      return stockDataLimiter;
    case 'standard':
    default:
      return standardLimiter;
  }
}

/**
 * Extract IP address from request
 * Handles various proxy configurations
 */
export function getClientIP(req: Request): string {
  // Try X-Forwarded-For first (most common with proxies)
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    // X-Forwarded-For can contain multiple IPs, take the first
    return forwarded.split(',')[0].trim();
  }

  // Try other common headers
  const realIP = req.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // CF-Connecting-IP for Cloudflare
  const cfIP = req.headers.get('cf-connecting-ip');
  if (cfIP) {
    return cfIP;
  }

  // Fallback to a default (for local development)
  // In production, this should never happen if properly configured
  return '127.0.0.1';
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

/**
 * Check rate limit for a request
 * @throws RateLimitError if rate limit exceeded
 */
export async function checkRateLimit(
  req: Request,
  type: LimiterType = 'standard'
): Promise<RateLimitResult> {
  const limiter = getLimiter(type);
  const ip = getClientIP(req);
  const identifier = `${type}:${ip}`;

  const { success, limit, remaining, reset } = await limiter.limit(identifier);

  // Calculate retryAfter (if rate limited)
  const retryAfter = success ? undefined : Math.ceil((reset - Date.now()) / 1000);

  if (!success) {
    throw new RateLimitError(
      `Rate limit exceeded for ${type}. Try again in ${retryAfter || 60} seconds.`,
      retryAfter || 60
    );
  }

  return {
    success,
    limit,
    remaining,
    reset,
    retryAfter,
  };
}

/**
 * Get rate limit info without consuming a token
 * Useful for displaying remaining quota
 */
export async function getRateLimitStatus(
  req: Request,
  type: LimiterType = 'standard'
): Promise<{ limit: number; remaining: number }> {
  const limiter = getLimiter(type);
  const ip = getClientIP(req);
  const identifier = `${type}:${ip}`;

  // Get current limit
  const redis = getRedisClient();
  const key = `@upstash/ratelimit/alphalens/${type}:${ip}`;
  const current = await redis.get<number>(key);

  // This is a simplified check - full ratelimit object is used for actual limiting
  // For accurate status, we still need to check the actual Redis key
  const limits = {
    standard: 5,
    'ai-analysis': 3,
    'stock-data': 10,
  };

  const limit = limits[type];
  const used = typeof current === 'number' ? current : 0;

  return {
    limit,
    remaining: Math.max(0, limit - used),
  };
}

/**
 * Middleware to add rate limit headers to response
 * This is a helper for manually adding headers
 */
export function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.reset),
  };
}
