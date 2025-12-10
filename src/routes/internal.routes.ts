/**
 * @module internal.routes
 * @description Express routes for internal maintenance operations.
 *
 * Base path: /internal
 *
 * Routes:
 * - POST /voice/sessions/renew  - Renew expiring session tokens
 * - GET  /voice/sessions/stats  - Get session expiration statistics
 *
 * These endpoints are designed for:
 * - Ops teams
 * - Cron jobs (Kubernetes CronJob, etc.)
 * - Internal monitoring and tooling
 *
 * NOT for frontend/client consumption.
 */

import { Router } from 'express';
import { validateRequest } from '../middleware/validation';
import { renewSessions, getSessionStats } from '../controllers/internal.controller';
import { RenewSessionsBodySchema } from '../controllers/internal.schemas';

/**
 * Creates and configures the internal routes router.
 *
 * @returns Configured Express Router with internal routes
 */
export function createInternalRouter(): Router {
  const router = Router();

  /**
   * POST /voice/sessions/renew
   * Renews LiveKit tokens for sessions expiring within the threshold.
   *
   * Request body (optional):
   * - thresholdSeconds: number (default: 600) - Renew sessions expiring within this many seconds
   *
   * Response: 200 OK with renewal statistics
   */
  router.post(
    '/voice/sessions/renew',
    validateRequest({ body: RenewSessionsBodySchema }),
    renewSessions
  );

  /**
   * GET /voice/sessions/stats
   * Returns statistics about session expiration states.
   *
   * Response: 200 OK with session statistics
   */
  router.get('/voice/sessions/stats', getSessionStats);

  return router;
}

/**
 * Registers internal routes on an Express application.
 *
 * @param app - Express application or router to register routes on
 */
export function registerInternalRoutes(app: Router): void {
  const internalRouter = createInternalRouter();
  app.use('/internal', internalRouter);
}

// Export schemas for testing
export { RenewSessionsBodySchema } from '../controllers/internal.schemas';
