/**
 * Environment Configuration
 * Validates all required environment variables at startup
 * Fails fast if any required configuration is missing
 */

import { z } from 'zod';

const envSchema = z.object({
  // AI Provider API Keys (at least one is required)
  CEREBRAS_API_KEY: z.string().min(1, 'CEREBRAS_API_KEY must not be empty').optional(),
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY must not be empty').optional(),

  // Upstash Redis Configuration (required for rate limiting)
  UPSTASH_REDIS_REST_URL: z.string().url('UPSTASH_REDIS_REST_URL must be a valid URL'),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1, 'UPSTASH_REDIS_REST_TOKEN is required'),

  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

// Derived schema to enforce at least one AI key
const envWithAiValidation = envSchema.refine(
  (data) => data.CEREBRAS_API_KEY || data.GROQ_API_KEY,
  {
    message: 'At least one AI API key is required. Set either CEREBRAS_API_KEY or GROQ_API_KEY',
    path: ['CEREBRAS_API_KEY'],
  }
);

type EnvSchema = z.infer<typeof envSchema>;

// Parse and validate at module load time
function validateEnv(): EnvSchema {
  const parsed = envWithAiValidation.safeParse({
    CEREBRAS_API_KEY: process.env.CEREBRAS_API_KEY,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    NODE_ENV: process.env.NODE_ENV,
  });

  if (!parsed.success) {
    const errorMessages = parsed.error.errors.map(
      (err) => `  - ${err.path.join('.')}: ${err.message}`
    ).join('\n');

    // Print clear error and exit in production, throw in development
    const errorMessage = `\n❌ Environment validation failed:\n\n${errorMessages}\n\n` +
      `Required environment variables:\n` +
      `  - UPSTASH_REDIS_REST_URL (required)\n` +
      `  - UPSTASH_REDIS_REST_TOKEN (required)\n` +
      `  - CEREBRAS_API_KEY or GROQ_API_KEY (at least one)\n\n` +
      `Please check your .env.local file`;

    throw new Error(errorMessage);
  }

  return parsed.data;
}

/**
 * Environment configuration object
 * Use this instead of process.env directly
 */
export const env = validateEnv();

/**
 * Helper to check if we're in production
 */
export const isProduction = env.NODE_ENV === 'production';

/**
 * Helper to check if we're in development
 */
export const isDevelopment = env.NODE_ENV === 'development';

/**
 * Check if Cerebras is configured
 */
export const hasCerebrasKey = Boolean(env.CEREBRAS_API_KEY);

/**
 * Check if Groq is configured
 */
export const hasGroqKey = Boolean(env.GROQ_API_KEY);
