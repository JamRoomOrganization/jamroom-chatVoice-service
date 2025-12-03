import { Express } from 'express';
import { registerHealthRoutes } from './health.routes';
import { registerDebugRoutes } from './debug.routes';
import { registerVoiceRoutes } from './voiceSession.routes';
import { registerInternalRoutes } from './internal.routes';
import { registerMetricsRoutes } from './metrics.routes';
import { registerVoiceModerationRoutes } from './voiceModeration.routes';

/**
 * Registers all application routes.
 *
 * This is the centralized place for route registration.
 * Add new route modules here as the service grows.
 *
 * Current routes:
 * - Health routes (/healthz, /readyz)
 * - Debug routes (/debug/echo) - demonstrates validation
 * - Voice routes (/api/v1/voice/*) - voice session management
 * - Voice moderation routes (/api/v1/voice/moderation/*) - internal moderation
 * - Internal routes (/internal/*) - maintenance operations
 * - Metrics routes (/metrics) - Prometheus metrics export
 *
 * Future routes (examples):
 * - Chat routes (/api/v1/chat/*)
 * - Room routes (/api/v1/rooms/*)
 *
 * @param app - Express application instance
 */
export function registerRoutes(app: Express): void {
  // Health check routes (no prefix, at root level)
  registerHealthRoutes(app);

  // Debug routes (for development/testing)
  registerDebugRoutes(app);

  // Voice session routes (REST API v1)
  registerVoiceRoutes(app);

  // Voice moderation routes (internal, protected by API key)
  registerVoiceModerationRoutes(app);

  // Internal maintenance routes (ops, cron jobs)
  registerInternalRoutes(app);

  // Metrics routes (Prometheus scraping)
  registerMetricsRoutes(app);

  // Future route registrations:
  // registerChatRoutes(app);
  // registerRoomRoutes(app);
}

export { registerHealthRoutes, createHealthRouter } from './health.routes';
export { registerDebugRoutes, createDebugRouter } from './debug.routes';
export { registerVoiceRoutes, createVoiceRouter } from './voiceSession.routes';
export { registerInternalRoutes, createInternalRouter } from './internal.routes';
export { registerMetricsRoutes, createMetricsRouter } from './metrics.routes';
export { registerVoiceModerationRoutes, createVoiceModerationRouter } from './voiceModeration.routes';
