import { validateEnv, type EnvConfig } from './env';

/**
 * LiveKit configuration interface.
 * All fields are optional since LiveKit integration is optional.
 * The livekitAdapter will throw DEPENDENCY_UNAVAILABLE if called without config.
 */
export interface LiveKitConfig {
  apiKey?: string;
  apiSecret?: string;
  wsUrl?: string;
  tokenTtlSeconds: number;
}

/**
 * Application configuration interface.
 * Extends validated environment config with any computed/derived values.
 */
export interface AppConfig extends Omit<EnvConfig, 'LIVEKIT_API_KEY' | 'LIVEKIT_API_SECRET' | 'LIVEKIT_URL' | 'LIVEKIT_TOKEN_TTL_SECONDS' | 'INTERNAL_API_KEY'> {
  /**
   * Service name for identification in logs and health checks.
   */
  serviceName: string;

  /**
   * Whether the application is running in production mode.
   */
  isProduction: boolean;

  /**
   * Whether the application is running in development mode.
   */
  isDevelopment: boolean;

  /**
   * Whether the application is running in test mode.
   */
  isTest: boolean;

  /**
   * LiveKit configuration for voice/video functionality.
   * May be partially configured - check individual fields before use.
   */
  livekit: LiveKitConfig;

  /**
   * Internal API key for service-to-service authentication.
   * Used for moderation endpoints called by sync-service.
   */
  internalApiKey?: string;
}

/**
 * Creates the application configuration from validated environment.
 */
function createConfig(): AppConfig {
  const env = validateEnv();

  return {
    PORT: env.PORT,
    NODE_ENV: env.NODE_ENV,
    serviceName: 'chatVoice-service',
    isProduction: env.NODE_ENV === 'production',
    isDevelopment: env.NODE_ENV === 'development',
    isTest: env.NODE_ENV === 'test',
    livekit: {
      apiKey: env.LIVEKIT_API_KEY,
      apiSecret: env.LIVEKIT_API_SECRET,
      wsUrl: env.LIVEKIT_URL, // Changed from LIVEKIT_WS_URL to LIVEKIT_URL
      tokenTtlSeconds: env.LIVEKIT_TOKEN_TTL_SECONDS ?? 3600,
    },
    internalApiKey: env.INTERNAL_API_KEY,
  };
}

/**
 * Singleton configuration object.
 * Validates environment on first access and caches the result.
 */
export const config: AppConfig = createConfig();

export { validateEnv } from './env';
export type { EnvConfig } from './env';
