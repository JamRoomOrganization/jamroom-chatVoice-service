import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file FIRST
// Skip in test environment to allow tests to control env vars
if (process.env.NODE_ENV !== 'test') {
  dotenvConfig();
}

/**
 * Schema for validating environment variables using Zod.
 * All configuration must come from environment variables (12-factor app principle).
 */
const envSchema = z.object({
  /**
   * Server port number.
   * Defaults to 3000 if not specified.
   */
  PORT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0 && val < 65536, {
      message: 'PORT must be a valid port number (1-65535)',
    })
    .default('3002'),

  /**
   * Node environment.
   * Determines logging level and other environment-specific behaviors.
   */
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  CORS_ORIGIN: z
    .string()
    .default('http://localhost:3000'),

  // =========================================================================
  // LIVEKIT CONFIGURATION (Optional - required only for voice features)
  // =========================================================================

  /**
   * LiveKit API Key for authentication.
   * Optional - required only when using voice session features.
   */
  LIVEKIT_API_KEY: z.string().min(1, 'LIVEKIT_API_KEY is required').optional(),

  /**
   * LiveKit API Secret for signing tokens.
   * Optional - required only when using voice session features.
   */
  LIVEKIT_API_SECRET: z
    .string()
    .min(1, 'LIVEKIT_API_SECRET is required')
    .optional(),

  /**
   * LiveKit WebSocket URL (standard LiveKit variable name).
   * The URL clients will connect to (e.g., wss://your-livekit.cloud).
   * Optional - required only when using voice session features.
   */
  LIVEKIT_URL: z
    .string()
    .url('LIVEKIT_URL must be a valid URL')
    .refine((url) => url.startsWith('wss://') || url.startsWith('ws://'), {
      message: 'LIVEKIT_URL must be a WebSocket URL (ws:// or wss://)',
    })
    .optional(),

  /**
   * LiveKit token TTL in seconds.
   * Defaults to 3600 (1 hour) if not specified.
   */
  LIVEKIT_TOKEN_TTL_SECONDS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0, {
      message: 'LIVEKIT_TOKEN_TTL_SECONDS must be a positive number',
    })
    .optional(),

  // =========================================================================
  // INTERNAL API CONFIGURATION
  // =========================================================================

  /**
   * Internal API key for service-to-service authentication.
   * Required for moderation endpoints that are called by sync-service.
   */
  INTERNAL_API_KEY: z
    .string()
    .min(16, 'INTERNAL_API_KEY must be at least 16 characters')
    .optional(),
});

/**
 * Type representing the validated environment configuration.
 */
export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validates and parses environment variables.
 * Throws a descriptive error if validation fails.
 *
 * @throws {Error} If required environment variables are missing or invalid.
 * @returns {EnvConfig} The validated environment configuration.
 */
export function validateEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formattedErrors = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `Environment validation failed:\n${formattedErrors}\n\n` +
        'Please check your environment variables and ensure all required values are set correctly.\n' +
        'See .env.example for reference.'
    );
  }

  return result.data;
}

export { envSchema };
