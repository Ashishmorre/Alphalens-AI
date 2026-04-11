/**
 * Library Index
 * Export all shared utilities from the lib directory
 */

// Environment configuration
export {
  env,
  isProduction,
  isDevelopment,
  hasCerebrasKey,
  hasGroqKey,
} from './env';

// Error handling
export {
  withErrorHandler,
  withErrorHandlerSync,
  createResponse,
  createErrorResponse,
  safeParse,
  safeParseAsync,
  AppError,
  ValidationError,
  RateLimitError,
  NotFoundError,
  ExternalServiceError,
  ConfigurationError,
  type ApiResponse,
} from './error-handler';

// Rate limiting
export {
  checkRateLimit,
  getRateLimitStatus,
  getClientIP,
  createRateLimitHeaders,
  type LimiterType,
  type RateLimitResult,
} from './rate-limiter';
