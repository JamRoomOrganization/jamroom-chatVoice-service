/**
 * @module metrics.routes
 * @description Express routes for metrics endpoints.
 *
 * Base path: /metrics
 *
 * Routes:
 * - GET /         - Export metrics in Prometheus text format
 * - GET /json     - Export metrics in JSON format
 *
 * These endpoints are designed for:
 * - Prometheus scraping
 * - Monitoring dashboards
 * - Observability tooling
 */

import { Router } from 'express';
import { getPrometheusMetrics, getJsonMetrics } from '../controllers/metrics.controller';

/**
 * Creates and configures the metrics routes router.
 *
 * @returns Configured Express Router with metrics routes
 */
export function createMetricsRouter(): Router {
  const router = Router();

  /**
   * GET /
   * Export metrics in Prometheus text format.
   * This is the standard endpoint for Prometheus scraping.
   */
  router.get('/', getPrometheusMetrics);

  /**
   * GET /json
   * Export metrics in JSON format.
   * Useful for debugging and custom dashboards.
   */
  router.get('/json', getJsonMetrics);

  return router;
}

/**
 * Registers metrics routes on an Express application.
 *
 * @param app - Express application or router to register routes on
 */
export function registerMetricsRoutes(app: Router): void {
  const metricsRouter = createMetricsRouter();
  app.use('/metrics', metricsRouter);
}
