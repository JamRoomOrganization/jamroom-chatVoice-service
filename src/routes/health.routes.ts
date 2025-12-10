import { Router } from 'express';
import { healthCheck, readinessCheck } from '../controllers/health.controller';

/**
 * Creates and configures the health routes router.
 *
 * Routes:
 * - GET /healthz - Basic health check
 * - GET /readyz - Readiness check (for orchestrators)
 *
 * @returns Configured Express Router with health routes
 */
export function createHealthRouter(): Router {
  const router = Router();

  /**
   * GET /healthz
   * Basic health check endpoint.
   * Returns 200 OK if the service is running.
   */
  router.get('/healthz', healthCheck);
  router.get('/health', healthCheck);

  /**
   * GET /readyz
   * Readiness check endpoint.
   * Returns 200 OK if the service is ready to accept traffic.
   * Can be extended to check dependencies in the future.
   */
  router.get('/readyz', readinessCheck);

  return router;
}

/**
 * Registers health routes on an Express application.
 *
 * @param app - Express application or router to register routes on
 */
export function registerHealthRoutes(app: Router): void {
  const healthRouter = createHealthRouter();
  app.use('/', healthRouter);
}
