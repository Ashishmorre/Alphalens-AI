/**
 * Global Error Handler
 * Standardized error handling for API routes
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * Standard API Response format
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: string | null;
}

/**
 * Custom application errors
 */
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR'
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends AppError {
  constructor(
    message: string,
    public retryAfter: number = 60
  ) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string) {
    super(`External service error: ${service} - ${message}`, 502, 'EXTERNAL_SERVICE_ERROR');
    this.name = 'ExternalServiceError';
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string) {
    super(message, 500, 'CONFIGURATION_ERROR');
    this.name = 'ConfigurationError';
  }
}

/**
 * Create standardized API response
 */
export function createResponse<T>(data: T, statusCode: number = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    { success: true, data, error: null },
    { status: statusCode }
  );
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  error: string,
  statusCode: number = 500,
  additionalHeaders?: Record<string, string>
): NextResponse<ApiResponse> {
  return NextResponse.json(
    { success: false, data: null, error },
    {
      status: statusCode,
      headers: additionalHeaders,
    }
  );
}

/**
 * Format Zod validation errors into human-readable message
 */
function formatZodError(error: z.ZodError): string {
  const issues = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'input';
    return `${path}: ${issue.message}`;
  });
  return `Validation failed: ${issues.join('; ')}`;
}

/**
 * Handle Zod validation
 * Returns { success: true, data } or { success: false, error, response }
 */
export function safeParse<T>(schema: z.ZodSchema<T>, data: unknown):
  | { success: true; data: T }
  | { success: false; error: string; response: NextResponse } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errorMessage = formatZodError(result.error);
  return {
    success: false,
    error: errorMessage,
    response: createErrorResponse(errorMessage, 400),
  };
}

/**
 * Async version of safeParse
 */
export async function safeParseAsync<T>(
  schema: z.ZodSchema<T>,
  data: Promise<unknown>
): Promise<
  | { success: true; data: T }
  | { success: false; error: string; response: NextResponse }
> {
  try {
    const awaited = await data;
    return safeParse(schema, awaited);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse request body';
    return {
      success: false,
      error: message,
      response: createErrorResponse(`Parse error: ${message}`, 400),
    };
  }
}

/**
 * Global error handler wrapper for API routes
 * Usage: export const POST = withErrorHandler(async (req) => { ... })
 */
export function withErrorHandler(
  handler: (req: Request, ...args: unknown[]) => Promise<NextResponse>
) {
  return async (req: Request, ...args: unknown[]): Promise<NextResponse> => {
    try {
      return await handler(req, ...args);
    } catch (error) {
      // Log error for monitoring (but don't expose internals in production)
      console.error('[API Error]', {
        url: req.url,
        method: req.method,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      });

      // Handle specific error types
      if (error instanceof AppError) {
        const headers: Record<string, string> = {};
        if (error instanceof RateLimitError && error.retryAfter) {
          headers['Retry-After'] = String(error.retryAfter);
        }
        return createErrorResponse(error.message, error.statusCode, headers);
      }

      // Handle Zod errors
      if (error instanceof z.ZodError) {
        const message = formatZodError(error);
        return createErrorResponse(message, 400);
      }

      // Generic errors - don't expose details in production
      const isDev = process.env.NODE_ENV === 'development';
      const message = isDev && error instanceof Error
        ? error.message
        : 'An unexpected error occurred';

      return createErrorResponse(message, 500);
    }
  };
}

/**
 * Synchronous wrapper for GET handlers that don't need request body parsing
 */
export function withErrorHandlerSync(
  handler: (req: Request, ...args: unknown[]) => Promise<NextResponse>
) {
  return withErrorHandler(handler);
}
