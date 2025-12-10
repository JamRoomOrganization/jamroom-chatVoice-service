/**
 * @module metrics.controller
 * @description Controller handlers for metrics endpoint.
 *
 * Endpoints:
 * - GET /metrics - Export metrics in Prometheus format
 *
 * These endpoints are designed for:
 * - Prometheus scraping
 * - Monitoring systems
 * - Observability tooling
 */

import { Request, Response } from 'express';
import { metrics } from '../services/metrics';
import { buildSuccessResponse, createMeta } from '../utils/response';

// ============================================================================
// HANDLERS
// ============================================================================

/**
 * Exports metrics in Prometheus text format.
 *
 * GET /metrics
 *
 * Response (200 OK):
 * ```text
 * # HELP voice_sessions_created_total Total number of voice sessions created
 * # TYPE voice_sessions_created_total counter
 * voice_sessions_created_total 42
 * ...
 * ```
 */
export function getPrometheusMetrics(req: Request, res: Response): void {
  const prometheusOutput = metrics.export();
  
  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.status(200).send(prometheusOutput);
}

/**
 * Exports metrics in JSON format.
 *
 * GET /metrics/json
 *
 * Response (200 OK):
 * ```json
 * {
 *   "data": {
 *     "counters": { ... },
 *     "histograms": { ... }
 *   },
 *   "error": null,
 *   "meta": { "requestId": "<uuid>", "timestamp": "<ISO8601>" }
 * }
 * ```
 */
export function getJsonMetrics(req: Request, res: Response): void {
  const summary = metrics.summary();
  const response = buildSuccessResponse(summary, createMeta(req));
  res.status(200).json(response);
}
